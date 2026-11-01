import { describe, it, expect } from 'vitest';
import { frameAt, DURATION, FPS, STAGE_SECONDS, stageStart, FORWARD_START, FORWARD_END, REVERSE_END, TOPOLOGY_END, contactBeats, SCENARIO_ID } from '../../src/film/schedule.js';
import * as E from '../../src/engine/engine.js';
import { scenarioById } from '../../src/scenarios/index.js';

const sc = scenarioById[SCENARIO_ID];
const N = sc.stages.length;
const st = (f) => E.computeState(sc, { faultId: 'healthy', ...f.session });

describe('deterministic v0.3.0 film schedule', () => {
  it('runs at 60 fps for a bounded duration and covers every Domain Controller stage', () => {
    expect(FPS).toBe(60); expect(DURATION).toBeGreaterThan(35); expect(DURATION).toBeLessThan(75); expect(STAGE_SECONDS).toHaveLength(N); // v0.4.0: 24 Path A steps
    expect(SCENARIO_ID).toBe('dc-manual-certificate-request');
  });
  it('the same timestamp always yields the same frame and canonical state', () => {
    for (let i = 0; i < DURATION * FPS; i += 7) { const t = i / FPS; const a = frameAt(t), b = frameAt(t); expect(a).toEqual(b); expect(st(a)).toEqual(st(b)); }
  });
  it('starts on the title/home, then walks the stages in order with monotonic progress', () => {
    expect(frameAt(0).segment).toBe('title'); expect(frameAt(FORWARD_START - 0.1).screen).toBe('home');
    let last = -1;
    for (let i = Math.floor(FORWARD_START * 60); i < FORWARD_END * 60; i += 3) {
      const t = i / 60; const f = frameAt(t); expect(f.screen).toBe('workspace');
      let expected = 0; while (expected < N - 1 && t >= stageStart(expected + 1)) expected++;
      expect(st(f).stage).toBe(expected); expect(f.session.t).toBeGreaterThanOrEqual(last); last = f.session.t; expect(f.full).toBe(false);
    }
  });
  it('ends trusted, then traces evidence in reverse, then reveals the full topology and the outro', () => {
    // v0.4.0: the DC story ends "suitable" (not "trusted").
    expect(st(frameAt(FORWARD_END - 0.01)).trustDecision).toBe('suitable');
    const idx = []; for (let t = FORWARD_END; t < REVERSE_END; t += 0.05) { const f = frameAt(t); const s = st(f); expect(s.direction).toBe('reverse'); expect(s.trustDecision).toBe('suitable'); expect(f.tab).toBe('evidence'); idx.push(s.evidenceIndex); }
    expect(idx[0]).toBe(0); expect(Math.max(...idx)).toBe(E.buildTrace(sc, 'healthy').length - 1);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(frameAt(REVERSE_END + 0.1)).toMatchObject({ segment: 'topology', full: true }); expect(frameAt(TOPOLOGY_END + 0.5).segment).toBe('outro');
  });
  it('focused view is used for the story and the CSR is shown from the real inspector', () => {
    const csrStage = sc.stages.findIndex((s) => s.id === 'a-inspect-csr'); // v0.4.0 Path A step id
    const f = frameAt(stageStart(csrStage) + 1.0); expect(f).toMatchObject({ tab: 'inspector', full: false }); expect(f.session.selectedArtifact).toBe('csr');
  });
  it('provides at least twelve contact-sheet frames inside the film', () => {
    const b = contactBeats(); expect(b.length).toBeGreaterThanOrEqual(12); for (const [t] of b) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(DURATION); }
  });
});
