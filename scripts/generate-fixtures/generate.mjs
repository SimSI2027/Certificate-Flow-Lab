// Generates the synthetic SIMSI2027 demonstration PKI fixtures.
// Private keys exist only in memory during this run and are never written to disk.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import * as asn1js from 'asn1js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV, URLS, TEMPLATE, OIDS } from '../../src/artifacts/synthetic.js';

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

write('manifests', 'manifest.json', JSON.stringify({
  notice: 'Synthetic demonstration fixtures generated for Certificate Flow Lab. Not connected to any real PKI. No private keys are distributed.',
  generator: 'scripts/generate-fixtures/generate.mjs', simulationNow: ENV.simulationNow, artifacts: files }, null, 2) + '\n');
console.log(`Generated ${files.length} fixture artifacts (private keys were in memory only and discarded).`);
