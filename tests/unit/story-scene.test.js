// v0.4.0 StoryScene geometry: disclosure, connectors, stores, Root CA and private-key rules, for every step of both paths.
import { describe, it, expect } from 'vitest';
import * as E from '../../src/engine/engine.js';
import DCS from '../../src/scenarios/dc-manual-certificate-request.js';
import { storyModel, zoneStates, isOrthogonal, segments, segmentHitsRect, segmentsCross, VIEW, ASSOC_LABEL, HISTORY_LABEL } from '../../src/views/story-layout.js';
import { roundedPath, wrap } from '../../src/views/story-scene.js';

const views = [['A', { pathId: 'csr' }], ['A trust-present', { pathId: 'csr', conditionId: 'trust-present' }], ['B', { pathId: 'mmc' }]];
const stateAt = (view, i, faultId = 'healthy') => E.worldAt(view, faultId, i + 1);
const inView = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= VIEW.w && r.y + r.h <= VIEW.h;
const ACTIVE = ['active', 'blocked', 'association'];

describe('StoryScene disclosure', () => {
  it('before START FLOW: six placeholders, the Offline Trust box and no connectors', () => {
    const v = E.pathOf(DCS, {}); const m = storyModel(v, E.worldAt(v, 'healthy', 0), { started: false });
    expect(m.zones.map((z) => z.mode)).toEqual(Array(6).fill('placeholder')); expect(m.connectors).toEqual([]); expect(m.spotlight).toBeNull(); expect(m.stores).toBeNull();
  });
  for (const [name, sess] of views) {
    const v = E.pathOf(DCS, sess);
    it(`${name}: at most three non-placeholder zones per step, one active zone and the step artifact in the spotlight`, () => {
      v.stages.forEach((st, i) => {
        const zs = zoneStates(v, stateAt(v, i));
        expect(zs.filter((z) => ['active', 'adjacent'].includes(z.mode)).length, st.id).toBeLessThanOrEqual(3);
        expect(zs.filter((z) => z.mode === 'active').map((z) => z.id), st.id).toEqual([st.zone]);
        const m = storyModel(v, stateAt(v, i));
        if (m.spotlight) expect(m.spotlight.artifact).toBe(st.artifact);
        if (st.artifact && st.zone !== 'Z6' && !st.skipped) expect(m.spotlight?.zone).toBe(st.zone);
      });
    });
    it(`${name}: exactly one active connector per moving step, orthogonal, inside the view, never through a card, no crossings`, () => {
      v.stages.forEach((st, i) => {
        const m = storyModel(v, stateAt(v, i));
        const active = m.connectors.filter((c) => ACTIVE.includes(c.kind));
        expect(active.length, st.id).toBe(st.connector && !st.skipped ? 1 : 0);
        for (const c of m.connectors) {
          expect(isOrthogonal(c.points), `${st.id} ${c.id}`).toBe(true);
          for (const p of c.points) { expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[0]).toBeLessThanOrEqual(VIEW.w); expect(p[1]).toBeGreaterThanOrEqual(0); expect(p[1]).toBeLessThanOrEqual(VIEW.h); }
          for (const card of m.cards) if (card.id !== c.fromCard && card.id !== c.toCard) for (const s of segments(c.points)) expect(segmentHitsRect(s, card.rect), `${st.id}: ${c.id} crosses ${card.id}`).toBe(false);
        }
        for (const a of m.connectors) for (const b of m.connectors) if (a !== b) for (const s of segments(a.points)) for (const t of segments(b.points)) expect(segmentsCross(s, t), `${st.id}: ${a.id} x ${b.id}`).toBe(false);
        for (const card of m.cards) expect(inView(card.rect), card.id).toBe(true);
      });
    });
    it(`${name}: the Root CA is never an active-flow endpoint and the private key is never on a transport route`, () => {
      v.stages.forEach((st, i) => {
        const m = storyModel(v, stateAt(v, i));
        for (const c of m.connectors) {
          if (c.kind === 'history') { expect(c.from).toBe('OT'); expect(c.label).toBe(HISTORY_LABEL); expect(st.rootHistory).toBe(true); continue; }
          expect([c.from, c.to]).not.toContain('OT'); expect(c.carriesKey).toBe(false);
        }
        if (st.connector && !st.connector.association) expect(st.artifact, st.id).not.toBe('private-key');
      });
      expect(v.flows.every((f) => f.artifact !== 'private-key')).toBe(true);
    });
  }
  it('blocked RPC/DCOM connector is drawn red-dashed with a cross and the label "RPC/DCOM blocked"', () => {
    const v = E.pathOf(DCS, {}); const m = storyModel(v, stateAt(v, 1));
    const c = m.connectors[0]; expect(c.kind).toBe('blocked'); expect(c.label).toBe('RPC/DCOM blocked'); expect(c.cross).toBeTruthy();
  });
  it('a fault that stops a route draws it blocked and keeps the artifact at its source (rpc-blocked at b-enroll)', () => {
    const B = E.pathOf(DCS, { pathId: 'mmc' }); const i = B.stages.findIndex((s) => s.id === 'b-enroll');
    const m = storyModel(B, E.worldAt(B, 'rpc-blocked', 99));
    expect(m.connectors[0]).toMatchObject({ kind: 'blocked', label: 'RPC/DCOM blocked' }); expect(m.spotlight).toMatchObject({ zone: 'Z2', blocked: true });
    expect(storyModel(B, stateAt(B, i)).connectors[0].kind).toBe('active');
    const A = E.pathOf(DCS, {}); const j = A.stages.findIndex((s) => s.id === 'a-chain');
    const c = storyModel(A, E.worldAt(A, 'cdp-unreachable', j + 1)).connectors.find((x) => x.kind !== 'history');
    expect(c).toMatchObject({ kind: 'blocked', label: 'HTTP (CDP) unreachable' }); expect(c.cross).toBeTruthy();
  });
  it('the DC01 internal association lane appears only for accept and key confirmation', () => {
    for (const [, sess] of views) { const v = E.pathOf(DCS, sess); v.stages.forEach((st, i) => { const has = storyModel(v, stateAt(v, i)).connectors.some((c) => c.kind === 'association'); expect(has, st.id).toBe(['a-accept', 'a-key'].includes(st.id)); }); }
    const v = E.pathOf(DCS, {}); const c = storyModel(v, stateAt(v, v.stages.findIndex((s) => s.id === 'a-accept'))).connectors[0];
    expect(c.label).toBe(ASSOC_LABEL); expect(c.points[1][1]).toBe(624);
  });
  it('channel labels use the fixed vocabulary', () => {
    const allowed = ['local file', 'approved file transfer', 'RPC/DCOM', 'CA approval (console)', 'local store write', 'HTTP (AIA)', 'HTTP (CDP)'];
    for (const [, sess] of views) for (const f of E.pathOf(DCS, sess).flows) if (!f.association) expect(allowed).toContain(f.channel ?? 'local store write');
  });
  it('key vault shows the pending request from a-new until a-accept (Path A only)', () => {
    const v = E.pathOf(DCS, {});
    v.stages.forEach((st, i) => { const m = storyModel(v, stateAt(v, i)); expect(m.vault.visible, st.id).toBe(!!st.vault); });
    const B = E.pathOf(DCS, { pathId: 'mmc' }); B.stages.forEach((st, i) => expect(storyModel(B, stateAt(B, i)).vault.visible).toBe(false));
  });
  it('full topology shows every zone, keeps one active zone and is never the default', () => {
    const v = E.pathOf(DCS, {}); const i = v.stages.findIndex((s) => s.id === 'a-submit');
    const m = storyModel(v, stateAt(v, i), { full: true }); expect(m.zones.filter((z) => z.mode === 'placeholder' || z.mode === 'finished')).toHaveLength(0); expect(m.zones.filter((z) => z.mode === 'active')).toHaveLength(1);
    expect(m.connectors.filter((c) => c.kind === 'finished').length).toBeGreaterThan(3);
    expect(storyModel(v, stateAt(v, i)).full).toBe(false);
  });
  it('the Root history link appears only for the chain step or when a CA certificate is inspected', () => {
    const v = E.pathOf(DCS, {}); const i = v.stages.findIndex((s) => s.id === 'a-submit');
    expect(storyModel(v, stateAt(v, i)).connectors.some((c) => c.kind === 'history')).toBe(false);
    expect(storyModel(v, stateAt(v, i), { inspectCa: true }).connectors.some((c) => c.kind === 'history')).toBe(true);
    expect(storyModel(v, stateAt(v, i), { inspectCa: true }).ot.emphasis).toBe(true);
  });
});

describe('key, vault and store consistency (audit P1-P4, T1)', () => {
  const linked = (s) => ['linked', 'matched'].includes(s.keyAssociation);
  for (const pathId of ['csr', 'mmc']) {
    it(`Path ${pathId}: for every fault and step, the key state, the vault and the Personal store agree`, () => {
      const v = E.pathOf(DCS, { pathId });
      for (const f of v.faults) for (let t = 0; t <= v.stages.length; t += 0.5) {
        const s = E.worldAt(v, f.id, t); const m = storyModel(v, s); const where = `${f.id} @ ${v.stages[s.stage].id} (t=${t})`;
        // A request is "consumed" only by a successful accept, which links the key.
        if (s.pendingRequest === 'consumed') expect(linked(s), where).toBe(true);
        if (s.keyState === 'associated') expect(linked(s), where).toBe(true);
        if (linked(s) && pathId === 'csr') expect(s.pendingRequest, where).toBe('consumed');
        // The vault never claims a completed link that did not happen.
        if (m.vault.visible && m.vault.state === 'consumed') expect(linked(s), where).toBe(true);
        // A leaf in Personal shows the key badge exactly when the key is linked.
        const leaf = m.stores?.find((x) => x.id === 'personal').entries.find((e) => e.artifact === 'accepted');
        if (leaf) expect(leaf.key, where).toBe(linked(s));
        // A successful association lane is drawn only when the key is (or is being) linked.
        const assoc = m.connectors.find((c) => c.kind === 'association');
        if (assoc && (s.halted || s.stageProgress >= 1)) expect(linked(s), where).toBe(true);
      }
    });
  }
  it('failed accepts: nothing installed or linked on DC01, and the association lane is drawn blocked with the reason', () => {
    const v = E.pathOf(DCS, {}); const at = (fault) => { const s = E.worldAt(v, fault, 99); return { s, m: storyModel(v, s) }; };
    const uc = at('user-context'); expect(uc.s).toMatchObject({ pendingRequest: 'user-store', keyState: 'user-store', leafState: 'on-dc01' }); expect(uc.m.vault.state).toBe('user-store');
    expect(uc.m.stores.find((x) => x.id === 'personal').entries).toEqual([]);
    expect(uc.m.connectors[0]).toMatchObject({ kind: 'blocked', label: 'no pending machine request on DC01: nothing linked' });
    const wm = at('accepted-on-wrong-machine'); expect(wm.s).toMatchObject({ pendingRequest: 'present', keyState: 'pending-on-dc01', leafState: 'keyless-copy' });
    expect(wm.m.vault).toMatchObject({ visible: true, state: 'present' }); expect(wm.m.connectors[0].label).toMatch(/PKI-TRANSFER01, not DC01/);
    const pl = at('pending-request-lost'); expect(pl.s).toMatchObject({ pendingRequest: 'lost', leafState: 'on-dc01' }); expect(pl.m.stores.find((x) => x.id === 'personal').entries).toEqual([]);
    const km = at('key-mismatch'); expect(km.s).toMatchObject({ leafState: 'unlinked', pendingRequest: 'present', keyAssociation: 'mismatch' });
    expect(km.m.vault).toMatchObject({ visible: true, state: 'present' }); expect(km.m.stores.find((x) => x.id === 'personal').entries[0]).toMatchObject({ key: false });
    const kmAccept = E.worldAt(v, 'key-mismatch', v.stages.findIndex((x) => x.id === 'a-accept') + 1); expect(kmAccept).toMatchObject({ leafState: 'unlinked', keyAssociation: 'none', pendingRequest: 'present' });
  });
});

describe('StoryScene stores', () => {
  const v = E.pathOf(DCS, {}); const at = (id, fault) => storyModel(v, stateAt(v, v.stages.findIndex((s) => s.id === id), fault));
  const entries = (m, store) => m.stores.find((s) => s.id === store).entries;
  it('maps leaf → Personal (with key), Issuing CA → Intermediate, Root → Trusted Root; only the leaf shows a private key', () => {
    const m = at('a-key');
    expect(entries(m, 'personal').map((e) => [e.artifact, e.key])).toEqual([['accepted', true]]);
    expect(entries(m, 'intermediate').map((e) => [e.artifact, e.key, e.source])).toEqual([['ica', false, 'Local (manual)']]);
    expect(entries(m, 'root').map((e) => [e.artifact, e.key, e.anchor, e.source])).toEqual([['root', false, true, 'Local (manual, emergency)']]);
  });
  it('CA certificates are not drawn before they are installed; trust-present shows them from a-trust-check (Enterprise (AD))', () => {
    const m = at('a-return-move'); expect(entries(m, 'root')).toEqual([]); expect(m.stores.find((s) => s.id === 'root').status).toBe('Missing (lesson condition)');
    const P = E.pathOf(DCS, { conditionId: 'trust-present' }); const mp = storyModel(P, stateAt(P, 2));
    expect(mp.stores.find((s) => s.id === 'root').entries[0].source).toBe('Enterprise (AD)');
  });
  it('key-mismatch shows the leaf in Personal without a matching private key', () => {
    const m = at('a-key', 'key-mismatch'); expect(entries(m, 'personal')[0]).toMatchObject({ key: false, keyText: 'no matching private key' });
  });
});

describe('drawing helpers', () => {
  it('rounded corners keep orthogonal endpoints; text wraps', () => {
    expect(roundedPath([[0, 0], [100, 0], [100, 100]])).toBe('M0 0 L88 0 Q100 0 100 12 L100 100');
    expect(wrap('public key + names · signed by DC01 key', 26)).toEqual(['public key + names ·', 'signed by DC01 key']);
  });
});
