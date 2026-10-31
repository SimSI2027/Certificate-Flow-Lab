// Focused-flow SVG scene. Flat icon cards, orthogonal connectors, progressive disclosure.
// build()/load() create DOM once per scenario; update() only patches attributes from canonical state.
import { entityById } from '../entities/entities.js';
import { flowStatus, artifactLocation, stageIndex, buildTrace } from '../engine/engine.js';
import { iconUse } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
export const CARD = { w: 176, h: 84 };
const SIZE = { chain: { w: 176, h: 132 } };
export const sizeOf = (id) => SIZE[id] ?? CARD;
const KIND_LABEL = { request: 'Request', policy: 'Policy', cert: 'Certificate', install: 'Install', validate: 'Check', trust: 'Result', history: 'History' };
const STATUS_TEXT = { active: 'In progress', ok: 'Done', fail: 'Problem', policy: 'Deciding', 'policy-ok': 'Permitted', idle: '' };
const CHIP_TEXT = { 'private-key': 'PRIVATE KEY', ticket: 'REPORT', csr: 'CSR', inf: 'INF', leaf: 'CERT', dccert: 'CERT', ica: 'ICA CERT', root: 'ROOT CERT', crl: 'CRL', chain: 'CHAIN' };
const CHIP_W = { 'private-key': 96, ticket: 70, csr: 48, inf: 46, leaf: 54, dccert: 54, ica: 74, root: 86, crl: 48, chain: 64 };
const CHAIN_CARDS = [['leaf', 'Leaf certificate', 0], ['ica', 'Issuing CA', 1], ['root', 'Root CA', 2]];

const el = (name, attrs = {}, html = '') => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrap = (s, n) => { const out = []; let cur = ''; for (const w of String(s).split(/(?<=[\\ ·])/)) { if ((cur + w).length > n && cur) { out.push(cur.trim()); cur = w; } else cur += w; } if (cur) out.push(cur.trim()); return out; };
const trunc = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

// ---- pure helpers (unit-tested) ----
export function stageEndpoints(sc, stageId) {
  const set = new Set(); const st = sc.stages.find((s) => s.id === stageId); if (!st) return set;
  for (const fid of st.flows) { const f = sc.flows.find((x) => x.id === fid); set.add(f.from); set.add(f.to); }
  return set;
}
// Which entities are shown at a stage in the focused view.
export function visibleSets(sc, stageIdx, { halted = false, full = false } = {}) {
  const ids = new Set(sc.entityIds);
  if (full) return { current: new Set(ids), previous: new Set(), next: new Set(), all: new Set(ids) };
  const st = sc.stages[stageIdx];
  const current = new Set([...stageEndpoints(sc, st.id), st.focus.entity, ...(st.show ?? [])]);
  const previous = new Set(); const next = new Set();
  if (stageIdx > 0) { const p = sc.stages[stageIdx - 1]; for (const e of [...stageEndpoints(sc, p.id), p.focus.entity]) if (!current.has(e)) previous.add(e); }
  if (!halted && stageIdx < sc.stages.length - 1) { const n = sc.stages[stageIdx + 1]; for (const e of stageEndpoints(sc, n.id)) if (!current.has(e) && !previous.has(e)) next.add(e); }
  // the offline Root CA only appears when the current stage explains the chain or trust anchor
  const rootOk = (st.show ?? []).includes('rootca') || st.focus.entity === 'rootca';
  for (const set of [current, previous, next]) if (!rootOk) set.delete('rootca');
  const all = new Set([...current, ...previous, ...next]);
  for (const e of [...all]) if (!ids.has(e)) { current.delete(e); previous.delete(e); next.delete(e); all.delete(e); }
  return { current, previous, next, all };
}

// Orthogonal route for a flow: array of [x,y] points. Explicit routes win; otherwise ports and lanes are computed.
export function routeFor(sc, f) {
  if (f.route) return f.route;
  const [x1, y1] = sc.layout[f.from], [x2, y2] = sc.layout[f.to];
  const a = sizeOf(f.from), b = sizeOf(f.to), lane = f.lane ?? 0;
  if (f.from === f.to) return null;
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dy) < 4) { const s = Math.sign(dx); return [[x1 + s * a.w / 2, y1 + lane], [x2 - s * b.w / 2, y2 + lane]]; }
  if (Math.abs(dx) < 4) { const s = Math.sign(dy); return [[x1, y1 + s * a.h / 2], [x2, y2 - s * b.h / 2]]; }
  const s = Math.sign(dx); const sx = x1 + s * a.w / 2, ex = x2 - s * b.w / 2; const mx = (sx + ex) / 2;
  return [[sx, y1], [mx, y1], [mx, y2], [ex, y2]];
}
export const pathD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

export class Scene {
  constructor(svg, onSelect) { this.svg = svg; this.onSelect = onSelect; this.cam = { x: 0, y: 0, k: 1 }; this.sc = null; this.wireInteraction(); }

  load(sc) {
    this.sc = sc; const { svg } = this;
    svg.setAttribute('viewBox', '0 0 1600 800');
    svg.innerHTML = `<defs>${['request', 'policy', 'cert', 'install', 'validate', 'trust', 'fail', 'history'].map((c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah ah-${c}"/></marker>`).join('')}</defs>`;
    this.camG = el('g', { id: 'cam' }); svg.appendChild(this.camG); this.fitG = el('g', { id: 'fit' }); this.camG.appendChild(this.fitG);
    this.nodes = {}; this.flowEls = {}; this.chipEls = {}; this.zoneEls = {}; this.cardEls = {};
    this.zoneLayer = el('g', { class: 'zones' }); this.linkLayer = el('g', { class: 'links' }); this.flowLayer = el('g', { class: 'flows' });
    this.nodeLayer = el('g', { class: 'nodes' }); this.chipLayer = el('g', { class: 'chips' }); this.packetLayer = el('g', { class: 'packets' });
    this.fitG.append(this.zoneLayer, this.linkLayer, this.flowLayer, this.nodeLayer, this.chipLayer, this.packetLayer);
    for (const z of sc.zones) {
      const g = el('g', { class: `zone${z.offline ? ' offline' : ''}`, 'data-zone': z.id }, `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14"/><text class="zone-t" x="${z.x + z.w / 2}" y="${z.y + 24}" text-anchor="middle">${esc(z.label)}</text>`);
      this.zoneLayer.appendChild(g); this.zoneEls[z.id] = g;
    }
    if (sc.rootLink) {
      const [x1, y1] = sc.layout[sc.rootLink.from], [x2] = sc.layout[sc.rootLink.to];
      const a = sizeOf(sc.rootLink.from).w / 2, b = sizeOf(sc.rootLink.to).w / 2;
      this.rootLinkEl = el('g', { class: 'rootlink' }, `<path d="M${x1 + a} ${y1} L${x2 - b} ${y1}" marker-start="url(#ah-history)"/><text x="${(x1 + a + x2 - b) / 2}" y="${y1 - 12}" text-anchor="middle">Previously signed Issuing CA certificate</text>`);
      this.linkLayer.appendChild(this.rootLinkEl);
    }
    for (const f of sc.flows) this.buildFlow(f);
    for (const id of sc.entityIds) (id === 'chain' ? this.buildChain(id) : this.buildNode(id));
    for (const a of sc.artifacts) if (a.id !== 'chain' || !sc.entityIds.includes('chain')) { if (a.id !== 'chain') this.buildChip(a); }
    for (const f of sc.flows.filter((x) => !x.artifact)) {
      const g = el('g', { class: 'packet', 'data-flow': f.id }, '<circle r="10"/><circle r="4.5" class="core"/>'); this.packetLayer.appendChild(g); this.flowEls[f.id].packet = g;
    }
    this.applyCam();
  }

  describe(id) { const e = entityById[id]; const o = this.sc.overrides?.[id] ?? {}; return { ...e, ...o }; }

  buildFlow(f) {
    const sc = this.sc; const pts = routeFor(sc, f);
    const g = el('g', { class: `flow kind-${f.kind ?? 'request'}`, 'data-flow': f.id });
    let d, mid;
    if (!pts) { const [x, y] = sc.layout[f.from]; const t = y - sizeOf(f.from).h / 2; d = `M${x + 44} ${t} C${x + 44} ${t - 62} ${x - 44} ${t - 62} ${x - 44} ${t}`; mid = [x, t - 52]; } else {
      d = pathD(pts); let best = 0;
      mid = pts[0];
      for (let i = 0; i < pts.length - 1; i++) { const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (len > best) { best = len; mid = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; const vertical = pts[i][0] === pts[i + 1][0]; mid = vertical ? [mid[0] + 10, mid[1]] : [mid[0], mid[1] - 10]; mid.vertical = vertical; } }
    }
    const base = el('path', { class: 'flow-base', d });
    const over = el('path', { class: 'flow-over', d });
    const hit = el('path', { class: 'flow-hit', d });
    const label = el('text', { class: 'flow-label', x: mid[0], y: mid[1], 'text-anchor': mid.vertical ? 'start' : 'middle' });
    label.textContent = `${KIND_LABEL[f.kind ?? 'request']} · ${f.protocol.split(/ \(| over |:/)[0].slice(0, 30)}`;
    g.append(base, over, hit, label); this.flowLayer.appendChild(g);
    this.flowEls[f.id] = { g, base, over, hit, label, len: over.getTotalLength?.() ?? 300, d, local: !pts, f };
  }

  buildNode(id) {
    const [x, y] = this.sc.layout[id]; const e = this.describe(id);
    const names = wrap(e.label, 17).slice(0, 2); const subs = names.length === 1 ? wrap(e.sub ?? '', 23).slice(0, 2).map((x) => trunc(x, 24)) : [trunc(e.sub ?? '', 24)];
    const ny = names.length === 1 ? -16 : -24;
    const g = el('g', { class: `node kind-${e.kind}`, 'data-entity': id, transform: `translate(${x},${y})`, tabindex: 0, role: 'button', 'aria-label': `${e.label}. ${e.sub ?? ''}` });
    g.innerHTML = `<rect class="card" x="-88" y="-42" width="176" height="84" rx="10"/><rect class="accent" x="-88" y="-42" width="7" height="84" rx="3"/>
      <g class="ico" transform="translate(-76,-22)">${iconUse(e.icon, 42)}</g>
      <g class="lbl">${names.map((n, i) => `<text class="n-name" x="-26" y="${ny + 8 + i * 16}"${n.length > 16 ? ' textLength="138" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(n)}</text>`).join('')}${subs.map((t, i) => `<text class="n-sub" x="-26" y="${(names.length === 1 ? 10 : 18) + i * 15}"${t.length > 22 ? ' textLength="138" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(t)}</text>`).join('')}</g>
      <text class="n-status" x="80" y="35" text-anchor="end"></text><circle class="led" cx="78" cy="-28" r="5"/>`;
    this.nodeLayer.appendChild(g);
    this.nodes[id] = { g, status: g.querySelector('.n-status') };
    if (id === 'rootca') { const note = el('text', { class: 'root-note', x, y: y + 66, 'text-anchor': 'middle' }); note.innerHTML = '<tspan x="' + x + '" dy="0">Previously signed the Issuing CA</tspan><tspan x="' + x + '" dy="15">certificate; not contacted for</tspan><tspan x="' + x + '" dy="15">this request</tspan>'; this.nodeLayer.appendChild(note); this.nodes[id].note = note; }
  }

  buildChain(id) {
    const [cx, cy] = this.sc.layout[id]; const e = this.describe(id);
    const g = el('g', { class: 'node chain-node', 'data-entity': id, tabindex: 0, role: 'button', 'aria-label': e.label });
    g.innerHTML = `<rect class="card" x="${cx - 88}" y="${cy - 66}" width="176" height="132" rx="10"/><text class="n-name" x="${cx}" y="${cy - 46}" text-anchor="middle">${esc(e.label)}</text>`;
    CHAIN_CARDS.forEach(([cid, name, i]) => {
      const y = cy - 36 + i * 34;
      const c = el('g', { class: 'chaincard', 'data-artifact': cid, tabindex: 0, role: 'button', 'aria-label': `${name} certificate` },
        `<rect x="${cx - 80}" y="${y}" width="160" height="28" rx="6"/><text class="cc-name" x="${cx - 72}" y="${y + 18}">${esc(name)}</text><text class="cc-state" x="${cx + 74}" y="${y + 18}" text-anchor="end"></text>`);
      g.appendChild(c); this.cardEls[cid] = c;
    });
    this.nodeLayer.appendChild(g); this.nodes[id] = { g, status: null };
  }

  buildChip(a) {
    const w = CHIP_W[a.id] ?? 60;
    const g = el('g', { class: `chip chip-${a.color}`, 'data-artifact': a.id, tabindex: 0, role: 'button', 'aria-label': a.label },
      `<rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="12"/><text y="4.5" text-anchor="middle">${CHIP_TEXT[a.id] ?? a.id.toUpperCase()}</text>`);
    this.chipLayer.appendChild(g); this.chipEls[a.id] = g;
  }

  wireInteraction() {
    const svg = this.svg; let drag = null;
    svg.addEventListener('click', (ev) => {
      if (this.moved) { this.moved = false; return; }
      const t = ev.target.closest('[data-artifact],[data-entity],[data-flow]'); if (!t) return;
      if (t.dataset.artifact) this.onSelect({ type: 'artifact', id: t.dataset.artifact });
      else if (t.dataset.entity) this.onSelect({ type: 'entity', id: t.dataset.entity });
      else this.onSelect({ type: 'flow', id: t.dataset.flow });
    });
    svg.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = ev.target.closest('[data-artifact],[data-entity]'); if (!t) return; ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    svg.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, cx: this.cam.x, cy: this.cam.y, started: false }; });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.started && Math.hypot(dx, dy) > 6) { drag.started = true; svg.setPointerCapture?.(ev.pointerId); }
      if (drag.started) { const s = 1600 / svg.getBoundingClientRect().width; this.cam.x = drag.cx + dx * s; this.cam.y = drag.cy + dy * s; this.applyCam(); this.moved = true; }
    });
    const end = () => { drag = null; setTimeout(() => { this.moved = false; }, 0); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => { ev.preventDefault(); this.cam.k = Math.min(2.2, Math.max(0.6, this.cam.k * (ev.deltaY < 0 ? 1.1 : 0.9))); this.applyCam(); }, { passive: false });
  }
  applyCam() { this.camG?.setAttribute('transform', `translate(${this.cam.x},${this.cam.y}) translate(800,400) scale(${this.cam.k}) translate(-800,-400)`); }
  resetCamera() { this.cam = { x: 0, y: 0, k: 1 }; this.applyCam(); }
  setLabels(on) { this.svg.classList.toggle('hide-labels', !on); }

  update(s, { full = false } = {}) {
    const sc = this.sc; const reverse = s.direction === 'reverse';
    const trace = reverse ? buildTrace(sc, s.activeFault) : null;
    const stageIdx = s.stage;
    const vis = visibleSets(sc, stageIdx, { halted: s.halted || reverse, full });
    const st = sc.stages[stageIdx];
    const focusEntity = reverse ? trace[s.evidenceIndex]?.entity : st.focus.entity;
    const focusArtifact = reverse ? trace[s.evidenceIndex]?.artifact : st.focus.artifact;
    if (reverse && focusEntity) { vis.current.add(focusEntity); vis.all.add(focusEntity); }
    if (reverse) for (const e of ['rootca']) { if (trace[s.evidenceIndex]?.entity === e) { vis.current.add(e); vis.all.add(e); } }
    this.svg.dataset.direction = s.direction; this.svg.dataset.full = String(full);
    const zonesOn = new Set();
    for (const id of sc.entityIds) {
      const n = this.nodes[id]; if (!n) continue;
      const role = vis.current.has(id) ? 'current' : vis.previous.has(id) ? 'previous' : vis.next.has(id) ? 'next' : full ? 'faint' : 'hidden';
      const status = sc.statusOf(id, s);
      n.g.dataset.status = status; n.g.dataset.role = role; n.g.classList.toggle('focus', id === focusEntity); n.g.classList.toggle('sel', id === s.selectedEntity);
      n.g.style.display = role === 'hidden' ? 'none' : '';
      if (role !== 'hidden') zonesOn.add(sc.zoneOf[id]);
      if (n.status) {
        let t = STATUS_TEXT[status] ?? '';
        if (id === 'rootca') t = status === 'ok' ? 'Trust anchor' : 'Offline';
        if (id === 'decision') t = { trusted: 'TRUSTED', rejected: 'REJECTED', pending: 'PENDING', none: '' }[s.trustDecision];
        if (id === 'result') t = { trusted: 'SUITABLE', rejected: 'NOT SUITABLE', none: '' }[s.trustDecision] ?? '';
        n.status.textContent = t;
      }
      if (n.note) n.note.style.display = role === 'hidden' ? 'none' : '';
      if (id === 'chain') { for (const [cid] of CHAIN_CARDS) { const c = this.cardEls[cid]; const cs = chainCardState(sc, cid, s); c.dataset.status = cs.status; c.querySelector('.cc-state').textContent = cs.text; c.classList.toggle('sel', s.selectedArtifact === cid); c.classList.toggle('focus', cid === focusArtifact); } }
    }
    for (const z of sc.zones) this.zoneEls[z.id].style.opacity = full || zonesOn.has(z.id) ? '1' : '0';
    if (this.rootLinkEl) this.rootLinkEl.style.opacity = vis.all.has(sc.rootLink.to) && vis.all.has(sc.rootLink.from) ? '1' : '0';
    this.fit(vis, full);
    // flows
    const curFlows = new Set(st.flows); const prevFlows = new Set(stageIdx > 0 ? sc.stages[stageIdx - 1].flows : []); const nextFlows = new Set(!s.halted && stageIdx < sc.stages.length - 1 ? sc.stages[stageIdx + 1].flows : []);
    for (const f of sc.flows) {
      const fe = this.flowEls[f.id]; const fs = flowStatus(sc, s, f);
      const isCur = !reverse && curFlows.has(f.id) || (reverse && curFlows.has(f.id));
      const bothVisible = vis.all.has(f.from) && vis.all.has(f.to);
      const role = isCur ? 'current' : prevFlows.has(f.id) ? 'previous' : nextFlows.has(f.id) ? 'next' : full ? 'faint' : 'hidden';
      const show = role !== 'hidden' && bothVisible;
      const kind = fs.failed ? 'fail' : (f.kind ?? 'request');
      fe.g.style.display = show ? '' : 'none';
      fe.g.dataset.phase = fs.phase; fe.g.dataset.role = role; fe.g.dataset.kind = kind; fe.g.classList.toggle('failed', fs.failed); fe.g.classList.toggle('sel', s.selectedFlow === f.id);
      fe.over.setAttribute('marker-end', fe.local ? '' : `url(#ah-${kind})`);
      fe.over.style.strokeDasharray = `${fe.len}`; fe.over.style.strokeDashoffset = `${fe.len * (1 - fs.progress)}`;
      fe.label.style.opacity = role === 'current' && fs.phase !== 'idle' ? 1 : 0;
      if (fe.packet) { const active = fs.phase === 'active' && role === 'current'; fe.packet.style.opacity = active ? 1 : 0; const p = fe.over.getPointAtLength(fe.len * Math.min(1, Math.max(0, fs.progress))); fe.packet.setAttribute('transform', `translate(${p.x},${p.y})`); fe.packet.dataset.kind = kind; }
    }
    // artifacts
    const slots = {};
    for (const a of sc.artifacts) {
      const chip = this.chipEls[a.id]; if (!chip) continue;
      const loc = artifactLocation(sc, s, a);
      chip.classList.toggle('sel', s.selectedArtifact === a.id); chip.classList.toggle('focus', a.id === focusArtifact);
      const holderVisible = loc.visible && (loc.moving ? curFlows.has(loc.via.id) : vis.all.has(loc.at));
      if (!holderVisible) { chip.style.display = 'none'; continue; }
      chip.style.display = '';
      let x, y;
      if (loc.moving) {
        const fe = this.flowEls[loc.via.id]; const reversed = loc.from !== loc.via.from;
        const q = reversed ? 1 - loc.progress : loc.progress; const p = fe.over.getPointAtLength(fe.len * Math.min(1, Math.max(0, q))); x = p.x; y = p.y;
      } else {
        const n = (slots[loc.at] = (slots[loc.at] ?? 0) + 1) - 1; const [nx, ny] = sc.layout[loc.at];
        x = nx; y = ny + sizeOf(loc.at).h / 2 + 18 + n * 28;
        if (loc.at === 'rootca') y += 62;
      }
      chip.setAttribute('transform', `translate(${x},${y})`); chip.dataset.moving = loc.moving ? '1' : '0';
      chip.dataset.status = this.chipFailed(a.id, s) ? 'fail' : 'normal';
    }
  }

  // Frame the visible entities so cards stay large and readable. Pure function of the visible set.
  fit(vis, full) {
    const sc = this.sc; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    if (!full) {
      for (const id of vis.all) { const l = sc.layout[id]; if (!l) continue; const z = sizeOf(id); x0 = Math.min(x0, l[0] - z.w / 2); x1 = Math.max(x1, l[0] + z.w / 2); y0 = Math.min(y0, l[1] - z.h / 2 - 16); y1 = Math.max(y1, l[1] + z.h / 2 + 120); }
    }
    let k = 1, cx = 800, cy = 400;
    if (Number.isFinite(x0)) { const bw = x1 - x0 + 160, bh = y1 - y0 + 60; k = Math.min(1.45, 1560 / bw, 780 / bh); k = Math.max(1, k); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; cx = Math.min(Math.max(cx, 800 / k), 1600 - 800 / k); cy = Math.min(Math.max(cy, 400 / k), 800 - 400 / k); }
    this.fitG.style.transform = `translate(${800 - cx * k}px, ${400 - cy * k}px) scale(${k})`;
    this.fitG.dataset.k = k.toFixed(2);
  }

  chipFailed(id, s) {
    if (id === 'leaf' || id === 'dccert') return s.validation.name === 'fail' || s.validation.dates === 'fail' || s.validation.eku === 'fail' || s.revocationState === 'revoked' || s.installationState === 'no-private-key' || s.keyAssociation === 'mismatch';
    if (id === 'ica') return s.chainState === 'incomplete';
    if (id === 'root') return s.validation.root === 'fail';
    if (id === 'crl') return s.revocationState === 'unavailable';
    return false;
  }
}

function chainCardState(sc, card, s) {
  const v = s.validation;
  if (s.chainState === 'none') return { status: 'idle', text: '' };
  if (card === 'leaf') { const bad = [v.name, v.dates, v.eku].includes('fail') || s.revocationState === 'revoked'; return bad ? { status: 'fail', text: 'Problem' } : v.name === 'pass' && s.revocationState === 'good' ? { status: 'ok', text: 'Valid' } : { status: s.chainState === 'building' ? 'active' : 'idle', text: s.chainState === 'building' ? 'Building' : '' }; }
  if (card === 'ica') return s.chainState === 'incomplete' ? { status: 'fail', text: 'Missing' } : s.chainState === 'building' ? { status: 'active', text: 'Fetching' } : { status: v.signatures === 'fail' ? 'fail' : 'ok', text: 'Found' };
  if (s.chainState === 'incomplete') return { status: 'idle', text: '' };
  return v.root === 'fail' ? { status: 'fail', text: 'Untrusted' } : v.root === 'pass' ? { status: 'ok', text: 'Trusted' } : { status: 'idle', text: '' };
}
