// Domain Controller Manual Enrollment (v0.4.0): shared story data for Path A (manual CSR transfer) and Path B (Certificates MMC enrollment).
// Educational simulation only: nothing here contacts a real CA, Active Directory or certificate store, and no command is ever executed.
import { DC, URLS } from '../../artifacts/synthetic.js';
import { CFG, cfg, NEVER_EXECUTED, KIND, ZONE_GEOMETRY, OFFLINE_TRUST, PUB, tokenize, makeCommand } from '../story-common.js';

// Shared story vocabulary (also used by the Website TLS lesson) lives in ../story-common.js; re-exported here for the DC modules.
export { CFG, cfg, NEVER_EXECUTED, KIND, ZONE_GEOMETRY, OFFLINE_TRUST, PUB, tokenize };

// ---------- Zones (story layout; coordinates in a 1600 x 720 viewBox) ----------
export const ZONES = [
  { id: 'Z1', n: 1, name: 'DC01 — diagnose and key ownership', title: '1 · DC01', lines: ['Diagnose and key ownership', 'DC01 (same computer)'], sameComputer: true },
  { id: 'Z2', n: 2, name: 'Request package — INF and CSR', title: '2 · Request package', lines: ['INF and CSR'],
    mmc: { name: 'Enrollment wizard', title: '2 · Enrollment wizard', lines: ['Request built in memory'] } },
  { id: 'Z3', n: 3, name: 'Controlled transfer — PKI-TRANSFER01', title: '3 · Controlled transfer', lines: ['PKI-TRANSFER01'],
    mmc: { name: 'Direct RPC/DCOM (no handoff)', title: '3 · Direct RPC/DCOM', lines: ['No handoff'] } },
  { id: 'Z4', n: 4, name: 'Issuing CA — submission, policy, approval, issuance', title: '4 · Issuing CA (ICA01)', lines: ['Submission, policy,', 'approval, issuance'] },
  { id: 'Z5', n: 5, name: 'Return package — leaf and public chain', title: '5 · Return package', lines: ['Leaf and public chain'],
    mmc: { name: 'Automatic response', title: '5 · Automatic response', lines: ['Installed by the wizard'] } },
  { id: 'Z6', n: 6, name: 'DC01 certificate stores', title: '6 · DC01 stores', lines: ['Certificate stores', 'DC01 (same computer)'], sameComputer: true }
].map((z, i) => ({ ...z, x: ZONE_GEOMETRY.xs[i], y: ZONE_GEOMETRY.y, w: ZONE_GEOMETRY.w, h: ZONE_GEOMETRY.h }));
export const zonesFor = (pathId) => ZONES.map((z) => (pathId === 'mmc' && z.mmc ? { ...z, ...z.mmc, mmc: undefined } : { ...z, mmc: undefined }));

// ---------- Stores on DC01 (Local Computer) ----------
export const STORES = [
  { id: 'personal', name: 'Personal', full: 'Local Computer\\Personal', y: 216 },
  { id: 'intermediate', name: 'Intermediate Certification Authorities', short: 'Intermediate CAs', full: 'Local Computer\\Intermediate Certification Authorities', y: 344 },
  { id: 'root', name: 'Trusted Root Certification Authorities', short: 'Trusted Root CAs', full: 'Local Computer\\Trusted Root Certification Authorities', y: 472 }
];
export const PENDING_STORE = { id: 'requests', name: 'Certificate Enrollment Requests', full: 'Local Computer\\Certificate Enrollment Requests' };
// Which certificate belongs in which Local Computer store, and whether DC01 holds its private key (golden rules 18-21).
export const STORE_MAP = { leaf: { store: 'personal', privateKeyOnDc01: true }, ica: { store: 'intermediate', privateKeyOnDc01: false }, root: { store: 'root', privateKeyOnDc01: false } };

// ---------- Template cards (golden rules 13-16) ----------
export const ESC1_WARNING = 'A template whose subject is "Supply in the request" and that carries an authentication EKU lets an enrollee name any identity. That is a privilege-escalation path (commonly catalogued as "ESC1") unless enrollment rights are tightly restricted, CA certificate manager approval is required, publication is temporary and issuance is audited.';
export const TEMPLATE_CARDS = [
  { id: 'offline', name: DC.offlineTemplate, display: DC.offlineTemplateDisplay, oid: DC.offlineTemplateOid, version: DC.offlineTemplateVersion, path: 'csr', simulated: true,
    rows: [['Subject name', 'Supply in the request'], ['Enroll', `Only the "${DC.operatorGroup}" group`], ['Issuance requirement', 'CA certificate manager approval'], ['Autoenroll', 'No'], ['Publication', 'On ICA01 only for the duration of the change'], ['Status', 'Organization-specific, simulated']],
    warning: ESC1_WARNING },
  { id: 'kerberos', name: DC.template, display: 'Kerberos Authentication', oid: DC.templateOid, version: DC.templateVersion, path: 'mmc',
    rows: [['Subject name', 'Built from Active Directory'], ['Depends on', 'DC01 → ICA01 RPC/DCOM connectivity'], ['Enroll', cfg('SIMSI2027\\DC01$ needs Read and Enroll, normally through Domain Controllers or Enterprise Domain Controllers.', 'the template permission defaults')]],
    why: 'Cannot be used in Path A: when PKIOperator submits, the CA builds the identity from the submitter, not from DC01.' },
  { id: 'dcauth', name: DC.altTemplate, display: 'Domain Controller Authentication', comparison: true,
    rows: [['EKU', 'Client Authentication, Server Authentication, Smart Card Logon'], ['SAN', 'DC DNS name and DC object GUID'], ['Lacks', 'KDC Authentication EKU and the domain-name SAN this lesson\'s strict-KDC check expects']],
    note: 'Comparison only: a different valid profile, not universally wrong or right.' }
];

// ---------- Artifact vocabulary (icon + fixed label + colour token; colour is never the only signal) ----------
export const ARTIFACTS = {
  'private-key': { label: 'Private key', icon: 'a-key', color: 'amber', tag: 'stays on DC01', inspectable: false, transport: false },
  inf: { label: 'Request policy (INF)', icon: 'a-doc', color: 'grey', tag: 'local file on DC01', role: 'dc-inf' },
  csr: { label: 'CSR', icon: 'a-envelope', color: 'blue', tag: 'public key + names · signed by DC01 key', role: 'dc-csr', mmcRole: 'dc-mmc-csr' },
  package: { label: 'Transfer package', icon: 'a-box', color: 'slate', tag: 'CSR + SHA-256 hash', chips: ['dc01-request.req', 'SHA-256 hash'], stamp: 'no private key' },
  record: { label: 'Request record', icon: 'a-ledger', color: 'purple', tag: `Request ${DC.requestId}` },
  leaf: { label: 'Issued leaf', icon: 'a-ribbon', color: 'gold', tag: 'DC01 certificate · public', role: 'dc-cert', mmcRole: 'dc-enrolled' },
  accepted: { label: 'Accepted leaf', mmcLabel: 'Installed leaf', icon: 'a-ribbon-key', color: 'gold', tag: 'in Personal with its private key', mmcTag: 'installed by the wizard with its private key', role: 'dc-cert', mmcRole: 'dc-enrolled' },
  ica: { label: 'Issuing CA certificate', icon: 'a-cert-ca', color: 'teal', tag: 'no private key here', role: 'ica' },
  root: { label: 'Root CA certificate', icon: 'a-cert-anchor', color: 'green', tag: 'public copy · trust anchor · no private key here', role: 'root' },
  chain: { label: 'Chain', icon: 'a-chain', color: 'teal', tag: 'leaf → Issuing CA → Root', role: 'dc-chain' },
  return: { label: 'Return package', icon: 'a-box', color: 'slate', tag: 'public certificates only', chips: ['dc01-issued.cer', 'dc01-return.p7b', 'simsi2027-ica01.cer', 'simsi2027-rootca.cer', 'SHA-256 manifest'], stamp: 'no private key', role: 'dc-p7b' },
  crl: { label: 'CRL', icon: 'a-doc', color: 'grey', tag: 'revocation list from the CDP', role: 'crl' },
  error: { label: 'Error record', icon: 'a-alert', color: 'red', tag: 'The RPC server is unavailable · 0x800706BA' },
  identity: { label: 'Identity card', icon: 'a-id', color: 'slate', tag: 'DC01.simsi2027.test' },
  template: { label: 'Template card', icon: 'a-template', color: 'purple', tag: DC.offlineTemplate, mmcTag: DC.template },
  wizard: { label: 'Enrollment wizard', icon: 'a-wizard', color: 'slate', tag: 'Request New Certificate…' },
  remediation: { label: 'Remediation card', icon: 'a-check', color: 'slate', tag: 'root cause still open' }
};
// Path-aware label and tag (Path B has no accept step, so its leaf is "installed", not "accepted").
export const artifactLabel = (id, pathId) => (pathId === 'mmc' && ARTIFACTS[id]?.mmcLabel) || ARTIFACTS[id]?.label || id;
export const artifactTag = (id, pathId) => (pathId === 'mmc' && ARTIFACTS[id]?.mmcTag) || ARTIFACTS[id]?.tag || '';

// ---------- Commands: every token has a meaning; nothing is executed ----------
const TOKENS = {
  'certreq': 'Windows certificate request tool (certreq.exe).',
  '-new': 'Create a new key pair and a signed request from an INF policy file, in one operation.',
  '-machine': 'Use the Local Computer (machine) context instead of the current user.',
  '-submit': 'Send a request file to a certification authority.',
  '-config': 'Name the CA to use, as "CA host\\CA name".',
  '-retrieve': 'Download the response for an existing request ID.',
  '-accept': 'Install a response and link it to the pending request that holds the private key.',
  '-attrib': 'Add or override request attributes at submission time.',
  'certutil': 'Windows certificate utility (certutil.exe).',
  '-store': 'List the certificates in a store.',
  'My': 'The Personal store.',
  'Root': 'The Trusted Root Certification Authorities store.',
  'CA': 'The Intermediate Certification Authorities store.',
  '-ping': 'Check that the CA answers its request interface (RPC/DCOM).',
  '-dump': 'Decode and display a file without changing anything.',
  '-addstore': 'Add a certificate to a local store.',
  '-f': 'Force: overwrite an existing entry.',
  '-verify': 'Build and verify the chain for a certificate.',
  '-urlfetch': 'Retrieve AIA and CDP URLs during verification.',
  '-verifystore': 'Verify certificates in a store, including the private-key link.',
  '-pulse': 'Trigger the autoenrollment task now.',
  '-dspublish': 'Publish a certificate into Active Directory.',
  'RootCA': 'The AD container for trusted root certificates (Enterprise store source).',
  'Get-FileHash': 'PowerShell: compute a file hash.',
  '-Algorithm': 'PowerShell: choose the hash algorithm.',
  'SHA256': 'Use SHA-256.',
  'dc01-request.inf': 'The request policy written on DC01.',
  'dc01-request.req': 'The CSR file (public key, names, attributes; no private key).',
  'dc01-issued.cer': 'The issued DC01 certificate (public).',
  'dc01-return.p7b': 'PKCS #7 file with the leaf and the public CA certificates.',
  'simsi2027-rootca.cer': 'Public copy of the Root CA certificate.',
  'simsi2027-ica01.cer': 'Public copy of the Issuing CA certificate.',
  [`"${DC.caConfig}"`]: 'CA configuration string: CA host ICA01.simsi2027.test, CA name SIMSI2027 Issuing CA 01 (derived from the Issuing CA certificate).',
  [String(DC.requestId)]: 'The request ID the CA assigned on submission.',
  '<serial>': 'The serial number of the accepted DC01 certificate.',
  '"CertificateTemplate:DCOfflineKerberosAuth"': 'Ask for the controlled offline-handoff template by its template name.',
  'certlm.msc': 'Certificates console for the Local Computer store.',
  'mmc': 'Microsoft Management Console, to which the Certificates snap-in is added.'
};
export const command = makeCommand(TOKENS);

// ---------- Conditions (Path A) ----------
export const CONDITIONS = [
  { id: 'trust-missing', label: 'Trust certificates missing on DC01', note: 'Exceptional condition for this lesson', default: true,
    longTerm: cfg('Repair AD publication, replication or Group Policy so the Root and Issuing CA certificates arrive in the Enterprise store, then remove the manual copies.', 'the distribution method') },
  { id: 'trust-present', label: 'Trust certificates present via AD (Enterprise store)' }
];

// ---------- Canonical initial state ----------
export const initialState = {
  dcCertState: 'unknown', rpcState: 'unknown', identityState: 'unchecked', templateState: 'unchecked', permissionState: 'unchecked', infState: 'none',
  keyState: 'absent', pendingRequest: 'none', csrState: 'none', packageState: 'none', requestRecord: 'none', approvalState: 'none', leafState: 'none',
  returnState: 'none', rootVerified: 'unchecked', keyAssociation: 'none', purposeState: 'unchecked', chainState: 'unchecked', revocationState: 'unchecked',
  aiaState: 'not-needed', trustDecision: 'none', followupState: 'none', storeView: 'closed',
  trust: { root: 'unknown', ica: 'unknown', rootSource: null, icaSource: null },
  requester: null, validation: { name: 'pending', dates: 'pending', eku: 'pending', signatures: 'pending', root: 'pending' }
};

// ---------- Faults (separate selector from Condition) ----------
// at: per-path stage where the fault manifests. stops=false continues to the verdict (verdict withheld).
export const FAULTS = [
  { id: 'rpc-blocked', label: 'RPC/DCOM blocked (DC01 → ICA01)', at: { mmc: 'b-enroll' }, stops: true, check: 'rpc',
    symptom: 'Wizard: enrollment failed, "The RPC server is unavailable" (0x800706BA).', evidence: [{ text: 'certutil -ping from DC01 to ICA01 fails.', kind: KIND.SIM }],
    owner: 'Network / firewall team', remediation: cfg('Restore DC01 → ICA01 RPC/DCOM, or switch to Path A as an approved exception.', 'which RPC/DCOM ports the CA and firewalls use'),
    longTerm: 'Document the firewall rule and verify autoenrollment afterwards.', switchPath: 'csr',
    patch: { rpcState: 'blocked', requestRecord: 'none', trustDecision: 'rejected' } },
  { id: 'wrong-template-handoff', label: 'Wrong template for the handoff', at: { csr: 'a-policy' }, stops: true, check: 'handoff-template',
    symptom: 'Denied: the CA built the names from PKIOperator\'s user object, which has no DNS name for a Domain Controller (the request was submitted for KerberosAuthentication).',
    evidence: [{ text: 'CA request record: Denied (KerberosAuthentication builds the subject from the authenticated requester).', kind: KIND.SIM }, { text: 'CSR template attribute (1.3.6.1.4.1.311.13.2.1) reads DCOfflineKerberosAuth; the submission overrode it.', kind: KIND.REAL }],
    owner: 'Operator', remediation: 'Resubmit with certreq -submit -attrib "CertificateTemplate:DCOfflineKerberosAuth", or create a new request.', longTerm: 'Update the runbook so the handoff always names the offline template.',
    patch: { requestRecord: 'denied', trustDecision: 'rejected' } },
  { id: 'no-enroll-permission', label: 'No Enroll permission', at: { csr: 'a-policy', mmc: 'b-permission' }, stops: true, check: 'permission',
    symptom: 'Path A: denied for PKIOperator. Path B: the template is hidden; "Show all templates" gives the permission reason.', evidence: [{ text: 'Template security: the requester lacks Enroll.', kind: KIND.SIM }],
    owner: 'PKI administrator', remediation: 'Grant Enroll to PKI Operators (Path A) or to the Domain Controller groups (Path B). Running elevated does not help: elevation is not a template permission.',
    longTerm: 'Periodic template ACL review.', patch: { permissionState: 'denied', requestRecord: 'denied', trustDecision: 'rejected' } },
  { id: 'template-not-published', label: 'Template not published', at: { csr: 'a-policy', mmc: 'b-template' }, stops: true, check: 'published',
    symptom: 'The template is not available on this CA.', evidence: [{ text: 'ICA01 certificate templates to issue does not list it.', kind: KIND.SIM }],
    owner: 'PKI administrator', remediation: cfg('Publish the template on ICA01 and wait for AD replication.', 'how long replication takes'), longTerm: 'Path A: unpublish the offline template again after the change.',
    patch: { templateState: 'missing', requestRecord: 'denied', trustDecision: 'rejected' } },
  { id: 'pending-no-approver', label: 'Pending, no approver', at: { csr: 'a-approve' }, stops: true, check: 'approval',
    symptom: `Request ${DC.requestId} remains pending.`, evidence: [{ text: `CA database: request ${DC.requestId} disposition "Taken Under Submission"; no certificate manager action.`, kind: KIND.SIM }],
    owner: 'CA certificate manager', remediation: `Approve after out-of-band verification, then certreq -retrieve ${DC.requestId}.`, longTerm: 'Ensure approval coverage for change windows.',
    patch: { approvalState: 'waiting', requestRecord: 'pending', trustDecision: 'rejected' } },
  { id: 'user-context', label: 'Request created in user context', at: { csr: 'a-accept' }, stops: true, check: 'context', fixtures: { 'dc-inf': 'user-context' },
    effects: { 'a-inf': { infState: 'written-user' }, 'a-new': { keyState: 'user-store', pendingRequest: 'user-store' } },
    symptom: 'Machine accept finds no pending machine request; the key sits in the operator\'s user store.', evidence: [{ text: 'fault-user-context.inf: MachineKeySet = FALSE.', kind: KIND.REAL }, { text: 'Local Computer\\Certificate Enrollment Requests is empty.', kind: KIND.SIM }],
    owner: 'Operator', remediation: 'Recreate the request in machine context (certreq -new -machine) and remove the stray user-store key and request.', longTerm: 'Add a machine-context check to the runbook.',
    // -accept -machine fails: nothing is linked or installed; the key stays where it was created (the operator's user store).
    patch: { pendingRequest: 'user-store', keyState: 'user-store', leafState: 'on-dc01', keyAssociation: 'missing', trustDecision: 'rejected' } },
  { id: 'accepted-on-wrong-machine', label: 'Accepted on the wrong machine', at: { csr: 'a-accept' }, stops: true, check: 'accept-host',
    symptom: 'The operator runs certreq -accept on PKI-TRANSFER01: no matching pending request; the certificate shows without a private key.',
    evidence: [{ text: 'No pending request with this public key exists on PKI-TRANSFER01, so no private key can be linked.', kind: KIND.DERIVED }, { text: 'Leaf public key (SPKI SHA-256) matches only DC01\'s request.', kind: KIND.REAL }],
    owner: 'Operator', remediation: 'Accept only on DC01; delete the keyless copy from PKI-TRANSFER01.', longTerm: 'Name the target host in the runbook step for certreq -accept.',
    // Nothing ran on DC01: its pending request and private key are untouched.
    patch: { pendingRequest: 'present', keyState: 'pending-on-dc01', keyAssociation: 'missing', leafState: 'keyless-copy', trustDecision: 'rejected' } },
  { id: 'pending-request-lost', label: 'Pending request lost', at: { csr: 'a-accept' }, stops: true, check: 'pending',
    symptom: `DC01 Certificate Enrollment Requests no longer holds request ${DC.requestId}'s key.`, evidence: [{ text: 'Local Computer\\Certificate Enrollment Requests has no entry for this public key.', kind: KIND.SIM }],
    owner: 'Operator', remediation: 'Run a new certreq -new on DC01 and resubmit; revoke the orphan certificate per policy.', longTerm: 'Investigate request-store cleanup.',
    // Without the pending request, -accept cannot link a key and installs nothing.
    patch: { pendingRequest: 'lost', keyState: 'lost', leafState: 'on-dc01', keyAssociation: 'missing', trustDecision: 'rejected' } },
  { id: 'root-thumbprint-mismatch', label: 'Root thumbprint mismatch', at: { csr: 'a-return-move' }, stops: true, check: 'root-thumbprint', fixtures: { 'dc-root-candidate': 'root-thumbprint-mismatch' },
    symptom: 'The Root file thumbprint does not equal the known-good value in the change record.',
    evidence: [{ text: 'Thumbprint computed from fault-rootca-impostor.cer.', kind: KIND.REAL }, { text: 'Known-good thumbprint from the change record.', kind: KIND.SIM }],
    owner: 'Operator + PKI administrator', remediation: 'Do not install. Obtain the Root certificate from an authoritative source.', longTerm: 'Investigate possible tampering in the transfer path.',
    patch: { rootVerified: 'mismatch', trustDecision: 'rejected' } },
  { id: 'cdp-unreachable', label: 'CDP unreachable', at: { csr: 'a-chain', mmc: 'b-chain' }, stops: false, check: 'cdp',
    symptom: 'The chain builds, but revocation is "offline" (CRYPT_E_REVOCATION_OFFLINE 0x80092013): "Not confirmed suitable — revocation status unknown".',
    evidence: [{ text: `HTTP GET ${URLS.icaCdp} times out from DC01.`, kind: KIND.SIM }], owner: 'Network + PKI publication',
    remediation: cfg('Open HTTP to PKIWEB01 and confirm the CRL is published and current.', 'whether relying parties enforce revocation'), longTerm: 'Monitor CRL publication.',
    patch: { revocationState: 'offline' }, finalPatch: { trustDecision: 'withheld' } },
  { id: 'wrong-eku', label: 'KDC Authentication EKU missing', at: { csr: 'a-purposes', mmc: 'b-verify' }, stops: true, check: 'eku', fixtures: { 'dc-cert': 'wrong-eku' },
    symptom: 'KDC Authentication is missing from the issued certificate.', evidence: [{ text: 'fault-dc-wrong-eku.cer EKU list.', kind: KIND.REAL }],
    owner: 'PKI administrator', remediation: 'Fix the template EKUs, reissue, and remove the bad certificate.', longTerm: '—', patch: { purposeState: 'unsuitable', validation: { eku: 'fail' }, trustDecision: 'rejected' } },
  { id: 'san-no-domain', label: 'SAN lacks the domain name', at: { csr: 'a-purposes', mmc: 'b-verify' }, stops: true, check: 'san', fixtures: { 'dc-cert': 'san-no-domain' },
    symptom: 'The SAN lacks simsi2027.test, so it fails this lesson\'s strict KDC validation.', evidence: [{ text: 'fault-dc-san-no-domain.cer SAN list.', kind: KIND.REAL }],
    owner: 'Operator / PKI administrator', remediation: 'Re-request with the domain DNS name simsi2027.test in the SAN.', longTerm: '—', patch: { purposeState: 'unsuitable', validation: { name: 'fail' }, trustDecision: 'rejected' } },
  { id: 'key-mismatch', label: 'Certificate key ≠ CSR key', at: { csr: 'a-key' }, stops: true, check: 'key-match', fixtures: { 'dc-cert': 'key-mismatch' },
    // certreq -accept matches by public key, so it cannot link this certificate: it sits in Personal unlinked and the pending request remains.
    effects: { 'a-accept': { leafState: 'unlinked', pendingRequest: 'present', keyState: 'pending-on-dc01', keyAssociation: 'none' } },
    symptom: 'The certificate public key does not equal the CSR public key: certreq -accept found no pending request for it, so no private key was linked and request 1042 is still pending.',
    evidence: [{ text: 'fault-dc-key-mismatch.cer SPKI SHA-256 differs from dc01-request.req.', kind: KIND.REAL }, { text: 'Local Computer\\Certificate Enrollment Requests still holds request 1042.', kind: KIND.SIM }],
    owner: 'Operator', remediation: 'Do not use it. Remove it from Personal and accept the certificate issued for DC01\'s own request.', longTerm: 'Compare the certificate SPKI with the CSR before accepting.',
    patch: { leafState: 'unlinked', pendingRequest: 'present', keyState: 'pending-on-dc01', keyAssociation: 'mismatch', trustDecision: 'rejected' } },
  { id: 'expired', label: 'Certificate expired', at: { csr: 'a-purposes', mmc: 'b-verify' }, stops: true, check: 'dates', fixtures: { 'dc-cert': 'expired' },
    symptom: 'The certificate is outside its validity period at the simulation clock.', evidence: [{ text: 'fault-dc-expired.cer validity dates.', kind: KIND.REAL }],
    owner: 'Operator', remediation: 'Renew, then remove the expired certificate.', longTerm: 'Rely on autoenrollment renewal.', patch: { purposeState: 'unsuitable', validation: { dates: 'fail' }, trustDecision: 'rejected' } }
];
export const RETIRED_FAULTS = { 'ca-unavailable': 'rpc-blocked', 'ica-cert-unavailable': 'condition trust-missing' };

// Builds a fault list for one path in the engine's shape (failStage only when the fault stops the flow).
export function faultsFor(pathId) {
  return [{ id: 'healthy', label: 'Healthy (no fault)', failStage: null },
    ...FAULTS.filter((f) => f.at[pathId]).map((f) => ({ ...f, stage: f.at[pathId], failStage: f.stops ? f.at[pathId] : null, continues: !f.stops }))];
}

// ---------- Step builder ----------
// Keeps the engine's stage fields (phase, narrative, focus, during, done, flows, show) alongside the v0.4.0 story fields.
export function step(p) {
  const conn = p.connector ?? null;
  return {
    id: p.id, milestone: p.milestone, phase: p.milestone, title: p.title, purpose: p.purpose, narrative: p.purpose, zone: p.zone, adjacent: p.adjacent ?? [], actor: p.actor,
    artifact: p.artifact ?? null, command: p.command ?? null, gui: p.gui ?? null, connector: conn, conditional: p.conditional, result: p.result ?? null,
    show: p.show ?? [], explain: p.explain, during: p.during ?? {}, done: p.done ?? {}, focus: { entity: p.zone, artifact: p.artifact ?? null }, flows: conn ? [`f-${p.id}`] : [],
    vault: p.vault ?? false, stores: p.stores ?? false, pub: p.pub ?? false, rootHistory: p.rootHistory ?? false, notes: p.notes ?? []
  };
}
// Derives the engine flow objects from the step connectors.
export function flowsFor(steps, pathId = 'csr') {
  return steps.filter((s) => s.connector).map((s) => {
    const c = s.connector;
    const from = c.from ?? s.zone, to = c.to ?? (c.store ? `store:${c.store}` : s.zone);
    return { id: `f-${s.id}`, stage: s.id, from, to, kind: c.blocked ? 'blocked' : c.association ? 'association' : c.store ? 'store' : 'transport', protocol: c.channel ?? (c.store ? 'local store write' : 'DC01 internal association'),
      payload: artifactLabel(s.artifact, pathId), identity: s.actor, result: s.result ?? '', evidence: s.purpose, artifact: s.artifact, window: [0, 1], blocked: !!c.blocked, channel: c.channel, store: c.store, association: !!c.association };
  });
}
