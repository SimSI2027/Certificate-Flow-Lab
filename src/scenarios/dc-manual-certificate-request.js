// Scenario: manual Domain Controller certificate request with certreq (synthetic SIMSI2027 environment).
// Educational simulation only: nothing here contacts a real CA or Active Directory.
import { ENV, DC, URLS } from '../artifacts/synthetic.js';
import { evaluateDc } from './dc-evaluate.js';
import { DC_EXPLAIN } from './explain.js';

export const initialState = {
  visitorState: 'n/a', requestState: 'none', keyState: 'absent', csrState: 'none', templateDecision: 'pending', issuanceState: 'none',
  certificateState: 'none', installationState: 'none', iisBindingState: 'n/a', connectionState: 'n/a', chainState: 'none', aiaState: 'idle',
  revocationState: 'unchecked', trustDecision: 'none',
  validation: { name: 'pending', dates: 'pending', eku: 'pending', signatures: 'pending', root: 'pending' },
  dcCertState: 'unknown', identityState: 'unchecked', templatePublished: 'unchecked', permissionState: 'unchecked', contextState: 'unknown',
  keyAssociation: 'none', purposeState: 'unchecked', followupState: 'open'
};

const S = (id, phase, title, purpose, flows, focus, during, done, show = []) => ({ id, phase, title, narrative: purpose, flows, focus, during, done, show });

export const stages = [
  S('detect', 'Problem', 'Detect the missing certificate', 'DC01 should have a suitable Domain Controller certificate, but the Local Computer store has none.', ['f-detect'], { entity: 'certstore' }, { dcCertState: 'checking' }, { dcCertState: 'missing' }),
  S('inspect-dc01', 'Identity', 'Inspect DC01 identity', 'Confirm which computer needs the certificate: its name, domain and role.', ['f-inspect'], { entity: 'dc01' }, { identityState: 'checking' }, { identityState: 'verified' }),
  S('choose-template', 'Identity', 'Choose the certificate template', 'Pick the template that matches the purpose and check that the Issuing CA publishes it.', ['f-choose'], { entity: 'template' }, { templatePublished: 'checking' }, { templatePublished: 'published' }),
  S('verify-permission', 'Identity', 'Verify enrollment permission', 'Check that the DC01 computer account is allowed to Enroll on the template.', ['f-permission'], { entity: 'template' }, {}, { permissionState: 'enroll-granted' }),
  S('request-policy', 'Key', 'Create the request policy', 'Write the request policy (INF) that asks for a machine-context key and the chosen template.', ['f-request-policy'], { entity: 'dc01', artifact: 'inf' }, { requestState: 'drafting' }, { requestState: 'drafted', contextState: 'machine' }),
  S('keygen', 'Key', 'Generate the private key on DC01', 'certreq creates the key pair locally; the private key never leaves DC01.', ['f-keygen'], { entity: 'dc01', artifact: 'private-key' }, { keyState: 'generating' }, { keyState: 'held-on-dc01' }),
  S('csr', 'CSR', 'Create the CSR', 'DC01 signs a Certificate Signing Request containing its public key and requested identity.', ['f-csr'], { entity: 'dc01', artifact: 'csr' }, { csrState: 'building' }, { csrState: 'created' }),
  S('inspect-csr', 'CSR', 'Inspect the CSR', 'Look inside the request before sending it: subject, DNS name, key and template.', ['f-inspect-csr'], { entity: 'dc01', artifact: 'csr' }, {}, { csrState: 'inspected' }),
  S('submit', 'Submission', 'Submit to SIMSI2027-ICA01', 'Send only the CSR to the Enterprise Issuing CA.', ['f-submit'], { entity: 'ica01', artifact: 'csr' }, { requestState: 'submitting' }, { requestState: 'received', csrState: 'submitted', issuanceState: 'received' }),
  S('evaluate-policy', 'Policy', 'CA evaluates template policy', 'The CA checks the requester, context, name and key against the template.', ['f-evaluate'], { entity: 'template' }, { templateDecision: 'evaluating', issuanceState: 'evaluating' }, { templateDecision: 'permitted', issuanceState: 'approved' }),
  S('issue', 'Issuance', 'CA signs and issues the certificate', 'SIMSI2027-ICA01 signs the certificate and records it in its database. The Root CA is not involved.', ['f-issue'], { entity: 'ica01', artifact: 'dccert' }, { issuanceState: 'signing' }, { issuanceState: 'issued', certificateState: 'issued', requestState: 'issued' }),
  S('retrieve', 'Retrieval', 'Retrieve the issued certificate', 'The signed certificate (public data only) comes back to DC01 as dc01-issued.cer.', ['f-retrieve'], { entity: 'dc01', artifact: 'dccert' }, { certificateState: 'returning' }, { certificateState: 'returned' }),
  S('accept', 'Acceptance', 'Accept the certificate on DC01', 'certreq -accept pairs the certificate with the private key DC01 already holds and installs it.', ['f-accept'], { entity: 'certstore', artifact: 'dccert' }, { installationState: 'accepting' }, { installationState: 'accepted', certificateState: 'installed' }),
  S('key-match', 'Acceptance', 'Match certificate to private key', 'Confirm the certificate public key equals the public half of DC01\'s private key.', ['f-key-match'], { entity: 'certstore', artifact: 'dccert' }, { keyAssociation: 'checking' }, { keyAssociation: 'matched' }),
  S('inspect-purposes', 'Verification', 'Inspect purposes, SAN and dates', 'Check the certificate\'s DNS identity, enhanced key usages and validity dates.', ['f-purposes'], { entity: 'certstore', artifact: 'dccert' }, { purposeState: 'inspecting' }, { purposeState: 'suitable', validation: { name: 'pass', dates: 'pass', eku: 'pass' } }),
  S('verify-chain', 'Verification', 'Verify chain and revocation', 'Build the chain to the trusted root (AIA) and check revocation (CDP / CRL).', ['f-aia', 'f-cdp'], { entity: 'dc01', artifact: 'dccert' }, { chainState: 'building', aiaState: 'fetching', revocationState: 'checking' },
    { chainState: 'trusted-root', aiaState: 'retrieved', revocationState: 'good', validation: { signatures: 'pass', root: 'pass' } }, ['rootca', 'aia', 'cdp']),
  S('confirm', 'Verification', 'Confirm a usable Domain Controller certificate', 'All checks agree: the certificate is suitable for this simulated Domain Controller purpose.', ['f-confirm'], { entity: 'result' }, {}, { trustDecision: 'trusted' }, ['rootca']),
  S('followup', 'Verification', 'Investigate why autoenrollment failed', 'Manual enrollment worked, but the reason automatic enrollment did not produce a certificate is still unknown.', ['f-followup'], { entity: 'operator' }, {}, { followupState: 'investigate-autoenrollment' })
];

const F = (id, stage, from, to, kind, protocol, payload, identity, result, durationMs, evidence, artifact = null, extra = {}) =>
  ({ id, stage, from, to, kind, protocol, payload, identity, result, durationMs, evidence, artifact, window: [0, 1], ...extra });
const OP = DC.operator, MACH = `${ENV.netbios}\\${DC.host}$`;
const RID = `Request ${DC.requestId}`;
const CERTREQ_NEW = 'certreq.exe -new dc01-request.inf dc01-request.req';
const CERTREQ_SUBMIT = `certreq.exe -submit -config "${DC.caConfig}" dc01-request.req dc01-issued.cer`;
const CERTREQ_ACCEPT = 'certreq.exe -accept dc01-issued.cer';
export const commands = { new: CERTREQ_NEW, submit: CERTREQ_SUBMIT, accept: CERTREQ_ACCEPT };

export const flows = [
  F('f-detect', 'detect', 'dc01', 'certstore', 'request', 'Local certificate store query (no network)', 'Search LocalMachine\\My for a suitable Domain Controller certificate', `${OP} on DC01`, 'No suitable certificate found', 30, 'certlm.msc / Get-ChildItem Cert:\\LocalMachine\\My shows no matching certificate'),
  F('f-inspect', 'inspect-dc01', 'operator', 'dc01', 'request', 'Administrative session (conceptual)', 'Inspect computer name, domain and role', OP, `${DC.fqdn} in ${ENV.domain}, Domain Controller role`, 400, 'hostname, domain membership and role confirmed'),
  F('f-choose', 'choose-template', 'operator', 'template', 'policy', 'Certificate Authority template listing (conceptual)', `Is template ${DC.template} published on ${ENV.issuingCa}?`, OP, `${DC.template} is published (simulated)`, 250, 'CA template list includes KerberosAuthentication'),
  F('f-permission', 'verify-permission', 'dc01', 'template', 'policy', 'Directory permission check (conceptual)', `Does ${MACH} have Read and Enroll on ${DC.template}?`, MACH, 'Enroll permission granted (simulated)', 120, 'Template security tab: DC01$ (via Domain Controllers group): Read, Enroll'),
  F('f-request-policy', 'request-policy', 'operator', 'dc01', 'request', 'File on DC01 (no network)', 'dc01-request.inf (teaching request policy)', OP, 'Request policy written for machine context', 100, 'dc01-request.inf saved on DC01', 'inf'),
  F('f-keygen', 'keygen', 'dc01', 'dc01', 'request', 'Local cryptographic provider (no network)', 'RSA 2048 key pair (private key stays on DC01)', `${OP} running certreq as Local Computer`, 'Private key created and retained on DC01', 900, 'Key container created in the machine key store', 'private-key', { local: true }),
  F('f-csr', 'csr', 'dc01', 'dc01', 'request', `Local request builder: ${CERTREQ_NEW}`, 'PKCS#10 CSR (CN and DNS name DC01.simsi2027.test, template attribute)', `${OP} (request created in the Local Computer context)`, 'CSR signed with the DC01 private key (proof of possession)', 200, 'dc01-request.req created: public key and request only', 'csr', { local: true }),
  F('f-inspect-csr', 'inspect-csr', 'dc01', 'dc01', 'request', 'Local file inspection (no network)', 'certutil -dump dc01-request.req (conceptual)', OP, 'CSR content confirmed', 100, 'Operator reviews subject, SAN, key size and template', 'csr', { local: true }),
  F('f-submit', 'submit', 'dc01', 'ica01', 'request', `RPC/DCOM to the CA (conceptual): ${CERTREQ_SUBMIT}`, 'CSR (PKCS#10)', `${OP} (authenticated); request context machine`, `${RID} received`, 400, `CA event: ${RID} received`, 'csr'),
  F('f-evaluate', 'evaluate-policy', 'ica01', 'template', 'policy', 'Template policy evaluation (conceptual)', `${RID} against template ${DC.template}`, `${OP} requesting for ${MACH}`, 'Template permits issuance (simulated automatic approval)', 250, 'Policy decision record: permitted'),
  F('f-issue', 'issue', 'ica01', 'cadb', 'cert', 'CA signing operation (local to the CA)', 'Issued certificate record; certificate signed by SIMSI2027-ICA01', ENV.issuingCa, `Certificate issued for ${RID}`, 500, 'Certificate Issued event; database row with serial number', 'dccert'),
  F('f-retrieve', 'retrieve', 'ica01', 'dc01', 'cert', 'RPC/DCOM response (conceptual)', 'dc01-issued.cer (public certificate only)', ENV.issuingCa, 'Certificate delivered to DC01', 350, 'dc01-issued.cer written on DC01', 'dccert', { route: [[1040, 442], [1040, 490], [400, 490], [400, 442]] }),
  F('f-accept', 'accept', 'dc01', 'certstore', 'install', `Local certificate store: ${CERTREQ_ACCEPT}`, 'Certificate paired with the existing private key', `${OP} (Local Computer)`, 'Installed in LocalMachine\\My with private key present', 600, 'Store entry: "You have a private key that corresponds to this certificate."', 'dccert'),
  F('f-key-match', 'key-match', 'certstore', 'certstore', 'validate', 'Local comparison (no network)', 'Certificate public key vs. DC01 key-pair public key', MACH, 'Public keys are identical', 20, 'certutil -store my shows "Private key is NOT exportable" and a matching key container', 'dccert', { local: true }),
  F('f-purposes', 'inspect-purposes', 'certstore', 'certstore', 'validate', 'Local certificate inspection (no network)', 'Subject, SAN, EKU, Key Usage and validity dates', MACH, 'Purposes, DNS name and dates are suitable', 10, 'Certificate General and Details tabs', 'dccert', { local: true }),
  F('f-aia', 'verify-chain', 'dc01', 'aia', 'validate', 'HTTP GET (AIA caIssuers URL)', URLS.icaAia, MACH, 'Issuing CA certificate retrieved', 60, 'CAPI2 operational log: AIA retrieval', 'ica', { window: [0, 0.5], route: [[400, 358], [400, 110], [1100, 110], [1100, 230], [1172, 230]] }),
  F('f-cdp', 'verify-chain', 'dc01', 'cdp', 'validate', 'HTTP GET (CDP URL)', URLS.icaCdp, MACH, 'CRL retrieved; certificate not listed', 70, 'CAPI2 operational log: CRL retrieval', 'crl', { window: [0.5, 1], route: [[440, 442], [440, 520], [1100, 520], [1100, 560], [1172, 560]] }),
  F('f-confirm', 'confirm', 'certstore', 'result', 'trust', 'Local conclusion (no network)', 'Aggregate of the checks above', MACH, 'SUITABLE FOR THIS SIMULATED DOMAIN CONTROLLER PURPOSE', 1, 'Verification summary'),
  F('f-followup', 'followup', 'operator', 'dc01', 'request', 'Investigation task (conceptual)', 'Check autoenrollment policy, template flags, permissions, replication and CA connectivity', OP, 'Open: root cause of the missing autoenrollment is not yet known', 3600000, 'Ticket: investigate autoenrollment', null, { route: [[198, 245], [299, 245], [299, 415], [312, 415]] })
];

export const artifacts = [
  { id: 'inf', label: 'Request policy (INF)', color: 'request', inspectable: true, fixtureRole: 'dc-inf', presence: [{ arrive: 'request-policy', at: 'dc01', via: 'f-request-policy' }] },
  { id: 'private-key', label: 'Private key', color: 'key', inspectable: false, presence: [{ arrive: 'keygen', at: 'dc01', via: null }], note: 'Never leaves DC01. Not a distributable artifact.' },
  { id: 'csr', label: 'CSR', color: 'request', inspectable: true, fixtureRole: 'dc-csr', presence: [{ arrive: 'csr', at: 'dc01', via: null }, { arrive: 'submit', at: 'ica01', via: 'f-submit' }] },
  { id: 'dccert', label: 'DC01 certificate', color: 'cert', inspectable: true, fixtureRole: 'dc-cert', presence: [{ arrive: 'issue', at: 'ica01', via: null }, { arrive: 'retrieve', at: 'dc01', via: 'f-retrieve' }, { arrive: 'accept', at: 'certstore', via: 'f-accept' }] },
  { id: 'ica', label: 'Issuing CA certificate', color: 'cert', inspectable: true, fixtureRole: 'ica', presence: [{ arrive: 'verify-chain', at: 'dc01', via: 'f-aia', from: 'aia', blockedBy: ['ica-cert-unavailable'] }] },
  { id: 'root', label: 'Root CA certificate', color: 'cert', inspectable: true, fixtureRole: 'root', presence: [{ arrive: 'detect', at: 'rootca', via: null }] },
  { id: 'crl', label: 'CRL', color: 'cert', inspectable: true, fixtureRole: 'crl', presence: [{ arrive: 'detect', at: 'cdp', via: null }, { arrive: 'verify-chain', at: 'dc01', via: 'f-cdp', from: 'cdp', blockedBy: ['cdp-unavailable'] }] },
  { id: 'chain', label: 'Certificate chain', color: 'cert', inspectable: true, fixtureRole: 'dc-chain', presence: [{ arrive: 'verify-chain', at: 'certstore', via: null }] }
];

export const faults = [
  { id: 'healthy', label: 'Healthy manual enrollment', failStage: null },
  { id: 'template-not-published', label: 'Template not published', failStage: 'choose-template', check: 'template', owner: 'PKI administrator (CA template publication)', continues: false,
    remediation: `Publish ${DC.template} on ${ENV.issuingCa} (Certificate Templates > New > Certificate Template to Issue), wait for AD replication, then retry.` },
  { id: 'no-enroll-permission', label: 'DC01 lacks Enroll permission', failStage: 'verify-permission', check: 'permission', owner: 'PKI administrator (template security)', continues: false,
    remediation: 'Grant Read and Enroll on the template to the Domain Controllers (or DC01$) security principal. Prefer group-based permission; do not grant Everyone.' },
  { id: 'user-context', label: 'Request created in user context', failStage: 'evaluate-policy', check: 'context', fixtures: { 'dc-inf': 'user-context' }, owner: 'Operator (request procedure)', continues: false,
    stageEffects: { 'request-policy': { contextState: 'user' } },
    remediation: 'Recreate the request in the Local Computer context (MachineKeySet = TRUE, elevated prompt on DC01) and resubmit. Remove the stray user-store key.' },
  { id: 'ca-unavailable', label: 'CA unavailable', failStage: 'submit', check: 'ca-available', owner: 'CA administrator', continues: false,
    remediation: 'Restore the Certification Authority service and RPC connectivity (firewall, DNS), confirm with certutil -ping, then resubmit the same request.' },
  { id: 'pending-approval', label: 'Request pending approval', failStage: 'evaluate-policy', check: 'disposition', owner: 'CA manager (approval)', continues: true,
    remediation: `A CA manager issues the pending ${RID} (Certification Authority > Pending Requests). Then retrieve with certreq -retrieve ${DC.requestId} and continue with -accept.` },
  { id: 'wrong-eku', label: 'Certificate issued with wrong EKU', failStage: 'inspect-purposes', check: 'eku', fixtures: { 'dc-cert': 'wrong-eku' }, owner: 'PKI administrator (template EKUs)', continues: false,
    remediation: `Correct the template (${DC.template} should include Client Authentication, Server Authentication, KDC Authentication and, if used, Smart Card Logon), reissue, and remove the wrong certificate.` },
  { id: 'san-missing', label: 'SAN missing DC01 DNS name', failStage: 'inspect-purposes', check: 'name', fixtures: { 'dc-cert': 'san-missing' }, owner: 'Operator (request) and PKI administrator (template subject settings)', continues: false,
    remediation: 'Request again with the DNS name DC01.simsi2027.test in the SAN (or use a template that builds it from the directory) and replace the certificate.' },
  { id: 'key-mismatch', label: 'Certificate does not match the private key', failStage: 'key-match', check: 'key-match', fixtures: { 'dc-cert': 'key-mismatch' }, owner: 'Operator (DC01 administrator)', continues: false,
    remediation: 'Do not import this certificate. Submit the original request again (or create a new request/key on DC01) and accept the certificate that matches the key container on DC01.' },
  { id: 'ica-cert-unavailable', label: 'Issuing CA certificate unavailable', failStage: 'verify-chain', check: 'aia', owner: 'PKI publication administrator (PKIWEB01)', continues: true,
    remediation: 'Publish SIMSI2027-ICA01.crt to the AIA location (or deploy it through Group Policy to the Intermediate store), then rebuild the chain.' },
  { id: 'cdp-unavailable', label: 'CDP unavailable', failStage: 'verify-chain', check: 'cdp', owner: 'PKI publication administrator (PKIWEB01)', continues: true,
    remediation: 'Restore CRL publication at the CDP URL and verify the current CRL is published. The certificate itself is not at fault.' },
  { id: 'expired', label: 'Certificate expired', failStage: 'inspect-purposes', check: 'dates', fixtures: { 'dc-cert': 'expired' }, owner: 'Operator (renewal) and PKI administrator (validity policy)', continues: false,
    remediation: 'Renew the certificate before expiry (autoenrollment normally does this), accept the new one and remove the expired certificate.' }
];

export const faultPatches = {
  'template-not-published': { templatePublished: 'missing', trustDecision: 'rejected' },
  'no-enroll-permission': { permissionState: 'enroll-denied', trustDecision: 'rejected' },
  'user-context': { contextState: 'user', templateDecision: 'denied', issuanceState: 'denied', trustDecision: 'rejected' },
  'ca-unavailable': { requestState: 'not-delivered', trustDecision: 'rejected' },
  'pending-approval': { templateDecision: 'permitted', issuanceState: 'pending', requestState: 'pending', trustDecision: 'rejected' },
  'wrong-eku': { purposeState: 'unsuitable', validation: { eku: 'fail' }, trustDecision: 'rejected' },
  'san-missing': { purposeState: 'unsuitable', validation: { name: 'fail' }, trustDecision: 'rejected' },
  'key-mismatch': { keyAssociation: 'mismatch', trustDecision: 'rejected' },
  'ica-cert-unavailable': { chainState: 'incomplete', aiaState: 'failed', validation: { signatures: 'pending', root: 'pending' }, trustDecision: 'rejected' },
  'cdp-unavailable': { revocationState: 'unavailable', trustDecision: 'rejected' },
  expired: { purposeState: 'unsuitable', validation: { dates: 'fail' }, trustDecision: 'rejected' }
};

// Faults may also change an earlier stage's completed state (for example the request was created in the wrong context).
export const faultStagePatches = { 'user-context': { 'request-policy': { contextState: 'user' } } };

const T = (id, stage, question, claim, entity, artifact, evidenceKind) => ({ id, stage, question, claim, entity, artifact, evidenceKind });
export const evidenceTrace = [
  T('usable', 'confirm', 'Why is the Domain Controller certificate considered usable?', 'Every check passed, so the certificate is suitable for this simulated Domain Controller purpose.', 'result', null, 'Derived conclusion'),
  T('purposes', 'inspect-purposes', 'Does it have the required purposes?', 'The certificate lists Client Authentication, Server Authentication, KDC Authentication and Smart Card Logon, and is within its validity dates.', 'certstore', 'dccert', 'Real fixture data'),
  T('dns', 'inspect-purposes', 'Does the identity include DC01.simsi2027.test?', 'Subject and SAN carry DC01.simsi2027.test.', 'certstore', 'dccert', 'Real fixture data'),
  T('key-assoc', 'key-match', 'Is it associated with DC01\'s private key?', 'The certificate public key equals the public key in the CSR created from DC01\'s key pair.', 'certstore', 'dccert', 'Real fixture data'),
  T('chain-root', 'verify-chain', 'Does the chain reach SIMSI2027-ROOTCA?', 'The Issuing CA certificate is signed by the Root CA, which CLIENT trusts as the trust anchor (the Root CA was not contacted).', 'rootca', 'root', 'Real fixture data'),
  T('revocation', 'verify-chain', 'Is revocation status acceptable?', 'The CRL from the CDP is current, signed by the Issuing CA and does not list this serial number.', 'cdp', 'crl', 'Real fixture data'),
  T('issued-by', 'issue', 'Who issued it?', `SIMSI2027-ICA01 signed the certificate for ${RID}.`, 'ica01', 'dccert', 'Real fixture data'),
  T('template', 'evaluate-policy', 'Did the template permit issuance?', `The ${DC.template} template permitted the request.`, 'template', null, 'Simulated environment'),
  T('permission', 'verify-permission', 'Did DC01 have enrollment permission?', 'DC01\'s computer account had Read and Enroll on the template (simulated directory permission).', 'template', null, 'Simulated environment'),
  T('pop', 'csr', 'Did the CSR prove possession of the private key?', 'The CSR signature verifies with the public key it contains, proving the requester holds the private key.', 'dc01', 'csr', 'Real fixture data'),
  T('key-local', 'keygen', 'Where was the private key generated?', 'DC01 generated the key locally with MachineKeySet = TRUE; it was never transmitted.', 'dc01', 'private-key', 'Real fixture data'),
  T('initiated', 'detect', 'Why was the manual request started?', 'Automatic enrollment had not produced a suitable certificate, so the operator started a controlled manual request.', 'operator', null, 'Simulated environment')
];

export const tour = [
  { id: 't1', stage: 'detect', title: 'The problem', text: 'DC01 has no suitable Domain Controller certificate.' },
  { id: 't2', stage: 'verify-permission', title: 'Identity and permissions', text: 'The operator checks the computer, the template and enrollment permission.' },
  { id: 't3', stage: 'keygen', title: 'Private key on DC01', text: 'The key pair is created locally and stays on DC01.' },
  { id: 't4', stage: 'inspect-csr', title: 'Inspect the CSR', text: 'The CSR carries the public key and requested identity, never the private key.', select: { artifact: 'csr' } },
  { id: 't5', stage: 'submit', title: 'Submit to the Issuing CA', text: 'Only the CSR is sent. The Root CA is not contacted.', select: { entity: 'ica01' } },
  { id: 't6', stage: 'issue', title: 'The CA issues the certificate', text: 'SIMSI2027-ICA01 signs it.' },
  { id: 't7', stage: 'key-match', title: 'Accept and match the key', text: 'The certificate is paired with the existing private key.', select: { artifact: 'dccert' } },
  { id: 't8', stage: 'verify-chain', title: 'Chain and revocation', text: 'AIA fetches the issuer certificate; the CDP supplies the CRL.' },
  { id: 't9', stage: 'confirm', title: 'Suitable for the simulated purpose', text: 'All checks pass.' },
  { id: 't10', stage: 'confirm', title: 'Reverse evidence', text: 'Tracing the result back to the request.', reverse: true },
  { id: 't11', stage: 'followup', title: 'Your turn', text: 'Try a failure, or inspect any artifact.', handoff: true }
];

export const futureScenarios = ['ndes-scep-device-enrollment', 'cep-ces-enrollment', 'autoenrollment', 'aia-chain-retrieval', 'cdp-crl-validation', 'ocsp-validation'];

export const layout = {
  operator: [110, 230], dc01: [400, 400], certstore: [400, 640], template: [760, 230], result: [760, 640], ica01: [1040, 400], cadb: [1040, 640],
  aia: [1260, 230], cdp: [1260, 560], rootca: [1480, 400]
};
export const zones = [
  { id: 'origin', label: 'Operator', x: 10, y: 110, w: 210, h: 660 },
  { id: 'dc', label: 'Domain Controller', x: 280, y: 110, w: 240, h: 660 },
  { id: 'policy', label: 'Policy and outcome', x: 650, y: 110, w: 220, h: 660 },
  { id: 'ca', label: 'Issuing CA', x: 940, y: 110, w: 200, h: 660 },
  { id: 'pub', label: 'Publication', x: 1170 - 10, y: 110, w: 200, h: 660 },
  { id: 'offline', label: 'OFFLINE TRUST', x: 1385, y: 110, w: 205, h: 660, offline: true }
];
export const zoneOf = { operator: 'origin', dc01: 'dc', certstore: 'dc', template: 'policy', result: 'policy', ica01: 'ca', cadb: 'ca', aia: 'pub', cdp: 'pub', rootca: 'offline' };

export function statusOf(id, s) {
  switch (id) {
    case 'operator': return ['drafting', 'submitting'].includes(s.requestState) || s.identityState === 'checking' ? 'active' : s.followupState === 'investigate-autoenrollment' ? 'active' : s.requestState !== 'none' || s.identityState === 'verified' ? 'ok' : 'idle';
    case 'dc01':
      if (s.keyAssociation === 'mismatch') return 'fail';
      if (s.keyState === 'generating' || s.csrState === 'building' || s.certificateState === 'returning') return 'active';
      return s.trustDecision === 'trusted' ? 'ok' : s.keyState === 'held-on-dc01' ? 'ok' : s.identityState === 'verified' ? 'ok' : 'idle';
    case 'certstore':
      if (s.dcCertState === 'missing' && s.installationState === 'none') return 'fail';
      if (s.keyAssociation === 'mismatch' || s.purposeState === 'unsuitable') return 'fail';
      if (['accepting'].includes(s.installationState) || s.keyAssociation === 'checking' || s.purposeState === 'inspecting') return 'active';
      return s.installationState === 'accepted' ? 'ok' : 'idle';
    case 'template':
      if (['missing'].includes(s.templatePublished) || s.permissionState === 'enroll-denied' || s.templateDecision === 'denied') return 'fail';
      if (s.templateDecision === 'evaluating' || s.templatePublished === 'checking') return 'policy';
      return s.templateDecision === 'permitted' || s.permissionState === 'enroll-granted' || s.templatePublished === 'published' ? 'policy-ok' : 'idle';
    case 'ica01':
      if (s.requestState === 'not-delivered' || s.issuanceState === 'denied') return 'fail';
      if (['evaluating', 'signing', 'pending'].includes(s.issuanceState) || s.requestState === 'submitting') return 'active';
      return ['approved', 'issued', 'received'].includes(s.issuanceState) ? 'ok' : 'idle';
    case 'cadb': return ['received', 'issued', 'pending'].includes(s.requestState) ? 'ok' : 'idle';
    case 'aia': return s.aiaState === 'failed' ? 'fail' : s.aiaState === 'fetching' ? 'active' : s.aiaState === 'retrieved' ? 'ok' : 'idle';
    case 'cdp': return s.revocationState === 'unavailable' ? 'fail' : s.revocationState === 'checking' ? 'active' : s.revocationState === 'good' ? 'ok' : 'idle';
    case 'rootca': return s.validation.root === 'pass' ? 'ok' : 'idle';
    case 'result': return s.trustDecision === 'trusted' ? 'ok' : s.trustDecision === 'rejected' ? 'fail' : 'idle';
    default: return 'idle';
  }
}

export const overrides = {
  template: { label: `${DC.template} template`, sub: 'Policy gate (simulated)' },
  cdp: { label: 'CDP / CRL repository', sub: 'Revocation lists' },
  result: { label: 'Suitability result', sub: 'Simulated DC purpose' }
};

export default {
  id: 'dc-manual-certificate-request', title: 'Domain Controller Manual Enrollment', version: '0.3.0',
  subtitle: 'DC01 is not receiving its Domain Controller certificate automatically, so an operator performs a controlled manual request.',
  home: { purpose: 'A Domain Controller that is not receiving a certificate automatically creates and submits a manual request.', requester: 'PKI operator on behalf of DC01 (machine context)', destination: 'Local Computer\\Personal store on DC01', method: 'certreq.exe manual request (simulated)' },
  initialState, stages: stages.map((s) => ({ ...s, explain: DC_EXPLAIN[s.id] })), flows, artifacts, faults, faultPatches, faultStagePatches, evidenceTrace, tour, futureScenarios, layout, zones, zoneOf, statusOf, overrides, commands,
  evaluate: evaluateDc,
  entityIds: ['operator', 'dc01', 'certstore', 'template', 'ica01', 'cadb', 'aia', 'cdp', 'rootca', 'result'],
  rootLink: { from: 'ica01', to: 'rootca' }
};
