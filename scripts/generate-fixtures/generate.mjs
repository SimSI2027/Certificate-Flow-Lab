// Generates the synthetic SIMSI2027 demonstration PKI fixtures.
// Private keys exist only in memory during this run and are never written to disk.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import * as asn1js from 'asn1js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV, URLS, TEMPLATE, OIDS, DC } from '../../src/artifacts/synthetic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (...p) => join(root, 'fixtures', ...p);
x509.cryptoProvider.set(globalThis.crypto);
const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', publicExponent: new Uint8Array([1, 0, 1]), modulusLength: 2048 };
const gen = () => crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
const D = (s) => new Date(s);
const DEMO = 'Demonstration fixture';
const EKU = x509.ExtendedKeyUsage;

const bmp = (s) => new asn1js.BmpString({ value: s }).toBER();
const templateNameExt = (tpl) => new x509.Extension(OIDS.templateName, false, bmp(tpl.name));
const templateInfoExt = (tpl) => new x509.Extension(OIDS.templateInfo, false, new asn1js.Sequence({ value: [
  new asn1js.ObjectIdentifier({ value: tpl.oid }), new asn1js.Integer({ value: tpl.major }), new asn1js.Integer({ value: tpl.minor })] }).toBER());
const crlNumberExt = (n) => new x509.Extension(OIDS.crlNumber, false, new asn1js.Integer({ value: n }).toBER());
const ku = (f) => new x509.KeyUsagesExtension(f, true);

const pem = (obj) => obj.toString('pem') + '\n';
const der = (obj) => Buffer.from(obj.rawData);
const sha = (a, buf) => createHash(a).update(buf).digest('hex').toUpperCase();

const files = [];
function write(dir, name, text, bin) {
  mkdirSync(out(dir), { recursive: true });
  writeFileSync(out(dir, name), bin ?? text);
}
for (const d of ['certificates', 'requests', 'crl', 'manifests']) rmSync(out(d), { recursive: true, force: true });

// ---- Hierarchy ----
const rootKeys = await gen(), icaKeys = await gen(), webKeys = await gen();
const rootCert = await x509.X509CertificateGenerator.createSelfSigned({
  serialNumber: '2027000000000000000000000000AA01', name: 'CN=SIMSI2027 Root CA, O=SIMSI2027 Synthetic Demo, DC=simsi2027, DC=test',
  notBefore: D('2026-01-01T00:00:00Z'), notAfter: D('2046-01-01T00:00:00Z'), signingAlgorithm: alg, keys: rootKeys,
  extensions: [new x509.BasicConstraintsExtension(true, 1, true), ku(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign),
    await x509.SubjectKeyIdentifierExtension.create(rootKeys.publicKey)]
});
const icaCert = await x509.X509CertificateGenerator.create({
  serialNumber: '2027000000000000000000000000BB02', subject: 'CN=SIMSI2027 Issuing CA 01, O=SIMSI2027 Synthetic Demo, DC=simsi2027, DC=test',
  issuer: rootCert.subject, notBefore: D('2026-01-02T00:00:00Z'), notAfter: D('2036-01-02T00:00:00Z'),
  signingKey: rootKeys.privateKey, publicKey: icaKeys.publicKey, signingAlgorithm: alg,
  extensions: [new x509.BasicConstraintsExtension(true, 0, true), ku(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign),
    await x509.SubjectKeyIdentifierExtension.create(icaKeys.publicKey), await x509.AuthorityKeyIdentifierExtension.create(rootCert, false),
    new x509.AuthorityInfoAccessExtension({ caIssuers: [URLS.rootAia] }), new x509.CRLDistributionPointsExtension([URLS.rootCdp])]
});

// ---- CSRs (WEB01 key; private key stays in memory only) ----
const csr = (name) => x509.Pkcs10CertificateRequestGenerator.create({
  name: `CN=${name}, O=SIMSI2027 Synthetic Demo`, keys: webKeys, signingAlgorithm: alg,
  extensions: [new x509.SubjectAlternativeNameExtension([{ type: 'dns', value: name }]), templateNameExt(TEMPLATE),
    new x509.ExtendedKeyUsageExtension([EKU.serverAuth]), ku(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment)]
});
const csrOk = await csr(ENV.web.site);
const csrWrongDns = await csr('web01.simsi2027.test');

// ---- Leaf variants ----
const leaf = async ({ serial, san, eku = [EKU.serverAuth], nb = '2026-10-30T00:00:00Z', na = '2027-10-30T00:00:00Z', tpl = TEMPLATE }) =>
  x509.X509CertificateGenerator.create({
    serialNumber: serial, subject: `CN=${san}, O=SIMSI2027 Synthetic Demo`, issuer: icaCert.subject,
    notBefore: D(nb), notAfter: D(na), signingKey: icaKeys.privateKey, publicKey: webKeys.publicKey, signingAlgorithm: alg,
    extensions: [new x509.BasicConstraintsExtension(false, undefined, true), ku(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment),
      new x509.ExtendedKeyUsageExtension(eku), new x509.SubjectAlternativeNameExtension([{ type: 'dns', value: san }]),
      await x509.SubjectKeyIdentifierExtension.create(webKeys.publicKey), await x509.AuthorityKeyIdentifierExtension.create(icaCert, false),
      new x509.AuthorityInfoAccessExtension({ caIssuers: [URLS.icaAia] }), new x509.CRLDistributionPointsExtension([URLS.icaCdp]),
      templateNameExt(tpl), templateInfoExt(tpl)]
  });
const leafOk = await leaf({ serial: '2027000000000000000000000000CC10', san: ENV.web.site });
const leafWrongDns = await leaf({ serial: '2027000000000000000000000000CC11', san: 'web01.simsi2027.test' });
const leafExpired = await leaf({ serial: '2027000000000000000000000000CC12', san: ENV.web.site, nb: '2026-02-01T00:00:00Z', na: '2026-09-30T00:00:00Z' });
const leafWrongEku = await leaf({ serial: '2027000000000000000000000000CC13', san: ENV.web.site, eku: [EKU.clientAuth],
  tpl: { name: 'WorkstationAuth', oid: '1.3.6.1.4.1.311.21.8.2027.1.7', major: 100, minor: 2 } });
const leafRevoked = await leaf({ serial: '2027000000000000000000000000CC14', san: ENV.web.site });

// ---- CRL ----
const crl = await x509.X509CrlGenerator.create({
  issuer: icaCert.subject, thisUpdate: D('2026-10-31T00:00:00Z'), nextUpdate: D('2026-11-07T00:00:00Z'),
  entries: [
    { serialNumber: leafRevoked.serialNumber, revocationDate: D('2026-10-30T18:00:00Z'), reason: x509.X509CrlReason.keyCompromise },
    { serialNumber: '2027000000000000000000000000DD99', revocationDate: D('2026-09-15T09:30:00Z'), reason: x509.X509CrlReason.superseded }
  ],
  extensions: [await x509.AuthorityKeyIdentifierExtension.create(icaCert, false), crlNumberExt(27)],
  signingAlgorithm: alg, signingKey: icaKeys.privateKey
});

// ---- Write ----
const sans = (c) => (c.getExtension(x509.SubjectAlternativeNameExtension)?.names.items ?? []).map((n) => `${n.type.toUpperCase()}=${n.value}`);
function addCert(name, cert, meta) {
  write('certificates', `${name}.cer`, null, der(cert));
  write('certificates', `${name}.pem`, pem(cert));
  files.push({ filename: `certificates/${name}.cer`, pemFilename: `certificates/${name}.pem`, artifactType: 'certificate', ...meta,
    subject: cert.subject, issuer: cert.issuer, serialNumber: cert.serialNumber.toUpperCase(),
    thumbprints: { sha1: sha('sha1', der(cert)), sha256: sha('sha256', der(cert)) },
    validity: { notBefore: cert.notBefore.toISOString().replace('.000Z', 'Z'), notAfter: cert.notAfter.toISOString().replace('.000Z', 'Z') },
    san: sans(cert),
    eku: cert.getExtension(x509.ExtendedKeyUsageExtension)?.usages ?? [],
    aia: (cert.getExtension(x509.AuthorityInfoAccessExtension)?.caIssuers ?? []).map((n) => n.value),
    cdp: (cert.getExtension(x509.CRLDistributionPointsExtension)?.distributionPoints ?? []).flatMap((d) => (d.distributionPoint?.fullName ?? []).map((n) => n.uniformResourceIdentifier)),
    demonstrationFixture: true, notice: DEMO });
}
const rid = String(ENV.requestId);
addCert('simsi2027-rootca', rootCert, { relatedRequest: null, stage: 'root-trust', role: 'root', fault: null });
addCert('simsi2027-ica01', icaCert, { relatedRequest: null, stage: 'chain-build', role: 'ica', fault: null });
addCert('portal.simsi2027.test', leafOk, { relatedRequest: rid, stage: 'return', role: 'leaf', fault: null });
addCert('fault-wrong-dns', leafWrongDns, { relatedRequest: rid, stage: 'return', role: 'leaf', fault: 'wrong-dns' });
addCert('fault-expired', leafExpired, { relatedRequest: rid, stage: 'return', role: 'leaf', fault: 'expired' });
addCert('fault-wrong-eku', leafWrongEku, { relatedRequest: rid, stage: 'return', role: 'leaf', fault: 'wrong-eku' });
addCert('fault-revoked', leafRevoked, { relatedRequest: rid, stage: 'return', role: 'leaf', fault: 'revoked' });

function addCsr(name, c, fault) {
  write('requests', `${name}.csr`, pem(c));
  write('requests', `${name}.der`, null, der(c));
  files.push({ filename: `requests/${name}.der`, pemFilename: `requests/${name}.csr`, artifactType: 'csr', subject: c.subject, issuer: null,
    serialNumber: null, thumbprints: { sha1: sha('sha1', der(c)), sha256: sha('sha256', der(c)) }, validity: null,
    san: new x509.SubjectAlternativeNameExtension(c.extensions.find((e) => e.type === '2.5.29.17').rawData).names.items.map((n) => `DNS=${n.value}`), eku: ['1.3.6.1.5.5.7.3.1'], aia: [], cdp: [],
    relatedRequest: rid, stage: 'csr', role: 'csr', fault, demonstrationFixture: true, notice: DEMO });
}
addCsr('portal.simsi2027.test', csrOk, null);
addCsr('fault-wrong-dns', csrWrongDns, 'wrong-dns');

write('crl', 'SIMSI2027-ICA01.crl', null, der(crl));
write('crl', 'SIMSI2027-ICA01.crl.pem', pem(crl));
files.push({ filename: 'crl/SIMSI2027-ICA01.crl', pemFilename: 'crl/SIMSI2027-ICA01.crl.pem', artifactType: 'crl', subject: null, issuer: crl.issuer,
  serialNumber: null, thumbprints: { sha1: sha('sha1', der(crl)), sha256: sha('sha256', der(crl)) },
  validity: { notBefore: crl.thisUpdate.toISOString().replace('.000Z', 'Z'), notAfter: crl.nextUpdate.toISOString().replace('.000Z', 'Z') }, san: [], eku: [], aia: [], cdp: [URLS.icaCdp],
  relatedRequest: null, stage: 'revocation', role: 'crl', fault: null, demonstrationFixture: true, notice: DEMO });

const chainPem = pem(leafOk) + pem(icaCert) + pem(rootCert);
write('certificates', 'portal.simsi2027.test-chain.pem', chainPem);
files.push({ filename: 'certificates/portal.simsi2027.test-chain.pem', pemFilename: 'certificates/portal.simsi2027.test-chain.pem', artifactType: 'chain',
  subject: leafOk.subject, issuer: rootCert.subject, serialNumber: null,
  thumbprints: { sha1: sha('sha1', Buffer.from(chainPem)), sha256: sha('sha256', Buffer.from(chainPem)) },
  validity: null, san: sans(leafOk), eku: ['serverAuth'], aia: [], cdp: [], relatedRequest: rid, stage: 'chain-build', role: 'chain', fault: null,
  demonstrationFixture: true, notice: `${DEMO} (leaf, issuing CA, root; concatenated PEM)` });

// ======================= Domain Controller manual-enrollment fixtures (scenario dc-manual-certificate-request) =======================
// Path A (manual CSR transfer): template DCOfflineKerberosAuth, subject supplied in the request, submitted by SIMSI2027\PKIOperator.
// Path B (Certificates MMC enrollment): template KerberosAuthentication, identity built from AD, machine context SIMSI2027\DC01$.
const DC_NAME = DC.fqdn;
const DC_SANS = [DC.fqdn, DC.domainDns, DC.netbios];
const DC_TPL = { name: DC.template, oid: DC.templateOid, major: 100, minor: 5 };
const DC_OFF_TPL = { name: DC.offlineTemplate, oid: DC.offlineTemplateOid, major: 100, minor: 1 };
const KDC_AUTH = OIDS.kdcAuth, SMARTCARD_LOGON = OIDS.smartCardLogon;
const dcKeys = await gen(), mmcKeys = await gen(), otherKeys = await gen(), impostorKeys = await gen(); // memory only; never written
const dnsNames = (list) => list.map((value) => ({ type: 'dns', value }));
const DC_KU = () => ku(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment);
// enrollmentNameValuePair (1.3.6.1.4.1.311.13.2.1): SEQUENCE { BMPString name, BMPString value }
const nameValueAttr = (name, value) => new x509.Attribute(OIDS.enrollmentNameValuePair, [new asn1js.Sequence({ value: [new asn1js.BmpString({ value: name }), new asn1js.BmpString({ value })] }).toBER()]);
// ClientInformation (1.3.6.1.4.1.311.21.20): SEQUENCE { INTEGER clientId, UTF8String machine, UTF8String user, UTF8String process }
const clientInfoAttr = (machine, user, processName) => new x509.Attribute(OIDS.clientInformation, [new asn1js.Sequence({ value: [new asn1js.Integer({ value: 9 }),
  new asn1js.Utf8String({ value: machine }), new asn1js.Utf8String({ value: user }), new asn1js.Utf8String({ value: processName })] }).toBER()]);
const dcCsr = await x509.Pkcs10CertificateRequestGenerator.create({
  name: `CN=${DC_NAME}`, keys: dcKeys, signingAlgorithm: alg,
  extensions: [new x509.SubjectAlternativeNameExtension(dnsNames(DC_SANS)), DC_KU()],
  attributes: [nameValueAttr('CertificateTemplate', DC_OFF_TPL.name), clientInfoAttr(DC_NAME, DC.operator, 'certreq.exe')]
});
// Path B: built in memory by the enrollment wizard (not saved as a file in real enrollment). Subject and SAN come from AD at the CA.
const mmcCsr = await x509.Pkcs10CertificateRequestGenerator.create({
  name: '', keys: mmcKeys, signingAlgorithm: alg, extensions: [DC_KU()],
  attributes: [nameValueAttr('CertificateTemplate', DC_TPL.name), clientInfoAttr(DC_NAME, DC.machineAccount, 'mmc.exe')]
});
const dcLeaf = async ({ serial, subject = `CN=${DC_NAME}`, sans = DC_SANS, sanCritical = false, eku = [EKU.clientAuth, EKU.serverAuth, SMARTCARD_LOGON, KDC_AUTH], nb = '2026-10-30T00:00:00Z', na = '2027-10-30T00:00:00Z', keys = dcKeys, tpl = DC_OFF_TPL }) =>
  x509.X509CertificateGenerator.create({
    serialNumber: serial, subject, issuer: icaCert.subject, notBefore: D(nb), notAfter: D(na),
    signingKey: icaKeys.privateKey, publicKey: keys.publicKey, signingAlgorithm: alg,
    extensions: [new x509.BasicConstraintsExtension(false, undefined, true), DC_KU(),
      new x509.ExtendedKeyUsageExtension(eku), new x509.SubjectAlternativeNameExtension(dnsNames(sans), sanCritical),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey), await x509.AuthorityKeyIdentifierExtension.create(icaCert, false),
      new x509.AuthorityInfoAccessExtension({ caIssuers: [URLS.icaAia] }), new x509.CRLDistributionPointsExtension([URLS.icaCdp]),
      templateInfoExt(tpl)]
  });
const dcCert = await dcLeaf({ serial: '2027000000000000000000000000DC01' });
const dcWrongEku = await dcLeaf({ serial: '2027000000000000000000000000DC02', eku: [EKU.clientAuth] });
const dcSanMissing = await dcLeaf({ serial: '2027000000000000000000000000DC03', sans: ['simsi2027.test'] });
const dcKeyMismatch = await dcLeaf({ serial: '2027000000000000000000000000DC04', keys: otherKeys });
const dcExpired = await dcLeaf({ serial: '2027000000000000000000000000DC05', nb: '2026-02-01T00:00:00Z', na: '2026-09-30T00:00:00Z' });
const dcEnrolled = await dcLeaf({ serial: '2027000000000000000000000000DC06', subject: '', sanCritical: true, keys: mmcKeys, tpl: DC_TPL });
const dcSanNoDomain = await dcLeaf({ serial: '2027000000000000000000000000DC07', sans: [DC_NAME] });
const rootImpostor = await x509.X509CertificateGenerator.createSelfSigned({
  serialNumber: '2027000000000000000000000000AA99', name: rootCert.subject, notBefore: D('2026-01-01T00:00:00Z'), notAfter: D('2046-01-01T00:00:00Z'), signingAlgorithm: alg, keys: impostorKeys,
  extensions: [new x509.BasicConstraintsExtension(true, 1, true), ku(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign), await x509.SubjectKeyIdentifierExtension.create(impostorKeys.publicKey)]
});

const infText = (machine) => `; Certificate Flow Lab - SYNTHETIC teaching request policy for the simulation. Not a production recommendation.
; The exact template, provider and settings that work in a real AD CS environment depend on its configuration.
[Version]
Signature = "$Windows NT$"

[NewRequest]
Subject = "CN=${DC_NAME}"
KeyLength = 2048                 ; RSA 2048 meets the template minimum in this simulation
KeySpec = 1                      ; AT_KEYEXCHANGE (compatibility; the template also allows signing)
KeyUsage = 0xA0                  ; digitalSignature (0x80) + keyEncipherment (0x20)
Exportable = FALSE               ; the private key must not leave DC01
MachineKeySet = ${machine ? 'TRUE ' : 'FALSE'}             ; ${machine ? 'TRUE = Local Computer key store (machine context)' : 'FALSE = current user key store (WRONG for a Domain Controller certificate)'}
UseExistingKeySet = FALSE        ; create a new key pair on this computer
ProviderName = "Microsoft RSA SChannel Cryptographic Provider"   ; legacy-compatible provider named for teaching
ProviderType = 12
RequestType = PKCS10
HashAlgorithm = SHA256

[RequestAttributes]
CertificateTemplate = ${DC_OFF_TPL.name}   ; template name, not display name (simulated organization-specific template)

[Extensions]
2.5.29.17 = "{text}"
_continue_ = "${DC_SANS.map((n) => `dns=${n}`).join('&')}"
`;
const textDigest = (s) => ({ sha1: sha('sha1', Buffer.from(s)), sha256: sha('sha256', Buffer.from(s)) });
function addInf(name, text, fault) {
  write('requests', name, text);
  files.push({ filename: `requests/${name}`, pemFilename: `requests/${name}`, artifactType: 'inf', subject: `CN=${DC_NAME}`, issuer: null, serialNumber: null, thumbprints: textDigest(text),
    validity: null, san: DC_SANS.map((n) => `DNS=${n}`), eku: [], aia: [], cdp: [], relatedRequest: rid, stage: 'a-inf', role: 'dc-inf', path: fault ? 'fault' : 'csr', fault, demonstrationFixture: true, notice: `${DEMO} (teaching request policy, not a recommendation)` });
}
addInf('dc01-request.inf', infText(true), null);
addInf('fault-user-context.inf', infText(false), 'user-context');

function addDcCsr(name, c, { role, path, stage, notice = DEMO }) {
  write('requests', `${name}.req`, pem(c)); write('requests', `${name}.der`, null, der(c));
  const sanExt = c.extensions.find((e) => e.type === '2.5.29.17');
  files.push({ filename: `requests/${name}.der`, pemFilename: `requests/${name}.req`, artifactType: 'csr', subject: c.subject, issuer: null, serialNumber: null,
    thumbprints: { sha1: sha('sha1', der(c)), sha256: sha('sha256', der(c)) }, validity: null,
    san: sanExt ? new x509.SubjectAlternativeNameExtension(sanExt.rawData).names.items.map((n) => `DNS=${n.value}`) : [], eku: [], aia: [], cdp: [], relatedRequest: rid, stage, role, path, fault: null, demonstrationFixture: true, notice });
}
addDcCsr('dc01-request', dcCsr, { role: 'dc-csr', path: 'csr', stage: 'a-new' });
addDcCsr('dc01-mmc-request', mmcCsr, { role: 'dc-mmc-csr', path: 'mmc', stage: 'b-enroll',
  notice: `${DEMO} (built in memory by the enrollment wizard; not saved as a file in real enrollment)` });

const dcCertMeta = (stage, role, path, fault) => ({ relatedRequest: rid, stage, role, path, fault });
addCert('dc01-issued', dcCert, dcCertMeta('a-sign', 'dc-cert', 'csr', null));
addCert('dc01-enrolled', dcEnrolled, dcCertMeta('b-issue', 'dc-enrolled', 'mmc', null));
addCert('fault-dc-wrong-eku', dcWrongEku, dcCertMeta('a-purposes', 'dc-cert', 'fault', 'wrong-eku'));
addCert('fault-dc-san-missing', dcSanMissing, dcCertMeta('a-purposes', 'dc-cert', 'fault', 'san-missing'));
addCert('fault-dc-san-no-domain', dcSanNoDomain, dcCertMeta('a-purposes', 'dc-cert', 'fault', 'san-no-domain'));
addCert('fault-dc-key-mismatch', dcKeyMismatch, dcCertMeta('a-key', 'dc-cert', 'fault', 'key-mismatch'));
addCert('fault-dc-expired', dcExpired, dcCertMeta('a-purposes', 'dc-cert', 'fault', 'expired'));
addCert('fault-rootca-impostor', rootImpostor, { relatedRequest: null, stage: 'a-return-move', role: 'dc-root-candidate', path: 'fault', fault: 'root-thumbprint-mismatch' });
const dcChainPem = pem(dcCert) + pem(icaCert) + pem(rootCert);
write('certificates', 'dc01-chain.pem', dcChainPem);
files.push({ filename: 'certificates/dc01-chain.pem', pemFilename: 'certificates/dc01-chain.pem', artifactType: 'chain', subject: dcCert.subject, issuer: rootCert.subject, serialNumber: null,
  thumbprints: textDigest(dcChainPem), validity: null, san: sans(dcCert), eku: [], aia: [], cdp: [], relatedRequest: rid, stage: 'a-chain', role: 'dc-chain', path: 'csr', fault: null,
  demonstrationFixture: true, notice: `${DEMO} (leaf, issuing CA, root; concatenated PEM)` });

// PKCS #7 certificates-only return package (leaf + Issuing CA + Root). Public certificates only; no signature, no private key.
const p7 = new x509.X509Certificates([dcCert, icaCert, rootCert]);
const p7Der = Buffer.from(p7.export('raw'));
write('certificates', 'dc01-return.p7b', null, p7Der);
write('certificates', 'dc01-return.p7b.pem', p7.export('pem') + '\n');
files.push({ filename: 'certificates/dc01-return.p7b', pemFilename: 'certificates/dc01-return.p7b.pem', artifactType: 'p7b', subject: null, issuer: null, serialNumber: null,
  thumbprints: { sha1: sha('sha1', p7Der), sha256: sha('sha256', p7Der) }, validity: null, san: [], eku: [], aia: [], cdp: [], relatedRequest: rid, stage: 'a-retrieve', role: 'dc-p7b', path: 'csr', fault: null,
  demonstrationFixture: true, notice: `${DEMO} (PKCS #7 certificates-only: leaf, Issuing CA, Root)` });

// SPKI SHA-256 and path for every manifest entry.
const spkiOf = async (f) => {
  if (!['certificate', 'csr'].includes(f.artifactType)) return null;
  const { readFileSync } = await import('node:fs');
  const o = f.artifactType === 'certificate' ? new x509.X509Certificate(readFileSync(out(f.filename))) : new x509.Pkcs10CertificateRequest(readFileSync(out(f.filename)));
  return sha('sha256', Buffer.from(o.publicKey.rawData));
};
for (const f of files) {
  f.spkiSha256 = await spkiOf(f);
  f.path ??= ['root', 'ica', 'crl'].includes(f.role) ? 'shared' : 'tls';
}

write('manifests', 'manifest.json', JSON.stringify({
  notice: 'Synthetic demonstration fixtures generated for Certificate Flow Lab. Not connected to any real PKI. No private keys are distributed.',
  generator: 'scripts/generate-fixtures/generate.mjs', simulationNow: ENV.simulationNow, artifacts: files }, null, 2) + '\n');
console.log(`Generated ${files.length} fixture artifacts (private keys were in memory only and discarded).`);
