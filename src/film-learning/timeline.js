// Learning film v1 "From CSR to Trust": the final shot timeline. Times are seconds. Every shot owns [start, end) exclusively.
// Captions: headline + one supporting sentence (+ an optional evidence label built from parsed fixtures, see facts.js).
// Each caption's readable window satisfies minHold() from tokens.js (0.3 s per word + 0.5 s); tests enforce it.
// Cues are shot-local times that the canonical film state (state.js) reads; the renderer never invents its own timing.
import { minHold } from './tokens.js';

export const FPS = 60;
export const TITLE = 'From CSR to Trust';
export const FILM_NAME = 'Certificate Flow Lab · Learning film v1';
export const DEMO_URL = 'simsi2027.github.io/Certificate-Flow-Lab/';
export const ACTS = [{ n: 1, title: 'Get the certificate' }, { n: 2, title: 'Use the certificate' }, { n: 3, title: 'Look back' }];

// Camera targets: world centre (x, y) and zoom z. World geometry lives in state.js (plates of 1000 x 760).
export const CAM = {
  client: { x: 500, y: 390, z: 1.0 }, browser: { x: 500, y: 330, z: 1.04 }, checks: { x: 500, y: 560, z: 1.15 },
  pairCW: { x: 1100, y: 470, z: 0.54 }, web: { x: 1700, y: 390, z: 1.0 }, webRight: { x: 1700, y: 400, z: 1.1 },
  webStores: { x: 1465, y: 300, z: 1.42 }, webIis: { x: 1465, y: 610, z: 1.42 },
  pairWI: { x: 2300, y: 430, z: 0.5 }, ica: { x: 2900, y: 390, z: 1.0 }, bench: { x: 3140, y: 420, z: 1.12 },
  pairIR: { x: 3330, y: 400, z: 0.55 }, clientPki: { x: 500, y: 650, z: 0.74 }, wide: { x: 2150, y: 560, z: 0.26 }
};

const C = (at, until, head, body, evidence = null) => ({ at, until, head, body, evidence });
const K = (at, target, dur = 1.0) => ({ at, target, dur });

export const SHOTS = [
  {
    id: 'problem', n: 1, act: 1, title: 'The problem', dur: 10,
    objective: 'The process starts because a person cannot get a trusted connection.',
    hero: 'Browser trust failure on CLIENT01', supporting: ['Jordan (visitor) badge', 'address bar'],
    cameraNote: 'Static on CLIENT01; no movement while the warning is read.',
    artifactState: 'No key, no CSR. WEB01 presents a temporary self-signed certificate.', scenarioState: 'Untrusted connection.',
    handoff: 'The warning stays visible as the report leaves CLIENT01.',
    camera: [K(0, 'browser', 0)],
    cues: { type: 0.4, load: 1.4, warn: 4.7 },
    captions: [
      C(0.2, 5.0, 'Jordan opens the company portal.', 'CLIENT01 asks portal.simsi2027.test for a secure HTTPS connection.', (f) => `Visitor: ${f.visitor.account} on ${f.visitor.host} (${f.visitor.ip})`),
      C(5.0, 10.0, 'The browser does not trust it.', 'WEB01 offers only a temporary self-signed certificate.', (f) => `${f.temp.file}: issuer = subject = ${f.temp.issuerCn}`)
    ]
  },
  {
    id: 'report', n: 2, act: 1, title: 'Report and investigation', dur: 11,
    objective: 'The visitor reports the symptom; the server owner owns the certificate.',
    hero: 'Problem report travelling CLIENT01 → WEB01', supporting: ['Morgan (application owner) badge', 'WEB01 stores and IIS binding'],
    cameraNote: 'Pull back to show both computers during the report, then push into WEB01.',
    artifactState: 'Report only. Personal holds the temporary self-signed certificate; IIS uses it.', scenarioState: 'Investigation.',
    handoff: 'Camera stays on WEB01, where the key will be created.',
    camera: [K(0.5, 'pairCW', 1.1), K(2.6, 'web', 1.0)],
    cues: { ticket: 0.2, travel: 0.9, travelDur: 1.6, morgan: 3.0, inspect: 5.6 },
    captions: [
      C(0.2, 5.6, 'Jordan reports it. That is all.', 'A visitor never requests or owns the site\'s certificate.'),
      C(5.6, 11.0, 'Morgan, the application owner, checks WEB01.', 'No certificate there is trusted for portal.simsi2027.test.', (f) => `Owner and operator: ${f.owner.account} · server ${f.web.fqdn}`)
    ]
  },
  {
    id: 'private-key', n: 3, act: 1, title: 'The private key', dur: 10.5,
    objective: 'The private key is generated on WEB01 and never leaves it.',
    hero: 'Key generated and locked inside the WEB01 key vault', supporting: ['certreq -new command chip'],
    cameraNote: 'Gentle push toward the key vault.',
    artifactState: 'Private key exists, locked in WEB01 (pending request store).', scenarioState: 'Key created.',
    handoff: 'The public half is about to separate from the key pair.',
    camera: [K(0, 'webRight', 0.9)],
    cues: { command: 0.6, keyIn: 1.3, lock: 5.3 },
    captions: [
      C(0.2, 5.2, 'WEB01 generates a private key.', 'certreq -new -machine creates it inside WEB01, marked non-exportable.', (f) => `${f.inf.file}: MachineKeySet = ${f.inf.machineKeySet} · Exportable = ${f.inf.exportable} · KeyLength = ${f.inf.keyLength}`),
      C(5.2, 10.5, 'The private key is the secret.', 'It stays locked on WEB01 and never travels.', () => 'Waiting in Local Computer\\Certificate Enrollment Requests')
    ]
  },
  {
    id: 'csr', n: 4, act: 1, title: 'Public key and CSR', dur: 12.5,
    objective: 'The CSR carries the public key and requested name, never the private key.',
    hero: 'Public key leaves the vault; the CSR forms around it and is signed', supporting: ['vault highlight while signing (the key does not move)'],
    cameraNote: 'Hold on the WEB01 key-and-request column.',
    artifactState: 'Public key token, then a signed CSR on WEB01. Private key unchanged in the vault.', scenarioState: 'CSR created.',
    handoff: 'The CSR opens into an exploded inspection view.',
    camera: [K(0, 'webRight', 0)],
    cues: { pub: 0.5, envelope: 6.3, name: 6.9, seal: 8.7 },
    captions: [
      C(0.2, 6.2, 'Its partner, the public key, is safe to share.', 'It verifies signatures but cannot reveal the private key.'),
      C(6.2, 12.5, 'WEB01 creates a CSR (Certificate Signing Request).', 'Public key plus requested name, signed with the private key.')
    ]
  },
  {
    id: 'csr-inspect', n: 5, act: 1, title: 'Inside the CSR', dur: 19, overlay: 'csr',
    objective: 'Read the CSR field by field and see what it does not contain.',
    hero: 'Exploded CSR with one callout at a time', supporting: ['dimmed WEB01 behind'],
    cameraNote: 'World held; screen-space inspection plate.',
    artifactState: 'CSR unchanged; still on WEB01.', scenarioState: 'CSR ready to submit.',
    handoff: 'The plate closes back onto the CSR on WEB01.',
    camera: [K(0, 'webRight', 0)],
    cues: { in: 0, out: 18.7 },
    callouts: [
      { at: 1.0, field: 'subject', label: 'Subject', text: 'The identity being requested.' },
      { at: 3.6, field: 'san', label: 'SAN (Subject Alternative Name)', text: 'The name browsers will check.' },
      { at: 6.2, field: 'key', label: 'Public key', text: 'Will be copied into the certificate.' },
      { at: 8.8, field: 'template', label: 'Certificate template', text: 'Which issuing policy to apply.' },
      { at: 11.4, field: 'signature', label: 'Signature', text: 'Made with WEB01\'s private key: proof of possession.' },
      { at: 14.0, field: 'absent', label: 'Not inside', text: 'No private key. Ever.' }
    ],
    captions: [
      C(0.2, 14.0, 'Inside the CSR: a request, not a certificate.', 'Every value shown is parsed from the real fixture.', (f) => `fixtures/requests/${f.csr.file}`),
      C(14.0, 19.0, 'What the CSR never contains.', 'No private key. Signing proves possession without sending it.')
    ]
  },
  {
    id: 'submit', n: 6, act: 1, title: 'Submission and policy', dur: 14,
    objective: 'The CA receives the request first, then evaluates it against template policy.',
    hero: 'CSR travels WEB01 → Issuing CA; policy checks tick in order', supporting: ['"private key stays here" pin on WEB01'],
    cameraNote: 'Pull back to show WEB01 and ICA01 together for the trip, then push into ICA01.',
    artifactState: 'CSR at ICA01 as request 1043. Private key still on WEB01.', scenarioState: 'Received, then evaluated.',
    handoff: 'The approved request moves onto the issuance bench.',
    camera: [K(0.2, 'pairWI', 1.2), K(3.7, 'ica', 1.0)],
    cues: { travel: 1.4, travelDur: 2.2, record: 4.3, checks: 6.0, checkStep: 1.2 },
    checks: [
      { label: 'Requester may enroll', value: (f) => `${f.owner.account} · member of ${f.requesterGroup}` },
      { label: 'Template published on this CA', value: (f) => `${f.template.name} (version ${f.template.version})` },
      { label: 'Requested name acceptable', value: (f) => `${f.csr.sanDns[0]} · supplied in the request` },
      { label: 'Key meets the minimum', value: (f) => `${f.csr.keyAlg} · minimum RSA 2048` },
      { label: 'Purpose set by the template', value: () => 'Server Authentication only' }
    ],
    captions: [
      C(0.2, 5.6, 'Morgan submits the CSR.', 'It travels to SIMSI2027 Issuing CA 01, the Certificate Authority (CA).', (f) => `certreq -submit -config "${f.ca.config}" · shown for learning, never executed`),
      C(5.6, 14.0, 'The CA receives it, then checks policy.', 'Allowed requester, published template, acceptable name, key and purpose.', (f) => `Request ${f.requestId} · simulated template policy · Depends on your configuration`)
    ]
  },
  {
    id: 'issue', n: 7, act: 1, title: 'Certificate issuance', dur: 14.5,
    objective: 'The CA creates and signs a NEW certificate; the CSR is only an input.',
    hero: 'New certificate structure filling beside the CSR, then the Issuing CA signature', supporting: ['copy lines CSR → certificate', 'Issuing CA key box', 'Offline Root: not contacted'],
    cameraNote: 'Push onto the bench; after signing, pull back to show the offline Root untouched.',
    artifactState: 'CSR (input) and a separate new leaf certificate, signed by the Issuing CA.', scenarioState: 'Issued.',
    handoff: 'The finished certificate opens for inspection.',
    camera: [K(0, 'bench', 0.9), K(9.6, 'pairIR', 1.3)],
    cues: { bench: 0.3, copy: 1.3, copyStep: 0.8, add: 3.9, addStep: 0.42, sign: 7.2, rootNote: 10.6 },
    captions: [
      C(0.2, 6.8, 'The CA builds a new certificate.', 'The CSR stays an input; approved values are copied across.'),
      C(6.8, 14.5, 'The Issuing CA signs the new certificate.', 'With its own key, which stays on ICA01. The Root CA is not contacted.', (f) => `Issuer: ${f.leaf.issuerCn} · ${f.leaf.sigAlg}`)
    ]
  },
  {
    id: 'cert-inspect', n: 8, act: 1, title: 'Inside the certificate', dur: 28.5, overlay: 'cert',
    objective: 'Read the leaf in four groups: identity, validity, purpose, locations.',
    hero: 'One expanded field group at a time', supporting: ['collapsed summaries of the other groups'],
    cameraNote: 'World held; screen-space inspection plate.',
    artifactState: 'Issued leaf at ICA01.', scenarioState: 'Issued.',
    handoff: 'The plate closes; the public certificates head back to WEB01.',
    camera: [K(0, 'bench', 0.9)],
    cues: { out: 28.2 },
    groups: [
      { at: 0.6, id: 'identity', title: 'Who it identifies' },
      { at: 7.4, id: 'validity', title: 'When it is valid, and which one' },
      { at: 14.2, id: 'purpose', title: 'What it may be used for' },
      { at: 21.0, id: 'locations', title: 'Where clients find more' }
    ],
    captions: [
      C(0.2, 7.4, 'Who it identifies.', 'Browsers match the SAN (Subject Alternative Name); Issuer names the signing CA.'),
      C(7.4, 14.2, 'When it is valid, and which one.', 'A thumbprint is a hash for comparing certificates, not a secret.'),
      C(14.2, 21.0, 'What it may be used for.', 'EKU (Enhanced Key Usage): Server Authentication. Key Usage limits the key itself.', (f) => `Template ${f.leaf.template} ${f.leaf.templateVersion} · settings depend on your configuration`),
      C(21.0, 28.5, 'Where clients find more.', 'AIA (Authority Information Access) locates the issuer certificate; CDP (CRL Distribution Point) locates the CRL (Certificate Revocation List).')
    ]
  },
  {
    id: 'return', n: 9, act: 1, title: 'Return and installation', dur: 13.5,
    objective: 'The returned certificate is public; it becomes usable only with the key WEB01 kept.',
    hero: 'Leaf returns, enters Personal and is linked to the waiting private key', supporting: ['Issuing CA certificate (follows slightly later)', '"private key waiting" pin'],
    cameraNote: 'Pull back for the return trip, then push into WEB01 for the accept.',
    artifactState: 'Leaf in Personal with its private key; Issuing CA certificate in Intermediate.', scenarioState: 'Accepted.',
    handoff: 'Camera settles on the three stores.',
    camera: [K(0.3, 'pairWI', 1.1), K(3.6, 'web', 1.0)],
    cues: { travel: 1.2, travelDur: 2.2, icaLag: 0.3, icaIn: 4.7, command: 6.4, leafIn: 7.0, link: 8.5 },
    captions: [
      C(0.2, 6.4, 'Public certificates return to WEB01.', 'The new leaf and the Issuing CA certificate; neither holds a private key.', () => 'Response contents depend on its format (certificate or PKCS #7 chain) · Depends on your configuration'),
      C(6.4, 13.5, 'certreq -accept pairs the leaf with its key.', 'The key never moved. A certificate file alone cannot recreate it.', () => 'certreq -accept -machine portal.cer · shown for learning, never executed')
    ]
  },
  {
    id: 'stores', n: 10, act: 1, title: 'Certificate stores', dur: 12.5,
    objective: 'Leaf, Issuing CA and Root certificates have different roles and stores.',
    hero: 'One store highlighted at a time', supporting: ['key badge only on the leaf'],
    cameraNote: 'Push into the store column.',
    artifactState: 'Personal: leaf + key. Intermediate: Issuing CA. Trusted Root: Root.', scenarioState: 'Installed.',
    handoff: 'Camera slides down to the IIS binding.',
    camera: [K(0, 'webStores', 1.0)],
    cues: { personal: 0.6, intermediate: 3.2, root: 6.4 },
    captions: [
      C(0.2, 6.2, 'Three stores, three roles.', 'Personal: the leaf with its key. Intermediate: the Issuing CA, no key.'),
      C(6.2, 12.5, 'Trusted Root holds the trust anchor.', 'The Root CA certificate, delivered through Active Directory. No CA key is here.', () => 'Enterprise (AD) distribution · Depends on your configuration')
    ]
  },
  {
    id: 'bind', n: 11, act: 1, title: 'IIS binding', dur: 8,
    objective: 'Installation alone does not make the site use the certificate.',
    hero: 'SSL certificate row switches from the temporary certificate to the new leaf', supporting: ['binding rows'],
    cameraNote: 'Slide down to the IIS card.',
    artifactState: 'HTTPS binding uses the new leaf.', scenarioState: 'Bound.',
    handoff: 'Camera pulls back to the wire between CLIENT01 and WEB01.',
    camera: [K(0, 'webIis', 0.9)],
    cues: { rows: 1.0, swap: 2.2 },
    captions: [
      C(0.2, 8.0, 'Installed is not yet in use.', 'Morgan binds it in IIS: https, port 443, host name portal.simsi2027.test.', () => 'IP All Unassigned · Require Server Name Indication')
    ]
  },
  {
    id: 'retry', n: 12, act: 2, title: 'Client retry and checks', dur: 13.7,
    objective: 'CLIENT01 receives the certificate in the handshake and checks name, dates and purpose.',
    hero: 'Certificate message (leaf + Issuing CA) to CLIENT01, then three checks', supporting: ['ClientHello', 'remaining checks marked next'],
    cameraNote: 'Pull back to the wire, then push onto the checks panel.',
    artifactState: 'Handshake chain = leaf + Issuing CA (Root not sent).', scenarioState: 'Validating.',
    handoff: 'The chain opens as a vertical stack.',
    camera: [K(0, 'pairCW', 1.3), K(6.2, 'checks', 1.0)],
    cues: { hello: 1.5, helloDur: 1.1, certMsg: 2.9, certDur: 1.5, check0: 7.3, checkStep: 1.4 },
    captions: [
      C(0.2, 6.2, 'Jordan tries again.', 'In the TLS (Transport Layer Security) handshake, WEB01 sends the leaf and Issuing CA certificate.', (f) => `Certificate message: ${f.handshakeChain.join(' + ')} · the Root is not sent`),
      C(6.2, 13.7, 'CLIENT01 checks name, dates and purpose.', 'The SAN must match, the date must be in range, the EKU must fit.', (f) => `Simulation clock ${f.now}`)
    ]
  },
  {
    id: 'chain', n: 13, act: 2, title: 'The chain', dur: 13, overlay: 'chain',
    objective: 'Leaf, Issuing CA and Root play different roles; the Root is the trust anchor.',
    hero: 'Leaf → Issuing CA → Root stack with verified signatures', supporting: ['muted history note: Root signed the Issuing CA earlier, offline'],
    cameraNote: 'World held; screen-space chain plate.',
    artifactState: 'Chain built to the Root already in CLIENT01 Trusted Root.', scenarioState: 'Chain trusted.',
    handoff: 'Plate closes to CLIENT01 and the publication server.',
    camera: [K(0, 'checks', 0)],
    cues: { leaf: 0.4, ica: 1.5, root: 2.9, anchor: 6.2, history: 7.4, out: 12.7 },
    captions: [
      C(0.2, 6.0, 'The chain: leaf, Issuing CA, Root.', 'Each signature is verified with the issuer\'s public key.'),
      C(6.0, 13.0, 'The Root is the trust anchor.', 'Trusted because it is already in CLIENT01\'s store, not because a server sent it.', () => 'Root delivered by Group Policy · Depends on your configuration')
    ]
  },
  {
    id: 'aia-cdp', n: 14, act: 2, title: 'AIA and CDP', dur: 14,
    objective: 'AIA and CDP are separate mechanisms with separate locations.',
    hero: 'AIA route shown as not needed; then the CDP route delivers the CRL', supporting: ['PKIWEB01 publication server'],
    cameraNote: 'Pan down to CLIENT01 and PKIWEB01.',
    artifactState: 'CRL #27 read; leaf serial not listed.', scenarioState: 'Revocation checked.',
    handoff: 'Camera pulls back to the wire for the proof of possession.',
    camera: [K(0, 'clientPki', 1.1)],
    cues: { aia: 1.0, cdp: 6.5, crlTravel: 7.0, crlDur: 1.8, list: 9.0, tick: 10.4 },
    captions: [
      C(0.2, 6.4, 'AIA finds a missing issuer certificate.', 'Not needed here: WEB01 already sent the Issuing CA certificate.', (f) => `AIA: ${f.urls.aia}`),
      C(6.4, 14.0, 'CDP finds the revocation list.', 'CLIENT01 reads the CRL; this certificate\'s serial is not listed.', (f) => `CDP: ${f.urls.cdp} · revocation checking depends on your configuration`)
    ]
  },
  {
    id: 'handshake', n: 15, act: 2, title: 'Proof and session keys', dur: 13.5,
    objective: 'The certificate authenticates WEB01; negotiated session keys encrypt the traffic.',
    hero: 'CertificateVerify signature to CLIENT01, then session keys on both sides', supporting: ['encrypted channel'],
    cameraNote: 'Pull back to show both computers and the wire.',
    artifactState: 'Signature travels; the private key does not. Session keys derived on each side.', scenarioState: 'Handshake finished.',
    handoff: 'Camera returns to Jordan\'s browser.',
    camera: [K(0, 'pairCW', 1.2)],
    cues: { verify: 1.3, verifyDur: 1.6, verified: 3.1, sessKeys: 6.8, channel: 8.4 },
    captions: [
      C(0.2, 6.6, 'WEB01 proves it holds the private key.', 'It signs the handshake; CLIENT01 verifies with the leaf\'s public key.', () => 'TLS 1.3 CertificateVerify · signature only, the key never travels'),
      C(6.6, 13.5, 'Session keys encrypt the traffic.', 'Both sides derive them. The certificate proves identity; it does not encrypt data.')
    ]
  },
  {
    id: 'success', n: 16, act: 2, title: 'Trusted connection', dur: 6,
    objective: 'The original problem is solved.',
    hero: 'Browser shows SECURE CONNECTION ESTABLISHED', supporting: ['renewal follow-up label'],
    cameraNote: 'Push back into the browser.',
    artifactState: 'Trusted connection.', scenarioState: 'Trusted.',
    handoff: 'The evidence trace opens over a wide view.',
    camera: [K(0, 'browser', 1.0)],
    cues: { secure: 0.6 },
    captions: [
      C(0.2, 6.0, 'Secure connection established.', 'Jordan reaches the portal without a warning.', (f) => `Follow-up for Morgan: renew before ${f.renewBy} (not autoenrolled)`)
    ]
  },
  {
    id: 'reverse', n: 17, act: 3, title: 'Reverse evidence', dur: 13, overlay: 'reverse',
    objective: 'Trace the trusted result back through its evidence to the original request.',
    hero: 'Evidence nodes revealed from the result back to the cause', supporting: ['wide, dimmed world'],
    cameraNote: 'Wide pullback behind the trace plate.',
    artifactState: 'Final world state, unchanged.', scenarioState: 'Reverse evidence (causality, not a reversed animation).',
    handoff: 'Fade to the end card.',
    camera: [K(0, 'wide', 1.4)],
    cues: { first: 1.0, step: 1.15 },
    captions: [
      C(0.2, 13.0, 'Why is it trusted? Trace it back.', 'Each result rests on evidence created earlier.')
    ]
  },
  {
    id: 'end', n: 18, act: 3, title: 'Certificate Flow Lab', dur: 7, overlay: 'final',
    objective: 'Close the film and point to the interactive demo.',
    hero: 'End card', supporting: [], cameraNote: 'Held.', artifactState: '—', scenarioState: '—', handoff: 'End.',
    camera: [K(0, 'wide', 0)],
    cues: {},
    captions: []
  }
];

// ---------- Derived timing ----------
let acc = 0;
for (const s of SHOTS) { s.start = acc; s.end = acc + s.dur; acc = s.end; }
export const DURATION = acc;
export const FRAME_COUNT = Math.round(DURATION * FPS);
export const shotAt = (t) => { const c = Math.min(Math.max(t, 0), DURATION - 1e-9); let i = 0; while (i < SHOTS.length - 1 && c >= SHOTS[i + 1].start) i++; return i; };
export const shotById = Object.fromEntries(SHOTS.map((s) => [s.id, s]));
export const abs = (shotId, local) => shotById[shotId].start + local;

// All captions in film order with absolute times.
export const CAPTIONS = SHOTS.flatMap((s) => s.captions.map((c, i) => ({ ...c, shot: s.id, index: i, start: s.start + c.at, end: s.start + c.until })));

// Abbreviations the film defines at first use (tests check the first occurrence carries the expansion).
export const DEFINITIONS = {
  CSR: 'Certificate Signing Request', CA: 'Certificate Authority', SAN: 'Subject Alternative Name', EKU: 'Enhanced Key Usage',
  AIA: 'Authority Information Access', CDP: 'CRL Distribution Point', CRL: 'Certificate Revocation List', TLS: 'Transport Layer Security'
};

// Reading-time audit used by tests and the contact-sheet notes.
export const captionAudit = () => CAPTIONS.map((c) => ({ shot: c.shot, head: c.head, window: +(c.end - c.start).toFixed(2), needed: +minHold(`${c.head} ${c.body}`).toFixed(2) }));

// Contact sheet: one settled hold frame per shot (late in its last caption), plus the issuance and AIA/CDP key moments.
export function contactBeats() {
  const beats = SHOTS.map((s) => {
    const last = s.captions.at(-1);
    const t = s.overlay === 'final' ? s.start + s.dur * 0.6 : s.start + (last ? last.until - 0.6 : s.dur * 0.7);
    return [t, `${String(s.n).padStart(2, '0')} ${s.title}`];
  });
  const extra = [[abs('issue', 6.4), '07 New certificate built'], [abs('csr-inspect', 13.6), '05 CSR signature'], [abs('aia-cdp', 6.0), '14 AIA not needed'], [abs('handshake', 6.2), '15 CertificateVerify']];
  return [...beats, ...extra].sort((a, b) => a[0] - b[0]);
}

// Shot-boundary audit: one frame before, the boundary frame, one frame after and a representative hold frame per shot.
export function boundaryFrames() {
  const f = (t) => Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(t * FPS)));
  return SHOTS.map((s) => {
    const last = s.captions.at(-1);
    return { shot: s.id, before: f(s.start) - 1, boundary: f(s.start), after: f(s.start) + 1, hold: f(s.start + (last ? last.until - 0.6 : s.dur * 0.6)) };
  });
}
