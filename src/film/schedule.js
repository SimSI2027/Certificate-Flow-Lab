// Deterministic film schedule (v0.3.0 story): film time (seconds) -> screen, session, selection, tab. Pure functions, no clocks, no randomness.
// Everything visible is then derived from the canonical scenario state exactly as in the interactive app.
import scenario from '../scenarios/dc-manual-certificate-request.js';
import { buildTrace } from '../engine/engine.js';

export const FPS = 60;
export const SCENARIO_ID = scenario.id;
export const TITLE_SECONDS = 3;
export const HOME_SECONDS = 4;
export const REVERSE_SECONDS = 5;
export const TOPOLOGY_SECONDS = 2.2;
export const OUTRO_SECONDS = 2.8;
// Seconds on each DC Path A stage (animate for 80%, then hold the completed state).
const LONG = { 'a-why': 2.2, 'a-template': 2.4, 'a-new': 2.6, 'a-inspect-csr': 2.4, 'a-sign': 2.2, 'a-accept': 2.6, 'a-chain': 2.4, 'a-followup': 2.4 };
export const STAGE_SECONDS = scenario.stages.map((s) => LONG[s.id] ?? 1.6);
export const ANIMATE_FRACTION = 0.8;

const N = scenario.stages.length;
export const FORWARD_START = TITLE_SECONDS + HOME_SECONDS;
export const FORWARD_END = FORWARD_START + STAGE_SECONDS.reduce((a, b) => a + b, 0);
export const REVERSE_END = FORWARD_END + REVERSE_SECONDS;
export const TOPOLOGY_END = REVERSE_END + TOPOLOGY_SECONDS;
export const DURATION = TOPOLOGY_END + OUTRO_SECONDS;
export const stageStart = (i) => FORWARD_START + STAGE_SECONDS.slice(0, i).reduce((a, b) => a + b, 0);
const TRACE = buildTrace(scenario, 'healthy');

// Which side tab / selection explains each stage best.
const SHOW = {
  'a-inf': { tab: 'inspector', artifact: 'inf', tabs: ['summary', 'raw-inf'] }, 'a-inspect-csr': { tab: 'inspector', artifact: 'csr', tabs: ['subject', 'san', 'public-key', 'pem'] },
  'a-retrieve': { tab: 'inspector', artifact: 'leaf', tabs: ['general'] }, 'a-key': { tab: 'inspector', artifact: 'accepted', tabs: ['matching-csr'] },
  'a-purposes': { tab: 'inspector', artifact: 'accepted', tabs: ['subject-alternative-names', 'enhanced-key-usage'] }
};

export function frameAt(time) {
  const t = Math.min(Math.max(time, 0), DURATION);
  const base = { time: t, screen: 'workspace', segment: 'forward', titleOpacity: 0, outroOpacity: 0, full: false, tab: 'explain', inspTab: null, session: { direction: 'forward', t: 0, tReverse: 0, selectedEntity: null, selectedArtifact: null } };
  if (t < TITLE_SECONDS) return { ...base, screen: 'home', segment: 'title', titleOpacity: t > TITLE_SECONDS - 0.5 ? (TITLE_SECONDS - t) / 0.5 : 1 };
  if (t < FORWARD_START) return { ...base, screen: 'home', segment: 'home' };
  if (t < FORWARD_END) {
    let i = 0; while (i < N - 1 && t >= stageStart(i + 1)) i++;
    const u = (t - stageStart(i)) / STAGE_SECONDS[i]; const p = Math.min(1, u / ANIMATE_FRACTION); const id = scenario.stages[i].id; const show = SHOW[id];
    const out = { ...base, session: { ...base.session, t: p >= 1 ? i + 1 : i + Math.max(p, 1e-6) } };
    if (show?.entity) out.session.selectedEntity = show.entity;
    if (show?.artifact) { out.session.selectedArtifact = show.artifact; out.inspTab = show.tabs[Math.min(show.tabs.length - 1, Math.floor(u * show.tabs.length))]; }
    if (show) out.tab = show.tab;
    return out;
  }
  if (t < REVERSE_END) {
    const u = (t - FORWARD_END) / REVERSE_SECONDS; const idx = Math.min(TRACE.length - 1, Math.floor(u * TRACE.length));
    return { ...base, segment: 'reverse', tab: 'evidence', session: { ...base.session, direction: 'reverse', t: N, tReverse: idx + 1 } };
  }
  if (t < TOPOLOGY_END) return { ...base, segment: 'topology', full: true, session: { ...base.session, t: N } };
  const u = (t - TOPOLOGY_END) / OUTRO_SECONDS;
  return { ...base, segment: 'outro', full: true, outroOpacity: Math.min(1, Math.max(0, u / 0.3)), session: { ...base.session, t: N } };
}

// Representative frames for the contact sheet (time, label).
export function contactBeats() {
  const at = (i, f) => stageStart(i) + STAGE_SECONDS[i] * f;
  return [[1.5, 'Title'], [5, 'Scenario home'], [at(0, 0.9), 'Missing certificate'], [at(1, 0.9), 'Inspect DC01'], [at(5, 0.9), 'Key on DC01'], [at(7, 0.55), 'CSR inspector'], [at(8, 0.9), 'Submit to ICA'],
    [at(9, 0.9), 'Template policy'], [at(10, 0.9), 'CA issues'], [at(12, 0.9), 'Accept on DC01'], [at(13, 0.9), 'Key match'], [at(14, 0.6), 'EKU and SAN'], [at(15, 0.9), 'Chain, AIA, CDP'],
    [at(16, 0.95), 'Suitable result'], [FORWARD_END + REVERSE_SECONDS * 0.5, 'Reverse evidence'], [TOPOLOGY_END - 0.6, 'Full topology']];
}
