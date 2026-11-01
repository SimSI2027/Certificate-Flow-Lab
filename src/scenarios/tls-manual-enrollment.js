// Scenario: Microsoft-style manual enterprise TLS certificate enrollment (synthetic SIMSI2027 environment).
// Data only. The engine (src/engine) interprets this structure; other scenarios can reuse the engine
// by exporting an object with the same shape (see docs/SCENARIO_MODEL.md).
import { ENV, URLS, TEMPLATE } from '../artifacts/synthetic.js';
import * as PRES from './tls-presentation.js';
import { TLS_EXPLAIN } from './explain.js';

const P = { need: 'Need', request: 'Request', policy: 'Policy', issue: 'Issue', install: 'Install', bind: 'Bind', connect: 'Connect', validate: 'Validate', trust: 'Trust' };

export const initialState = {
  visitorState: 'idle', requestState: 'none', keyState: 'absent', csrState: 'none', templateDecision: 'pending',
  issuanceState: 'none', certificateState: 'none', installationState: 'none', iisBindingState: 'default-selfsigned',
  connectionState: 'none', chainState: 'none', aiaState: 'idle', revocationState: 'unchecked', trustDecision: 'none',
  validation: { name: 'pending', dates: 'pending', eku: 'pending', signatures: 'pending', root: 'pending' }
};

const stage = (id, phase, title, narrative, flows, focus, during, done) => ({ id, phase: P[phase], title, narrative, flows, focus, during, done });

export const stages = [
  stage('visit', 'need', 'Visitor opens the website', 'Jordan (a normal visitor) browses to https://portal.simsi2027.test from CLIENT01. Jordan does not manage certificates.',
    ['f-visit'], { entity: 'visitor' }, { visitorState: 'browsing', connectionState: 'connecting' }, { connectionState: 'connecting' }),
  stage('browser-error', 'need', 'Browser detects a certificate problem', 'WEB01 still presents a default self-signed certificate. The browser cannot build a trusted path and warns Jordan.',
    ['f-error'], { entity: 'browser' }, { connectionState: 'failed' }, { visitorState: 'seeing-error', connectionState: 'failed', trustDecision: 'rejected' }),
  stage('report', 'need', 'Visitor reports the problem', 'Jordan reports the warning. Jordan is not the certificate requester: the report goes to the application owner.',
    ['f-report'], { entity: 'visitor' }, { visitorState: 'reporting' }, { visitorState: 'reported', requestState: 'needed' }),
  stage('owner-review', 'request', 'Application owner reviews the requirement', 'Morgan owns the portal application and is permitted to request its certificate. Morgan reviews the site requirement on WEB01.',
    ['f-review'], { entity: 'owner' }, {}, { requestState: 'reviewed' }),
  stage('keygen', 'request', 'WEB01 generates a private key', 'The key pair is generated locally on WEB01. The private key never leaves WEB01.',
    ['f-keygen'], { entity: 'web01', artifact: 'private-key' }, { keyState: 'generating' }, { keyState: 'held-on-web01' }),
  stage('csr', 'request', 'WEB01 creates the CSR', 'WEB01 builds a PKCS#10 request for portal.simsi2027.test, signed with the new private key (proof of possession).',
    ['f-csr'], { entity: 'web01', artifact: 'csr' }, { csrState: 'building' }, { csrState: 'created' }),
  stage('policy', 'policy', 'WebServer template policy gate', 'The request is evaluated against the WebServer template: requester permission, subject/SAN, key size, EKU and validity.',
    ['f-policy'], { entity: 'template', artifact: 'csr' }, { templateDecision: 'evaluating' }, { templateDecision: 'permitted' }),
  stage('ca-receive', 'policy', 'SIMSI2027-ICA01 receives the request', 'The request reaches the issuing CA and is recorded in the CA database as request 1042.',
    ['f-submit'], { entity: 'ica01', artifact: 'csr' }, { requestState: 'submitted' }, { requestState: 'received', csrState: 'submitted', issuanceState: 'received' }),
  stage('ca-evaluate', 'policy', 'Issuing CA evaluates the request', 'The CA checks identity, enrollment permissions and policy. The Root CA is not involved: it stays offline.',
    ['f-evaluate'], { entity: 'ica01' }, { issuanceState: 'evaluating' }, { issuanceState: 'approved' }),
  stage('issue', 'issue', 'Issuing CA signs the certificate', 'SIMSI2027-ICA01 signs the website certificate with its own key. The Root CA does not issue it.',
    ['f-issue'], { entity: 'ica01', artifact: 'leaf' }, { issuanceState: 'signing' }, { issuanceState: 'issued', certificateState: 'issued', requestState: 'issued' }),
  stage('return', 'issue', 'Certificate returns to WEB01', 'The issued certificate (public data only) is returned to WEB01.',
    ['f-return'], { entity: 'web01', artifact: 'leaf' }, { certificateState: 'returning' }, { certificateState: 'returned' }),
  stage('install', 'install', 'WEB01 installs the certificate', 'WEB01 matches the certificate public key to the private key it already holds and completes the installation.',
    ['f-install'], { entity: 'web01', artifact: 'leaf' }, { installationState: 'installing' }, { installationState: 'installed', certificateState: 'installed' }),
  stage('bind', 'bind', 'IIS HTTPS binding', 'IIS receives an HTTPS binding for portal.simsi2027.test on port 443 using the installed certificate.',
    ['f-bind'], { entity: 'iis' }, { iisBindingState: 'binding' }, { iisBindingState: 'bound' }),
  stage('retry', 'connect', 'Visitor retries the website', 'Jordan retries https://portal.simsi2027.test. WEB01 now presents the new certificate.',
    ['f-retry'], { entity: 'client01' }, { visitorState: 'retrying', connectionState: 'connecting' }, { connectionState: 'tls-handshake', certificateState: 'presented', trustDecision: 'pending' }),
  stage('chain-build', 'validate', 'CLIENT01 builds the certificate chain', 'WEB01 sends the leaf. CLIENT01 reads the AIA extension to fetch the issuing CA certificate from PKIWEB01.',
    ['f-present', 'f-aia'], { entity: 'chain', artifact: 'chain' }, { chainState: 'building', aiaState: 'fetching' }, { chainState: 'built', aiaState: 'retrieved' }),
  stage('validate', 'validate', 'Name, dates, EKU and signatures', 'CLIENT01 checks the DNS name, validity dates, Server Authentication EKU and each signature in the chain.',
    ['f-validate'], { entity: 'chain', artifact: 'leaf' }, { connectionState: 'validating' }, { validation: { name: 'pass', dates: 'pass', eku: 'pass', signatures: 'pass' } }),
  stage('root-trust', 'validate', 'Chain reaches a trusted root', 'The chain ends at SIMSI2027-ROOTCA, which must exist in the CLIENT01 trust store.',
    ['f-root'], { entity: 'rootca', artifact: 'root' }, {}, { validation: { root: 'pass' }, chainState: 'trusted-root' }),
  stage('revocation', 'validate', 'Revocation check (CDP)', 'CLIENT01 reads the CDP extension and retrieves the issuing CA CRL from PKIWEB01 to confirm the certificate is not revoked.',
    ['f-cdp'], { entity: 'cdp', artifact: 'crl' }, { revocationState: 'checking' }, { revocationState: 'good' }),
  stage('trust', 'trust', 'Connection becomes trusted', 'All checks passed. The browser shows a secure connection to Jordan.',
    ['f-trust'], { entity: 'decision' }, {}, { trustDecision: 'trusted', connectionState: 'trusted', visitorState: 'secure' })
];

const F = (id, stage, from, to, protocol, payload, identity, result, durationMs, evidence, artifact = null, extra = {}) =>
  ({ id, stage, from, to, protocol, payload, identity, result, durationMs, evidence, artifact, window: [0, 1], ...extra });

const REQ = `Request ${ENV.requestId}`;
export const flows = [
  F('f-visit', 'visit', 'client01', 'web01', 'HTTPS / TLS 1.3 over TCP 443', 'ClientHello with SNI portal.simsi2027.test', `${ENV.visitor.user} (browsing; TLS server authentication needs no client identity)`, 'Handshake started', 85, 'Browser connection event (client side)'),
  F('f-error', 'browser-error', 'web01', 'client01', 'HTTPS / TLS 1.3 over TCP 443', 'ServerHello + default self-signed certificate (CN=WEB01)', 'WEB01 (server)', 'Certificate rejected: name mismatch and untrusted issuer', 120, 'Browser certificate-error page; TLS alert'),
  F('f-report', 'report', 'visitor', 'owner', 'Support ticket (conceptual)', 'Problem report with browser error text', ENV.visitor.user, 'Report received by application owner', 1800000, 'Ticket record: report submitted by Jordan'),
  F('f-review', 'owner-review', 'owner', 'web01', 'Administrative session (conceptual)', 'Review of the site requirement', ENV.owner.user, 'Requirement confirmed: HTTPS certificate for portal.simsi2027.test', 900000, 'Change note: owner approved the requirement'),
  F('f-keygen', 'keygen', 'web01', 'web01', 'Local cryptographic provider (no network)', 'RSA 2048 key pair (private key stays on WEB01)', `${ENV.owner.user} on WEB01`, 'Private key created and retained on WEB01', 1200, 'Key container created in the WEB01 machine store', 'private-key', { local: true }),
  F('f-csr', 'csr', 'web01', 'web01', 'Local request builder (no network)', 'PKCS#10 CSR (CN/SAN portal.simsi2027.test)', `${ENV.owner.user} on WEB01`, 'CSR signed with the WEB01 private key', 300, 'CSR file created (public key and request only)', 'csr', { local: true }),
  F('f-policy', 'policy', 'web01', 'template', 'Enrollment policy evaluation (conceptual)', 'CSR + requested template WebServer', `${ENV.owner.user} (member of WebServer-Requesters, synthetic)`, 'Template permits the request', 250, 'Policy decision record: WebServer permitted', 'csr'),
  F('f-submit', 'ca-receive', 'template', 'ica01', 'RPC/DCOM ICertRequest (conceptual)', 'CSR (PKCS#10)', `${ENV.owner.user}`, `${REQ} received (pending)`, 400, `CA event: ${REQ} received`, 'csr'),
  F('f-evaluate', 'ca-evaluate', 'ica01', 'cadb', 'CA database write (local to the CA)', 'Request row: requester, template, SAN, key size', `${ENV.owner.user}`, `${REQ} approved by CA policy`, 120, 'CA database row updated; audit event written'),
  F('f-issue', 'issue', 'ica01', 'cadb', 'CA signing operation (local to the CA)', 'Issued certificate record; leaf signed by SIMSI2027-ICA01', ENV.issuingCa, `Certificate issued for ${REQ}`, 500, 'Certificate Issued event; database row with serial number', 'leaf'),
  F('f-return', 'return', 'ica01', 'web01', 'RPC/DCOM response (conceptual)', 'Issued certificate (public data only)', ENV.issuingCa, 'Certificate delivered to WEB01', 350, 'Retrieval event on WEB01', 'leaf'),
  F('f-install', 'install', 'web01', 'web01', 'Local certificate store (no network)', 'Certificate bound to existing private key', `${ENV.owner.user} on WEB01`, 'Installed in LocalMachine\\My with private key present', 600, 'Store entry shows "You have a private key that corresponds to this certificate"', 'leaf', { local: true }),
  F('f-bind', 'bind', 'web01', 'iis', 'IIS binding configuration (local)', 'https binding: portal.simsi2027.test:443, SNI', `${ENV.owner.user} on WEB01`, 'Binding active', 400, 'IIS configuration change event', 'leaf'),
  F('f-retry', 'retry', 'client01', 'web01', 'HTTPS / TLS 1.3 over TCP 443', 'ClientHello with SNI portal.simsi2027.test', ENV.visitor.user, 'WEB01 selects the new certificate by SNI', 90, 'Browser connection event (client side)'),
  F('f-present', 'chain-build', 'web01', 'client01', 'TLS Certificate message', 'Leaf certificate (portal.simsi2027.test)', 'WEB01 (server)', 'Leaf received; issuer certificate is not included', 40, 'Handshake capture (conceptual)', 'leaf', { window: [0, 0.5] }),
  F('f-aia', 'chain-build', 'client01', 'aia', 'HTTP GET (AIA caIssuers URL)', URLS.icaAia, ENV.visitor.user, 'Issuing CA certificate retrieved', 60, 'CAPI2 operational log: AIA retrieval', 'ica', { window: [0.5, 1] }),
  F('f-validate', 'validate', 'client01', 'web01', 'Local path validation (no network)', 'Checks against the presented certificate: DNS name, dates, EKU, signatures', 'CLIENT01 (system)', 'Name, dates, EKU and signatures valid', 8, 'CAPI2 operational log: chain validation', 'leaf'),
  F('f-root', 'root-trust', 'client01', 'chain', 'Local trust-store lookup (no network)', 'Root thumbprint lookup in Trusted Root store', 'CLIENT01 (system)', 'SIMSI2027-ROOTCA found in the trust store', 2, 'CAPI2 operational log: trust anchor found', 'root'),
  F('f-cdp', 'revocation', 'client01', 'cdp', 'HTTP GET (CDP URL)', URLS.icaCdp, ENV.visitor.user, 'CRL retrieved; certificate not listed', 70, 'CAPI2 operational log: CRL retrieval', 'crl'),
  F('f-trust', 'trust', 'client01', 'decision', 'Local trust decision (no network)', 'Aggregate validation result', 'CLIENT01 (system)', 'Connection trusted', 1, 'Browser shows secure indicator')
];

// Where each artifact lives over time. "arrive" is the stage during which it moves (via a flow) or appears.
export const artifacts = [
  { id: 'private-key', label: 'Private key', kind: 'secret', color: 'key', inspectable: false, presence: [{ arrive: 'keygen', at: 'web01', via: null }], note: 'Never leaves WEB01. Not a distributable artifact.' },
  { id: 'ticket', label: 'Problem report', kind: 'ticket', color: 'request', inspectable: false, presence: [{ arrive: 'report', at: 'owner', via: 'f-report' }] },
  { id: 'csr', label: 'CSR', kind: 'csr', color: 'request', inspectable: true, fixtureRole: 'csr', presence: [
    { arrive: 'csr', at: 'web01', via: null }, { arrive: 'policy', at: 'template', via: 'f-policy' }, { arrive: 'ca-receive', at: 'ica01', via: 'f-submit' }] },
  { id: 'leaf', label: 'Website certificate', kind: 'certificate', color: 'cert', inspectable: true, fixtureRole: 'leaf', presence: [
    { arrive: 'issue', at: 'ica01', via: null }, { arrive: 'return', at: 'web01', via: 'f-return' }, { arrive: 'chain-build', at: 'client01', via: 'f-present' }] },
  { id: 'ica', label: 'Issuing CA certificate', kind: 'certificate', color: 'cert', inspectable: true, fixtureRole: 'ica', presence: [
    { arrive: 'chain-build', at: 'client01', via: 'f-aia', from: 'aia', blockedBy: ['missing-ica'] }] },
  { id: 'root', label: 'Root CA certificate', kind: 'certificate', color: 'cert', inspectable: true, fixtureRole: 'root', presence: [{ arrive: 'visit', at: 'rootca', via: null }] },
  { id: 'crl', label: 'CRL', kind: 'crl', color: 'cert', inspectable: true, fixtureRole: 'crl', presence: [
    { arrive: 'visit', at: 'cdp', via: null }, { arrive: 'revocation', at: 'client01', via: 'f-cdp', from: 'cdp', blockedBy: ['cdp-unavailable'] }] },
  { id: 'chain', label: 'Certificate chain', kind: 'chain', color: 'cert', inspectable: true, fixtureRole: 'chain', presence: [{ arrive: 'chain-build', at: 'chain', via: null }] }
];

export const faults = [
  { id: 'healthy', label: 'Healthy', failStage: null },
  { id: 'wrong-dns', label: 'Wrong DNS name', failStage: 'validate', check: 'name', fixtures: { leaf: 'wrong-dns', csr: 'wrong-dns' }, owner: 'Application owner (re-request) with PKI admin review',
    remediation: 'Create a new CSR whose SAN contains portal.simsi2027.test, re-submit to the WebServer template, install the new certificate and rebind IIS.' },
  { id: 'expired', label: 'Expired certificate', failStage: 'validate', check: 'dates', fixtures: { leaf: 'expired' }, owner: 'Application owner',
    remediation: 'Renew the certificate (re-enroll against WebServer), install it and rebind IIS before the next expiry; monitor expiry dates.' },
  { id: 'untrusted-root', label: 'Untrusted root', failStage: 'root-trust', check: 'root', owner: 'Endpoint / PKI administrator',
    remediation: 'Distribute SIMSI2027-ROOTCA to the Trusted Root store (for example by Group Policy). Do not ask users to click through the warning.' },
  { id: 'wrong-eku', label: 'Wrong EKU', failStage: 'validate', check: 'eku', fixtures: { leaf: 'wrong-eku' }, template: { name: 'WorkstationAuth', oid: '1.3.6.1.4.1.311.21.8.2027.1.7' }, owner: 'PKI administrator (template) and application owner (re-request)',
    remediation: 'Request the certificate from a template that includes Server Authentication (WebServer), revoke the mis-issued certificate and install the replacement.' },
  { id: 'missing-ica', label: 'Missing issuing CA certificate', failStage: 'chain-build', check: 'aia', owner: 'PKI publication administrator (PKIWEB01)',
    remediation: 'Publish SIMSI2027-ICA01.crt to the AIA location, or configure WEB01 to send the intermediate certificate, then retry.' },
  { id: 'revoked', label: 'Revoked certificate', failStage: 'revocation', check: 'revocation', fixtures: { leaf: 'revoked' }, owner: 'Application owner (replace) and CA administrator (revocation record)',
    remediation: 'Replace the certificate with a newly issued one (new key if compromise is suspected), install it and rebind IIS.' },
  { id: 'cdp-unavailable', label: 'CDP unavailable', failStage: 'revocation', check: 'cdp', owner: 'PKI publication administrator (PKIWEB01)',
    remediation: 'Restore the CRL publication service at the CDP URL and verify the current CRL is published; the certificate itself is not at fault.' },
  { id: 'no-private-key', label: 'Installed without matching private key', failStage: 'install', check: 'key', owner: 'Application owner (WEB01 administrator)',
    remediation: 'Install the certificate on the machine that holds the private key, or generate a new key and CSR on WEB01 and request a new certificate. Never copy private keys around casually.' }
];

// Patches applied when a faulted stage completes (instead of the healthy `done`).
export const faultPatches = {
  'wrong-dns': { validation: { name: 'fail' }, trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  expired: { validation: { dates: 'fail' }, trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  'wrong-eku': { validation: { eku: 'fail' }, trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  'untrusted-root': { validation: { root: 'fail' }, chainState: 'untrusted-root', trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  'missing-ica': { chainState: 'incomplete', aiaState: 'failed', trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  revoked: { revocationState: 'revoked', trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  'cdp-unavailable': { revocationState: 'unavailable', trustDecision: 'rejected', connectionState: 'blocked', visitorState: 'blocked' },
  'no-private-key': { installationState: 'no-private-key', keyState: 'missing-for-cert', certificateState: 'returned' }
};

// Evidence trace used by reverse mode. Each item names the forward stage that produced the evidence.
export const evidenceTrace = [
  { id: 'trusted', stage: 'trust', question: 'Why is the site trusted?', claim: 'All validation checks passed, so the browser trusts the connection.', entity: 'decision', artifact: null },
  { id: 'leaf-policy', stage: 'validate', question: 'Did the leaf certificate pass policy?', claim: 'DNS name, dates and Server Authentication EKU are valid for portal.simsi2027.test.', entity: 'chain', artifact: 'leaf' },
  { id: 'ica-signature', stage: 'chain-build', question: 'Was the issuing CA signature validated?', claim: 'The leaf signature verifies with the SIMSI2027-ICA01 public key (retrieved via AIA).', entity: 'ica01', artifact: 'ica' },
  { id: 'root-reached', stage: 'root-trust', question: 'Did the chain reach SIMSI2027-ROOTCA?', claim: 'The ICA certificate is signed by SIMSI2027-ROOTCA, which is in the CLIENT01 trust store.', entity: 'rootca', artifact: 'root' },
  { id: 'revocation-ok', stage: 'revocation', question: 'Was revocation status acceptable?', claim: 'The CRL from the CDP is current, signed by the ICA, and does not list this serial number.', entity: 'cdp', artifact: 'crl' },
  { id: 'binding', stage: 'bind', question: 'How did WEB01 present this certificate?', claim: 'IIS has an HTTPS binding for portal.simsi2027.test:443 using this certificate.', entity: 'iis', artifact: 'leaf' },
  { id: 'installed', stage: 'install', question: 'Was the certificate installed with its private key?', claim: 'The certificate public key matches the private key WEB01 generated and retained.', entity: 'web01', artifact: 'leaf' },
  { id: 'produced', stage: 'issue', question: `Which request produced the certificate?`, claim: `Request ${ENV.requestId} on SIMSI2027-ICA01 produced the certificate (signed by the Issuing CA, not the Root CA).`, entity: 'ica01', artifact: 'leaf' },
  { id: 'template', stage: 'policy', question: 'Did policy permit issuance?', claim: `The ${TEMPLATE.name} template permitted the requester, name and key.`, entity: 'template', artifact: 'csr' },
  { id: 'csr-name', stage: 'csr', question: 'What name did the CSR request?', claim: 'The CSR requested portal.simsi2027.test.', entity: 'web01', artifact: 'csr' },
  { id: 'key', stage: 'keygen', question: 'Where is the private key?', claim: 'WEB01 generated and retained the private key; it was never transmitted.', entity: 'web01', artifact: 'private-key' },
  { id: 'owner', stage: 'owner-review', question: 'Who initiated the request?', claim: 'The application owner (Morgan) initiated the request. The visitor did not enroll.', entity: 'owner', artifact: null },
  { id: 'visitor', stage: 'report', question: 'How did this start?', claim: 'The visitor (Jordan) originally reported the TLS problem.', entity: 'visitor', artifact: 'ticket' }
];

export const tour = [
  { id: 't1', stage: 'visit', title: 'The failing website', text: 'Jordan, a normal visitor, opens https://portal.simsi2027.test from CLIENT01.' },
  { id: 't2', stage: 'browser-error', title: 'The reported problem', text: 'The browser finds a certificate problem and warns Jordan; Jordan reports it.' },
  { id: 't3', stage: 'owner-review', title: 'The application owner', text: 'Morgan owns the application and is allowed to request its certificate. Jordan is not the requester.' },
  { id: 't4', stage: 'keygen', title: 'Private key on WEB01', text: 'WEB01 generates the private key locally. It never leaves WEB01.' },
  { id: 't5', stage: 'csr', title: 'The CSR', text: 'WEB01 creates a signed request for portal.simsi2027.test.', select: { artifact: 'csr' } },
  { id: 't6', stage: 'policy', title: 'WebServer policy gate', text: 'The WebServer template decides whether this request is allowed.', select: { entity: 'template' } },
  { id: 't7', stage: 'ca-receive', title: 'Submit to SIMSI2027-ICA01', text: 'The issuing CA receives the request. The offline Root CA is not involved.', select: { entity: 'ica01' } },
  { id: 't8', stage: 'issue', title: 'The CA issues the certificate', text: 'SIMSI2027-ICA01 signs the website certificate.' },
  { id: 't9', stage: 'return', title: 'Inspect the issued certificate', text: 'The real fixture certificate is open in the inspector.', select: { artifact: 'leaf' } },
  { id: 't10', stage: 'install', title: 'Install on WEB01', text: 'WEB01 pairs the certificate with its existing private key.', select: { entity: 'web01' } },
  { id: 't11', stage: 'bind', title: 'Bind to IIS', text: 'IIS gets an HTTPS binding for portal.simsi2027.test on port 443.' },
  { id: 't12', stage: 'retry', title: 'Retry from CLIENT01', text: 'Jordan retries the website.' },
  { id: 't13', stage: 'chain-build', title: 'Build the chain', text: 'CLIENT01 builds leaf, issuing CA and root into a chain.', select: { entity: 'chain' } },
  { id: 't14', stage: 'revocation', title: 'AIA and CDP', text: 'AIA found the issuing CA certificate; the CDP supplied the CRL. Different jobs, different URLs.', select: { entity: 'aia' } },
  { id: 't15', stage: 'trust', title: 'Trusted result', text: 'Every check passed and the connection is trusted.' },
  { id: 't16', stage: 'trust', title: 'Reverse evidence mode', text: 'Now tracing evidence backward: why is the site trusted?', reverse: true },
  { id: 't17', stage: 'trust', title: 'Your turn', text: 'The tour is finished. Try a failure scenario, or step through the lifecycle yourself.', handoff: true }
];

export const futureScenarios = [
  'ndes-scep-device-enrollment', 'cep-ces-enrollment', 'autoenrollment', 'aia-chain-retrieval', 'cdp-crl-validation',
  'ocsp-validation', 'smartcard-logon', 'client-authentication', 'cross-forest-enrollment'
];

const EVIDENCE_KIND = { trusted: 'Derived conclusion', 'leaf-policy': 'Real fixture data', 'ica-signature': 'Real fixture data', 'root-reached': 'Real fixture data', 'revocation-ok': 'Real fixture data',
  binding: 'Simulated environment', installed: 'Real fixture data', produced: 'Real fixture data', template: 'Simulated environment', 'csr-name': 'Real fixture data', key: 'Simulated environment', owner: 'Simulated environment', visitor: 'Simulated environment' };

export default {
  id: 'tls-manual-enrollment', title: 'Website TLS Certificate', version: '0.4.1',
  subtitle: 'An IIS application receives and deploys a server certificate.',
  home: PRES.home, initialState,
  stages: stages.map((s) => ({ ...s, explain: TLS_EXPLAIN[s.id], show: PRES.SHOW[s.id] ?? [] })),
  flows: flows.map((f) => ({ ...f, ...(PRES.FLOW_META[f.id] ?? {}) })),
  artifacts, faults, faultPatches,
  evidenceTrace: evidenceTrace.map((e) => ({ ...e, evidenceKind: EVIDENCE_KIND[e.id] })),
  tour, futureScenarios, layout: PRES.layout, zones: PRES.zones, zoneOf: PRES.zoneOf, statusOf: PRES.statusOf, overrides: PRES.overrides, entityIds: PRES.entityIds, rootLink: PRES.rootLink
};
