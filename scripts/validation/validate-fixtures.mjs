// Validates the real certificate, CSR, CRL and chain fixtures and checks that no private key material is present.
// Usage: npm run fixtures:validate
import 'reflect-metadata';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureModel, evaluateAll } from '../../src/artifacts/model.js';
import scenario from '../../src/scenarios/tls-manual-enrollment.js';
import dcScenario from '../../src/scenarios/dc-manual-certificate-request.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'fixtures/manifests/manifest.json'), 'utf8'));
const files = {};
for (const m of manifest.artifacts) files[m.pemFilename] = readFileSync(join(root, 'fixtures', m.pemFilename), 'utf8');
const model = await buildFixtureModel(files, manifest);
const evidence = await evaluateAll(model, scenario);
const dcEvidence = await evaluateAll(model, dcScenario);

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

const leaf = model.resolve('leaf', null).parsed, ica = model.resolve('ica', null).parsed, rootc = model.resolve('root', null).parsed;
const csr = model.resolve('csr', null).parsed, crl = model.resolve('crl', null).parsed;
check(leaf.san.some((n) => n.value === 'portal.simsi2027.test'), 'leaf SAN contains DNS=portal.simsi2027.test');
check(leaf.eku.some((e) => e.name === 'Server Authentication'), 'leaf has Server Authentication EKU');
check(csr.signatureValid && csr.publicKey.spkiSha256 === leaf.publicKey.spkiSha256, 'CSR signature valid and its key is the leaf key');
check(leaf.issuer === ica.subject && ica.issuer === rootc.subject && rootc.selfSigned, 'chain: leaf -> SIMSI2027 Issuing CA 01 -> SIMSI2027 Root CA (self-signed)');
check(await leaf.x509.verify({ publicKey: ica.x509, signatureOnly: true }), 'leaf signature verifies with the issuing CA key');
check(await ica.x509.verify({ publicKey: rootc.x509, signatureOnly: true }), 'issuing CA signature verifies with the root key');
check(await crl.x509.verify({ publicKey: ica.x509 }), `CRL #${crl.crlNumber} signature verifies with the issuing CA key`);
check(evidence.healthy.firstFailure === null, 'healthy evaluation passes every check');
for (const f of scenario.faults.filter((x) => x.id !== 'healthy')) check(evidence[f.id].failStage === f.failStage, `fault ${f.id} fails at ${f.failStage}`);


check(dcEvidence.healthy.firstFailure === null, 'DC healthy evaluation passes every check');
for (const f of dcScenario.faults.filter((x) => x.id !== 'healthy')) check(dcEvidence[f.id].failStage === f.failStage, `DC fault ${f.id} fails at ${f.failStage}`);
// Domain Controller scenario fixtures
const dcCsr = model.resolve('dc-csr', null).parsed, dcCert = model.resolve('dc-cert', null).parsed, dcInf = model.resolve('dc-inf', null).parsed;
check(dcCsr.signatureValid && dcCsr.publicKey.spkiSha256 === dcCert.publicKey.spkiSha256, 'DC CSR signature valid and its key is the DC certificate key');
check(dcCert.san.some((n) => n.value === 'DC01.simsi2027.test') && dcCsr.san.some((n) => n.value === 'DC01.simsi2027.test'), 'DC CSR and certificate SAN contain DC01.simsi2027.test');
check(['Client Authentication', 'Server Authentication', 'KDC Authentication'].every((n) => dcCert.eku.some((e) => e.name === n)), 'DC certificate has Client, Server and KDC Authentication EKUs');
check(await dcCert.x509.verify({ publicKey: ica.x509, signatureOnly: true }) && dcCert.issuer === ica.subject, 'DC certificate is signed by the issuing CA (not the root)');
check(dcInf.machineContext && dcInf.template === 'KerberosAuthentication', 'DC request policy asks for machine context and the KerberosAuthentication template');
check(model.resolve('dc-cert', 'key-mismatch').parsed.publicKey.spkiSha256 !== dcCsr.publicKey.spkiSha256, 'key-mismatch fault certificate really has a different public key');

// Private key hygiene across the whole working tree (excluding node_modules/.git/dist).
const skip = new Set(['node_modules', '.git', 'dist', 'test-results', 'screenshots']);
const hits = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (skip.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(pfx|p12|key|pk8|jks)$/i.test(n)) hits.push(p);
    else if (/fixtures[\\/]/.test(p) || /\.(pem|csr|cer|der|crl)$/i.test(n)) { if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(readFileSync(p).toString('latin1'))) hits.push(p); }
  }
})(root);
check(hits.length === 0, `no private key / PFX files in the project tree${hits.length ? ': ' + hits.join(', ') : ''}`);
console.log(failures ? `\n${failures} validation failure(s)` : '\nAll fixture validations passed');
process.exit(failures ? 1 : 0);
