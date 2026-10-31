import { describe, it, expect } from 'vitest';
import * as E from '../../src/engine/engine.js';
import { scenario } from '../helpers/fixtures.js';
import { entities } from '../../src/entities/entities.js';

const N = scenario.stages.length;
const ids = scenario.stages.map((s) => s.id);
const FINITE = (v) => v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'object';

describe('stage ordering', () => {
  it('has the canonical 19 stage sequence', () => {
    expect(ids).toEqual(['visit', 'browser-error', 'report', 'owner-review', 'keygen', 'csr', 'policy', 'ca-receive', 'ca-evaluate', 'issue', 'return', 'install', 'bind', 'retry', 'chain-build', 'validate', 'root-trust', 'revocation', 'trust']);
    expect(new Set(ids).size).toBe(N);
  });
  it('phases progress Need→Request→Policy→Issue→Install→Bind→Connect→Validate→Trust', () => {
    const order = [];
    for (const s of scenario.stages) if (order.at(-1) !== s.phase) order.push(s.phase);
    expect(order).toEqual(['Need', 'Request', 'Policy', 'Issue', 'Install', 'Bind', 'Connect', 'Validate', 'Trust']);
  });
  it('visitor reports; owner (not visitor) starts the request', () => {
    const w = (id) => E.worldAt(scenario, 'healthy', E.stageEndT(ids.indexOf(id)));
    expect(w('report').requestState).toBe('needed');
    expect(w('owner-review').requestState).toBe('reviewed');
    const flow = scenario.flows.find((f) => f.id === 'f-review');
    expect([flow.from, flow.to]).toEqual(['owner', 'web01']);
    expect(scenario.flows.some((f) => f.from === 'visitor' && /csr|submit|enroll/i.test(f.id))).toBe(false);
  });
});

describe('forward transitions', () => {
  it('state is fully determined by position', () => {
    for (let t = 0; t <= N; t += 0.25) expect(E.worldAt(scenario, 'healthy', t)).toEqual(E.worldAt(scenario, 'healthy', t));
  });
  it('healthy run ends trusted and all fields are finite', () => {
    const s = E.worldAt(scenario, 'healthy', N);
    expect(s).toMatchObject({ trustDecision: 'trusted', connectionState: 'trusted', iisBindingState: 'bound', revocationState: 'good', chainState: 'trusted-root', keyState: 'held-on-web01' });
    for (let t = 0; t <= N; t += 0.1) for (const f of scenario.faults) for (const v of Object.values(E.worldAt(scenario, f.id, t))) expect(FINITE(v)).toBe(true);
    for (let t = 0; t <= N; t += 0.1) expect(Number.isFinite(E.worldAt(scenario, 'healthy', t).stageProgress)).toBe(true);
  });
  it('certificate state only advances', () => {
    const order = ['none', 'issued', 'returning', 'returned', 'installed', 'presented'];
    let last = 0;
    for (let t = 0; t <= N; t += 0.05) { const i = order.indexOf(E.worldAt(scenario, 'healthy', t).certificateState); expect(i).toBeGreaterThanOrEqual(last); last = i; }
  });
});

describe('timeline scrubbing and stepping', () => {
  it('maps t to stage/progress', () => {
    expect(E.tToPosition(0, N)).toEqual({ stage: 0, progress: 0 });
    expect(E.tToPosition(1, N)).toEqual({ stage: 0, progress: 1 });
    expect(E.tToPosition(1.5, N)).toEqual({ stage: 1, progress: 0.5 });
    expect(E.tToPosition(N, N)).toEqual({ stage: N - 1, progress: 1 });
  });
  it('scrubbing back and forth gives identical states', () => {
    const a = E.worldAt(scenario, 'healthy', 7.3);
    E.worldAt(scenario, 'healthy', 2); E.worldAt(scenario, 'healthy', 15);
    expect(E.worldAt(scenario, 'healthy', 7.3)).toEqual(a);
  });
  it('partial vs complete stage movement', () => {
    const mid = E.worldAt(scenario, 'healthy', 4.5), done = E.worldAt(scenario, 'healthy', 5);
    expect(mid.keyState).toBe('generating');
    expect(mid.stageProgress).toBeCloseTo(0.5);
    expect(done.keyState).toBe('held-on-web01');
    expect(done.stageProgress).toBe(1);
  });
  it('step forward/backward move by whole stages', () => {
    expect(E.stepForwardT(0, N)).toBe(1);
    expect(E.stepForwardT(1.4, N)).toBe(2);
    expect(E.stepForwardT(2, N)).toBe(3);
    expect(E.stepBackwardT(3, N)).toBe(2);
    expect(E.stepBackwardT(2.5, N)).toBe(2);
    expect(E.stepBackwardT(0.5, N)).toBe(0);
    expect(E.stepForwardT(N, N)).toBe(N);
  });
  it('advance scales with speed and clamps', () => {
    const a = E.advanceT(0, 1, 1, N), b = E.advanceT(0, 1, 2, N);
    expect(b).toBeCloseTo(a * 2);
    expect(E.advanceT(N - 0.01, 10, 2, N)).toBe(N);
    expect(E.SPEEDS).toEqual([0.25, 0.5, 1, 2]);
  });
});

describe('fault branching', () => {
  const expected = { 'wrong-dns': 'validate', expired: 'validate', 'untrusted-root': 'root-trust', 'wrong-eku': 'validate', 'missing-ica': 'chain-build', revoked: 'revocation', 'cdp-unavailable': 'revocation', 'no-private-key': 'install' };
  it('has exactly the initial fault set', () => {
    expect(scenario.faults.map((f) => f.id)).toEqual(['healthy', ...Object.keys(expected)]);
  });
  for (const [id, stage] of Object.entries(expected)) {
    it(`${id} halts at ${stage}`, () => {
      expect(E.maxT(scenario, id)).toBe(ids.indexOf(stage) + 1);
      const s = E.worldAt(scenario, id, 99);
      expect(s.halted).toBe(true);
      expect(s.stage).toBe(ids.indexOf(stage));
      expect(s.trustDecision).not.toBe('trusted');
      expect(E.worldAt(scenario, id, ids.indexOf(stage)).halted).toBe(false);
    });
  }
  it('step forward cannot pass the failure', () => {
    const m = E.maxT(scenario, 'revoked');
    expect(E.stepForwardT(m, m)).toBe(m);
  });
});

describe('reverse evidence trace', () => {
  it('healthy trace answers the spec questions in order', () => {
    const t = E.buildTrace(scenario, 'healthy');
    expect(t.map((e) => e.id)).toEqual(['trusted', 'leaf-policy', 'ica-signature', 'root-reached', 'revocation-ok', 'binding', 'installed', 'produced', 'template', 'csr-name', 'key', 'owner', 'visitor']);
    expect(t.at(-1).claim).toMatch(/Jordan/);
    const prod = t.slice(t.findIndex((e) => e.id === 'binding'));
    for (let i = 1; i < prod.length; i++) expect(prod[i].stageIndex).toBeLessThan(prod[i - 1].stageIndex);
  });
  it('is evidence tracing, not reversed animation: it keeps the end-state world and moves a focus index', () => {
    const w = E.worldAt(scenario, 'healthy', N);
    const r = E.computeState(scenario, { faultId: 'healthy', direction: 'reverse', tReverse: 3 });
    expect(r.direction).toBe('reverse');
    expect(r.evidenceIndex).toBe(2);
    expect(r.trustDecision).toBe(w.trustDecision);
    expect(r.keyState).toBe(w.keyState);
    expect(r.stage).toBe(E.buildTrace(scenario, 'healthy')[2].stageIndex);
  });
  it('failure traces start from the verdict and drop unreached evidence', () => {
    const t = E.buildTrace(scenario, 'revoked');
    expect(t[0].id).toBe('verdict');
    expect(t[0].verdict).toBe('fail');
    expect(t.every((e) => e.stageIndex <= ids.indexOf('revocation'))).toBe(true);
    expect(E.buildTrace(scenario, 'no-private-key').some((e) => e.id === 'binding')).toBe(false);
  });
});

describe('scene derivations and references', () => {
  it('private key never leaves WEB01', () => {
    const key = scenario.artifacts.find((a) => a.id === 'private-key');
    expect(key.presence.every((p) => p.at === 'web01' && !p.via)).toBe(true);
    for (let t = 0; t <= N; t += 0.25) { const loc = E.artifactLocation(scenario, E.worldAt(scenario, 'healthy', t), key); if (loc.visible) expect(loc.at).toBe('web01'); }
    expect(scenario.flows.filter((f) => f.artifact === 'private-key').every((f) => f.from === 'web01' && f.to === 'web01')).toBe(true);
  });
  it('certificate moves from ICA to WEB01 and never to/from the Root CA', () => {
    const leaf = scenario.artifacts.find((a) => a.id === 'leaf');
    expect(E.artifactLocation(scenario, E.worldAt(scenario, 'healthy', 10.5), leaf)).toMatchObject({ moving: true, from: 'ica01', at: 'web01' });
    expect(scenario.flows.some((f) => f.from === 'rootca' || f.to === 'rootca')).toBe(false);
  });
  it('every reference resolves to a defined entity / stage / flow', () => {
    const eid = new Set(entities.map((e) => e.id));
    for (const f of scenario.flows) { expect(ids).toContain(f.stage); expect(eid.has(f.from)).toBe(true); expect(eid.has(f.to)).toBe(true); }
    for (const a of scenario.artifacts) for (const p of a.presence) { expect(ids).toContain(p.arrive); expect(eid.has(p.at)).toBe(true); }
    for (const s of scenario.stages) { expect(eid.has(s.focus.entity)).toBe(true); for (const f of s.flows) expect(scenario.flows.some((x) => x.id === f)).toBe(true); }
    for (const e of scenario.evidenceTrace) { expect(ids).toContain(e.stage); if (e.entity) expect(eid.has(e.entity)).toBe(true); }
    for (const t of scenario.tour) expect(ids).toContain(t.stage);
  });
  it('future scenarios are reserved but not implemented', () => {
    expect(scenario.futureScenarios).toContain('ocsp-validation');
    expect(scenario.futureScenarios).toHaveLength(9);
  });
});
