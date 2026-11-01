// Scenario: Website TLS Certificate (v0.5.0 story redesign; synthetic SIMSI2027 environment). Id unchanged so URLs and tests resolve.
// One path ('main', expressed as pathId without a paths map), two acts, 10 milestones and 26 steps on the story-zone system.
// Educational simulation only: nothing here contacts a real CA, IIS, DNS or browser, and no command is executed.
import { TLS } from '../artifacts/synthetic.js';
import { NEVER_EXECUTED, CFG } from './story-common.js';
import { ZONES, STORES, ARTIFACTS, FAULTS, ACTOR_TEXT, ACTOR_FULL, initialState, faultsList, flowsFor, artifactLabel, artifactTag, SITE } from './tls/shared.js';
import { steps, MILESTONES, ACTS, MILESTONE_ACT, evidenceTrace, VERDICT_QUESTION, tour } from './tls/steps.js';
import { evaluateTls } from './tls/evaluate.js';

const faults = faultsList();
const faultPatches = Object.fromEntries(FAULTS.filter((f) => f.stops).map((f) => [f.id, f.patch]));
const faultStagePatches = Object.fromEntries(FAULTS.filter((f) => f.effects).map((f) => [f.id, f.effects]));
const artifacts = Object.entries(ARTIFACTS).map(([id, a]) => {
  const first = steps.find((s) => s.artifact === id);
  return { id, label: a.label, color: a.color, icon: a.icon, tag: a.tag, inspectable: !!a.role, fixtureRole: a.role ?? null, note: a.stamp, presence: first ? [{ arrive: first.id, at: first.zone, via: null }] : [] };
});

// Resolves the parsed fixture behind an artifact for the selected fault.
function resolveFixture(model, artifactId, faultId = 'healthy') {
  const a = ARTIFACTS[artifactId]; if (!a?.role) return null;
  const f = FAULTS.find((x) => x.id === faultId);
  if (artifactId === 'handshake' && f?.fixtures?.handshake) return model.resolve('selfsigned', null);
  const variant = (role) => (f?.fixtures?.[role] ? faultId : null);
  if (artifactId === 'accepted' || artifactId === 'leaf') return model.resolve('leaf', variant('leaf'));
  return model.resolve(a.role, variant(a.role));
}

// Where the active artifact is now, in words (spotlight footer). Steps that move something say where it is going or has arrived.
function whereText(sp, state, step) {
  const done = state.stageProgress >= 1;
  const special = {
    't-warning': done ? 'on CLIENT01, in the browser' : 'arriving from WEB01', 't-report': done ? 'with Morgan' : 'leaving CLIENT01',
    't-submit': done ? `at ICA01 · Request ${TLS.requestId}` : 'on the way to ICA01', 't-return': done ? 'on WEB01 as portal.cer' : 'leaving ICA01',
    't-hello': done ? 'received by WEB01' : 'on the wire to WEB01', 't-cert-msg': done ? 'received by CLIENT01' : 'on the wire to CLIENT01',
    't-proof': done ? 'verified by CLIENT01' : 'on the wire to CLIENT01', 't-revocation': done ? 'on CLIENT01, checked' : 'fetched from PKIWEB01',
    't-trusted': done ? 'in the browser on CLIENT01' : 'on the wire'
  }[step?.id];
  if (special) return special;
  return { Z1: 'on CLIENT01', Z2: 'on WEB01', Z3: 'at ICA01', Z4: 'on WEB01', Z5: 'on the wire', Z6: 'on CLIENT01' }[sp.zone] ?? '';
}

// Story descriptor consumed by the shared story layout and scene (src/views/story-layout.js, story-scene.js).
const story = {
  kind: 'tls', title: 'Website TLS Certificate', ariaScene: 'Website TLS story: six zones',
  beforeStart: 'Press START FLOW. Act 1 gets the certificate; Act 2 uses it. One zone, one artifact and one route are active at a time.',
  zones: () => ZONES, artifacts: ARTIFACTS, label: (id) => artifactLabel(id), tag: (id) => artifactTag(id), actorText: ACTOR_TEXT, actorFull: ACTOR_FULL,
  storeZone: 'Z4', stores: STORES, storeHost: 'WEB01', leafLabel: SITE, caZone: 'Z3', client: 'CLIENT01', requestId: TLS.requestId,
  vault: { zone: 'Z2', from: 't-new', host: 'WEB01', userStore: 'Morgan\'s user store' },
  iis: { zone: 'Z4' }, clientRoot: { zone: 'Z6' },
  assocLabel: 'certreq -accept links this certificate to the existing key — same computer (WEB01), never on the network',
  assocFail: { 'user-store': 'no pending machine request on WEB01: nothing linked', default: 'no pending request matches this certificate: nothing linked' },
  otLabel: 'It signed the Issuing CA certificate earlier and never signs the website certificate.',
  aiaNote: { ok: 'not needed: sent in handshake', failed: 'unreachable (fault)' },
  whereText
};

export default {
  id: 'tls-manual-enrollment', title: 'Website TLS Certificate', version: '0.5.0', layoutMode: 'story-zones', pathId: 'main', pathLabel: 'Website TLS',
  subtitle: `Jordan sees a certificate warning on ${SITE}. Morgan gets a certificate from the Issuing CA for WEB01, binds it in IIS, and CLIENT01 learns to trust the site.`,
  home: { purpose: 'Replace the temporary self-signed certificate behind a browser warning with a certificate from the Issuing CA, then follow the TLS handshake and the checks CLIENT01 makes.',
    requester: `${TLS.owner}, the application owner (the visitor ${TLS.visitor.user} only reports the problem)`,
    destination: `WEB01: Local Computer\\Personal with the private key that never leaves WEB01, bound to the IIS https site ${SITE}`,
    method: `certreq on WEB01 (key and CSR together), template ${TLS.template.name}, submitted to SIMSI2027 Issuing CA 01; then the TLS handshake and validation on CLIENT01` },
  initialState, milestones: MILESTONES, acts: ACTS, milestoneAct: MILESTONE_ACT, stages: steps, flows: flowsFor(steps), artifacts, faults, faultPatches, faultStagePatches,
  evidenceTrace, verdictQuestion: VERDICT_QUESTION, zones: ZONES, story, tour,
  futureScenarios: ['ndes-scep-device-enrollment', 'cep-ces-enrollment', 'autoenrollment', 'aia-chain-retrieval', 'cdp-crl-validation', 'ocsp-validation', 'smartcard-logon', 'client-authentication', 'cross-forest-enrollment'],
  resolveFixture, evaluate: evaluateTls, neverExecuted: NEVER_EXECUTED, configMarker: CFG
};
