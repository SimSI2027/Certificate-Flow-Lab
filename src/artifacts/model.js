// Parses the real fixture files into plain data models, and evaluates validation evidence from them.
// Works in browsers and Node (WebCrypto). Only public artifacts are ever handled.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import * as asn1js from 'asn1js';
import { ENV, URLS, OIDS, TEMPLATE_NAMES } from './synthetic.js';

x509.cryptoProvider.set(globalThis.crypto);

const EKU_NAMES = {
  '1.3.6.1.5.5.7.3.1': 'Server Authentication', '1.3.6.1.5.5.7.3.2': 'Client Authentication', '1.3.6.1.5.5.7.3.3': 'Code Signing',
  '1.3.6.1.5.5.7.3.4': 'Secure Email', '1.3.6.1.4.1.311.20.2.2': 'Smart Card Logon', '1.3.6.1.5.2.3.5': 'KDC Authentication'
};
export const SERVER_AUTH = '1.3.6.1.5.5.7.3.1';
const KU_FLAGS = [[1, 'Digital Signature'], [2, 'Non-Repudiation'], [4, 'Key Encipherment'], [8, 'Data Encipherment'], [16, 'Key Agreement'],
  [32, 'Certificate Signing'], [64, 'CRL Signing']];

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
export const colonHex = (h) => h.match(/../g).join(' ');
export function pemToDer(pem) {
  const b64 = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export function splitPem(text) {
  return text.match(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g) ?? [];
}
export function derToPem(der, label) {
  let bin = ''; new Uint8Array(der).forEach((b) => { bin += String.fromCharCode(b); });
  return `-----BEGIN ${label}-----\n${btoa(bin).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
}
const iso = (d) => d.toISOString().replace('.000Z', 'Z');
const sha = async (alg, data) => hex(await crypto.subtle.digest(alg, data));

// ---- Raw ASN.1 summary ----
export function asn1Summary(der, maxDepth = 3, maxLines = 70) {
  const parsed = asn1js.fromBER(der instanceof Uint8Array ? der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) : der);
  const lines = [];
  const walk = (node, depth) => {
    if (lines.length >= maxLines) return;
    const name = node.constructor.name.replace(/^Constructed$/, 'Constructed');
    let extra = '';
    if (name === 'ObjectIdentifier') { const oid = node.valueBlock.toString(); extra = ` ${oid}${EKU_NAMES[oid] ? ` (${EKU_NAMES[oid]})` : ''}`; }
    else if (/String$/.test(name)) extra = ` "${node.valueBlock.value}"`;
    else if (name === 'UTCTime' || name === 'GeneralizedTime') extra = ` ${node.toDate().toISOString()}`;
    else if (name === 'Integer') extra = ` ${hex(node.valueBlock.valueHexView).slice(0, 40)}`;
    else if (name === 'BitString' || name === 'OctetString') extra = ` (${node.valueBlock.valueHexView?.byteLength ?? 0} bytes)`;
    lines.push(`${'  '.repeat(depth)}${name.toUpperCase()}${extra}`);
    const kids = node.valueBlock?.value;
    if (Array.isArray(kids) && depth < maxDepth) kids.forEach((k) => walk(k, depth + 1));
    else if (Array.isArray(kids) && kids.length) lines.push(`${'  '.repeat(depth + 1)}… ${kids.length} element(s)`);
  };
  if (parsed.offset !== -1) walk(parsed.result, 0);
  return lines.join('\n');
}

const oidFromExt = (e) => e.type;
function crlNumber(crl) {
  const e = crl.extensions.find((x) => x.type === OIDS.crlNumber);
  if (!e) return null;
  const a = asn1js.fromBER(e.value);
  return a.result.valueBlock.valueDec ?? Number.parseInt(hex(a.result.valueBlock.valueHexView), 16);
}

// ---- Certificate model ----
export async function parseCertificate(pem, filename = '') {
  const der = pemToDer(pem);
  const c = new x509.X509Certificate(der);
  const san = c.getExtension(x509.SubjectAlternativeNameExtension)?.names.items.map((n) => ({ type: n.type.toUpperCase(), value: n.value })) ?? [];
  const eku = (c.getExtension(x509.ExtendedKeyUsageExtension)?.usages ?? []).map((o) => ({ oid: o, name: EKU_NAMES[o] ?? o }));
  const kuExt = c.getExtension(x509.KeyUsagesExtension);
  const bc = c.getExtension(x509.BasicConstraintsExtension);
  const aia = c.getExtension(x509.AuthorityInfoAccessExtension);
  const cdp = c.getExtension(x509.CRLDistributionPointsExtension);
  const tplName = c.extensions.find((e) => e.type === OIDS.templateName);
  const tplInfo = c.extensions.find((e) => e.type === OIDS.templateInfo);
  let template = null;
  if (tplName) template = { name: asn1js.fromBER(tplName.value).result.valueBlock.value };
  if (tplInfo) {
    const seq = asn1js.fromBER(tplInfo.value).result.valueBlock.value; const oid = seq[0].valueBlock.toString();
    template = { ...(template ?? {}), oid, version: `${seq[1].valueBlock.valueDec}.${seq[2].valueBlock.valueDec}`, source: template?.name ? 'name extension (1.3.6.1.4.1.311.20.2)' : 'template information (1.3.6.1.4.1.311.21.7)' };
    template.name ??= TEMPLATE_NAMES[oid] ?? null; template.resolvedFromOid = !tplName;
  }
  const pk = c.publicKey.algorithm;
  const pubKeyDer = new Uint8Array(c.publicKey.rawData);
  const sanExt = c.getExtension(x509.SubjectAlternativeNameExtension);
  return {
    kind: 'certificate', filename, pem: derToPem(der, 'CERTIFICATE'), der, sanCritical: sanExt?.critical ?? false, hasTemplateNameExtension: !!tplName,
    subject: c.subject, issuer: c.issuer, serialNumber: c.serialNumber.toUpperCase(), selfSigned: await c.isSelfSigned(),
    notBefore: iso(c.notBefore), notAfter: iso(c.notAfter), version: 3,
    signatureAlgorithm: `${c.signatureAlgorithm.name} / ${c.signatureAlgorithm.hash?.name ?? ''}`.replace(/ \/ $/, ''),
    publicKey: { algorithm: pk.name, bits: pk.modulusLength ?? null, spkiSha256: await sha('SHA-256', pubKeyDer) },
    san, eku,
    keyUsage: kuExt ? KU_FLAGS.filter(([bit]) => kuExt.usages & bit).map(([, n]) => n) : [], keyUsageCritical: kuExt?.critical ?? false,
    basicConstraints: bc ? { ca: bc.ca, pathLength: bc.pathLength ?? null, critical: bc.critical } : null,
    aia: (aia?.caIssuers ?? []).map((n) => ({ method: 'CA Issuers (1.3.6.1.5.5.7.48.2)', location: n.value })),
    ocsp: (aia?.ocsp ?? []).map((n) => n.value),
    cdp: (cdp?.distributionPoints ?? []).flatMap((d) => (d.distributionPoint?.fullName ?? []).map((n) => n.uniformResourceIdentifier)),
    template,
    extensions: c.extensions.map((e) => ({ oid: oidFromExt(e), critical: e.critical })),
    thumbprints: { sha1: await sha('SHA-1', der), sha256: await sha('SHA-256', der) },
    asn1: asn1Summary(der), x509: c
  };
}

// ---- CSR model ----
export async function parseCsr(pem, filename = '') {
  const der = pemToDer(pem);
  const r = new x509.Pkcs10CertificateRequest(der);
  const reqExt = (Cls, oid) => { const e = r.extensions.find((x) => x.type === oid); return e ? new Cls(e.rawData) : null; };
  const san = reqExt(x509.SubjectAlternativeNameExtension, '2.5.29.17')?.names.items.map((n) => ({ type: n.type.toUpperCase(), value: n.value })) ?? [];
  const tpl = r.extensions.find((e) => e.type === OIDS.templateName);
  const eku = reqExt(x509.ExtendedKeyUsageExtension, '2.5.29.37')?.usages ?? [];
  const kuExt = reqExt(x509.KeyUsagesExtension, '2.5.29.15');
  const pk = r.publicKey.algorithm;
  const pubDer = new Uint8Array(r.publicKey.rawData);
  // Request attributes: enrollmentNameValuePair (13.2.1) and ClientInformation (21.20).
  const attrSeq = (oid) => r.attributes.filter((a) => a.type === oid).flatMap((a) => a.values.map((v) => asn1js.fromBER(v).result.valueBlock.value));
  const nameValues = attrSeq(OIDS.enrollmentNameValuePair).map(([n, v]) => ({ name: n.valueBlock.value, value: v.valueBlock.value }));
  const ci = attrSeq(OIDS.clientInformation)[0];
  const clientInfo = ci ? { clientId: ci[0].valueBlock.valueDec, machine: ci[1].valueBlock.value, user: ci[2].valueBlock.value, process: ci[3].valueBlock.value } : null;
  const tplAttr = nameValues.find((p) => p.name === 'CertificateTemplate')?.value ?? null;
  return {
    kind: 'csr', filename, pem: derToPem(der, 'CERTIFICATE REQUEST'), der, subject: r.subject, san,
    publicKey: { algorithm: pk.name, bits: pk.modulusLength ?? null, exponent: pk.publicExponent ? Number.parseInt(hex(pk.publicExponent), 16) : null, spkiSha256: await sha('SHA-256', pubDer) },
    signatureAlgorithm: `${r.signatureAlgorithm.name} / ${r.signatureAlgorithm.hash?.name ?? ''}`,
    signatureValid: await r.verify(),
    requestedExtensions: r.extensions.map((e) => ({ oid: e.type, critical: e.critical })),
    requestedEku: eku.map((o) => ({ oid: o, name: EKU_NAMES[o] ?? o })),
    requestedKeyUsage: kuExt ? KU_FLAGS.filter(([bit]) => kuExt.usages & bit).map(([, n]) => n) : [], requestedKeyUsageCritical: kuExt?.critical ?? false,
    attributes: r.attributes.map((a) => a.type), nameValues, clientInfo, templateAttribute: tplAttr, templateExtension: tpl ? asn1js.fromBER(tpl.value).result.valueBlock.value : null,
    templateRequest: tplAttr ?? (tpl ? asn1js.fromBER(tpl.value).result.valueBlock.value : null),
    hasPrivateKeyMaterial: /PRIVATE KEY/.test(pem) || r.attributes.some((a) => a.type === '1.2.840.113549.1.9.9'),
    thumbprints: { sha1: await sha('SHA-1', der), sha256: await sha('SHA-256', der) },
    asn1: asn1Summary(der), x509: r
  };
}

// ---- CRL model ----
export async function parseCrl(pem, filename = '') {
  const der = pemToDer(pem);
  const c = new x509.X509Crl(der);
  return {
    kind: 'crl', filename, pem: derToPem(der, 'X509 CRL'), der, issuer: c.issuer, thisUpdate: iso(c.thisUpdate), nextUpdate: iso(c.nextUpdate),
    crlNumber: crlNumber(c),
    entries: (c.entries ?? []).map((e) => ({ serialNumber: e.serialNumber.toUpperCase(), revocationDate: iso(e.revocationDate), reason: x509.X509CrlReason[e.reason] ?? String(e.reason ?? 'unspecified') })),
    signatureAlgorithm: `${c.signatureAlgorithm.name} / ${c.signatureAlgorithm.hash?.name ?? ''}`,
    thumbprints: { sha1: await sha('SHA-1', der), sha256: await sha('SHA-256', der) },
    distribution: URLS.icaCdp, asn1: asn1Summary(der), x509: c
  };
}

// ---- INF (teaching request policy) ----
export function parseInf(text, filename = '') {
  const fields = {}; let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s;.*$/, '').trim();
    if (!line || line.startsWith(';')) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) { section = sec[1]; continue; }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (kv) fields[`${section}.${kv[1].trim()}`] = kv[2].trim().replace(/^"|"$/g, '');
  }
  return { kind: 'inf', filename, text, fields, machineContext: String(fields['NewRequest.MachineKeySet']).toUpperCase() === 'TRUE', template: fields['RequestAttributes.CertificateTemplate'] };
}

// ---- PKCS #7 certificates-only bundle ----
export async function parseP7b(pem, filename = '') {
  const der = pemToDer(pem);
  const set = new x509.X509Certificates(der);
  const certs = await Promise.all([...set].map((c) => parseCertificate(c.toString('pem'))));
  return { kind: 'p7b', filename, pem, der, certs, thumbprints: { sha1: await sha('SHA-1', der), sha256: await sha('SHA-256', der) }, asn1: asn1Summary(der) };
}

// ---- Fixture set ----
// files: { 'certificates/x.pem': text, ... }, manifest: parsed manifest.json
export async function buildFixtureModel(files, manifest) {
  const byFilename = {};
  const roles = {};
  for (const m of manifest.artifacts) {
    const text = files[m.pemFilename];
    if (text === undefined) throw new Error(`Missing fixture ${m.pemFilename}`);
    let parsed;
    if (m.artifactType === 'certificate') parsed = await parseCertificate(text, m.filename);
    else if (m.artifactType === 'csr') parsed = await parseCsr(text, m.filename);
    else if (m.artifactType === 'crl') parsed = await parseCrl(text, m.filename);
    else if (m.artifactType === 'inf') parsed = parseInf(text, m.filename);
    else if (m.artifactType === 'p7b') parsed = await parseP7b(text, m.filename);
    else parsed = { kind: 'chain', filename: m.filename, pem: text, certs: await Promise.all(splitPem(text).map((p) => parseCertificate(p))) };
    byFilename[m.filename] = { manifest: m, parsed, pemFilename: m.pemFilename };
    (roles[m.role] ??= []).push(byFilename[m.filename]);
  }
  const resolve = (role, faultId) => {
    const list = roles[role] ?? [];
    return list.find((e) => e.manifest.fault === faultId) ?? list.find((e) => e.manifest.fault === null) ?? null;
  };
  return { manifest, byFilename, roles, resolve, now: new Date(manifest.simulationNow) };
}

// ---- Validation evidence derived from the real fixtures ----
const stamp = (m) => m.now.toISOString().replace('.000Z', 'Z');
export async function evaluate(model, faultId, scenario) {
  const fault = scenario.faults.find((f) => f.id === faultId);
  const leaf = model.resolve('leaf', faultId).parsed, ica = model.resolve('ica', faultId).parsed, root = model.resolve('root', faultId).parsed;
  const crl = model.resolve('crl', faultId).parsed;
  const now = model.now, host = ENV.web.site, at = stamp(model);
  const trustStore = faultId === 'untrusted-root' ? [] : [root.thumbprints.sha256];
  const aiaOk = faultId !== 'missing-ica';
  const cdpOk = faultId !== 'cdp-unavailable';
  const checks = [];
  const add = (id, stageId, label, ok, detail, extra = {}) => checks.push({ id, stage: stageId, label, status: ok ? 'pass' : 'fail', detail, timestamp: at, ...extra });

  // install: private key match (WEB01 holds the key for the CSR public key)
  const csr = model.resolve('csr', faultId).parsed;
  const keyHeld = faultId !== 'no-private-key';
  add('key', 'install', 'Private key matches certificate', keyHeld,
    keyHeld ? `WEB01 key store holds a key whose public half has SHA-256 ${csr.publicKey.spkiSha256.slice(0, 16)}…, matching the certificate public key.`
      : `Certificate public key SHA-256 ${leaf.publicKey.spkiSha256.slice(0, 16)}… has no matching private key object in the WEB01 key store.`);
  add('aia', 'chain-build', 'Issuing CA certificate obtainable (AIA)', aiaOk,
    aiaOk ? `GET ${leaf.aia[0]?.location} → 200 OK, ${ica.subject} (SHA-1 ${ica.thumbprints.sha1.slice(0, 12)}…)` : `GET ${leaf.aia[0]?.location} → 404 Not Found (file not published on ${ENV.pubServer}); WEB01 did not send the issuing CA certificate.`,
    { url: leaf.aia[0]?.location, http: aiaOk ? 200 : 404 });
  add('name', 'validate', 'DNS name matches SAN', leaf.san.some((n) => n.type === 'DNS' && n.value.toLowerCase() === host),
    `Requested name ${host}; certificate SAN: ${leaf.san.map((n) => `${n.type}=${n.value}`).join(', ') || 'none'}.`);
  const ok = (c) => new Date(c.notBefore) <= now && now <= new Date(c.notAfter);
  add('dates', 'validate', 'Validity dates', [leaf, ica, root].every(ok),
    `Evaluation time ${at}; leaf valid ${leaf.notBefore} → ${leaf.notAfter}.`);
  add('eku', 'validate', 'Server Authentication EKU', leaf.eku.some((e) => e.oid === SERVER_AUTH),
    `Certificate EKU: ${leaf.eku.map((e) => e.name).join(', ') || 'none'}; required: Server Authentication (${SERVER_AUTH}).`);
  const sigLeaf = await leaf.x509.verify({ publicKey: ica.x509, signatureOnly: true });
  const sigIca = await ica.x509.verify({ publicKey: root.x509, signatureOnly: true });
  const sigRoot = await root.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('signatures', 'validate', 'Signatures along the chain', sigLeaf && sigIca && sigRoot,
    `Leaf signed by ${ica.subject}: ${sigLeaf}; ICA signed by ${root.subject}: ${sigIca}; root self-signature: ${sigRoot}.`);
  const trusted = trustStore.includes(root.thumbprints.sha256);
  add('root', 'root-trust', 'Root in trust store', trusted,
    trusted ? `${root.subject} (SHA-256 ${root.thumbprints.sha256.slice(0, 16)}…) found in CLIENT01 Trusted Root store.` : `CLIENT01 Trusted Root store does not contain ${root.subject} (SHA-256 ${root.thumbprints.sha256.slice(0, 16)}…).`);
  const crlSig = await crl.x509.verify({ publicKey: ica.x509 });
  const crlFresh = new Date(crl.thisUpdate) <= now && now <= new Date(crl.nextUpdate);
  const revokedEntry = crl.entries.find((e) => e.serialNumber === leaf.serialNumber);
  add('cdp', 'revocation', 'CRL obtainable (CDP)', cdpOk,
    cdpOk ? `GET ${leaf.cdp[0]} → 200 OK, CRL #${crl.crlNumber}, ${crl.entries.length} entries, signature valid: ${crlSig}, fresh: ${crlFresh}.` : `GET ${leaf.cdp[0]} → connection timed out (${ENV.pubServer} CDP unavailable). Revocation status unknown; the client fails closed.`,
    { url: leaf.cdp[0], http: cdpOk ? 200 : 0 });
  add('revocation', 'revocation', 'Certificate not revoked', cdpOk && !revokedEntry,
    !cdpOk ? 'Not evaluated: no CRL could be retrieved.' : revokedEntry ? `Serial ${leaf.serialNumber} is listed in CRL #${crl.crlNumber}: revoked ${revokedEntry.revocationDate}, reason ${revokedEntry.reason}.` : `Serial ${leaf.serialNumber} is not listed in CRL #${crl.crlNumber}.`);

  const KINDS = { key: 'Simulated environment', aia: 'Simulated environment', cdp: 'Simulated environment', root: 'Simulated environment', name: 'Real fixture data', dates: 'Real fixture data', eku: 'Real fixture data', signatures: 'Real fixture data', revocation: 'Real fixture data' };
  for (const c of checks) { c.basis = KINDS[c.id]; c.kind = c.status === 'fail' && faultId !== 'healthy' ? 'User-selected fault' : KINDS[c.id]; }
  const order = scenario.stages.map((s) => s.id);
  const sorted = [...checks].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  const first = sorted.find((c) => c.status === 'fail') ?? null;
  return { faultId, label: fault.label, checks: sorted, firstFailure: first, failStage: first?.stage ?? null, timestamp: at,
    aia: { raw: leaf.aia.map((a) => a.location), resolved: leaf.aia[0]?.location, expected: ica.subject, result: aiaOk ? 'Retrieved (HTTP 200)' : 'Failed (HTTP 404)', ok: aiaOk, timestamp: at },
    cdp: { raw: leaf.cdp, resolved: leaf.cdp[0], expected: `CRL issued by ${crl.issuer}`, result: cdpOk ? 'Retrieved (HTTP 200)' : 'Failed (timeout)', ok: cdpOk, timestamp: at } };
}

export async function evaluateAll(model, scenario) {
  const out = {};
  const fn = scenario.evaluate ?? evaluate;
  for (const f of scenario.faults) out[f.id] = await fn(model, f.id, scenario);
  return out;
}
