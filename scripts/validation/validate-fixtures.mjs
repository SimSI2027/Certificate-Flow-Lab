// Validates the real certificate, CSR, CRL, INF and chain fixtures and checks that no private key material is present.
// Usage: npm run fixtures:validate
import 'reflect-metadata';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureModel, evaluateAll } from '../../src/artifacts/model.js';
import { TLS, CA } from '../../src/artifacts/synthetic.js';
import scenario from '../../src/scenarios/tls-manual-enrollment.js';
import dcScenario from '../../src/scenarios/dc-manual-certificate-request.js';
import { pathOf } from '../../src/engine/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'fixtures/manifests/manifest.json'), 'utf8'));
const files = {};
for (const m of manifest.artifacts) files[m.pemFilename] = readFileSync(join(root, 'fixtures', m.pemFilename), 'utf8');
const model = await buildFixtureModel(files, manifest);
const evidence = await evaluateAll(model, scenario);
const dcEvidence = await evaluateAll(model, dcScenario);

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const verifies = (c, issuer) => c.x509.verify({ publicKey: issuer.x509, signatureOnly: true });

// ---------------- Website TLS lesson (v0.5.0) ----------------
const leaf = model.resolve('leaf', null).parsed, ica = model.resolve('ica', null).parsed, rootc = model.resolve('root', null).parsed;
const csr = model.resolve('csr', null).parsed, crl = model.resolve('crl', null).parsed, inf = model.resolve('inf', null).parsed;
const SITE = TLS.web.site, SERVER_AUTH = '1.3.6.1.5.5.7.3.1', CLIENT_AUTH = '1.3.6.1.5.5.7.3.2';
check(/CN=([^,]+)/.exec(ica.subject)[1] === CA.name && TLS.caConfig === `${CA.host}\\${CA.name}`, 'TLS caConfig is derived from the shared CA constants and matches the Issuing CA certificate CN');
// CSR
check(csr.signatureValid, 'portal CSR: signature verifies with its own public key (proof of possession by the WEB01 key)');
check(!csr.hasPrivateKeyMaterial && !/PRIVATE KEY/.test(csr.pem), 'portal CSR: contains no private-key material');
check(csr.subject === `CN=${SITE}, O=SIMSI2027 Synthetic Demo` && sameList(csr.san.map((n) => `${n.type}=${n.value}`), [`DNS=${SITE}`]), 'portal CSR: subject and SAN dNSName portal.simsi2027.test');
check(csr.publicKey.bits === 2048 && /SHA-256/.test(csr.signatureAlgorithm), 'portal CSR: RSA 2048, sha256WithRSAEncryption');
check(csr.requestedKeyUsageCritical && sameList(csr.requestedKeyUsage, ['Digital Signature', 'Key Encipherment']), 'portal CSR: requested Key Usage critical digitalSignature + keyEncipherment');
check(sameList(csr.requestedExtensions.map((e) => e.oid), ['2.5.29.17', '2.5.29.15']), 'portal CSR: requests only SAN and Key Usage (no requested EKU; the template sets it)');
check(csr.templateAttribute === TLS.template.name && csr.templateExtension === null, 'portal CSR: template attribute (13.2.1) SIMSI2027WebServer; no 1.3.6.1.4.1.311.20.2');
check(csr.clientInfo?.machine === TLS.web.fqdn && csr.clientInfo.user === TLS.owner && csr.clientInfo.process === 'certreq.exe', 'portal CSR: ClientInformation (21.20) = WEB01.simsi2027.test, SIMSI2027\\Morgan, certreq.exe');
// INF
check(inf.machineContext && inf.fields['NewRequest.Exportable'] === 'FALSE' && inf.template === TLS.template.name, 'portal INF: MachineKeySet TRUE, Exportable FALSE, template SIMSI2027WebServer');
check(inf.fields['NewRequest.Subject'] === `CN=${SITE}, O=SIMSI2027 Synthetic Demo` && inf.fields['NewRequest.KeyLength'] === '2048' && inf.fields['NewRequest.KeySpec'] === '1' && inf.fields['NewRequest.KeyUsage'] === '0xA0', 'portal INF: subject, KeyLength 2048, KeySpec 1, KeyUsage 0xA0');
check(inf.fields['NewRequest.ProviderName'] === 'Microsoft RSA SChannel Cryptographic Provider' && inf.fields['NewRequest.ProviderType'] === '12' && inf.fields['NewRequest.RequestType'] === 'PKCS10' && inf.fields['NewRequest.HashAlgorithm'] === 'SHA256', 'portal INF: SChannel provider (type 12), PKCS10, SHA256');
check(inf.fields['Extensions._continue_'] === `dns=${SITE}` && /SYNTHETIC/.test(inf.text), 'portal INF: SAN text dns=portal.simsi2027.test; synthetic header');
check(!model.resolve('inf', 'user-context').parsed.machineContext, 'portal fault INF (user-context): MachineKeySet FALSE');
// Leaf
check(leaf.subject === `CN=${SITE}, O=SIMSI2027 Synthetic Demo` && leaf.serialNumber === '2027000000000000000000000000CC10', 'portal leaf: subject and serial kept');
check(sameList(leaf.san.map((n) => `${n.type}=${n.value}`), [`DNS=${SITE}`]) && sameList(leaf.eku.map((e) => e.oid), [SERVER_AUTH]), 'portal leaf: SAN dNSName portal.simsi2027.test; EKU Server Authentication only');
check(leaf.keyUsageCritical && sameList(leaf.keyUsage, ['Digital Signature', 'Key Encipherment']) && leaf.basicConstraints?.ca === false && leaf.basicConstraints.critical, 'portal leaf: KU critical digitalSignature + keyEncipherment; Basic Constraints CA:FALSE critical');
check(leaf.template?.name === TLS.template.name && leaf.template.oid === TLS.template.oid && leaf.template.version === TLS.template.version && !leaf.hasTemplateNameExtension, 'portal leaf: template information (21.7) SIMSI2027WebServer 100.4; no 1.3.6.1.4.1.311.20.2');
check(leaf.aia[0]?.location === 'http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt' && sameList(leaf.cdp, ['http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl']), 'portal leaf: AIA and CDP URLs distinct and correct');
check(leaf.notBefore === '2026-10-30T00:00:00Z' && leaf.notAfter === '2027-10-30T00:00:00Z', 'portal leaf: validity 2026-10-30 to 2027-10-30 (renew before 2027-10-30)');
check(leaf.publicKey.spkiSha256 === csr.publicKey.spkiSha256, 'portal leaf: SPKI equals the CSR SPKI (the CA copied the requested public key into a new certificate)');
// Chain and CRL
check(leaf.issuer === ica.subject && ica.issuer === rootc.subject && rootc.selfSigned, 'chain: leaf -> SIMSI2027 Issuing CA 01 -> SIMSI2027 Root CA (self-signed)');
check(await verifies(leaf, ica) && !(await verifies(leaf, rootc)), 'portal leaf: signed by the Issuing CA key, not by the Root');
check(await verifies(ica, rootc), 'issuing CA signature verifies with the root key');
const handshake = model.resolve('handshake', null).parsed, fullChain = model.resolve('chain', null).parsed;
check(sameList(handshake.certs.map((c) => c.thumbprints.sha256), [leaf.thumbprints.sha256, ica.thumbprints.sha256]), 'portal-handshake-chain.pem: exactly leaf + Issuing CA (the Root is not sent)');
check(sameList(fullChain.certs.map((c) => c.thumbprints.sha256), [leaf, ica, rootc].map((c) => c.thumbprints.sha256)), 'portal.simsi2027.test-chain.pem: leaf, Issuing CA, Root');
check(await crl.x509.verify({ publicKey: ica.x509 }) && crl.issuer === ica.subject && crl.crlNumber === 27, `CRL #${crl.crlNumber} is signed by the issuing CA key`);
const revoked = model.resolve('leaf', 'revoked').parsed;
check(sameList(crl.entries.map((e) => e.serialNumber), [revoked.serialNumber, '2027000000000000000000000000DD99']) && !crl.entries.some((e) => e.serialNumber === leaf.serialNumber), 'CRL lists the revoked fault leaf and a synthetic serial, not the portal leaf');
// Fault certificates
const wrongDns = model.resolve('leaf', 'wrong-dns').parsed, expired = model.resolve('leaf', 'expired').parsed, wrongEku = model.resolve('leaf', 'wrong-eku').parsed;
check(sameList(wrongDns.san.map((n) => n.value), [`www.${SITE}`]) && sameList(model.resolve('csr', 'wrong-dns').parsed.san.map((n) => n.value), [`www.${SITE}`]), 'wrong-dns fault: SAN www.portal.simsi2027.test (certificate and CSR)');
check(new Date(expired.notAfter) < model.now, 'expired fault: notAfter is before the simulation clock');
check(sameList(wrongEku.eku.map((e) => e.oid), [CLIENT_AUTH]) && wrongEku.template?.name === TLS.wrongEkuTemplate.name && wrongEku.template.version === TLS.wrongEkuTemplate.version, 'wrong-eku fault: Client Authentication only, template SIMSI2027WorkstationAuth 100.2');
for (const c of [wrongDns, expired, wrongEku, revoked]) check(await verifies(c, ica) && c.publicKey.spkiSha256 === csr.publicKey.spkiSha256, `fault leaf ${c.serialNumber}: signed by the Issuing CA for the WEB01 key`);
const temp = model.resolve('selfsigned', null).parsed;
check(temp.selfSigned && temp.issuer === temp.subject && !(await verifies(temp, ica)) && temp.publicKey.spkiSha256 !== leaf.publicKey.spkiSha256 && temp.san.some((n) => n.value === SITE), 'temporary self-signed certificate: self-signed, not from the Issuing CA, its own key, SAN portal.simsi2027.test');
// v2 templates never carry the template-name extension.
for (const e of Object.values(model.byFilename)) { const p = e.parsed; if (p.kind === 'certificate' && p.template) check(!p.hasTemplateNameExtension && p.template.oid, `${e.manifest.filename}: v2 template information only, no 1.3.6.1.4.1.311.20.2`); }
// Scenario evidence agrees with the fixtures.
check(evidence.healthy.firstFailure === null, 'TLS healthy evaluation passes every check');
for (const f of scenario.faults.filter((x) => x.id !== 'healthy')) check(evidence[f.id].failStage === f.failStage && evidence[f.id].firstFailure?.id === f.check, `TLS fault ${f.id} first fails at ${f.failStage} (${f.check})`);

// ---------------- Domain Controller lesson (v0.4.0: Path A manual CSR transfer, Path B Certificates MMC enrollment) ----------------
check(dcEvidence.healthy.firstFailure === null, 'DC healthy evaluation passes every check');
for (const pathId of Object.keys(dcScenario.paths)) {
  const view = pathOf(dcScenario, { pathId }); const ev = await evaluateAll(model, view);
  check(ev.healthy.firstFailure === null, `DC path ${pathId}: healthy evaluation passes every check`);
  for (const f of view.faults.filter((x) => x.id !== 'healthy')) check(ev[f.id].failStage === f.stage && ev[f.id].firstFailure.id === f.check, `DC path ${pathId}: fault ${f.id} first fails at ${f.stage} (${f.check})`);
}
const dcCsr = model.resolve('dc-csr', null).parsed, dcCert = model.resolve('dc-cert', null).parsed, dcInf = model.resolve('dc-inf', null).parsed;
const mmcCsr = model.resolve('dc-mmc-csr', null).parsed, enrolled = model.resolve('dc-enrolled', null).parsed, p7b = model.resolve('dc-p7b', null).parsed;
const SANS = ['DC01.simsi2027.test', 'simsi2027.test', 'SIMSI2027'];
const EKUS = ['1.3.6.1.5.5.7.3.2', '1.3.6.1.5.5.7.3.1', '1.3.6.1.4.1.311.20.2.2', '1.3.6.1.5.2.3.5'];
for (const [label, r] of [['Path A CSR', dcCsr], ['Path B CSR', mmcCsr]]) {
  check(r.signatureValid, `${label}: signature verifies with its own public key (proof of possession)`);
  check(!r.hasPrivateKeyMaterial && !/PRIVATE KEY/.test(r.pem), `${label}: contains no private-key material`);
}
check(dcCsr.subject === 'CN=DC01.simsi2027.test' && sameList(dcCsr.san.map((n) => n.value), SANS), 'Path A CSR: subject CN=DC01.simsi2027.test and three dNSName SANs');
check(dcCsr.publicKey.bits === 2048 && /SHA-256/.test(dcCsr.signatureAlgorithm), 'Path A CSR: RSA 2048, sha256WithRSAEncryption');
check(dcCsr.requestedKeyUsageCritical && sameList(dcCsr.requestedKeyUsage, ['Digital Signature', 'Key Encipherment']), 'Path A CSR: Key Usage critical digitalSignature + keyEncipherment');
check(dcCsr.templateAttribute === 'DCOfflineKerberosAuth' && dcCsr.templateExtension === null, 'Path A CSR: template attribute (13.2.1) DCOfflineKerberosAuth; no 1.3.6.1.4.1.311.20.2');
check(dcCsr.clientInfo?.clientId === 9 && dcCsr.clientInfo.machine === 'DC01.simsi2027.test' && dcCsr.clientInfo.user === 'SIMSI2027\\PKIOperator' && dcCsr.clientInfo.process === 'certreq.exe', 'Path A CSR: ClientInformation (21.20) = 9, DC01.simsi2027.test, SIMSI2027\\PKIOperator, certreq.exe');
check(mmcCsr.templateAttribute === 'KerberosAuthentication' && mmcCsr.clientInfo?.process === 'mmc.exe' && mmcCsr.clientInfo.user === 'SIMSI2027\\DC01$', 'Path B CSR: template KerberosAuthentication, client mmc.exe, SIMSI2027\\DC01$');
check(dcCsr.publicKey.spkiSha256 === dcCert.publicKey.spkiSha256, 'Path A: leaf SPKI equals CSR SPKI');
check(mmcCsr.publicKey.spkiSha256 === enrolled.publicKey.spkiSha256, 'Path B: leaf SPKI equals CSR SPKI');
check(mmcCsr.publicKey.spkiSha256 !== dcCsr.publicKey.spkiSha256, 'Path B uses a new key pair');
for (const [label, c, tpl, ver] of [['Path A leaf', dcCert, 'DCOfflineKerberosAuth', '100.1'], ['Path B leaf', enrolled, 'KerberosAuthentication', '100.5']]) {
  check(c.issuer === ica.subject && await verifies(c, ica), `${label}: signed by SIMSI2027 Issuing CA 01`);
  check(!(await verifies(c, rootc)), `${label}: not signed by the Root CA`);
  check(sameList(c.san.map((n) => n.value), SANS) && sameList(c.eku.map((e) => e.oid), EKUS), `${label}: three dNSName SANs; EKU Client, Server, Smart Card Logon, KDC Authentication`);
  check(c.keyUsageCritical && c.basicConstraints?.ca === false && c.basicConstraints.critical, `${label}: KU critical, Basic Constraints CA:FALSE critical`);
  check(c.template?.name === tpl && c.template.version === ver && !c.hasTemplateNameExtension, `${label}: template information ${tpl} ${ver}; no 1.3.6.1.4.1.311.20.2`);
  check(c.aia[0]?.location === 'http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt' && c.cdp[0] === 'http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl', `${label}: AIA and CDP URLs distinct and correct`);
  check(c.notBefore === '2026-10-30T00:00:00Z' && c.notAfter === '2027-10-30T00:00:00Z', `${label}: validity 2026-10-30 to 2027-10-30`);
}
check(dcCert.subject === 'CN=DC01.simsi2027.test' && dcCert.serialNumber === '2027000000000000000000000000DC01', 'Path A leaf: subject and serial kept');
check(enrolled.subject === '' && enrolled.sanCritical, 'Path B leaf: empty subject and critical SAN');
check(p7b.certs.length === 3 && sameList(p7b.certs.map((c) => c.thumbprints.sha256).sort(), [dcCert, ica, rootc].map((c) => c.thumbprints.sha256).sort()), 'dc01-return.p7b contains exactly leaf, Issuing CA and Root');
check(dcInf.machineContext && dcInf.fields['NewRequest.Exportable'] === 'FALSE' && dcInf.template === 'DCOfflineKerberosAuth', 'DC INF: MachineKeySet TRUE, Exportable FALSE, template DCOfflineKerberosAuth');
check(dcInf.fields['Extensions._continue_'] === 'dns=DC01.simsi2027.test&dns=simsi2027.test&dns=SIMSI2027', 'DC INF: SAN text lists the three DNS names');
check(!model.resolve('dc-inf', 'user-context').parsed.machineContext, 'fault INF: MachineKeySet FALSE');
check(model.resolve('dc-cert', 'key-mismatch').parsed.publicKey.spkiSha256 !== dcCsr.publicKey.spkiSha256, 'key-mismatch fault certificate really has a different public key');
check(sameList(model.resolve('dc-cert', 'san-no-domain').parsed.san.map((n) => n.value), ['DC01.simsi2027.test']), 'san-no-domain fault: SAN only DC01.simsi2027.test');
const imp = model.resolve('dc-root-candidate', 'root-thumbprint-mismatch').parsed;
check(imp.subject === rootc.subject && imp.selfSigned && imp.publicKey.spkiSha256 !== rootc.publicKey.spkiSha256 && imp.thumbprints.sha1 !== rootc.thumbprints.sha1, 'root impostor: same subject DN, different key and thumbprint');
check(!crl.entries.some((e) => [dcCert.serialNumber, enrolled.serialNumber].includes(e.serialNumber)), 'CRL does not list either DC leaf serial');
for (const m of manifest.artifacts) {
  const okT = /^[0-9A-F]{40}$/.test(m.thumbprints.sha1) && /^[0-9A-F]{64}$/.test(m.thumbprints.sha256);
  const okS = !['certificate', 'csr'].includes(m.artifactType) || /^[0-9A-F]{64}$/.test(m.spkiSha256 ?? '');
  check(okT && okS && m.role && ['csr', 'mmc', 'shared', 'fault', 'tls'].includes(m.path), `manifest ${m.filename}: thumbprints, SPKI, role and path`);
}

// Private key hygiene across the whole working tree (excluding node_modules/.git/dist).
const skip = new Set(['node_modules', '.git', 'dist', 'test-results', 'screenshots', 'output']);
const hits = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (skip.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(pfx|p12|key|pk8|jks)$/i.test(n)) hits.push(p);
    else if (/fixtures[\\/]/.test(p) || /\.(pem|csr|cer|der|crl|inf|req)$/i.test(n)) { if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(readFileSync(p).toString('latin1'))) hits.push(p); }
  }
})(root);
check(hits.length === 0, `no private key / PFX files in the project tree${hits.length ? ': ' + hits.join(', ') : ''}`);
console.log(failures ? `\n${failures} validation failure(s)` : '\nAll fixture validations passed');
process.exit(failures ? 1 : 0);
