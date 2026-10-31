// Evidence for the Domain Controller scenario. Real checks parse the generated fixtures; simulated checks are labelled as such.
import { ENV, DC, URLS } from '../artifacts/synthetic.js';

const KDC = '1.3.6.1.5.2.3.5', CLIENT = '1.3.6.1.5.5.7.3.2', SERVER = '1.3.6.1.5.5.7.3.1';

export async function evaluateDc(model, faultId, scenario) {
  const fault = scenario.faults.find((f) => f.id === faultId);
  const csr = model.resolve('dc-csr', faultId).parsed, cert = model.resolve('dc-cert', faultId).parsed, inf = model.resolve('dc-inf', faultId).parsed;
  const ica = model.resolve('ica', null).parsed, root = model.resolve('root', null).parsed, crl = model.resolve('crl', null).parsed;
  const now = model.now, at = now.toISOString().replace('.000Z', 'Z');
  const checks = [];
  const add = (id, stage, label, ok, detail, basis, extra = {}) => checks.push({ id, stage, label, status: ok ? 'pass' : 'fail', detail, timestamp: at, basis, kind: !ok && faultId !== 'healthy' ? 'User-selected fault' : basis, ...extra });
  const SIM = 'Simulated environment', REAL = 'Real fixture data';

  const published = faultId !== 'template-not-published';
  add('template', 'choose-template', `Template ${DC.template} is published`, published, published ? `${ENV.issuingCa} lists ${DC.template} (template OID ${cert.template?.oid ?? DC.templateOid}, version ${cert.template?.version ?? DC.templateVersion}).` : `${ENV.issuingCa} does not list ${DC.template}; certreq would report that the template is unavailable.`, SIM);
  const perm = faultId !== 'no-enroll-permission';
  add('permission', 'verify-permission', 'DC01 has Read and Enroll on the template', perm, perm ? 'Domain Controllers group (containing DC01$) has Read and Enroll on the template.' : 'DC01$ has Read but no Enroll permission; the CA would deny the request.', SIM);
  add('pop', 'inspect-csr', 'CSR signature proves possession of the private key', csr.signatureValid, `The CSR signature verifies with the public key inside it (SHA-256 of key ${csr.publicKey.spkiSha256.slice(0, 16)}…).`, REAL);
  const reachable = faultId !== 'ca-unavailable';
  add('ca-available', 'submit', 'Issuing CA reachable', reachable, reachable ? `${DC.caConfig} answered the submission.` : `${DC.caConfig} did not respond (RPC server unavailable). Nothing was sent to the CA.`, SIM);
  add('context', 'evaluate-policy', 'Request created in Local Computer (machine) context', inf.machineContext, `Request policy: MachineKeySet = ${inf.fields['NewRequest.MachineKeySet']}. ${inf.machineContext ? 'The key lives in the Local Computer store.' : 'The key would live in the operator\'s user store, which a Domain Controller template does not accept.'}`, REAL);
  const approved = faultId !== 'pending-approval';
  add('disposition', 'evaluate-policy', 'Request disposition is "Issued"', approved, approved ? `Template ${DC.template} auto-issues in this simulation.` : `Request ${DC.requestId} is Pending: the template requires CA manager approval in this fault.`, SIM);
  const keyOk = cert.publicKey.spkiSha256 === csr.publicKey.spkiSha256;
  add('key-match', 'key-match', 'Certificate public key matches the DC01 key pair', keyOk, keyOk ? `Certificate and CSR share public key SHA-256 ${cert.publicKey.spkiSha256.slice(0, 16)}….` : `Certificate key ${cert.publicKey.spkiSha256.slice(0, 16)}… differs from the CSR key ${csr.publicKey.spkiSha256.slice(0, 16)}…; no private key on DC01 corresponds to it.`, REAL);
  const dnsOk = cert.san.some((n) => n.type === 'DNS' && n.value.toLowerCase() === DC.fqdn.toLowerCase()) && /CN=DC01\.simsi2027\.test/i.test(cert.subject);
  add('name', 'inspect-purposes', 'Subject and SAN identify DC01.simsi2027.test', dnsOk, `Subject ${cert.subject}; SAN ${cert.san.map((n) => `${n.type}=${n.value}`).join(', ') || 'none'}.`, REAL);
  const have = new Set(cert.eku.map((e) => e.oid));
  const ekuOk = [CLIENT, SERVER, KDC].every((o) => have.has(o));
  add('eku', 'inspect-purposes', 'EKUs include Client, Server and KDC Authentication', ekuOk, `Certificate EKUs: ${cert.eku.map((e) => e.name).join(', ') || 'none'}; required in this simulation: Client Authentication, Server Authentication, KDC Authentication.`, REAL);
  const datesOk = [cert, ica, root].every((c) => new Date(c.notBefore) <= now && now <= new Date(c.notAfter));
  add('dates', 'inspect-purposes', 'Validity dates', datesOk, `Evaluation time ${at}; certificate valid ${cert.notBefore} to ${cert.notAfter}.`, REAL);
  const aiaOk = faultId !== 'ica-cert-unavailable';
  add('aia', 'verify-chain', 'Issuing CA certificate obtainable (AIA)', aiaOk, aiaOk ? `GET ${cert.aia[0]?.location} returned 200 (${ica.subject}).` : `GET ${cert.aia[0]?.location} returned 404 (not published on ${ENV.pubServer}).`, SIM, { url: cert.aia[0]?.location });
  const sigLeaf = await cert.x509.verify({ publicKey: ica.x509, signatureOnly: true }), sigIca = await ica.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('signatures', 'verify-chain', 'Signatures along the chain', sigLeaf && sigIca, `Certificate signed by ${ica.subject}: ${sigLeaf}; ${ica.subject} signed by ${root.subject}: ${sigIca}.`, REAL);
  add('root', 'verify-chain', 'Chain ends at the trusted SIMSI2027-ROOTCA', true, `${root.subject} (SHA-256 ${root.thumbprints.sha256.slice(0, 16)}…) is in the Trusted Root store.`, SIM);
  const cdpOk = faultId !== 'cdp-unavailable';
  add('cdp', 'verify-chain', 'CRL obtainable (CDP)', cdpOk, cdpOk ? `GET ${cert.cdp[0]} returned 200 (CRL #${crl.crlNumber}).` : `GET ${cert.cdp[0]} timed out (${ENV.pubServer} CDP unavailable); revocation status is unknown.`, SIM, { url: cert.cdp[0] });
  const listed = crl.entries.some((e) => e.serialNumber === cert.serialNumber);
  add('revocation', 'verify-chain', 'Certificate is not revoked', cdpOk && !listed, !cdpOk ? 'Not evaluated: no CRL could be retrieved.' : listed ? 'Serial listed in the CRL.' : `Serial ${cert.serialNumber} is not listed in CRL #${crl.crlNumber}.`, REAL);

  const order = scenario.stages.map((s) => s.id);
  const sorted = [...checks].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  const first = sorted.find((c) => c.status === 'fail') ?? null;
  return { faultId, label: fault.label, checks: sorted, firstFailure: first, failStage: first?.stage ?? null, timestamp: at,
    aia: { raw: cert.aia.map((a) => a.location), resolved: cert.aia[0]?.location, expected: ica.subject, result: aiaOk ? 'Retrieved (HTTP 200)' : 'Failed (HTTP 404)', ok: aiaOk, timestamp: at },
    cdp: { raw: cert.cdp, resolved: cert.cdp[0], expected: `CRL issued by ${crl.issuer}`, result: cdpOk ? 'Retrieved (HTTP 200)' : 'Failed (timeout)', ok: cdpOk, timestamp: at } };
}
void URLS;
