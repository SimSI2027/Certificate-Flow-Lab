// Deterministic scenario engine. Pure functions only: every visual derives from computeState().
// Timeline position t: t=0 is "nothing happened". t in (k, k+1] is stage k with progress t-k.
// So integer t=k means stage k-1 is complete. Maximum t is the stage count (or the failing stage + 1).

export const SPEEDS = [0.25, 0.5, 1, 2];
export const STAGE_SECONDS = 3.2; // wall-clock seconds per stage at 1x

export const stageIndex = (scenario, id) => scenario.stages.findIndex((s) => s.id === id);
export const getFault = (scenario, id) => scenario.faults.find((f) => f.id === id) ?? scenario.faults[0];

export function haltStageIndex(scenario, faultId) {
  const f = getFault(scenario, faultId);
  return f.failStage ? stageIndex(scenario, f.failStage) : null;
}
export function maxT(scenario, faultId) {
  const h = haltStageIndex(scenario, faultId);
  return h === null ? scenario.stages.length : h + 1;
}

export function tToPosition(t, count) {
  const c = Math.min(Math.max(t, 0), count);
  const stage = Math.max(0, Math.min(count - 1, Math.ceil(c) - 1));
  return { stage, progress: c - stage };
}
export const stageStartT = (i) => i;
export const stageEndT = (i) => i + 1;
export const clampT = (t, max) => Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), max);
const EPS = 1e-9;
export const stepForwardT = (t, max) => clampT(Math.floor(t + EPS) + 1, max);
export const stepBackwardT = (t, max) => clampT(Math.ceil(t - EPS) - 1, max);
export const advanceT = (t, dtSeconds, speed, max) => clampT(t + (dtSeconds * speed) / STAGE_SECONDS, max);

function merge(state, patch) {
  if (!patch) return state;
  const next = { ...state };
  for (const [k, v] of Object.entries(patch)) next[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...state[k], ...v } : v;
  return next;
}

export function createInitialState(scenario) {
  return {
    scenarioId: scenario.id, direction: 'forward', stage: 0, stageProgress: 0, selectedEntity: null, selectedArtifact: null, playbackSpeed: 1,
    ...structuredClone(scenario.initialState), activeFault: 'healthy', evidenceIndex: null, halted: false, failure: null
  };
}

// World state after applying forward timeline position t (no reverse/ui overlay).
export function worldAt(scenario, faultId, t) {
  const count = scenario.stages.length;
  const halt = haltStageIndex(scenario, faultId);
  const tt = clampT(t, maxT(scenario, faultId));
  const { stage, progress } = tToPosition(tt, count);
  let s = createInitialState(scenario);
  s.activeFault = faultId;
  for (let i = 0; i < stage; i++) s = merge(s, stageDone(scenario, faultId, i, halt));
  if (tt > 0) {
    if (progress >= 1 - EPS) s = merge(s, stageDone(scenario, faultId, stage, halt));
    else s = merge(s, scenario.stages[stage].during);
  }
  s.stage = stage;
  s.stageProgress = tt === 0 ? 0 : Math.min(1, progress);
  s.halted = halt !== null && tt >= halt + 1 - EPS;
  s.failure = s.halted ? faultId : null;
  return s;
}
function stageDone(scenario, faultId, i, halt) {
  const st = scenario.stages[i];
  if (halt !== i) return st.done;
  const fp = scenario.faultPatches[faultId] ?? {};
  return { ...st.done, ...fp, validation: { ...(st.done.validation ?? {}), ...(fp.validation ?? {}) } };
}

// Evidence trace for reverse mode, filtered to what exists for this fault.
export function buildTrace(scenario, faultId) {
  const halt = haltStageIndex(scenario, faultId);
  const items = scenario.evidenceTrace.map((e) => ({ ...e, stageIndex: stageIndex(scenario, e.stage) }));
  if (halt === null) return items.map((e) => ({ ...e, verdict: 'pass' }));
  const reached = items.filter((e) => e.stageIndex <= halt);
  const failing = reached.find((e) => e.stageIndex === halt);
  const verdict = {
    id: 'verdict', stage: scenario.stages[halt].id, stageIndex: halt, question: 'Why is the site NOT trusted?',
    claim: `Validation stopped at "${scenario.stages[halt].title}" (${getFault(scenario, faultId).label}).`,
    entity: failing?.entity ?? scenario.stages[halt].focus.entity, artifact: failing?.artifact ?? null, verdict: 'fail'
  };
  // trace order is the declared order; items past the halt are dropped; the failing item is flagged.
  const rest = reached.map((e) => ({ ...e, verdict: e.stageIndex === halt ? 'fail' : 'pass' }));
  return [verdict, ...rest.filter((e) => e.id !== 'trusted')];
}

export const traceMaxT = (scenario, faultId) => buildTrace(scenario, faultId).length;

// Full canonical state for a session: { faultId, direction, t, tReverse, selectedEntity, selectedArtifact, playbackSpeed }.
export function computeState(scenario, session) {
  const { faultId = 'healthy', direction = 'forward' } = session;
  let s;
  if (direction === 'reverse') {
    const trace = buildTrace(scenario, faultId);
    const tr = clampT(session.tReverse ?? 0, trace.length);
    const idx = Math.max(0, Math.min(trace.length - 1, Math.ceil(tr) - 1));
    s = worldAt(scenario, faultId, maxT(scenario, faultId));
    s.direction = 'reverse';
    s.evidenceIndex = idx;
    s.stage = trace[idx].stageIndex;
    s.stageProgress = tr === 0 ? 0 : Math.min(1, tr - idx);
  } else {
    s = worldAt(scenario, faultId, session.t ?? 0);
  }
  s.selectedFlow = session.selectedFlow ?? null;
  s.selectedEntity = session.selectedEntity ?? null;
  s.selectedArtifact = session.selectedArtifact ?? null;
  s.playbackSpeed = session.playbackSpeed ?? 1;
  return s;
}

// ---- Derived scene facts (so the view never invents state) ----
export function flowStatus(scenario, state, flow, faultId = state.activeFault) {
  const si = stageIndex(scenario, flow.stage);
  if (state.direction === 'reverse') {
    const reached = si <= (haltStageIndex(scenario, faultId) ?? Infinity);
    return { phase: reached ? 'done' : 'idle', progress: reached ? 1 : 0, failed: reached && haltStageIndex(scenario, faultId) === si };
  }
  const halt = haltStageIndex(scenario, faultId);
  if (state.stage < si) return { phase: 'idle', progress: 0, failed: false };
  if (state.stage > si) return { phase: 'done', progress: 1, failed: halt === si };
  const [a, b] = flow.window;
  const p = state.stageProgress;
  if (state.stage === si && p <= 0) return { phase: 'idle', progress: 0, failed: false };
  const local = Math.min(1, Math.max(0, (p - a) / (b - a)));
  const done = local >= 1;
  return { phase: done ? 'done' : local > 0 ? 'active' : 'idle', progress: local, failed: done && halt === si };
}

// Where is an artifact right now? Returns {visible, at, moving, via, from, progress}
export function artifactLocation(scenario, state, artifact) {
  const faultId = state.activeFault;
  const reverse = state.direction === 'reverse';
  const cur = reverse ? (haltStageIndex(scenario, faultId) ?? scenario.stages.length - 1) : state.stage;
  const prog = reverse ? 1 : state.stageProgress;
  let loc = { visible: false, at: null, moving: false, via: null, from: null, progress: 1 };
  for (const p of artifact.presence) {
    const ai = stageIndex(scenario, p.arrive);
    if (cur < ai || (cur === ai && prog <= 0)) continue;
    if (cur === ai && p.via) {
      const flow = scenario.flows.find((f) => f.id === p.via);
      const fs = flowStatus(scenario, state, flow, faultId);
      if (fs.phase === 'idle') continue;
      if (fs.phase === 'done' && p.blockedBy?.includes(faultId)) continue;
      if (fs.phase === 'active') { loc = { visible: true, at: flow.to, moving: true, via: flow, from: p.from ?? flow.from, progress: fs.progress }; continue; }
    }
    loc = { visible: true, at: p.at, moving: false, via: null, from: null, progress: 1 };
  }
  return loc;
}

// Reachable stage ids for jump-to-stage (forward mode).
export const reachableStages = (scenario, faultId) => scenario.stages.slice(0, maxT(scenario, faultId)).map((s, i) => ({ ...s, index: i }));
