// Pure geometry and disclosure model for the v0.4.0 story scene (viewBox 1600 x 720). No DOM access: everything is derived
// from the canonical state so that tests can check zones, connectors, cards and stores exactly as they are drawn.
import { ZONES, OFFLINE_TRUST, PUB, STORES, ARTIFACTS, zonesFor, artifactLabel } from '../scenarios/dc/shared.js';

export const VIEW = { w: 1600, h: 720 };
export const LANE_Y = 360, ASSOC_Y = 624, HISTORY_Y = 112;
// Plate headline band (top-left, above the zones, left of Offline Trust): "Step n of N · title" + one plain sentence.
export const HEADLINE = { x: 32, y: 40, width: 1260, narrowWidth: 860 };
export const CRUMB_ROWS = [252, 288, 380, 416];
const zoneById = (id) => ZONES.find((z) => z.id === id);
export const stationRect = (z) => ({ x: z.x + 12, y: 136, w: 220, h: 64 });
export const badgeRect = (z) => ({ x: z.x + 12, y: 212, w: 160, h: 32 });
export const spotRect = (z) => ({ x: z.x + 16, y: 290, w: 212, h: 140 });
export const crumbRect = (z, i) => ({ x: z.x + 16, y: CRUMB_ROWS[i], w: 212, h: 28 });
export const VAULT = { x: 40, y: 470, w: 212, h: 104 };
export const storeRect = (id) => ({ x: 1340, y: STORES.find((s) => s.id === id).y, w: 212, h: 112 });
export const PUB_ENDPOINTS = { aia: { x: 812, y: 648, w: 236, h: 48 }, cdp: { x: 1064, y: 648, w: 236, h: 48 } };
export const OT_RECT = { x: OFFLINE_TRUST.x, y: OFFLINE_TRUST.y, w: OFFLINE_TRUST.w, h: OFFLINE_TRUST.h };
export const PUB_RECT = { x: PUB.x, y: PUB.y, w: PUB.w, h: PUB.h };
export const ACTOR_TEXT = { OP: 'Operator acts', MGR: 'Cert manager acts', SYS: 'System acts' };
export const ACTOR_FULL = { OP: 'Operator SIMSI2027\\PKIOperator', MGR: 'CA certificate manager SIMSI2027\\PKICertManager', SYS: 'System (no person acts)' };
export const ASSOC_LABEL = 'certreq -accept links this certificate to the existing key — same computer, never on the network';
export const HISTORY_LABEL = 'signed the Issuing CA certificate earlier (offline)';

const idx = (id) => ZONES.findIndex((z) => z.id === id);
const right = (r) => r.x + r.w, bottom = (r) => r.y + r.h, cx = (r) => r.x + r.w / 2, cy = (r) => r.y + r.h / 2;

// ---------- Disclosure ----------
export function storyModel(sc, state, { started = true, full = false, inspectCa = false } = {}) {
  const zones = zonesFor(sc.pathId ?? 'csr');
  const st = sc.stages[state.stage];
  const live = started || state.direction === 'reverse';
  const step = live ? st : null;
  const prev = live ? sc.stages.slice(0, state.stage).filter((s) => !s.skipped) : [];
  const skipped = !!step?.skipped;
  const modeOf = (z) => {
    if (!step) return 'placeholder';
    if (z.id === step.zone) return 'active';
    if (full || step.adjacent.includes(z.id)) return 'adjacent';
    return prev.some((p) => p.zone === z.id) ? 'finished' : 'placeholder';
  };
  const zoneList = zones.map((z) => {
    const mode = modeOf(z);
    let crumbs = [];
    if (mode === 'finished') {
      const seen = []; for (const p of prev) if (p.zone === z.id && p.artifact && !seen.includes(p.artifact)) seen.push(p.artifact);
      crumbs = seen.slice(-CRUMB_ROWS.length).map((a, i) => ({ artifact: a, rect: crumbRect(z, i), label: artifactLabel(a, sc.pathId) }));
    }
    return { ...z, mode, crumbs, station: mode === 'placeholder' || mode === 'finished' ? null : stationRect(z) };
  });
  const isShown = (id) => ['active', 'adjacent'].includes(zoneList.find((z) => z.id === id).mode);
  let conn = step && !skipped ? step.connector : null;
  // A fault that stops the flow on this route (for example RPC/DCOM blocked) draws it blocked and keeps the artifact at its source.
  const blockedHere = !!(conn?.blockedBy?.includes(state.activeFault) && (state.halted || state.stageProgress >= 1));
  if (blockedHere) conn = { ...conn, blocked: true };
  // Spotlight: the active artifact only. In Z6 the store cards occupy the zone, so a moving artifact is shown in its source zone.
  let spotlight = null;
  if (step && step.artifact && !skipped) {
    if (blockedHere && conn.from !== 'Z6' && zoneById(conn.from)) spotlight = { zone: conn.from, artifact: step.artifact, rect: spotRect(zoneById(conn.from)), source: true, blocked: true };
    else if (step.zone !== 'Z6') spotlight = { zone: step.zone, artifact: step.artifact, rect: spotRect(zoneById(step.zone)) };
    else if (conn && !conn.association && conn.from && conn.from !== 'Z6' && zoneById(conn.from)) spotlight = { zone: conn.from, artifact: step.artifact, rect: spotRect(zoneById(conn.from)), source: true };
  }
  const badge = step ? { zone: step.zone, actor: step.actor, text: ACTOR_TEXT[step.actor], full: ACTOR_FULL[step.actor], rect: step.zone === 'Z6' ? null : badgeRect(zoneById(step.zone)), inStation: step.zone === 'Z6' } : null;
  // Key vault (Path A): from a-new while a pending request (or its fault state) exists; after a successful accept it disappears.
  const afterNew = sc.stages.findIndex((s) => s.id === 'a-new') <= state.stage;
  const vault = { visible: !!step && (sc.pathId ?? 'csr') === 'csr' && afterNew && state.pendingRequest !== 'none' && (!!step.vault || state.pendingRequest !== 'consumed'),
    rect: VAULT, state: state.pendingRequest, keyState: state.keyState };
  const storesVisible = !!step && (isShown('Z6'));
  const stores = storesVisible ? storeEntries(sc, state, step) : null;
  const pubVisible = !!step?.pub;
  const otEmphasis = !!step && (step.rootHistory || inspectCa);
  const connectors = [];
  if (conn) connectors.push(connectorFor(conn, step, { spotlight, vault, stores, state }));
  if (step && otEmphasis) connectors.push(historyLink());
  // Full topology: finished routes show only the hand-offs between zones (thin, unlabelled, no crosses). Local, store, PUB and
  // association lanes are omitted, and each zone pair is drawn once, so the overview stays readable (audit S1).
  if (full && step) {
    const seen = new Set();
    for (const p of prev) {
      const pc = p.connector; if (!pc || pc.association || pc.local || pc.store || pc.blocked || pc.to === 'PUB:cdp' || !zoneById(pc.from) || !zoneById(pc.to)) continue;
      const key = [pc.from, pc.to].sort().join('-'); if (seen.has(key)) continue; seen.add(key);
      const c = connectorFor(pc, p, { spotlight: null, vault: { visible: false }, stores: null, state });
      connectors.push({ ...c, kind: 'finished', id: `${c.id}-done`, cross: null });
    }
  }
  const cards = [];
  for (const z of zoneList) { if (z.station) cards.push({ id: `station:${z.id}`, rect: z.station }); for (const c of z.crumbs) cards.push({ id: `crumb:${z.id}:${c.artifact}`, rect: c.rect }); }
  if (badge?.rect) cards.push({ id: `badge:${badge.zone}`, rect: badge.rect });
  if (spotlight) cards.push({ id: `spot:${spotlight.zone}`, rect: spotlight.rect });
  if (vault.visible) cards.push({ id: 'vault', rect: VAULT });
  if (stores) for (const s of STORES) cards.push({ id: `store:${s.id}`, rect: storeRect(s.id) });
  if (pubVisible) for (const [k, r] of Object.entries(PUB_ENDPOINTS)) cards.push({ id: `pub:${k}`, rect: r });
  cards.push({ id: 'ot', rect: OT_RECT });
  return { started: live, step, skipped, zones: zoneList, spotlight, badge, vault, stores, pub: { visible: pubVisible, rect: PUB_RECT, endpoints: PUB_ENDPOINTS }, ot: { rect: OT_RECT, emphasis: otEmphasis }, connectors, cards, full };
}

// Non-placeholder zones = active + adjacent (finished zones are placeholders that keep clickable breadcrumb chips).
export const zoneStates = (sc, state, opts) => storyModel(sc, state, opts).zones.map((z) => ({ id: z.id, mode: z.mode, crumbs: z.crumbs.map((c) => c.artifact) }));

// ---------- Stores (golden rules 18-21) ----------
function storeEntries(sc, s, step) {
  const pathB = (sc.pathId ?? 'csr') === 'mmc';
  const entries = { personal: [], intermediate: [], root: [] };
  // 'unlinked' = a certificate placed in Personal that no pending request matched (key-mismatch): it has no private key.
  if (['accepted', 'unlinked'].includes(s.leafState)) entries.personal.push({ artifact: 'accepted', label: pathB ? 'DC01 certificate (empty subject)' : 'DC01.simsi2027.test', key: ['linked', 'matched'].includes(s.keyAssociation), keyText: ['linked', 'matched'].includes(s.keyAssociation) ? 'private key on DC01' : 'no matching private key', active: step?.artifact === 'accepted' || step?.artifact === 'chain' });
  if (s.trust?.ica === 'present') entries.intermediate.push({ artifact: 'ica', label: 'SIMSI2027 Issuing CA 01', key: false, keyText: 'no private key here', source: s.trust.icaSource, active: step?.artifact === 'ica' });
  if (s.trust?.root === 'present') entries.root.push({ artifact: 'root', label: 'SIMSI2027 Root CA', key: false, keyText: 'trust anchor · no private key here', source: s.trust.rootSource, anchor: true, active: step?.artifact === 'root' });
  const status = (id) => (entries[id].length ? null : id === 'personal' ? (s.dcCertState === 'missing' ? 'No suitable DC certificate' : 'Not checked yet') : s.trust?.[id === 'root' ? 'root' : 'ica'] === 'missing' ? 'Missing (lesson condition)' : 'Not checked yet');
  return STORES.map((st) => ({ ...st, rect: storeRect(st.id), entries: entries[st.id], status: status(st.id), target: step?.connector?.store === st.id || (st.id === 'personal' && ['a-accept', 'a-key', 'b-issue'].includes(step?.id)) }));
}

// ---------- Connectors: orthogonal, at most one active per step ----------
function endpointFor(zoneId, { spotlight, stores, store }) {
  if (zoneId === 'PUB:cdp') return { rect: PUB_ENDPOINTS.cdp, card: 'pub:cdp', y: cy(PUB_ENDPOINTS.cdp) };
  const z = zoneById(zoneId);
  if (store) { const r = storeRect(store); return { rect: r, card: `store:${store}`, y: cy(r) }; }
  if (spotlight?.zone === zoneId) return { rect: spotlight.rect, card: `spot:${zoneId}`, y: LANE_Y };
  void stores; const r = stationRect(z); return { rect: r, card: `station:${zoneId}`, y: cy(r) };
}
function dedupe(pts) {
  const out = [];
  for (const p of pts) { const l = out.at(-1); if (l && l[0] === p[0] && l[1] === p[1]) continue; out.push(p); }
  // remove collinear middle points
  return out.filter((p, i) => i === 0 || i === out.length - 1 || !((out[i - 1][0] === p[0] && p[0] === out[i + 1][0]) || (out[i - 1][1] === p[1] && p[1] === out[i + 1][1])));
}
function connectorFor(c, step, ctx) {
  const id = `c-${step.id}`;
  const channel = c.channel ?? (c.store ? 'local store write' : '');
  if (c.association) {
    const start = ctx.vault?.visible ? [cx(VAULT), bottom(VAULT)] : [cx(stationRect(zoneById('Z1'))), bottom(stationRect(zoneById('Z1')))];
    const pr = storeRect('personal'); const s = ctx.state ?? {};
    // Once the step has completed (or halted), the link either exists or it does not: a failed accept is drawn blocked.
    const settled = s.halted || s.stageProgress >= 1;
    const failed = settled && !['linked', 'matched'].includes(s.keyAssociation);
    const failLabel = s.leafState === 'keyless-copy' ? 'certreq -accept ran on PKI-TRANSFER01, not DC01: nothing linked'
      : s.pendingRequest === 'user-store' ? 'no pending machine request on DC01: nothing linked'
        : s.pendingRequest === 'lost' ? 'pending request lost: nothing linked'
          : 'no pending request matches this certificate: nothing linked';
    return { id, kind: failed ? 'blocked' : 'association', channel: 'DC01 internal association', label: failed ? failLabel : ASSOC_LABEL, cross: failed ? [853, ASSOC_Y] : null, from: 'Z1', to: 'store:personal', fromCard: ctx.vault?.visible ? 'vault' : 'station:Z1', toCard: 'store:personal',
      points: [start, [start[0], ASSOC_Y], [1560, ASSOC_Y], [1560, cy(pr)], [right(pr), cy(pr)]], labelAt: { x: 853, y: ASSOC_Y, anchor: 'middle', pill: true }, carriesKey: false };
  }
  if (c.local) {
    const b = badgeRect(zoneById(c.from)), s = spotRect(zoneById(c.from));
    return { id, kind: 'active', channel, label: channel, from: c.from, to: c.from, fromCard: `badge:${c.from}`, toCard: `spot:${c.from}`, points: [[b.x + 18, bottom(b)], [b.x + 18, s.y]], labelAt: { x: b.x + 30, y: 268, anchor: 'start' }, carriesKey: false };
  }
  if (c.to === 'PUB:cdp') {
    const pr = storeRect('personal'), e = PUB_ENDPOINTS.cdp;
    return { id, kind: c.blocked ? 'blocked' : 'active', channel, label: c.blocked ? `${channel} unreachable` : channel, cross: c.blocked ? [1316, (cy(pr) + cy(e)) / 2] : null, from: 'Z6', to: 'PUB:cdp', fromCard: 'store:personal', toCard: 'pub:cdp', points: [[pr.x, cy(pr)], [1316, cy(pr)], [1316, cy(e)], [right(e), cy(e)]], labelAt: { x: cx(e) + 4, y: 627, anchor: 'middle' }, carriesKey: false };
  }
  const fromId = c.from, toId = c.store ? 'Z6' : c.to;
  const a = endpointFor(fromId, ctx), b = endpointFor(toId, { ...ctx, store: c.store });
  const i = idx(fromId), j = idx(toId), dir = j > i ? 1 : -1;
  const start = [dir > 0 ? right(a.rect) : a.rect.x, a.y], end = [dir > 0 ? b.rect.x : right(b.rect), b.y];
  const zi = zoneById(fromId), zj = zoneById(toId);
  const gx = dir > 0 ? zi.x + zi.w + 8 : zi.x - 8, gx2 = dir > 0 ? zj.x - 8 : zj.x + zj.w + 8;
  let pts;
  if (start[1] === end[1] && Math.abs(i - j) === 1) pts = [start, end];
  else {
    pts = [start];
    if (start[1] !== LANE_Y) pts.push([gx, start[1]], [gx, LANE_Y]);
    if (end[1] !== LANE_Y) pts.push([gx2, LANE_Y], [gx2, end[1]]);
    pts.push(end);
  }
  // Label: in whichever end zone has free space below its station card; otherwise under the source spotlight.
  const free = [fromId, toId].find((z) => z !== 'Z6' && ctx.spotlight?.zone !== z);
  const labelAt = c.store || !free ? { x: cx(spotRect(zoneById(ctx.spotlight?.zone ?? fromId))), y: 460, anchor: 'middle' } : { x: cx(stationRect(zoneById(free))), y: 300, anchor: 'middle' };
  const label = c.blocked ? `${channel} blocked` : channel;
  const cross = c.blocked ? (() => { const seg = longestHorizontal(dedupe(pts)); return [(seg[0][0] + seg[1][0]) / 2, seg[0][1]]; })() : null;
  return { id, kind: c.blocked ? 'blocked' : 'active', channel, label, from: fromId, to: c.store ? `store:${c.store}` : toId, fromCard: a.card, toCard: b.card, points: dedupe(pts), labelAt, cross, carriesKey: false };
}
// Muted history link: from the bottom of Offline Trust, along the thin band just above the zones, down into Z4's station.
// It stays below the plate headline (top band) and never touches an active route.
function historyLink() {
  const s = stationRect(zoneById('Z4')); const sx = OT_RECT.x + 36;
  return { id: 'c-root-history', kind: 'history', channel: 'history', label: HISTORY_LABEL, from: 'OT', to: 'Z4', fromCard: 'ot', toCard: 'station:Z4',
    points: [[sx, bottom(OT_RECT)], [sx, HISTORY_Y], [cx(s), HISTORY_Y], [cx(s), s.y]], labelAt: { x: OT_RECT.x - 14, y: HISTORY_Y - 14, anchor: 'end' } };
}
function longestHorizontal(pts) {
  let best = [pts[0], pts[1]], len = -1;
  for (let i = 0; i < pts.length - 1; i++) if (pts[i][1] === pts[i + 1][1]) { const l = Math.abs(pts[i + 1][0] - pts[i][0]); if (l > len) { len = l; best = [pts[i], pts[i + 1]]; } }
  return best;
}

// ---------- Geometry helpers (shared with tests and the visual review) ----------
export const segments = (pts) => pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);
export const isOrthogonal = (pts) => segments(pts).every(([p, q]) => p[0] === q[0] || p[1] === q[1]);
export function segmentHitsRect([p, q], r, inset = 1) {
  const x1 = Math.min(p[0], q[0]), x2 = Math.max(p[0], q[0]), y1 = Math.min(p[1], q[1]), y2 = Math.max(p[1], q[1]);
  return x2 > r.x + inset && x1 < r.x + r.w - inset && y2 > r.y + inset && y1 < r.y + r.h - inset;
}
export function segmentsCross([a, b], [c, d]) {
  const hz1 = a[1] === b[1], hz2 = c[1] === d[1]; if (hz1 === hz2) return false;
  const [h, v] = hz1 ? [[a, b], [c, d]] : [[c, d], [a, b]];
  const hx1 = Math.min(h[0][0], h[1][0]), hx2 = Math.max(h[0][0], h[1][0]), vy1 = Math.min(v[0][1], v[1][1]), vy2 = Math.max(v[0][1], v[1][1]);
  return v[0][0] > hx1 && v[0][0] < hx2 && h[0][1] > vy1 && h[0][1] < vy2;
}
export function pointAt(pts, t) {
  const segs = segments(pts); const lens = segs.map(([p, q]) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])); const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < segs.length; i++) { if (d <= lens[i]) { const [p, q] = segs[i]; const f = lens[i] ? d / lens[i] : 0; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; } d -= lens[i]; }
  return pts.at(-1);
}
