import { describe, it, expect } from 'vitest';
import { frameAt, DURATION, FPS, STAGE_SECONDS, stageStart, FORWARD_END, REVERSE_END } from '../../src/film/schedule.js';
import * as E from '../../src/engine/engine.js';
import { scenario } from '../helpers/fixtures.js';

describe('deterministic film schedule', () => {
  it('is 45 s at 60 fps and covers every stage', () => {
    expect(DURATION).toBeGreaterThanOrEqual(35); expect(DURATION).toBeLessThanOrEqual(45.01); expect(FPS).toBe(60);
    expect(STAGE_SECONDS).toHaveLength(scenario.stages.length);
  });
  it('the same timestamp always yields the same frame and canonical state', () => {
    for (let i = 0; i < DURATION * FPS; i += 7) {
      const t = i / FPS; const a = frameAt(t), b = frameAt(t);
      expect(a).toEqual(b);
      expect(E.computeState(scenario, { faultId: 'healthy', ...a.session })).toEqual(E.computeState(scenario, { faultId: 'healthy', ...b.session }));
    }
  });
  it('forward time maps to the matching stage, never goes backwards, and camera stays inside the scene', () => {
    let last = -1;
    for (let i = 0; i < FORWARD_END * FPS; i += 3) {
      const t = i / FPS; const f = frameAt(t);
      expect(Number.isFinite(f.cam.cx + f.cam.cy + f.cam.k)).toBe(true);
      expect(f.cam.cx - 800 / f.cam.k).toBeGreaterThanOrEqual(-1e-6); expect(f.cam.cx + 800 / f.cam.k).toBeLessThanOrEqual(1600 + 1e-6);
      expect(f.cam.cy - 450 / f.cam.k).toBeGreaterThanOrEqual(-1e-6); expect(f.cam.cy + 450 / f.cam.k).toBeLessThanOrEqual(900 + 1e-6);
      if (f.segment !== 'forward') continue;
      const s = E.computeState(scenario, { faultId: 'healthy', ...f.session });
      let expected = 0; while (expected < 18 && t >= stageStart(expected + 1)) expected++;
      expect(s.stage).toBe(expected);
      expect(f.session.t).toBeGreaterThanOrEqual(last); last = f.session.t;
    }
  });
  it('ends trusted, then switches to reverse evidence covering the whole trace, then the outro', () => {
    expect(E.computeState(scenario, { faultId: 'healthy', ...frameAt(FORWARD_END - 0.01).session }).trustDecision).toBe('trusted');
    const idx = []; for (let t = FORWARD_END; t < REVERSE_END; t += 0.05) { const s = E.computeState(scenario, { faultId: 'healthy', ...frameAt(t).session }); expect(s.direction).toBe('reverse'); expect(s.trustDecision).toBe('trusted'); idx.push(s.evidenceIndex); }
    expect(idx[0]).toBe(0); expect(Math.max(...idx)).toBe(12);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);
    expect(frameAt(DURATION - 0.1).segment).toBe('outro');
  });
});
