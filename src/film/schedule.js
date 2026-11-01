// Deterministic film schedule (v0.4.0): film time (seconds) -> screen, scenario, session, selection, panel. Pure functions, no clocks,
// no randomness. Everything visible is then derived from the canonical scenario state exactly as in the interactive app.
// Story: title -> home -> TLS segment (classic workspace) -> DC Path A in story mode (one beat per step, grouped by milestone)
// -> reverse evidence -> full topology -> outro.
import dc from '../scenarios/dc-manual-certificate-request.js';
import tls from '../scenarios/tls-manual-enrollment.js';
import { buildTrace, pathOf } from '../engine/engine.js';

export const FPS = 60;
export const SCENARIO_ID = dc.id;
export const TLS_ID = tls.id;
const A = pathOf(dc, { pathId: 'csr', conditionId: 'trust-missing' });
export const TITLE_SECONDS = 3;
export const HOME_SECONDS = 3;
export const TLS_STAGE_SECONDS = 0.6;
export const TLS_SECONDS = TLS_STAGE_SECONDS * tls.stages.length;
export const REVERSE_SECONDS = 5;
export const TOPOLOGY_SECONDS = 2.2;
export const OUTRO_SECONDS = 2.8;
// Seconds on each DC Path A step (animate for 80%, then hold the completed state).
const LONG = { 'a-why': 2.2, 'a-template': 2.4, 'a-new': 2.6, 'a-inspect-csr': 2.6, 'a-submit': 1.9, 'a-sign': 2.2, 'a-return-move': 1.9, 'a-root': 1.9, 'a-accept': 2.6, 'a-key': 2.2, 'a-chain': 2.4, 'a-followup': 2.6 };
export const STAGE_SECONDS = A.stages.map((s) => LONG[s.id] ?? 1.4);
export const ANIMATE_FRACTION = 0.8;

const N = A.stages.length;
export const TLS_START = TITLE_SECONDS + HOME_SECONDS;
export const FORWARD_START = TLS_START + TLS_SECONDS;
export const FORWARD_END = FORWARD_START + STAGE_SECONDS.reduce((a, b) => a + b, 0);
export const REVERSE_END = FORWARD_END + REVERSE_SECONDS;
export const TOPOLOGY_END = REVERSE_END + TOPOLOGY_SECONDS;
export const DURATION = TOPOLOGY_END + OUTRO_SECONDS;
export const stageStart = (i) => FORWARD_START + STAGE_SECONDS.slice(0, i).reduce((a, b) => a + b, 0);
const TRACE = buildTrace(A, 'healthy');

// Steps where the details panel opens on the object that explains the step best.
const SHOW = {
  'a-template': { select: null, panel: true }, 'a-inf': { select: { type: 'artifact', id: 'inf' }, panel: true }, 'a-inspect-csr': { select: { type: 'artifact', id: 'csr' }, panel: true },
  'a-sign': { select: { type: 'artifact', id: 'leaf' }, panel: true }, 'a-return-move': { select: { type: 'artifact', id: 'root' }, panel: true },
  'a-key': { select: { type: 'store', id: 'personal' }, panel: true }, 'a-purposes': { select: { type: 'artifact', id: 'accepted' }, panel: true }
};

export function frameAt(time) {
  const t = Math.min(Math.max(time, 0), DURATION);
  const base = { time: t, screen: 'workspace', scenario: SCENARIO_ID, segment: 'forward', titleOpacity: 0, outroOpacity: 0, full: false, tab: 'explain', inspTab: null, panel: false, select: null,
    session: { direction: 'forward', t: 0, tReverse: 0, selectedEntity: null, selectedArtifact: null } };
  if (t < TITLE_SECONDS) return { ...base, screen: 'home', segment: 'title', titleOpacity: t > TITLE_SECONDS - 0.5 ? (TITLE_SECONDS - t) / 0.5 : 1 };
  if (t < TLS_START) return { ...base, screen: 'home', segment: 'home' };
  if (t < FORWARD_START) {
    const u = (t - TLS_START) / TLS_STAGE_SECONDS; const i = Math.min(tls.stages.length - 1, Math.floor(u)); const p = Math.min(1, (u - i) / ANIMATE_FRACTION);
    return { ...base, scenario: TLS_ID, segment: 'tls-forward', session: { ...base.session, t: p >= 1 ? i + 1 : i + Math.max(p, 1e-6) } };
  }
  if (t < FORWARD_END) {
    let i = 0; while (i < N - 1 && t >= stageStart(i + 1)) i++;
    const u = (t - stageStart(i)) / STAGE_SECONDS[i]; const p = Math.min(1, u / ANIMATE_FRACTION); const show = SHOW[A.stages[i].id];
    const out = { ...base, session: { ...base.session, t: p >= 1 ? i + 1 : i + Math.max(p, 1e-6) } };
    // The panel opens once the step's movement has finished, so the route stays visible while it moves.
    if (show && u >= 0.55) { out.panel = show.panel; out.select = show.select; if (show.select?.type === 'artifact') out.session.selectedArtifact = show.select.id; }
    return out;
  }
  if (t < REVERSE_END) {
    const u = (t - FORWARD_END) / REVERSE_SECONDS; const idx = Math.min(TRACE.length - 1, Math.floor(u * TRACE.length));
    return { ...base, segment: 'reverse', panel: true, session: { ...base.session, direction: 'reverse', t: N, tReverse: idx + 1 } };
  }
  if (t < TOPOLOGY_END) return { ...base, segment: 'topology', full: true, session: { ...base.session, t: N } };
  const u = (t - TOPOLOGY_END) / OUTRO_SECONDS;
  return { ...base, segment: 'outro', full: true, outroOpacity: Math.min(1, Math.max(0, u / 0.3)), session: { ...base.session, t: N } };
}

// Contact sheet: title, home, TLS beats, one frame per DC milestone, reverse evidence and full topology.
export function contactBeats() {
  const at = (i, f) => stageStart(i) + STAGE_SECONDS[i] * f;
  const tlsAt = (frac) => TLS_START + TLS_SECONDS * frac;
  const milestoneBeats = A.milestones.map((m) => {
    const idx = A.stages.map((s, i) => (s.milestone === m ? i : -1)).filter((i) => i >= 0);
    const pick = idx.find((i) => SHOW[A.stages[i].id]) ?? idx[Math.floor((idx.length - 1) / 2)];
    return [at(pick, 0.92), `${A.milestones.indexOf(m) + 1} ${m}`];
  });
  return [[1.5, 'Title'], [4.5, 'Scenario home'], [tlsAt(0.35), 'TLS request'], [tlsAt(0.97), 'TLS trusted'], ...milestoneBeats,
    [FORWARD_END + REVERSE_SECONDS * 0.5, 'Reverse evidence'], [TOPOLOGY_END - 0.6, 'Full topology']];
}
