// Website TLS Certificate (v0.5.0): story vocabulary for the redesigned lesson. Educational simulation only: nothing here contacts a
// real CA, IIS, DNS or browser, and no command is ever executed. Rules: CLAUDE.md "Website TLS truth rules (v0.5.0)".
import { TLS, URLS } from '../../artifacts/synthetic.js';
import { CFG, cfg, KIND, placeZones, makeCommand } from '../story-common.js';

export { CFG, cfg, KIND };
export const SITE = TLS.web.site;
export const MORGAN = TLS.owner, JORDAN = TLS.visitor.user;
export const REQ = TLS.requestId;
export const CA_ARG = `"${TLS.caConfig}"`;

// ---------- Zones (same geometry as the DC story) ----------
export const ZONES = placeZones([
  { id: 'Z1', n: 1, name: 'CLIENT01 — the visitor', title: '1 · CLIENT01', lines: ['The visitor', 'CLIENT01 (same computer)'], sameComputer: 'CLIENT01' },
  { id: 'Z2', n: 2, name: 'WEB01 — key and request', title: '2 · WEB01', lines: ['Key and request', 'WEB01 (same computer)'], sameComputer: 'WEB01' },
  { id: 'Z3', n: 3, name: 'Issuing CA — SIMSI2027 Issuing CA 01', title: '3 · Issuing CA (ICA01)', lines: ['SIMSI2027 Issuing CA 01'] },
  { id: 'Z4', n: 4, name: 'WEB01 — install and IIS binding', title: '4 · WEB01', lines: ['Install and IIS binding', 'WEB01 (same computer)'], sameComputer: 'WEB01' },
  { id: 'Z5', n: 5, name: 'On the wire — TLS handshake', title: '5 · On the wire', lines: ['TLS handshake'] },
  { id: 'Z6', n: 6, name: 'CLIENT01 — validation and trust store', title: '6 · CLIENT01', lines: ['Validation, trust store', 'CLIENT01 (same computer)'], sameComputer: 'CLIENT01' }
]);

// ---------- WEB01 stores (Local Computer), drawn in Z4; the transient request store is the key vault in Z2 ----------
export const STORES = [
  { id: 'personal', name: 'Personal', full: 'Local Computer\\Personal', y: 212, h: 96 },
  { id: 'intermediate', name: 'Intermediate Certification Authorities', short: 'Intermediate CAs', full: 'Local Computer\\Intermediate Certification Authorities', y: 316, h: 96 },
  { id: 'root', name: 'Trusted Root Certification Authorities', short: 'Trusted Root CAs', full: 'Local Computer\\Trusted Root Certification Authorities', y: 420, h: 96 }
];
export const PENDING_STORE = { id: 'requests', name: 'Certificate Enrollment Requests', full: 'Local Computer\\Certificate Enrollment Requests' };
export const CLIENT_ROOT = { id: 'client-root', name: 'Trusted Root CAs', full: 'Local Computer\\Trusted Root Certification Authorities on CLIENT01' };
// Rule 9: only the leaf has a private key on WEB01. CLIENT01 holds no private key for this site.
export const STORE_MAP = { leaf: { store: 'personal', privateKeyOnWeb01: true }, ica: { store: 'intermediate', privateKeyOnWeb01: false }, root: { store: 'root', privateKeyOnWeb01: false } };

// ---------- Template cards (rule 3) ----------
export const TEMPLATE_CARDS = [
  { id: 'web', name: TLS.template.name, display: TLS.template.display, oid: TLS.template.oid, version: TLS.template.version, simulated: true, used: true,
    rows: [['Schema', 'Version 2 (an organization duplicate)'], ['Subject name', 'Supply in the request'], ['EKU', 'Server Authentication only'], ['Key Usage', 'Digital Signature, Key Encipherment'],
      ['Minimum key', 'RSA 2048'], ['Enroll', cfg(`The "${TLS.requesterGroup}" group (Morgan is a member).`, 'how template permissions are delegated')],
      ['Issuance', cfg('Issued without manager approval in this lab.', 'whether your template requires approval')], ['Status', 'Organization-specific, simulated']] },
  { id: 'builtin', name: TLS.builtinTemplate.name, display: 'Web Server (built-in)', comparison: true,
    rows: [['Schema', 'Version 1: its settings cannot be edited'], ['Enroll', cfg('Only Domain Admins and Enterprise Admins by default.', 'the template permissions in your forest')]],
    note: 'Comparison only: organizations commonly duplicate the built-in template as a version 2 template with its own Enroll group, as SIMSI2027WebServer does.' }
];

// ---------- Artifact vocabulary (icon + fixed label + colour token; colour is never the only signal) ----------
export const ARTIFACTS = {
  selfsigned: { label: 'Temporary cert', icon: 'a-browser', color: 'red', tag: 'self-signed by WEB01 · the browser warns', stamp: 'not trusted', role: 'selfsigned' },
  report: { label: 'Problem report', icon: 'a-ticket', color: 'slate', tag: 'from Jordan: "certificate warning on the portal"' },
  requirements: { label: 'Requirements', icon: 'a-template', color: 'purple', tag: 'SAN portal.simsi2027.test · Server Authentication · RSA 2048' },
  inf: { label: 'Request policy (INF)', icon: 'a-doc', color: 'grey', tag: 'portal-request.inf · local file on WEB01', role: 'inf' },
  'private-key': { label: 'Private key', icon: 'a-key', color: 'amber', tag: 'stays on WEB01', inspectable: false, transport: false },
  csr: { label: 'CSR', icon: 'a-envelope', color: 'blue', tag: 'public key + name · signed by the WEB01 key', role: 'csr' },
  record: { label: 'Request record', icon: 'a-ledger', color: 'purple', tag: `Request ${REQ}` },
  leaf: { label: 'Issued certificate', icon: 'a-ribbon', color: 'gold', tag: 'portal.simsi2027.test · public', role: 'leaf' },
  accepted: { label: 'Accepted certificate', icon: 'a-ribbon-key', color: 'gold', tag: 'in Personal with its private key', role: 'leaf' },
  binding: { label: 'HTTPS binding', icon: 'a-iis', color: 'teal', tag: 'https · 443 · portal.simsi2027.test · SNI' },
  hello: { label: 'ClientHello', icon: 'a-handshake', color: 'indigo', tag: 'SNI portal.simsi2027.test · TLS 1.3 offered · key share' },
  handshake: { label: 'Certificate message', icon: 'a-chain', color: 'indigo', tag: 'leaf + Issuing CA · public only · Root not sent', role: 'handshake' },
  certverify: { label: 'CertificateVerify', icon: 'a-handshake', color: 'indigo', tag: 'signature by the WEB01 key · the key never travels' },
  chain: { label: 'Chain', icon: 'a-chain', color: 'teal', tag: 'leaf → Issuing CA → Root (in CLIENT01 store)', role: 'chain' },
  crl: { label: 'CRL', icon: 'a-doc', color: 'grey', tag: 'from the CDP · signed by the Issuing CA', role: 'crl' },
  ica: { label: 'Issuing CA certificate', icon: 'a-cert-ca', color: 'teal', tag: 'public · no private key here', role: 'ica' },
  root: { label: 'Root CA certificate', icon: 'a-cert-anchor', color: 'green', tag: 'trust anchor · public copy · no private key here', role: 'root' },
  padlock: { label: 'Trusted connection', icon: 'a-padlock', color: 'trusted', tag: 'identity proven · session keys encrypt the traffic' },
  followup: { label: 'Follow-up', icon: 'a-check', color: 'slate', tag: `renew before ${TLS.renewBy} · not autoenrolled` }
};
export const artifactLabel = (id) => ARTIFACTS[id]?.label ?? id;
export const artifactTag = (id) => ARTIFACTS[id]?.tag ?? '';

// ---------- Glossary: one-line definitions opened from the first use (focusable, not hover-only) ----------
export const GLOSSARY = {
  TLS: 'Transport Layer Security: the protocol behind HTTPS that authenticates the server and encrypts the connection.',
  SNI: 'Server Name Indication: the site name the browser sends in ClientHello so the server can pick the right certificate.',
  CSR: 'Certificate Signing Request: the public key and requested names, signed with the new private key; never the private key itself.',
  SAN: 'Subject Alternative Name: the list of names a certificate is valid for; browsers match the typed name against it.',
  EKU: 'Enhanced Key Usage: the purposes a certificate may be used for, such as Server Authentication.',
  KU: 'Key Usage: what the key itself may do, such as Digital Signature or Key Encipherment.',
  AIA: 'Authority Information Access: the URL where a client can download the issuer (CA) certificate.',
  CDP: 'CRL Distribution Point: the URL where a client downloads the revocation list.',
  CRL: 'Certificate Revocation List: a list, signed by the CA, of serial numbers withdrawn before they expire.',
  CertificateVerify: 'The TLS message in which the server signs the handshake with its private key, proving it holds that key.',
  'trust anchor': 'A root certificate a computer already trusts; every trusted chain must end at one.'
};

// ---------- Commands: every token has a meaning; nothing is executed ----------
const TOKENS = {
  'certreq': 'Windows certificate request tool (certreq.exe).',
  '-new': 'Create a new key pair and a signed request from an INF policy file, in one operation.',
  '-machine': 'Use the Local Computer (machine) context, which IIS uses, instead of the current user.',
  '-submit': 'Send a request file to a certification authority.',
  '-config': 'Name the CA to use, as "CA host\\CA name".',
  '-accept': 'Install a response and link it to the pending request that holds the private key.',
  'certutil': 'Windows certificate utility (certutil.exe).',
  '-dump': 'Decode and display a file without changing anything.',
  '-verifystore': 'Verify a certificate in a Local Computer store, including its private key and chain.',
  'My': 'The Personal store.',
  'portal-request.inf': 'The request policy written on WEB01.',
  'portal.req': 'The CSR file (public key, name, attributes; no private key).',
  'portal.cer': 'The issued certificate for portal.simsi2027.test (public).',
  [CA_ARG]: 'CA configuration string: CA host ICA01.simsi2027.test, CA name SIMSI2027 Issuing CA 01 (derived from the Issuing CA certificate).',
  '<serial>': 'The serial number of the portal.simsi2027.test certificate.'
};
export const command = makeCommand(TOKENS);
// GUI paths are explained the same way: every segment is a token with a meaning.
export function guiPath(segments) {
  return { text: segments.map(([t]) => t).join(' → '), tokens: segments.map(([t, meaning]) => ({ t, meaning })) };
}

// ---------- Actors (the badge sits on the acting zone only) ----------
export const ACTOR_TEXT = { VIS: 'Jordan acts', OWN: 'Morgan acts', CA: 'Issuing CA acts', CLI: 'CLIENT01 checks', WEB: 'WEB01 acts' };
export const ACTOR_FULL = { VIS: `Visitor ${JORDAN}`, OWN: `Application owner (operator) ${MORGAN}`, CA: 'SIMSI2027 Issuing CA 01 (system)', CLI: 'CLIENT01 (system: browser and Windows chain engine)', WEB: 'WEB01 (system: IIS and HTTP.sys)' };

// ---------- Canonical initial state ----------
export const initialState = {
  visitorState: 'idle', dnsState: 'unresolved', connectionState: 'none', requestState: 'none', templateState: 'unchecked', infState: 'none',
  keyState: 'absent', pendingRequest: 'none', csrState: 'none', requestRecord: 'none', requester: null, permissionState: 'unchecked',
  leafState: 'none', keyAssociation: 'none', storeView: 'closed', iisBindingState: 'temporary-selfsigned', serverReady: false,
  handshake: 'none', handshakeChain: 'none', proofState: 'none', chainState: 'unchecked', aiaState: 'not-needed', revocationState: 'unchecked',
  trustDecision: 'none', followupState: 'none',
  // WEB01's CA certificates and CLIENT01's Root arrive from Active Directory before the lesson starts (rules 9 and 12).
  trust: { root: 'present', ica: 'present', rootSource: 'Enterprise (AD)', icaSource: 'Enterprise (AD)' },
  clientTrust: { root: 'present', source: 'Enterprise (AD) / Group Policy' },
  validation: { name: 'pending', dates: 'pending', eku: 'pending', signatures: 'pending', root: 'pending' }
};

// ---------- Faults (separate selector; each halts at its step) ----------
export const FAULTS = [
  { id: 'no-enroll-permission', label: 'No Enroll permission', at: 't-policy', stops: true, check: 'permission',
    symptom: `The CA denies request ${REQ}: ${MORGAN} has no Enroll permission on ${TLS.template.name}.`,
    evidence: [{ text: `Template security: Morgan is not in "${TLS.requesterGroup}", so Enroll is not granted.`, kind: KIND.SIM }, { text: `CA request record ${REQ}: denied by the policy module.`, kind: KIND.SIM }],
    owner: 'PKI administrator', remediation: cfg(`Add Morgan to "${TLS.requesterGroup}", the group that holds Read and Enroll, then resubmit the same CSR. Running certreq elevated does not help: elevation is not a template permission.`, 'how template permissions are delegated'),
    longTerm: 'Grant Enroll through groups, not individuals, and review template permissions periodically.',
    patch: { permissionState: 'denied', requestRecord: 'denied', trustDecision: 'rejected' } },
  { id: 'template-not-published', label: 'Template not published on ICA01', at: 't-policy', stops: true, check: 'published',
    symptom: `The CA rejects request ${REQ}: ${TLS.template.name} is not in ICA01's list of certificate templates to issue.`,
    evidence: [{ text: `ICA01 → Certificate Templates does not list ${TLS.template.name}.`, kind: KIND.SIM }],
    owner: 'PKI administrator', remediation: cfg(`Publish ${TLS.template.name} on ICA01 (Certificate Templates → New → Certificate Template to Issue) and wait for AD replication, then resubmit.`, 'how long replication takes'),
    longTerm: 'Keep the list of templates published on each CA in the PKI runbook.',
    patch: { templateState: 'missing', requestRecord: 'denied', trustDecision: 'rejected' } },
  { id: 'user-context', notes: { 't-new': 'certreq ran without machine context, so the key and the pending request went to Morgan\'s user store.' }, label: 'Request created in user context', at: 't-accept', stops: true, check: 'context', fixtures: { inf: 'user-context' },
    effects: { 't-inf': { infState: 'written-user' }, 't-new': { keyState: 'user-store', pendingRequest: 'user-store' } },
    symptom: 'certreq -accept -machine finds no pending machine request: the key and the request are in Morgan\'s user store, which IIS cannot use.',
    evidence: [{ text: 'fault-portal-user-context.inf: MachineKeySet = FALSE.', kind: KIND.REAL }, { text: 'Local Computer\\Certificate Enrollment Requests on WEB01 is empty.', kind: KIND.SIM }],
    owner: 'Application owner (Morgan)', remediation: 'Recreate the request in machine context (certreq -new -machine with MachineKeySet = TRUE), resubmit and accept it on WEB01; delete the stray request from Morgan\'s user store.',
    longTerm: 'Add a machine-context check to the web-certificate runbook.',
    patch: { pendingRequest: 'user-store', keyState: 'user-store', leafState: 'on-web01', keyAssociation: 'missing', trustDecision: 'rejected' } },
  { id: 'no-private-key', notes: { 't-accept': 'Morgan imported portal.cer with the Certificates console instead of running certreq -accept, so no key was linked.', 't-stores': 'Personal shows the certificate without a private key.' }, label: 'Certificate installed without its private key', at: 't-bind', stops: true, check: 'key',
    // The .cer file was imported into Personal by hand instead of being accepted: nothing linked the key, so the pending request remains.
    effects: { 't-accept': { leafState: 'unlinked', keyAssociation: 'missing', pendingRequest: 'present', keyState: 'pending-on-web01' }, 't-stores': { keyAssociation: 'missing' } },
    symptom: 'IIS cannot use the certificate: it was imported into Personal from portal.cer instead of being accepted, so it has no private key and the https binding cannot use it.',
    evidence: [{ text: 'Personal shows portal.simsi2027.test without a matching private key, and Certificate Enrollment Requests still holds the key for request 1043: no accept ran, so nothing was linked.', kind: KIND.DERIVED }, { text: 'The certificate public key (SPKI) matches only the pending request on WEB01.', kind: KIND.REAL }],
    owner: 'Application owner (Morgan)', remediation: 'Delete the keyless copy and run certreq -accept -machine portal.cer on WEB01, the computer that created the request (re-request if the pending request is gone). Copying a .cer file neither copies nor recreates a private key.',
    longTerm: 'Accept on the requesting computer; never move private keys around to repair a binding.',
    patch: { iisBindingState: 'failed-no-key', trustDecision: 'rejected' } },
  { id: 'wrong-binding', notes: { 't-bind': 'The new certificate went onto a different binding; the portal https binding still names the temporary certificate.', 't-ready': 'IIS still presents the temporary certificate for portal.simsi2027.test.' }, label: 'HTTPS binding still on the temporary certificate', at: 't-cert-msg', stops: true, check: 'binding', fixtures: { handshake: 'wrong-binding' },
    effects: { 't-bind': { iisBindingState: 'still-selfsigned' }, 't-ready': { serverReady: false } },
    symptom: 'CLIENT01 still receives the temporary self-signed certificate: the https binding for portal.simsi2027.test was not switched to the new certificate (or the binding has no SNI host name).',
    evidence: [{ text: 'Certificate message: fault-portal-selfsigned.cer (self-signed, not issued by the Issuing CA).', kind: KIND.REAL }, { text: 'IIS binding https · 443 · portal.simsi2027.test still names the temporary certificate.', kind: KIND.SIM }],
    owner: 'Application owner (Morgan)', remediation: 'Edit the portal site\'s https binding: host name portal.simsi2027.test, Require Server Name Indication, SSL certificate = portal.simsi2027.test (serial …CC10). Then retry from CLIENT01.',
    longTerm: 'Check the presented certificate after every certificate change (for example with netsh http show sslcert, which lists SNI bindings).',
    patch: { handshakeChain: 'selfsigned', connectionState: 'warning', trustDecision: 'rejected' } },
  { id: 'missing-ica', notes: { 't-stores': 'WEB01\'s Intermediate store does not hold the Issuing CA certificate, so IIS can send only the leaf.', 't-cert-msg': 'WEB01 sends only the leaf.' }, label: 'Issuing CA certificate missing', at: 't-chain', stops: true, check: 'chain-ica',
    effects: { 't-visit': { trust: { ica: 'missing', icaSource: null } }, 't-cert-msg': { handshakeChain: 'leaf-only' } },
    connector: { 't-chain': { from: 'Z6', to: 'PUB:aia', channel: 'HTTP (AIA)', blocked: true } },
    symptom: 'CLIENT01 cannot build the chain: WEB01 sent only the leaf (its Intermediate store lacks the Issuing CA certificate) and the AIA URL is unreachable.',
    evidence: [{ text: 'Certificate message lists one certificate: portal.simsi2027.test.', kind: KIND.SIM }, { text: `HTTP GET ${URLS.icaAia} fails from CLIENT01.`, kind: KIND.SIM }],
    owner: 'Application owner (WEB01) and PKI publication administrator', remediation: 'Restore the Issuing CA certificate in WEB01\'s Intermediate Certification Authorities store (normally delivered by AD) so IIS sends it, and restore the AIA file on PKIWEB01.',
    longTerm: 'Monitor AIA publication. Variant: with the AIA URL reachable, CLIENT01 would recover by downloading the Issuing CA certificate itself.',
    patch: { chainState: 'incomplete', aiaState: 'failed', connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'untrusted-root', notes: { 't-visit': 'CLIENT01 does not have the SIMSI2027 Root CA in its Trusted Root store.' }, label: 'Root not trusted on CLIENT01', at: 't-chain', stops: true, check: 'root',
    effects: { 't-visit': { clientTrust: { root: 'missing', source: null } } },
    symptom: 'The chain ends at SIMSI2027 Root CA, but CLIENT01\'s Trusted Root store does not contain it (CLIENT01 is not domain-joined, or the policy has not applied).',
    evidence: [{ text: 'CLIENT01 Trusted Root Certification Authorities: no SIMSI2027 Root CA.', kind: KIND.SIM }],
    owner: 'Endpoint team / PKI administrator', remediation: cfg('Distribute the SIMSI2027 Root CA to CLIENT01 through AD (Enterprise store) or Group Policy. Never tell visitors to click through the warning.', 'how trust anchors reach clients'),
    longTerm: 'Track which clients receive the PKI trust settings.',
    patch: { validation: { root: 'fail' }, chainState: 'untrusted-root', connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'wrong-dns', label: 'Wrong name in the certificate', at: 't-checks', stops: true, check: 'name', fixtures: { leaf: 'wrong-dns', csr: 'wrong-dns' },
    symptom: `Name mismatch: the certificate's SAN is www.${SITE}, but Jordan typed ${SITE}.`,
    evidence: [{ text: `fault-wrong-dns.cer SAN: DNS=www.${SITE}.`, kind: KIND.REAL }],
    owner: 'Application owner (Morgan)', remediation: `Create a new request with SAN dns=${SITE}, have it issued, accept it on WEB01 and rebind IIS; revoke the wrong certificate per policy.`,
    longTerm: 'Inspect the CSR SAN (certutil -dump) before submitting.',
    patch: { validation: { name: 'fail' }, connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'expired', label: 'Certificate expired', at: 't-checks', stops: true, check: 'dates', fixtures: { leaf: 'expired' },
    symptom: 'The certificate expired on 2026-09-30; the simulation clock is 2026-10-31.',
    evidence: [{ text: 'fault-expired.cer validity 2026-02-01 to 2026-09-30.', kind: KIND.REAL }],
    owner: 'Application owner (Morgan)', remediation: 'Renew: create a new request on WEB01, have it issued, accept it and rebind IIS.',
    longTerm: 'Track the expiry date: this certificate is not autoenrolled.',
    patch: { validation: { dates: 'fail' }, connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'wrong-eku', label: 'Wrong purpose (Client Authentication only)', at: 't-checks', stops: true, check: 'eku', fixtures: { leaf: 'wrong-eku' },
    symptom: 'The certificate allows Client Authentication only; a web server certificate needs Server Authentication.',
    evidence: [{ text: `fault-wrong-eku.cer EKU: Client Authentication; template ${TLS.wrongEkuTemplate.name} (${TLS.wrongEkuTemplate.display}).`, kind: KIND.REAL }],
    owner: 'Application owner (Morgan) / PKI administrator (template)', remediation: `Request a new certificate with ${TLS.template.name}, install it and rebind IIS; revoke the wrongly issued one per policy.`,
    longTerm: 'Restrict who may enroll for workstation templates.',
    patch: { validation: { eku: 'fail' }, connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'revoked', label: 'Certificate revoked', at: 't-revocation', stops: true, check: 'revocation', fixtures: { leaf: 'revoked' },
    symptom: 'The certificate\'s serial (…CC14) is on CRL #27: revoked on 2026-10-30 for key compromise.',
    evidence: [{ text: 'CRL #27 lists serial 2027000000000000000000000000CC14.', kind: KIND.REAL }],
    owner: 'Application owner (Morgan) and CA administrator', remediation: 'Generate a new key and request on WEB01 (the old key may be compromised), install the new certificate and rebind IIS.',
    longTerm: 'Record why the certificate was revoked.',
    patch: { revocationState: 'revoked', connectionState: 'blocked', trustDecision: 'rejected' } },
  { id: 'cdp-unavailable', label: 'CRL not reachable (CDP)', at: 't-revocation', stops: true, check: 'cdp',
    symptom: 'CLIENT01 cannot download the CRL from the CDP, so revocation status is unknown; this simulated client treats that as a failure (hard-fail).',
    evidence: [{ text: `HTTP GET ${URLS.icaCdp} times out from CLIENT01.`, kind: KIND.SIM }],
    owner: 'PKI publication administrator', remediation: cfg('Restore CRL publication on PKIWEB01 and confirm the CRL is current; the certificate itself is fine.', 'whether a client fails closed or open when revocation is unknown'),
    longTerm: 'Monitor CRL publication and the CRL next-update time.',
    patch: { revocationState: 'offline', connectionState: 'blocked', trustDecision: 'rejected' } }
];
export const faultsList = () => [{ id: 'healthy', label: 'Healthy (no fault)', failStage: null }, ...FAULTS.map((f) => ({ ...f, stage: f.at, failStage: f.stops ? f.at : null }))];

// ---------- Step builder (keeps the engine's stage fields alongside the story fields) ----------
export function step(p) {
  const conn = p.connector ?? null;
  return {
    id: p.id, milestone: p.milestone, act: p.act, phase: p.milestone, title: p.title, purpose: p.purpose, narrative: p.purpose, zone: p.zone, actorZone: p.actorZone ?? p.zone,
    adjacent: p.adjacent ?? [], actor: p.actor, artifact: p.artifact ?? null, command: p.command ?? null, gui: p.gui ?? null, connector: conn, result: p.result ?? null,
    show: [], explain: p.explain, technical: p.technical ?? [], during: p.during ?? {}, done: p.done ?? {}, focus: { entity: p.zone, artifact: p.artifact ?? null }, flows: conn ? [`f-${p.id}`] : [],
    vault: p.vault ?? false, stores: false, pub: p.pub ?? false, rootHistory: p.rootHistory ?? false, notes: p.notes ?? [], storeTargets: p.storeTargets ?? [], keyUse: p.keyUse ?? false
  };
}
export function flowsFor(steps) {
  return steps.filter((s) => s.connector).map((s) => {
    const c = s.connector;
    return { id: `f-${s.id}`, stage: s.id, from: c.from ?? s.zone, to: c.to ?? s.zone, kind: c.blocked ? 'blocked' : c.association ? 'association' : 'transport', protocol: c.channel ?? 'WEB01 internal association',
      payload: artifactLabel(s.artifact), identity: s.actor, result: s.result ?? '', evidence: s.purpose, artifact: s.artifact, window: [0, 1], blocked: !!c.blocked, channel: c.channel, association: !!c.association, local: !!c.local };
  });
}
export const CHANNELS = ['DNS, then TCP 443', 'support ticket', 'local file', 'RPC/DCOM', 'IIS binding (local)', 'HTTPS 443 / TLS', 'HTTP (AIA)', 'HTTP (CDP)'];
