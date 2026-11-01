// Engine behaviour (pure functions), exercised through the Website TLS lesson.
// v0.5.0: migrated from the superseded 19-stage classic TLS model to the 26-step story model. Each test keeps its v0.1 intent
// (canonical order, determinism, stepping, fault halts, evidence tracing, key never travels, Root never on a route).
import { describe, it, expect } from 'vitest';
import * as E from '../../src/engine/engine.js';
import { scenario } from '../helpers/fixtures.js';

const N = scenario.stages.length;
const ids = scenario.stages.map((s) => s.id);
const FINITE = (v) => v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'object';
const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'];

describe('stage ordering', () => {
  it('has the canonical 26-step sequence', () => {
    expect(ids).toEqual(['t-visit', 't-warning', 't-report', 't-owner', 't-requirements', 't-inf', 't-new', 't-inspect-csr', 't-submit', 't-policy', 't-sign', 't-return', 't-accept', 't-stores', 't-bind', 't-ready',
      't-retry', 't-hello', 't-cert-msg', 't-proof', 't-chain', 't-signatures', 't-checks', 't-revocation', 't-trusted', 't-followup']);
    expect(new Set(ids).size).toBe(N);
  });
  it('milestones progress in the two acts', () => {
    const order = [];
    for (const s of scenario.stages) if (order.at(-1) !== s.phase) order.push(s.phase);
    expect(order).toEqual(['See the problem', 'Plan the certificate', 'Create key and CSR', 'Submit and issue', 'Install', 'Bind in IIS', 'Connect (TLS handshake)', 'Build the chain', 'Check the certificate', 'Trusted connection']);
  });
  it('visitor reports; owner (not visitor) starts the request', () => {
    const w = (id) => E.worldAt(scenario, 'healthy', E.stageEndT(ids.indexOf(id)));
    expect(w('t-report').requestState).toBe('needed');
    expect(w('t-owner').requestState).toBe('owned');
    expect(scenario.stages.find((s) => s.id === 't-owner').actor).toBe('OWN');
    // Jordan (VIS) never acts on the request, key, CSR, submission or acceptance.
    for (const s of scenario.stages.filter((x) => x.actor === 'VIS')) expect(['t-visit', 't-report', 't-retry']).toContain(s.id);
    expect(scenario.flows.some((f) => f.identity === 'VIS' && /csr|submit|accept|new/i.test(f.stage))).toBe(false);
  });
});

describe('forward transitions', () => {
  it('state is fully determined by position', () => {
    for (let t = 0; t <= N; t += 0.25) expect(E.worldAt(scenario, 'healthy', t)).toEqual(E.worldAt(scenario, 'healthy', t));
  });
  it('healthy run ends trusted and all fields are finite', () => {
    const s = E.worldAt(scenario, 'healthy', N);
    expect(s).toMatchObject({ trustDecision: 'trusted', connectionState: 'trusted', iisBindingState: 'bound', revocationState: 'good', chainState: 'trusted-root', keyState: 'associated', keyAssociation: 'matched' });
    for (let t = 0; t <= N; t += 0.1) for (const f of scenario.faults) for (const v of Object.values(E.worldAt(scenario, f.id, t))) expect(FINITE(v)).toBe(true);
    for (let t = 0; t <= N; t += 0.1) expect(Number.isFinite(E.worldAt(scenario, 'healthy', t).stageProgress)).toBe(true);
  });
  it('certificate state only advances', () => {
    const order = ['none', 'signing', 'issued', 'returning', 'on-web01', 'accepting', 'accepted'];
    let last = 0;
    for (let t = 0; t <= N; t += 0.05) { const i = order.indexOf(E.worldAt(scenario, 'healthy', t).leafState); expect(i).toBeGreaterThanOrEqual(last); last = i; }
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
    const i = ids.indexOf('t-new');
    const mid = E.worldAt(scenario, 'healthy', i + 0.5), done = E.worldAt(scenario, 'healthy', i + 1);
    expect(mid.keyState).toBe('generating');
    expect(mid.stageProgress).toBeCloseTo(0.5);
    expect(done.keyState).toBe('pending-on-web01');
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
  // v0.5.0: the eight v0.1 fault ids are kept (re-homed to the new steps) and four are added.
  const expected = { 'no-enroll-permission': 't-policy', 'template-not-published': 't-policy', 'user-context': 't-accept', 'no-private-key': 't-bind', 'wrong-binding': 't-cert-msg',
    'missing-ica': 't-chain', 'untrusted-root': 't-chain', 'wrong-dns': 't-checks', expired: 't-checks', 'wrong-eku': 't-checks', revoked: 't-revocation', 'cdp-unavailable': 't-revocation' };
  it('keeps the v0.1 fault ids and adds the four new ones, in lesson order', () => {
    expect(scenario.faults.map((f) => f.id)).toEqual(['healthy', ...Object.keys(expected)]);
    for (const id of ['wrong-dns', 'expired', 'untrusted-root', 'wrong-eku', 'missing-ica', 'revoked', 'cdp-unavailable', 'no-private-key']) expect(Object.keys(expected)).toContain(id);
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
    expect(t.map((e) => e.id)).toEqual(['trusted', 'checks', 'revocation', 'chain', 'proof', 'binding', 'key-link', 'issuance', 'pop', 'key-origin', 'origin']);
    expect(t.at(-1).claim).toMatch(/Jordan/);
    const prod = t.slice(t.findIndex((e) => e.id === 'chain'));
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
    expect(t[0].question).toBe('Why is the connection NOT trusted?');
    expect(t.every((e) => e.stageIndex <= ids.indexOf('t-revocation'))).toBe(true);
    expect(E.buildTrace(scenario, 'no-private-key').some((e) => e.id === 'binding')).toBe(false);
  });
});

describe('scene derivations and references', () => {
  it('private key never leaves WEB01 and is never carried by a flow', () => {
    expect(scenario.artifacts.find((a) => a.id === 'private-key').inspectable).toBe(false);
    expect(scenario.flows.every((f) => f.artifact !== 'private-key')).toBe(true);
    expect(scenario.stages.every((s) => s.artifact !== 'private-key')).toBe(true);
  });
  it('the certificate is created at the Issuing CA and never moves to or from the Root CA', () => {
    const leaf = scenario.artifacts.find((a) => a.id === 'leaf');
    expect(leaf.presence[0]).toMatchObject({ arrive: 't-sign', at: 'Z3' });
    expect(E.artifactLocation(scenario, E.worldAt(scenario, 'healthy', ids.indexOf('t-sign') + 1), leaf)).toMatchObject({ visible: true, at: 'Z3' });
    expect(scenario.flows.some((f) => /OT|root/i.test(f.from) || /^OT|rootca/i.test(f.to))).toBe(false);
  });
  it('every reference resolves to a defined zone / stage / flow', () => {
    const ends = (x) => ZONE_IDS.includes(x) || ['PUB:cdp', 'PUB:aia', 'store:personal', 'iis'].includes(x);
    for (const f of scenario.flows) { expect(ids).toContain(f.stage); expect(ends(f.from), f.id).toBe(true); expect(ends(f.to), f.id).toBe(true); }
    for (const a of scenario.artifacts) for (const p of a.presence) { expect(ids).toContain(p.arrive); expect(ZONE_IDS).toContain(p.at); }
    for (const s of scenario.stages) { expect(ZONE_IDS).toContain(s.zone); expect(ZONE_IDS).toContain(s.actorZone); for (const f of s.flows) expect(scenario.flows.some((x) => x.id === f)).toBe(true); }
    for (const e of scenario.evidenceTrace) expect(ids).toContain(e.stage);
    for (const t of scenario.tour) expect(ids).toContain(t.stage);
  });
  it('future scenarios are reserved but not implemented', () => {
    expect(scenario.futureScenarios).toContain('ocsp-validation');
    expect(scenario.futureScenarios).toHaveLength(9);
  });
});
