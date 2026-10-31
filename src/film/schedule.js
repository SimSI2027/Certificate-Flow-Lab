// Deterministic film schedule: film time (seconds) -> session/selection/camera. Pure functions, no clocks, no randomness.
// The scene, captions and panels are then derived from the canonical scenario state exactly as in the interactive app.
import scenario from '../scenarios/tls-manual-enrollment.js';
import { buildTrace, stageIndex } from '../engine/engine.js';
import { LAYOUT } from '../views/scene.js';

export const FPS = 60;
export const TITLE_SECONDS = 3;
export const REVERSE_SECONDS = 7;
export const OUTRO_SECONDS = 3.9;
// Seconds spent on each of the 19 forward stages (animate for the first 80%, then hold the completed state).
export const STAGE_SECONDS = [2.2, 2, 1.6, 1.4, 1.5, 2.4, 1.6, 1.4, 1.2, 1.4, 2.2, 1.4, 1.4, 1.4, 1.8, 1.5, 1.3, 1.8, 1.6];
export const ANIMATE_FRACTION = 0.8;

const N = scenario.stages.length;
export const FORWARD_START = TITLE_SECONDS;
export const FORWARD_END = FORWARD_START + STAGE_SECONDS.reduce((a, b) => a + b, 0);
export const REVERSE_END = FORWARD_END + REVERSE_SECONDS;
export const DURATION = REVERSE_END + OUTRO_SECONDS;
export const stageStart = (i) => FORWARD_START + STAGE_SECONDS.slice(0, i).reduce((a, b) => a + b, 0);
const TRACE = buildTrace(scenario, 'healthy');

// What to show beside the scene during each stage (entity details, real artifact inspector, evidence...).
const SHOW = {
  keygen: { entity: 'web01' },
  csr: { artifact: 'csr', tabs: ['subject', 'san', 'template-request'] },
  policy: { entity: 'template' },
  'ca-receive': { entity: 'ica01' },
  issue: { entity: 'ica01' },
  return: { artifact: 'leaf', tabs: ['general', 'subject-alternative-names', 'enhanced-key-usage', 'authority-information-access'] },
  install: { entity: 'web01' },
  bind: { entity: 'iis' },
  'chain-build': { entity: 'aia' },
  validate: { artifact: 'leaf', tabs: ['certification-path'] },
  'root-trust': { entity: 'rootca' },
  revocation: { entity: 'cdp' },
  trust: { overview: true }
};

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const lerp = (a, b, k) => a + (b - a) * k;
const camFor = (id) => { const [x, y] = LAYOUT[id]; return { cx: x, cy: y - 40, k: 1.12 }; };
const WIDE = { cx: 800, cy: 450, k: 1 };

function forwardCamera(i, u) {
  const stageEntity = scenario.stages[i].focus.entity;
  const cur = i >= N - 1 ? WIDE : camFor(stageEntity);
  const prev = i === 0 ? WIDE : (i - 1 >= N - 1 ? WIDE : camFor(scenario.stages[i - 1].focus.entity));
  const k = smooth(u / 0.35);
  const kk = lerp(prev.k, cur.k, k);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // keep the viewport inside the 1600x900 scene so no empty margin is ever shown
  return { cx: clamp(lerp(prev.cx, cur.cx, k), 800 / kk, 1600 - 800 / kk), cy: clamp(lerp(prev.cy, cur.cy, k), 450 / kk, 900 - 450 / kk), k: kk };
}

export function frameAt(time) {
  const t = Math.min(Math.max(time, 0), DURATION);
  const base = { time: t, titleOpacity: 0, outroOpacity: 0, panel: 'overview', inspTab: null, cam: WIDE, session: { direction: 'forward', t: 0, tReverse: 0, selectedEntity: null, selectedArtifact: null }, segment: 'title' };
  if (t < TITLE_SECONDS) { base.titleOpacity = t > TITLE_SECONDS - 0.5 ? (TITLE_SECONDS - t) / 0.5 : 1; return base; }
  if (t < FORWARD_END) {
    let i = 0; while (i < N - 1 && t >= stageStart(i + 1)) i++;
    const u = (t - stageStart(i)) / STAGE_SECONDS[i];
    const p = Math.min(1, u / ANIMATE_FRACTION);
    const id = scenario.stages[i].id;
    const show = SHOW[id];
    const out = { ...base, segment: 'forward', cam: forwardCamera(i, u), session: { ...base.session, t: i + Math.max(p, 1e-6) } };
    if (show?.entity) { out.session.selectedEntity = show.entity; out.panel = 'details'; }
    if (show?.artifact) { out.session.selectedArtifact = show.artifact; out.panel = 'inspector'; out.inspTab = show.tabs[Math.min(show.tabs.length - 1, Math.floor(u * show.tabs.length))]; }
    if (p >= 1) out.session.t = i + 1;
    return out;
  }
  if (t < REVERSE_END) {
    const u = (t - FORWARD_END) / REVERSE_SECONDS;
    const idx = Math.min(TRACE.length - 1, Math.floor(u * TRACE.length));
    return { ...base, segment: 'reverse', panel: 'evidence', cam: WIDE, session: { ...base.session, direction: 'reverse', t: N, tReverse: idx + 1 } };
  }
  const u = (t - REVERSE_END) / OUTRO_SECONDS;
  return { ...base, segment: 'outro', outroOpacity: smooth(u / 0.3), session: { ...base.session, t: N } };
}
