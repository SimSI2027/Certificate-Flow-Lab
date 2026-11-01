// Evidence for the Domain Controller story (v0.4.0). Real checks parse the generated fixtures; simulated checks are labelled as such.
// The evaluated scenario is a path view (pathOf): scenario.pathId is 'csr' (Path A) or 'mmc' (Path B).
import { ENV, DC, OIDS } from '../artifacts/synthetic.js';
import { KIND } from './dc/shared.js';

const KDC = OIDS.kdcAuth;
// Known-good Root thumbprint from the (simulated) change record is the real Root fixture's SHA-1.
export async function evaluateDc(model, faultId, scenario) {
  const pathId = scenario.pathId ?? 'csr', A = pathId === 'csr';
  const fault = scenario.faults.find((f) => f.id === faultId) ?? { id: 'healthy', label: 'Healthy' };
  const fx = (artifactId) => scenario.resolveFixture(model, artifactId, faultId)?.parsed;
  const csr = fx('csr'), cert = fx('accepted'), inf = model.resolve('dc-inf', faultId).parsed;
  const ica = model.resolve('ica', null).parsed, root = model.resolve('root', null).parsed, crl = model.resolve('crl', null).parsed;
  const rootFile = A ? fx('root') : root;
  const now = model.now, at = now.toISOString().replace('.000Z', 'Z');
  const checks = [];
  const add = (id, stage, label, ok, detail, basis) => { if (!stage) return; checks.push({ id, stage, label, status: ok ? 'pass' : 'fail', detail, timestamp: at, basis, kind: !ok && faultId !== 'healthy' ? KIND.FAULT : basis }); };
  const S = (a, b) => (A ? a : b);
  const f = (id) => faultId === id;

  if (A) add('rpc-diagnosis', 'a-why', 'Autoenrollment failure diagnosed: DC01 → ICA01 RPC/DCOM blocked', true, '"The RPC server is unavailable" (0x800706BA) recorded from certutil -ping on DC01.', KIND.SIM);
  else add('rpc', 'b-enroll', 'DC01 reaches ICA01 over RPC/DCOM', !f('rpc-blocked'), f('rpc-blocked') ? 'Enrollment failed: "The RPC server is unavailable" (0x800706BA).' : 'Request delivered to ICA01; Requester SIMSI2027\\DC01$.', KIND.SIM);
  add('pop', S('a-inspect-csr', 'b-enroll'), 'Request signature proves possession of the private key', csr.signatureValid, `Signature verifies with the request's own public key (SPKI SHA-256 ${csr.publicKey.spkiSha256.slice(0, 16)}…).`, KIND.REAL);
  add('no-private-key', S('a-inspect-csr', 'b-enroll'), 'Request contains no private key', !csr.hasPrivateKeyMaterial, 'Only the public key, names and attributes are present.', KIND.REAL);
  const tpl = A ? DC.offlineTemplate : DC.template;
  add('published', S('a-policy', 'b-template'), `Template ${tpl} published on ICA01`, !f('template-not-published'), f('template-not-published') ? `ICA01 does not list ${tpl}.` : `ICA01 lists ${tpl}.`, KIND.SIM);
  add('permission', S('a-policy', 'b-permission'), A ? 'PKI Operators may enroll' : 'DC01$ has Read and Enroll', !f('no-enroll-permission'),
    f('no-enroll-permission') ? (A ? 'Denied: SIMSI2027\\PKIOperator lacks Enroll.' : 'Template hidden; "Show all templates" reports missing Enroll permission.') : (A ? 'PKI Operators: Read, Enroll.' : 'Domain Controllers / Enterprise Domain Controllers: Read, Enroll.'), KIND.SIM);
  if (A) {
    add('handoff-template', 'a-policy', 'Submitted for the offline-handoff template', !f('wrong-template-handoff'), f('wrong-template-handoff') ? `Denied: submitted for ${DC.template}; the CA built names from PKIOperator's user object, which has no DNS name. CSR attribute reads ${csr.templateAttribute}.` : `CSR template attribute ${csr.templateAttribute}; supplied SANs recorded.`, f('wrong-template-handoff') ? KIND.SIM : KIND.REAL);
    add('approval', 'a-approve', 'Certificate manager approved the request', !f('pending-no-approver'), f('pending-no-approver') ? `Request ${DC.requestId} remains pending.` : `Approved by ${DC.certManager}.`, KIND.SIM);
  }
  const sigLeaf = await cert.x509.verify({ publicKey: ica.x509, signatureOnly: true }), byRoot = await cert.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('issued', S('a-sign', 'b-issue'), 'Leaf signed by the Issuing CA (not the Root)', sigLeaf && !byRoot, `Signed by ${ica.subject}: ${sigLeaf}; signed by the Root: ${byRoot}.`, KIND.REAL);
  if (A) {
    const known = root.thumbprints.sha1, got = rootFile.thumbprints.sha1;
    add('root-thumbprint', 'a-return-move', 'Root thumbprint equals the change record', known === got, `File thumbprint ${got} (computed from the file); change record ${known} (simulated record).`, KIND.REAL);
    add('pending', 'a-accept', 'Pending request with the private key exists on DC01', !f('pending-request-lost'), f('pending-request-lost') ? 'Local Computer\\Certificate Enrollment Requests is empty.' : `Pending request present in ${f('user-context') ? 'the operator\'s user store only' : 'Local Computer\\Certificate Enrollment Requests'}.`, KIND.SIM);
    add('context', 'a-accept', 'Request created in machine context', inf.machineContext, `INF MachineKeySet = ${inf.fields['NewRequest.MachineKeySet']}; Exportable = ${inf.fields['NewRequest.Exportable']}.${inf.machineContext ? '' : ' certreq -accept -machine finds no pending machine request.'}`, KIND.REAL);
    add('accept-host', 'a-accept', 'certreq -accept ran on the original DC01', !f('accepted-on-wrong-machine'), f('accepted-on-wrong-machine') ? 'Run on PKI-TRANSFER01: no pending request, certificate shown without a private key.' : 'Run on DC01.', KIND.DERIVED);
  }
  // Fault certificate fixtures are shared by both paths and were issued for the Path A request key (documented deviation).
  const sharedFaultCert = !A && !!scenario.faults.find((x) => x.id === faultId)?.fixtures?.['dc-cert'];
  const keyRef = sharedFaultCert ? model.resolve('dc-csr', null).parsed : csr;
  const keyOk = cert.publicKey.spkiSha256 === keyRef.publicKey.spkiSha256;
  add('key-match', S('a-key', 'b-verify'), 'Leaf public key equals the request public key', keyOk, (keyOk ? `SPKI SHA-256 ${cert.publicKey.spkiSha256.slice(0, 16)}… on both.` : `Certificate ${cert.publicKey.spkiSha256.slice(0, 16)}… vs request ${keyRef.publicKey.spkiSha256.slice(0, 16)}….`) + (sharedFaultCert ? ' (Fault fixture shared with Path A; compared with the request it was issued for.)' : ''), KIND.REAL);
  const eku = cert.eku.some((e) => e.oid === KDC);
  const sans = cert.san.map((n) => n.value.toLowerCase());
  const pStage = S('a-purposes', 'b-verify');
  add('eku', pStage, 'EKU includes KDC Authentication', eku, `EKUs: ${cert.eku.map((e) => e.name).join(', ')}.`, KIND.REAL);
  add('san', pStage, 'SAN includes DC01.simsi2027.test and simsi2027.test', sans.includes(DC.fqdn.toLowerCase()) && sans.includes(DC.domainDns), `SAN: ${cert.san.map((n) => `${n.type}=${n.value}`).join(', ')}.`, KIND.REAL);
  add('dates', pStage, 'Within validity at the simulation clock', new Date(cert.notBefore) <= now && now <= new Date(cert.notAfter), `Clock ${at}; valid ${cert.notBefore} to ${cert.notAfter}.`, KIND.REAL);
  const cStage = S('a-chain', 'b-chain');
  const sigIca = await ica.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('signatures', cStage, 'Chain signatures verify (leaf → Issuing CA → Root)', sigLeaf && sigIca, `Leaf by ICA: ${sigLeaf}; ICA by Root: ${sigIca}.`, KIND.REAL);
  const cdpOk = !f('cdp-unreachable');
  add('cdp', cStage, 'CRL obtainable from the CDP', cdpOk, cdpOk ? `HTTP GET ${cert.cdp[0]} returned CRL #${crl.crlNumber}.` : `HTTP GET ${cert.cdp[0]} timed out: CRYPT_E_REVOCATION_OFFLINE (0x80092013).`, KIND.SIM);
  const crlSig = await crl.x509.verify({ publicKey: ica.x509 }), listed = crl.entries.some((e) => e.serialNumber === cert.serialNumber);
  add('revocation', cStage, 'Not revoked (CRL signed by the Issuing CA, current)', cdpOk && crlSig && !listed, cdpOk ? `CRL #${crl.crlNumber} signature ${crlSig}; serial ${cert.serialNumber} listed: ${listed}.` : 'Not evaluated: revocation status unknown.', KIND.REAL);

  const order = scenario.stages.map((s) => s.id);
  const sorted = [...checks].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  const first = sorted.find((c) => c.status === 'fail') ?? null;
  return { faultId, label: fault.label, checks: sorted, firstFailure: first, failStage: first?.stage ?? null, timestamp: at, pathId,
    aia: { raw: cert.aia.map((a) => a.location), resolved: cert.aia[0]?.location, expected: ica.subject, result: 'Not needed: the Issuing CA certificate is in the Intermediate store', ok: true, timestamp: at },
    cdp: { raw: cert.cdp, resolved: cert.cdp[0], expected: `CRL issued by ${crl.issuer}`, result: cdpOk ? 'Retrieved (HTTP 200)' : 'Failed (timeout)', ok: cdpOk, timestamp: at } };
}
void ENV;
