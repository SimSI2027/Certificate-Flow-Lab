// v0.5.0 Website TLS story geometry: disclosure, one active connector per step, orthogonal routes, no crossings, no card intersection,
// Root CA never an endpoint, private key never on a route nor in the "On the wire" zone, store mapping and key badges.
import { describe, it, expect } from 'vitest';
import * as E from '../../src/engine/engine.js';
import S from '../../src/scenarios/tls-manual-enrollment.js';
import { storyModel, zoneStates, isOrthogonal, segments, segmentHitsRect, segmentsCross, VIEW, HISTORY_LABEL, expectedActiveConnectors, zoneGeom } from '../../src/views/story-layout.js';

const ACTIVE = ['active', 'blocked', 'association'];
const ids = S.stages.map((s) => s.id);
const stateAt = (i, faultId = 'healthy', p = 1) => E.worldAt(S, faultId, i + p);
const inView = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= VIEW.w && r.y + r.h <= VIEW.h;
const at = (id, faultId = 'healthy') => storyModel(S, stateAt(ids.indexOf(id), faultId));
const Z5 = zoneGeom('Z5');

describe('TLS StoryScene disclosure', () => {
  it('before START FLOW: six placeholders, the Offline Trust box and no connectors', () => {
    const m = storyModel(S, E.worldAt(S, 'healthy', 0), { started: false });
    expect(m.zones.map((z) => z.mode)).toEqual(Array(6).fill('placeholder')); expect(m.connectors).toEqual([]); expect(m.spotlight).toBeNull(); expect(m.stores).toBeNull();
  });
  it('one active zone, at most three shown zones, the step artifact in the spotlight', () => {
    S.stages.forEach((st, i) => {
      const zs = zoneStates(S, stateAt(i));
      expect(zs.filter((z) => z.mode === 'active').map((z) => z.id), st.id).toEqual([st.zone]);
      expect(zs.filter((z) => ['active', 'adjacent'].includes(z.mode)).length, st.id).toBeLessThanOrEqual(3);
      const m = storyModel(S, stateAt(i));
      if (m.spotlight) expect(m.spotlight.artifact).toBe(st.artifact);
      if (st.artifact && st.zone !== 'Z4') expect(m.spotlight?.zone, st.id).toBe(st.zone);
    });
  });
  it('the actor badge sits on the acting zone only', () => {
    S.stages.forEach((st, i) => { const m = storyModel(S, stateAt(i)); expect(m.badge.zone, st.id).toBe(st.actorZone); });
    expect(at('t-submit').badge).toMatchObject({ zone: 'Z2', text: 'Morgan acts' }); expect(at('t-proof').badge).toMatchObject({ zone: 'Z4', inStation: true, text: 'WEB01 acts' });
  });
});

describe('TLS connectors', () => {
  const faults = S.faults.map((f) => f.id);
  for (const faultId of faults) {
    it(`${faultId}: exactly one active connector per moving step; orthogonal, inside the view, never through a card, no crossings`, () => {
      const max = E.maxT(S, faultId);
      for (let t = 0.5; t <= max; t += 0.5) {
        const s = E.worldAt(S, faultId, t); const st = S.stages[s.stage]; const m = storyModel(S, s);
        const active = m.connectors.filter((c) => ACTIVE.includes(c.kind));
        expect(active.length, `${faultId} ${st.id} t=${t}`).toBe(expectedActiveConnectors(S, s));
        for (const c of m.connectors) {
          expect(isOrthogonal(c.points), `${st.id} ${c.id}`).toBe(true);
          for (const p of c.points) { expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[0]).toBeLessThanOrEqual(VIEW.w); expect(p[1]).toBeGreaterThanOrEqual(0); expect(p[1]).toBeLessThanOrEqual(VIEW.h); }
          for (const card of m.cards) if (card.id !== c.fromCard && card.id !== c.toCard) for (const sg of segments(c.points)) expect(segmentHitsRect(sg, card.rect), `${faultId} ${st.id}: ${c.id} crosses ${card.id}`).toBe(false);
        }
        for (const a of m.connectors) for (const b of m.connectors) if (a !== b) for (const x of segments(a.points)) for (const y of segments(b.points)) expect(segmentsCross(x, y), `${st.id}: ${a.id} x ${b.id}`).toBe(false);
        for (const card of m.cards) expect(inView(card.rect), card.id).toBe(true);
      }
    });
  }
  it('every moving step has exactly one connector with a fixed channel label; still steps have none', () => {
    S.stages.forEach((st, i) => { const m = storyModel(S, stateAt(i)); const a = m.connectors.filter((c) => ACTIVE.includes(c.kind)); expect(a.length, st.id).toBe(st.connector ? 1 : 0); if (a[0]) expect(a[0].label, st.id).toBeTruthy(); });
  });
  it('the Root CA is never an endpoint; only the muted history link in milestone 8 or when a CA certificate is inspected', () => {
    S.stages.forEach((st, i) => {
      const m = storyModel(S, stateAt(i));
      for (const c of m.connectors) { if (c.kind === 'history') { expect(c.from).toBe('OT'); expect(c.to).toBe('Z3'); expect(c.label).toBe(HISTORY_LABEL); expect(st.milestone, st.id).toBe('Build the chain'); continue; } expect([c.from, c.to]).not.toContain('OT'); }
    });
    expect(at('t-submit').connectors.some((c) => c.kind === 'history')).toBe(false);
    expect(storyModel(S, stateAt(ids.indexOf('t-submit')), { inspectCa: true }).connectors.some((c) => c.kind === 'history')).toBe(true);
  });
  it('the private key is never on a route and never in the "On the wire" zone', () => {
    for (const faultId of faults) for (let t = 0.5; t <= E.maxT(S, faultId); t += 0.5) {
      const m = storyModel(S, E.worldAt(S, faultId, t));
      for (const c of m.connectors) expect(c.carriesKey ?? false).toBe(false);
      if (m.spotlight) { expect(m.spotlight.artifact).not.toBe('private-key'); }
      if (m.vault.visible) expect(m.vault.rect.x + m.vault.rect.w <= Z5.x || m.vault.rect.x >= Z5.x + Z5.w).toBe(true);
      const inZ5 = m.cards.filter((c) => c.rect.x >= Z5.x && c.rect.x < Z5.x + Z5.w).map((c) => c.id);
      expect(inZ5.some((id) => /vault|personal/.test(id))).toBe(false);
    }
    expect(S.flows.every((f) => f.artifact !== 'private-key')).toBe(true);
  });
  it('handshake routes use the wire lane under the zones; AIA and CDP are separate routes', () => {
    for (const id of ['t-visit', 't-warning', 't-retry', 't-hello', 't-cert-msg', 't-proof', 't-trusted']) { const c = at(id).connectors[0]; expect(c.wire, id).toBe(true); expect(c.points.some((p) => p[1] === 612), id).toBe(true); }
    expect(at('t-revocation').connectors[0]).toMatchObject({ to: 'PUB:cdp', label: 'HTTP (CDP)' });
    const aia = at('t-chain', 'missing-ica').connectors.find((c) => c.to === 'PUB:aia'); expect(aia).toMatchObject({ kind: 'blocked', label: 'HTTP (AIA) unreachable' }); expect(aia.cross).toBeTruthy();
    expect(at('t-chain').connectors.filter((c) => c.kind !== 'history')).toEqual([]);
    expect(at('t-revocation', 'cdp-unavailable').connectors[0]).toMatchObject({ kind: 'blocked', label: 'HTTP (CDP) unreachable' });
  });
  it('accept draws the WEB01 internal association lane from the key vault (Z2) to Personal (Z4); a failed accept is drawn blocked with the reason', () => {
    const c = at('t-accept').connectors[0]; expect(c).toMatchObject({ kind: 'association', from: 'Z2', to: 'store:personal' }); expect(c.label).toMatch(/same computer \(WEB01\), never on the network/);
    expect(at('t-accept', 'user-context').connectors[0]).toMatchObject({ kind: 'blocked', label: 'no pending machine request on WEB01: nothing linked' });
    expect(at('t-accept', 'no-private-key').connectors[0].kind).toBe('blocked');
  });
});

describe('TLS stores, vault and cards', () => {
  const entries = (m, store) => m.stores.find((s) => s.id === store).entries;
  it('WEB01: leaf with key in Personal; Issuing CA in Intermediate and Root in Trusted Root from Enterprise (AD); only the leaf has a key', () => {
    const m = at('t-stores');
    expect(entries(m, 'personal').map((e) => [e.artifact, e.key])).toEqual([['accepted', true]]);
    expect(entries(m, 'intermediate').map((e) => [e.artifact, e.key, e.source])).toEqual([['ica', false, 'Enterprise (AD)']]);
    expect(entries(m, 'root').map((e) => [e.artifact, e.key, e.anchor, e.source])).toEqual([['root', false, true, 'Enterprise (AD)']]);
    expect(m.stores.every((s) => s.target)).toBe(true);
  });
  it('the key vault (Certificate Enrollment Requests) shows the pending request from t-new until t-accept', () => {
    S.stages.forEach((st, i) => expect(storyModel(S, stateAt(i)).vault.visible, st.id).toBe(!!st.vault));
    expect(at('t-new').vault.rect.x).toBe(zoneGeom('Z2').x + 16);
    expect(at('t-accept', 'user-context').vault.state).toBe('user-store');
  });
  it('for every fault and step, the key state, the vault and the Personal key badge agree', () => {
    const linked = (s) => ['linked', 'matched'].includes(s.keyAssociation);
    for (const f of S.faults) for (let t = 0; t <= E.maxT(S, f.id); t += 0.5) {
      const s = E.worldAt(S, f.id, t); const m = storyModel(S, s); const where = `${f.id} t=${t}`;
      if (s.pendingRequest === 'consumed') expect(linked(s), where).toBe(true);
      const leaf = m.stores?.find((x) => x.id === 'personal').entries[0]; if (leaf) expect(leaf.key, where).toBe(linked(s));
    }
  });
  it('CLIENT01 Trusted Root card: Root present (no private key); missing in untrusted-root', () => {
    const m = at('t-chain'); expect(m.clientRoot).toMatchObject({ active: true }); expect(m.clientRoot.state.root).toBe('present');
    expect(at('t-chain', 'untrusted-root').clientRoot.state.root).toBe('missing');
    expect(at('t-chain').stores).toBeNull();
  });
  it('the IIS site card follows the binding state and is the active artifact at t-bind', () => {
    expect(at('t-return').iis.state).toBe('temporary-selfsigned'); expect(at('t-bind').iis).toMatchObject({ state: 'bound', active: true });
    expect(at('t-bind', 'no-private-key').iis.state).toBe('failed-no-key'); expect(at('t-bind', 'wrong-binding').iis.state).toBe('still-selfsigned');
    expect(at('t-bind').connectors[0]).toMatchObject({ fromCard: 'store:personal', toCard: 'iis', label: 'IIS binding (local)' });
  });
  it('t-proof shows the key used in place inside WEB01 (Personal entry), never on the wire', () => {
    const m = at('t-proof'); const leaf = entries(m, 'personal')[0]; expect(leaf).toMatchObject({ key: true, keyUse: true, active: true });
    expect(m.spotlight).toMatchObject({ zone: 'Z5', artifact: 'certverify' });
  });
  it('PUB strip only in milestones 8 and 9', () => {
    S.stages.forEach((st, i) => expect(storyModel(S, stateAt(i)).pub.visible, st.id).toBe(['Build the chain', 'Check the certificate'].includes(st.milestone)));
  });
  it('full topology shows every zone, one active zone, and is never the default', () => {
    const m = storyModel(S, stateAt(ids.indexOf('t-cert-msg')), { full: true });
    expect(m.zones.filter((z) => z.mode === 'active')).toHaveLength(1); expect(m.zones.every((z) => ['active', 'adjacent'].includes(z.mode))).toBe(true);
    expect(at('t-cert-msg').full).toBe(false);
  });
});
