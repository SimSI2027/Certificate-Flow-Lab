import { describe, it, expect } from 'vitest';
import { frameAt, DURATION, FPS, STAGE_SECONDS, stageStart, FORWARD_START, FORWARD_END, REVERSE_END, TOPOLOGY_END, TLS_START, contactBeats, SCENARIO_ID, TLS_ID } from '../../src/film/schedule.js';
import * as E from '../../src/engine/engine.js';
import { scenarioById } from '../../src/scenarios/index.js';

// v0.4.0: the film keeps a TLS segment, then follows DC Path A in story mode (24 steps, 10 milestones), ending "suitable".
const base = scenarioById[SCENARIO_ID];
const sc = E.pathOf(base, { pathId: 'csr' });
const N = sc.stages.length;
const st = (f) => E.computeState(f.scenario === TLS_ID ? scenarioById[TLS_ID] : base, { faultId: 'healthy', pathId: 'csr', ...f.session });

describe('deterministic v0.4.0 film schedule', () => {
  it('runs at 60 fps for a bounded duration and covers every DC Path A step', () => {
    expect(FPS).toBe(60); expect(DURATION).toBeGreaterThan(35); expect(DURATION).toBeLessThan(80); expect(STAGE_SECONDS).toHaveLength(N); expect(N).toBe(24);
    expect(SCENARIO_ID).toBe('dc-manual-certificate-request');
  });
  it('the same timestamp always yields the same frame and canonical state', () => {
    for (let i = 0; i < DURATION * FPS; i += 7) { const t = i / FPS; const a = frameAt(t), b = frameAt(t); expect(a).toEqual(b); expect(st(a)).toEqual(st(b)); }
  });
  it('starts on the title/home, keeps a TLS segment, then walks the DC steps in order with monotonic progress', () => {
    expect(frameAt(0).segment).toBe('title'); expect(frameAt(TLS_START - 0.1).screen).toBe('home');
    expect(frameAt(TLS_START + 0.1).scenario).toBe(TLS_ID); expect(st(frameAt(FORWARD_START - 0.01)).trustDecision).toBe('trusted');
    let last = -1;
    for (let i = Math.floor(FORWARD_START * 60) + 1; i < FORWARD_END * 60; i += 3) {
      const t = i / 60; const f = frameAt(t); expect(f.screen).toBe('workspace'); expect(f.scenario).toBe(SCENARIO_ID);
      let expected = 0; while (expected < N - 1 && t >= stageStart(expected + 1)) expected++;
      expect(st(f).stage).toBe(expected); expect(f.session.t).toBeGreaterThanOrEqual(last); last = f.session.t; expect(f.full).toBe(false);
    }
  });
  it('ends suitable, then traces evidence in reverse, then reveals the full topology and the outro', () => {
    expect(st(frameAt(FORWARD_END - 0.01)).trustDecision).toBe('suitable');
    const idx = []; for (let t = FORWARD_END; t < REVERSE_END; t += 0.05) { const f = frameAt(t); const s = st(f); expect(s.direction).toBe('reverse'); expect(s.trustDecision).toBe('suitable'); expect(f.panel).toBe(true); idx.push(s.evidenceIndex); }
    expect(idx[0]).toBe(0); expect(Math.max(...idx)).toBe(E.buildTrace(sc, 'healthy').length - 1);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(frameAt(REVERSE_END + 0.1)).toMatchObject({ segment: 'topology', full: true }); expect(frameAt(TOPOLOGY_END + 0.5).segment).toBe('outro');
  });
  it('story mode is used for the DC steps and the CSR is shown from the real inspector', () => {
    const csrStage = sc.stages.findIndex((s) => s.id === 'a-inspect-csr');
    const f = frameAt(stageStart(csrStage) + STAGE_SECONDS[csrStage] * 0.9); expect(f).toMatchObject({ panel: true, full: false, select: { type: 'artifact', id: 'csr' } }); expect(f.session.selectedArtifact).toBe('csr');
  });
  it('contact sheet: one frame per DC milestone plus TLS, title, home, reverse and topology beats', () => {
    const b = contactBeats(); expect(b.length).toBe(16);
    for (const [t] of b) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(DURATION); }
    const dcBeats = b.filter(([t]) => t >= FORWARD_START && t < FORWARD_END);
    expect(dcBeats.map(([t]) => sc.stages[st(frameAt(t)).stage].milestone)).toEqual(sc.milestones);
    expect(b.filter(([t]) => t >= TLS_START && t < FORWARD_START)).toHaveLength(2);
  });
});
