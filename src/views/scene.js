// 2.5D SVG scene. build() creates static DOM once; update(state) only patches attributes from canonical state.
import { entities, entityById } from '../entities/entities.js';
import { flowStatus, artifactLocation, stageIndex, buildTrace } from '../engine/engine.js';
import { entityStatus, chainCardStatus } from './status.js';

const NS = 'http://www.w3.org/2000/svg';
export const LAYOUT = {
  visitor: [120, 230], client01: [160, 480], browser: [380, 340], owner: [540, 180], web01: [560, 610], iis: [770, 720],
  enroll: [770, 450], template: [960, 430], ica01: [1140, 560], rootca: [1140, 190], cadb: [1140, 780],
  pkiweb01: [1480, 480], aia: [1420, 300], cdp: [1420, 680], chain: [930, 700], decision: [170, 740]
};
const CHAIN_CARDS = [['leaf', 'portal.simsi2027.test', 0], ['ica', 'SIMSI2027-ICA01', 1], ['root', 'SIMSI2027-ROOTCA', 2]];
const FLOW_COLOR = { 'f-policy': 'policy', 'f-evaluate': 'policy', 'f-validate': 'policy', 'f-root': 'policy' };
const CHIP_TEXT = { 'private-key': 'PRIVATE KEY', ticket: 'REPORT', csr: 'CSR', leaf: 'CERT', ica: 'ICA CERT', root: 'ROOT CERT', crl: 'CRL', chain: 'CHAIN' };
const CHIP_W = { 'private-key': 92, ticket: 66, csr: 46, leaf: 52, ica: 72, root: 84, crl: 46, chain: 62 };

const el = (name, attrs = {}, html = '') => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function box(x, y, a, h, cls = '') {
  const b = a / 2;
  return `<g class="${cls}"><polygon class="face-l" points="${x - a},${y - h} ${x},${y - h + b} ${x},${y + b} ${x - a},${y}"/>
  <polygon class="face-r" points="${x + a},${y - h} ${x},${y - h + b} ${x},${y + b} ${x + a},${y}"/>
  <polygon class="face-t" points="${x - a},${y - h} ${x},${y - h - b} ${x + a},${y - h} ${x},${y - h + b}"/></g>`;
}
function shape(kind) {
  switch (kind) {
    case 'person': return `<ellipse class="shadow" cx="6" cy="22" rx="34" ry="11"/>${box(0, 18, 22, 34)}<circle class="head" cx="0" cy="-34" r="15"/>`;
    case 'computer': return `<ellipse class="shadow" cx="8" cy="30" rx="58" ry="17"/>${box(0, 26, 52, 10)}<g transform="translate(0,-8)">${box(0, 6, 34, 46)}</g><rect class="screen" x="-26" y="-48" width="40" height="26" rx="3" transform="skewY(-8) translate(-8,10)"/>`;
    case 'screen': return `<ellipse class="shadow" cx="8" cy="26" rx="50" ry="14"/>${box(0, 22, 40, 8)}<rect class="win" x="-48" y="-52" width="96" height="62" rx="5"/><rect class="winbar" x="-48" y="-52" width="96" height="12" rx="5"/><text class="win-t" x="6" y="-14" text-anchor="middle">Not secure</text><g class="lock" transform="translate(-42,-50) scale(.55)"><path d="M0 8 v-4 a6 6 0 0 1 12 0 v4 z" fill="none" stroke-width="2"/><rect x="-2" y="6" width="16" height="12" rx="2"/></g>`;
    case 'server': return `<ellipse class="shadow" cx="8" cy="28" rx="52" ry="15"/>${box(0, 26, 36, 20)}${box(0, 6, 36, 20)}${box(0, -14, 36, 20)}<circle class="led" cx="-14" cy="-26" r="3"/><circle class="led" cx="-14" cy="-6" r="3"/>`;
    case 'binding': return `<ellipse class="shadow" cx="6" cy="14" rx="46" ry="12"/>${box(0, 12, 38, 14)}<text class="port" x="0" y="-8" text-anchor="middle">:443</text>`;
    case 'panel': return `<ellipse class="shadow" cx="6" cy="14" rx="46" ry="12"/>${box(0, 12, 38, 10)}<rect class="screen" x="-26" y="-34" width="52" height="30" rx="3"/><text class="port" x="0" y="-14" text-anchor="middle">certreq</text>`;
    case 'gate': return `<ellipse class="shadow" cx="8" cy="24" rx="62" ry="16"/>${box(-30, 22, 14, 70)}${box(30, 22, 14, 70)}<path class="beam" d="M-30 -48 L30 -48 L30 8 L-30 8 Z"/><text class="gate-t" x="0" y="-18" text-anchor="middle">POLICY</text>`;
    case 'ca': return `<ellipse class="shadow" cx="8" cy="28" rx="62" ry="17"/>${box(0, 26, 44, 56)}<circle class="seal" cx="0" cy="-34" r="13"/><text class="seal-t" x="0" y="-30" text-anchor="middle">CA</text>`;
    case 'root': return `<ellipse class="shadow" cx="8" cy="30" rx="66" ry="18"/>${box(0, 28, 50, 12)}<g transform="translate(0,-12)">${box(0, 26, 38, 50)}</g><circle class="seal" cx="0" cy="-38" r="13"/><text class="seal-t" x="0" y="-34" text-anchor="middle">ROOT</text>`;
    case 'db': return `<ellipse class="shadow" cx="8" cy="30" rx="52" ry="14"/><path class="face-l" d="M-34 -14 v40 a34 12 0 0 0 68 0 v-40 z"/><ellipse class="face-t" cx="0" cy="-14" rx="34" ry="12"/><path class="db-l" d="M-34 4 a34 12 0 0 0 68 0 M-34 18 a34 12 0 0 0 68 0" fill="none"/>`;
    case 'repo': return `<ellipse class="shadow" cx="6" cy="22" rx="52" ry="14"/>${box(0, 20, 40, 26)}<text class="port" x="0" y="-14" text-anchor="middle">HTTP</text>`;
    case 'decision': return `<ellipse class="shadow" cx="6" cy="26" rx="44" ry="12"/><path class="shield" d="M0 -46 L34 -34 L34 -4 Q34 20 0 32 Q-34 20 -34 -4 L-34 -34 Z"/><text class="verdict" x="0" y="-8" text-anchor="middle">PENDING</text>`;
    default: return box(0, 20, 30, 30);
  }
}

export class Scene {
  constructor(svg, onSelect, scenario) {
    this.svg = svg; this.onSelect = onSelect; this.scenario = scenario;
    this.nodes = {}; this.flowEls = {}; this.chipEls = {}; this.cardEls = {};
    this.cam = { x: 0, y: 0, k: 1 };
    this.build();
  }

  build() {
    const { svg, scenario } = this;
    svg.setAttribute('viewBox', '0 0 1600 900');
    svg.innerHTML = `<defs>
      <filter id="blur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
      <pattern id="grid" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 L24 0 L48 12 L24 24 Z" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern>
      ${['request', 'cert', 'policy', 'ok', 'fail', 'idle'].map((c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah ah-${c}"/></marker>`).join('')}
    </defs>`;
    const cam = el('g', { id: 'cam' }); this.camG = cam; svg.appendChild(cam);
    cam.appendChild(el('rect', { class: 'bg', x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#grid)' }));
    // zones
    cam.appendChild(el('g', { class: 'zones' }, `
      <path class="zone zone-pki" d="M1010 110 L1250 110 L1250 840 L1010 840 Z"/><text class="zone-t" x="1130" y="868" text-anchor="middle">CA SERVICES</text>
      <path class="zone zone-pub" d="M1300 230 L1590 230 L1590 760 L1300 760 Z"/><text class="zone-t" x="1445" y="788" text-anchor="middle">PUBLICATION</text>
      <path class="zone zone-web" d="M450 520 L880 520 L880 790 L450 790 Z" />
      <path class="zone zone-cli" d="M40 150 L460 150 L460 800 L40 800 Z"/>
      <text class="zone-t" x="250" y="826" text-anchor="middle">CLIENT SIDE · 10.20.10.0/24 (synthetic)</text>
      <text class="zone-t" x="640" y="818" text-anchor="middle">WEB TIER · 10.20.20.0/24 (synthetic)</text>`));
    // lineage (static trust links, not flows)
    const lin = el('g', { class: 'lineage' });
    lin.innerHTML = `<path class="lineage-p" d="M${LAYOUT.rootca[0]} ${LAYOUT.rootca[1] + 16} L${LAYOUT.ica01[0]} ${LAYOUT.ica01[1] - 70}"/><text class="lineage-t" x="${LAYOUT.rootca[0] + 14}" y="${(LAYOUT.rootca[1] + LAYOUT.ica01[1]) / 2 - 20}">signed ICA certificate earlier (root stays offline)</text>`;
    cam.appendChild(lin);
    // pkiweb01 group backdrop
    this.flowLayer = el('g', { class: 'flows' }); cam.appendChild(this.flowLayer);
    for (const f of scenario.flows) this.buildFlow(f);
    this.nodeLayer = el('g', { class: 'nodes' }); cam.appendChild(this.nodeLayer);
    for (const e of entities) if (e.id !== 'chain') this.buildNode(e);
    this.buildChain();
    this.chipLayer = el('g', { class: 'chips' }); cam.appendChild(this.chipLayer);
    for (const a of scenario.artifacts) if (a.id !== 'chain') this.buildChip(a);
    this.packetLayer = el('g', { class: 'packets' }); cam.appendChild(this.packetLayer);
    for (const f of scenario.flows.filter((x) => !x.artifact)) {
      const g = el('g', { class: 'packet', 'data-flow': f.id }, '<circle r="9"/><circle r="4" class="core"/>'); this.packetLayer.appendChild(g); this.flowEls[f.id].packet = g;
    }
    this.caption = el('text', { class: 'scene-caption', x: 800, y: 40, 'text-anchor': 'middle' });
    svg.appendChild(this.caption);
    this.wireInteraction();
  }

  anchor(id) { const [x, y] = LAYOUT[id]; return [x, y - 26]; }

  flowPath(f) {
    const [x1, y1] = this.anchor(f.from), [x2, y2] = this.anchor(f.to);
    if (f.from === f.to) return `M${x1 + 30} ${y1 - 10} C${x1 + 90} ${y1 - 80} ${x1 - 90} ${y1 - 80} ${x1 - 30} ${y1 - 10}`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const off = Math.min(46, len * 0.16) * (this.curveSign(f));
    return `M${x1} ${y1} Q${mx - (dy / len) * off} ${my + (dx / len) * off} ${x2} ${y2}`;
  }
  curveSign(f) { return ['f-error', 'f-present', 'f-cdp', 'f-root'].includes(f.id) ? -1 : 1; }

  buildFlow(f) {
    const d = this.flowPath(f);
    const g = el('g', { class: 'flow', 'data-flow': f.id });
    const base = el('path', { class: 'flow-base', d });
    const over = el('path', { class: 'flow-over', d, 'marker-end': f.local ? '' : 'url(#ah-request)' });
    const hit = el('path', { class: 'flow-hit', d });
    const label = el('text', { class: 'flow-label' }); label.textContent = f.protocol.split(' (')[0].slice(0, 30);
    g.append(base, over, hit, label); this.flowLayer.appendChild(g);
    this.flowEls[f.id] = { g, base, over, hit, label, len: over.getTotalLength?.() ?? 300, d };
  }

  buildNode(e) {
    const [x, y] = LAYOUT[e.id];
    const g = el('g', { class: `node kind-${e.kind}`, 'data-entity': e.id, transform: `translate(${x},${y})`, tabindex: 0, role: 'button', 'aria-label': e.label });
    g.innerHTML = `<g class="body">${shape(e.kind)}</g><circle class="status-led" cx="${e.kind === 'person' ? 28 : 40}" cy="-46" r="6"/>
      <g class="lbl"><text class="n-name" y="52" text-anchor="middle">${esc(e.label)}</text><text class="n-sub" y="68" text-anchor="middle">${esc(e.sub)}</text><text class="n-badge" y="84" text-anchor="middle"></text></g>`;
    this.nodeLayer.appendChild(g);
    this.nodes[e.id] = { g, badge: g.querySelector('.n-badge'), verdict: g.querySelector('.verdict'), win: g.querySelector('.win-t') };
    if (e.id === 'rootca') g.insertAdjacentHTML('beforeend', '<text class="offline-tag" x="0" y="-70" text-anchor="middle">OFFLINE</text>');
  }

  buildChain() {
    const [cx, cy] = LAYOUT.chain;
    const g = el('g', { class: 'node chain-node', 'data-entity': 'chain', tabindex: 0, role: 'button', 'aria-label': 'Certificate chain' });
    g.innerHTML = `<rect class="chain-frame" x="${cx - 104}" y="${cy - 118}" width="208" height="222" rx="10"/><text class="n-name" x="${cx}" y="${cy - 98}" text-anchor="middle">Certificate chain</text>`;
    CHAIN_CARDS.forEach(([id, name, i]) => {
      const y = cy - 82 + i * 62;
      const c = el('g', { class: 'chaincard', 'data-artifact': id, 'data-card': id, tabindex: 0, role: 'button', 'aria-label': name },
        `<rect x="${cx - 90}" y="${y}" width="180" height="46" rx="6"/><text class="cc-name" x="${cx}" y="${y + 20}" text-anchor="middle">${name}</text><text class="cc-sub" x="${cx}" y="${y + 36}" text-anchor="middle">${['Leaf (end entity)', 'Issuing CA', 'Root CA (trust anchor)'][i]}</text>`);
      g.appendChild(c); this.cardEls[id] = c;
      if (i < 2) g.appendChild(el('path', { class: 'chain-arrow', d: `M${cx} ${y + 46} L${cx} ${y + 62}`, 'marker-end': 'url(#ah-idle)' }));
    });
    this.chainFrame = g; this.nodeLayer.appendChild(g); this.nodes.chain = { g, badge: null };
  }

  buildChip(a) {
    const w = CHIP_W[a.id] ?? 60;
    const g = el('g', { class: `chip chip-${a.color}`, 'data-artifact': a.id, tabindex: 0, role: 'button', 'aria-label': a.label },
      `<rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11"/><text y="4" text-anchor="middle">${CHIP_TEXT[a.id]}</text>`);
    this.chipLayer.appendChild(g); this.chipEls[a.id] = g;
  }

  wireInteraction() {
    const svg = this.svg;
    let drag = null;
    svg.addEventListener('click', (ev) => {
      if (this.moved) { this.moved = false; return; }
      const t = ev.target.closest('[data-artifact],[data-entity],[data-flow]');
      if (!t) return;
      if (t.dataset.artifact) this.onSelect({ type: 'artifact', id: t.dataset.artifact });
      else if (t.dataset.entity) this.onSelect({ type: 'entity', id: t.dataset.entity });
      else this.onSelect({ type: 'flow', id: t.dataset.flow });
    });
    svg.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const t = ev.target.closest('[data-artifact],[data-entity]'); if (!t) return;
      ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    svg.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, cx: this.cam.x, cy: this.cam.y, id: ev.pointerId, started: false }; });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.started && Math.hypot(dx, dy) > 6) { drag.started = true; svg.setPointerCapture?.(ev.pointerId); }
      if (drag.started) { const r = svg.getBoundingClientRect(); const s = 1600 / r.width; this.cam.x = drag.cx + dx * s; this.cam.y = drag.cy + dy * s; this.applyCam(); this.moved = true; }
    });
    const end = () => { drag = null; setTimeout(() => { this.moved = false; }, 0); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => { ev.preventDefault(); this.cam.k = Math.min(2.2, Math.max(0.6, this.cam.k * (ev.deltaY < 0 ? 1.1 : 0.9))); this.applyCam(); }, { passive: false });
  }
  applyCam() { this.camG.setAttribute('transform', `translate(${this.cam.x},${this.cam.y}) translate(800,450) scale(${this.cam.k}) translate(-800,-450)`); }
  resetCamera() { this.cam = { x: 0, y: 0, k: 1 }; this.applyCam(); }
  setLabels(on) { this.svg.classList.toggle('hide-labels', !on); }

  // ---- derive everything from canonical state ----
  update(s, ctx) {
    const sc = this.scenario;
    const reverse = s.direction === 'reverse';
    const trace = reverse ? buildTrace(sc, s.activeFault) : null;
    const focusEntity = reverse ? trace[s.evidenceIndex]?.entity : sc.stages[s.stage].focus.entity;
    const focusArtifact = reverse ? trace[s.evidenceIndex]?.artifact : sc.stages[s.stage].focus.artifact;
    this.svg.dataset.direction = s.direction;
    for (const e of entities) {
      const n = this.nodes[e.id]; if (!n) continue;
      const st = e.id === 'chain' ? entityStatus('chain', s) : entityStatus(e.id, s);
      n.g.dataset.status = st;
      n.g.classList.toggle('focus', e.id === focusEntity);
      n.g.classList.toggle('sel', e.id === s.selectedEntity);
      if (n.badge) n.badge.textContent = badge(e.id, s);
      if (n.verdict) n.verdict.textContent = { trusted: 'TRUSTED', rejected: 'REJECTED', pending: 'PENDING', none: 'NO RESULT' }[s.trustDecision];
      if (n.win) n.win.textContent = s.connectionState === 'trusted' ? 'Secure connection' : ['failed', 'blocked'].includes(s.connectionState) ? 'Not secure' : s.connectionState === 'none' ? 'portal…' : 'Connecting…';
    }
    const chainVisible = s.chainState !== 'none' || (reverse && s.halted !== undefined && s.chainState !== 'none');
    this.chainFrame.classList.toggle('dim', !chainVisible);
    for (const [id] of CHAIN_CARDS) {
      const c = this.cardEls[id];
      let st = chainCardStatus(id, s);
      c.dataset.status = st;
      c.classList.toggle('missing', id === 'ica' && s.chainState === 'incomplete');
      c.classList.toggle('sel', s.selectedArtifact === id);
      c.classList.toggle('focus', id === focusArtifact);
    }
    // flows
    for (const f of sc.flows) {
      const fe = this.flowEls[f.id];
      const fs = flowStatus(sc, s, f);
      const color = fs.failed ? 'fail' : fs.phase === 'done' && f.id === 'f-trust' ? 'ok' : FLOW_COLOR[f.id] ?? (f.artifact && f.artifact !== 'private-key' && f.artifact !== 'csr' ? 'cert' : 'request');
      fe.g.dataset.phase = fs.phase; fe.g.dataset.color = color; fe.g.classList.toggle('failed', fs.failed);
      fe.g.classList.toggle('current', !reverse && sc.stages[s.stage].flows.includes(f.id));
      fe.g.classList.toggle('sel', s.selectedFlow === f.id);
      fe.over.setAttribute('marker-end', f.local ? '' : `url(#ah-${color})`);
      fe.over.style.strokeDasharray = `${fe.len}`;
      fe.over.style.strokeDashoffset = `${fe.len * (1 - fs.progress)}`;
      const showLabel = fs.phase === 'active' || (fe.g.classList.contains('current') && fs.phase !== 'idle') || (reverse && sc.stages[s.stage].flows.includes(f.id));
      fe.label.style.opacity = showLabel ? 1 : 0;
      const pt = pointAt(fe, fs.progress, f);
      fe.label.setAttribute('x', pt.mid[0]); fe.label.setAttribute('y', pt.mid[1] - 14);
      if (fe.packet) {
        fe.packet.style.opacity = fs.phase === 'active' ? 1 : 0;
        fe.packet.setAttribute('transform', `translate(${pt.at[0]},${pt.at[1]})`);
        fe.packet.dataset.color = color;
      }
    }
    // artifact chips
    const slots = {};
    for (const a of sc.artifacts) {
      if (a.id === 'chain') continue;
      const chip = this.chipEls[a.id];
      const loc = artifactLocation(sc, s, a);
      chip.classList.toggle('sel', s.selectedArtifact === a.id);
      chip.classList.toggle('focus', a.id === focusArtifact);
      if (!loc.visible || (a.id === 'root' && false)) { chip.style.display = 'none'; continue; }
      chip.style.display = '';
      let x, y;
      if (loc.moving) {
        const fe = this.flowEls[loc.via.id]; const p = pointAt(fe, loc.progress, loc.via, true); [x, y] = p.at;
        if (loc.from !== loc.via.from) { /* pulled from a repository: path start is the client; reverse direction */ [x, y] = pointAt(fe, 1 - loc.progress, loc.via, true).at; }
      } else {
        const n = (slots[loc.at] = (slots[loc.at] ?? 0) + 1) - 1;
        const [nx, ny] = LAYOUT[loc.at];
        const below = !['decision', 'chain'].includes(loc.at);
        x = nx + (loc.at === 'chain' ? 0 : -40 + 0); y = (below ? ny + 96 : ny) + n * 26;
        if (loc.at === 'chain') { x = LAYOUT.chain[0] + 120; y = LAYOUT.chain[1] - 80 + n * 26; }
        x += (n % 2) * 0;
      }
      chip.setAttribute('transform', `translate(${x},${y})`);
      chip.dataset.moving = loc.moving ? '1' : '0';
      const bad = this.chipFailed(a.id, s);
      chip.dataset.status = bad ? 'fail' : 'normal';
    }
    this.caption.textContent = reverse ? `Evidence trace ${s.evidenceIndex + 1} of ${trace.length}: ${trace[s.evidenceIndex].question}` : `${sc.stages[s.stage].phase.toUpperCase()} · ${sc.stages[s.stage].title}`;
  }

  chipFailed(id, s) {
    if (id === 'leaf') return ['fail'].includes(s.validation.name) || s.validation.dates === 'fail' || s.validation.eku === 'fail' || s.revocationState === 'revoked' || s.installationState === 'no-private-key';
    if (id === 'ica') return s.chainState === 'incomplete';
    if (id === 'root') return s.validation.root === 'fail';
    if (id === 'crl') return s.revocationState === 'unavailable';
    return false;
  }
}

function pointAt(fe, p, flow, clamp = false) {
  const path = fe.over;
  const len = path.getTotalLength();
  const q = Math.min(1, Math.max(0, p));
  const at = path.getPointAtLength(len * q);
  const m = path.getPointAtLength(len * 0.5);
  return { at: [at.x, at.y], mid: [m.x, m.y] };
}

function badge(id, s) {
  switch (id) {
    case 'web01': return `key: ${s.keyState}`;
    case 'ica01': return s.issuanceState === 'none' ? 'idle' : s.issuanceState;
    case 'template': return `decision: ${s.templateDecision}`;
    case 'iis': return s.iisBindingState;
    case 'client01': return `chain: ${s.chainState}`;
    case 'cdp': return `revocation: ${s.revocationState}`;
    case 'aia': return `AIA: ${s.aiaState}`;
    case 'cadb': return s.requestState === 'received' || s.requestState === 'issued' ? 'request 1042' : '';
    case 'rootca': return 'not involved in issuance';
    default: return '';
  }
}
