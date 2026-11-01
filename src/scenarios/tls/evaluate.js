// Evidence for the Website TLS story (v0.5.0). Real checks parse the generated fixtures; simulated checks are labelled as such.
import { TLS, ENV } from '../../artifacts/synthetic.js';
import { KIND } from './shared.js';

const SERVER_AUTH = '1.3.6.1.5.5.7.3.1';
export async function evaluateTls(model, faultId, scenario) {
  const fault = scenario.faults.find((f) => f.id === faultId) ?? { id: 'healthy', label: 'Healthy' };
  const fx = (artifactId) => scenario.resolveFixture(model, artifactId, faultId)?.parsed;
  const csr = fx('csr'), leaf = fx('leaf'), inf = fx('inf'), temp = model.resolve('selfsigned', null).parsed;
  const ica = model.resolve('ica', null).parsed, root = model.resolve('root', null).parsed, crl = model.resolve('crl', null).parsed;
  const now = model.now, at = now.toISOString().replace('.000Z', 'Z');
  const checks = [];
  const add = (id, stage, label, ok, detail, basis) => checks.push({ id, stage, label, status: ok ? 'pass' : 'fail', detail, timestamp: at, basis, kind: !ok && faultId !== 'healthy' ? KIND.FAULT : basis });
  const f = (id) => faultId === id;
  const short = (h) => `${h.slice(0, 16)}…`;

  add('selfsigned', 't-warning', 'The temporary certificate is self-signed and not trusted by CLIENT01', temp.selfSigned && temp.issuer !== ica.subject,
    `${temp.subject} is issued by itself (${temp.issuer}); CLIENT01's trust anchor is ${root.subject}, so no chain exists.`, KIND.REAL);
  add('pop', 't-inspect-csr', 'CSR signature proves possession of the private key', csr.signatureValid, `Signature verifies with the request's own public key (SPKI SHA-256 ${short(csr.publicKey.spkiSha256)}).`, KIND.REAL);
  add('csr-no-key', 't-inspect-csr', 'CSR contains no private key', !csr.hasPrivateKeyMaterial, 'Only the public key, the requested name, extensions and attributes are present.', KIND.REAL);
  add('received', 't-submit', `ICA01 received request ${TLS.requestId}`, true, `Request ${TLS.requestId} received from WEB01; Requester ${TLS.owner} (authenticated submitter).`, KIND.SIM);
  add('published', 't-policy', `Template ${TLS.template.name} published on ICA01`, !f('template-not-published'), f('template-not-published') ? `ICA01 does not list ${TLS.template.name}.` : `ICA01 lists ${TLS.template.name}.`, KIND.SIM);
  add('permission', 't-policy', `${TLS.owner} may enroll`, !f('no-enroll-permission'), f('no-enroll-permission') ? `Denied: ${TLS.owner} is not in "${TLS.requesterGroup}".` : `"${TLS.requesterGroup}": Read, Enroll (Morgan is a member).`, KIND.SIM);
  add('request-content', 't-policy', 'Supplied name, key size and template attribute are allowed', csr.templateAttribute === TLS.template.name && csr.publicKey.bits >= 2048 && csr.san.length > 0,
    `Template attribute ${csr.templateAttribute}; RSA ${csr.publicKey.bits}; SAN ${csr.san.map((n) => `${n.type}=${n.value}`).join(', ')}.`, KIND.REAL);
  const sigLeaf = await leaf.x509.verify({ publicKey: ica.x509, signatureOnly: true }), byRoot = await leaf.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('issued', 't-sign', 'New certificate signed by the Issuing CA (not the Root)', sigLeaf && !byRoot && leaf.publicKey.spkiSha256 === csr.publicKey.spkiSha256,
    `Signed by ${ica.subject}: ${sigLeaf}; signed by the Root: ${byRoot}; public key copied from the CSR: ${leaf.publicKey.spkiSha256 === csr.publicKey.spkiSha256}.`, KIND.REAL);
  add('context', 't-accept', 'Request created in machine context', inf.machineContext,
    `INF MachineKeySet = ${inf.fields['NewRequest.MachineKeySet']}; Exportable = ${inf.fields['NewRequest.Exportable']}.${inf.machineContext ? '' : ' certreq -accept -machine finds no pending machine request.'}`, KIND.REAL);
  add('key-match', 't-stores', 'Leaf public key equals the CSR public key', leaf.publicKey.spkiSha256 === csr.publicKey.spkiSha256, `SPKI SHA-256 ${short(leaf.publicKey.spkiSha256)} on both.`, KIND.REAL);
  add('key', 't-bind', 'The bound certificate has its private key on WEB01', !f('no-private-key'),
    f('no-private-key') ? 'Personal holds portal.simsi2027.test without a private key (imported from portal.cer, never accepted).' : 'Personal shows the certificate with its private key; the binding can use it.', f('no-private-key') ? KIND.DERIVED : KIND.SIM);
  add('binding', 't-cert-msg', 'WEB01 presents the new certificate for SNI portal.simsi2027.test', !f('wrong-binding'),
    f('wrong-binding') ? `Presented ${temp.subject} (self-signed, serial ${temp.serialNumber}).` : `Presented ${leaf.subject} (serial ${leaf.serialNumber}) and the Issuing CA certificate.`, KIND.SIM);
  add('proof', 't-proof', 'CertificateVerify verifies with the leaf public key', true, `Signature over the handshake verifies with the leaf key (SPKI SHA-256 ${short(leaf.publicKey.spkiSha256)}); the private key was used on WEB01 only.`, KIND.DERIVED);
  add('chain-ica', 't-chain', 'Issuing CA certificate available to CLIENT01', !f('missing-ica'),
    f('missing-ica') ? `WEB01 sent only the leaf; HTTP GET ${leaf.aia[0]?.location} failed.` : `Received in the handshake: ${ica.subject}. AIA (${leaf.aia[0]?.location}) not needed.`, KIND.SIM);
  add('root', 't-chain', 'Root in CLIENT01\'s Trusted Root store', !f('untrusted-root'),
    f('untrusted-root') ? `CLIENT01 Trusted Root store does not contain ${root.subject} (SHA-256 ${short(root.thumbprints.sha256)}).` : `${root.subject} (SHA-256 ${short(root.thumbprints.sha256)}) found; source Enterprise (AD) / Group Policy.`, KIND.SIM);
  const sigIca = await ica.x509.verify({ publicKey: root.x509, signatureOnly: true });
  add('signatures', 't-signatures', 'Chain signatures verify (leaf → Issuing CA → Root)', sigLeaf && sigIca, `Leaf by ICA: ${sigLeaf}; ICA by Root: ${sigIca}.`, KIND.REAL);
  const sans = leaf.san.filter((n) => n.type === 'DNS').map((n) => n.value.toLowerCase());
  add('name', 't-checks', `SAN contains ${ENV.web.site}`, sans.includes(ENV.web.site), `Typed host ${ENV.web.site}; certificate SAN: ${leaf.san.map((n) => `${n.type}=${n.value}`).join(', ') || 'none'} (the subject CN is not used for matching).`, KIND.REAL);
  add('dates', 't-checks', 'Within validity at the simulation clock', new Date(leaf.notBefore) <= now && now <= new Date(leaf.notAfter), `Clock ${at}; valid ${leaf.notBefore} to ${leaf.notAfter}.`, KIND.REAL);
  add('eku', 't-checks', 'EKU allows Server Authentication', leaf.eku.some((e) => e.oid === SERVER_AUTH), `EKU: ${leaf.eku.map((e) => e.name).join(', ') || 'none'}; required: Server Authentication (${SERVER_AUTH}).`, KIND.REAL);
  add('ku', 't-checks', 'Key Usage suits TLS', leaf.keyUsage.includes('Digital Signature'), `KU: ${leaf.keyUsage.join(', ')}${leaf.keyUsageCritical ? ' (critical)' : ''}.`, KIND.REAL);
  const cdpOk = !f('cdp-unavailable');
  add('cdp', 't-revocation', 'CRL obtainable from the CDP', cdpOk, cdpOk ? `HTTP GET ${leaf.cdp[0]} returned CRL #${crl.crlNumber}.` : `HTTP GET ${leaf.cdp[0]} timed out: revocation status unknown; this client fails closed.`, KIND.SIM);
  const crlSig = await crl.x509.verify({ publicKey: ica.x509 }), listed = crl.entries.find((e) => e.serialNumber === leaf.serialNumber);
  const fresh = new Date(crl.thisUpdate) <= now && now <= new Date(crl.nextUpdate);
  add('revocation', 't-revocation', 'Not revoked (CRL signed by the Issuing CA, current)', cdpOk && crlSig && fresh && !listed,
    !cdpOk ? 'Not evaluated: no CRL could be retrieved.' : listed ? `Serial ${leaf.serialNumber} is listed in CRL #${crl.crlNumber}: revoked ${listed.revocationDate}, reason ${listed.reason}.` : `CRL #${crl.crlNumber} signature ${crlSig}, current ${fresh}; serial ${leaf.serialNumber} not listed.`, KIND.REAL);

  const order = scenario.stages.map((s) => s.id);
  const sorted = [...checks].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  const first = sorted.find((c) => c.status === 'fail') ?? null;
  return { faultId, label: fault.label, checks: sorted, firstFailure: first, failStage: first?.stage ?? null, timestamp: at,
    aia: { raw: leaf.aia.map((a) => a.location), resolved: leaf.aia[0]?.location, expected: ica.subject, result: f('missing-ica') ? 'Failed (unreachable)' : 'Not needed: the Issuing CA certificate came in the handshake', ok: !f('missing-ica'), timestamp: at },
    cdp: { raw: leaf.cdp, resolved: leaf.cdp[0], expected: `CRL issued by ${crl.issuer}`, result: cdpOk ? 'Retrieved (HTTP 200)' : 'Failed (timeout)', ok: cdpOk, timestamp: at } };
}
