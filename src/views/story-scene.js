// StoryScene (v0.4.0): renders the Domain Controller story as six fixed zones, one active zone, one active artifact and one active
// route. All geometry comes from story-layout.js; this module only draws it and reports selections. The classic Scene keeps serving TLS.
import { storyModel, pointAt, VIEW, VAULT, ASSOC_Y } from './story-layout.js';
import { ARTIFACTS, OFFLINE_TRUST, STORES } from '../scenarios/dc/shared.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function wrap(text, max) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
const txt = (x, y, s, cls = 't14', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(s)}</text>`;
const icon = (name, x, y, size = 40) => `<use href="#ic-${name}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
// Orthogonal path with 12-unit rounded corners.
export function roundedPath(pts, r = 12) {
  if (pts.length < 3) return path(pts);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.abs(c[0] - p[0]) + Math.abs(c[1] - p[1]), l2 = Math.abs(n[0] - c[0]) + Math.abs(n[1] - c[1]); const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [c[0] - Math.sign(c[0] - p[0]) * rr, c[1] - Math.sign(c[1] - p[1]) * rr], b = [c[0] + Math.sign(n[0] - c[0]) * rr, c[1] + Math.sign(n[1] - c[1]) * rr];
    d += ` L${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  }
  const l = pts.at(-1); return `${d} L${l[0]} ${l[1]}`;
}

export class StoryScene {
  constructor(svg, onSelect) {
    this.svg = svg; this.onSelect = onSelect; this.key = ''; this.model = null;
    svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const act = (e) => {
      const el = e.target.closest('[data-sel]'); if (!el) return;
      const [type, id] = el.dataset.sel.split(':'); this.onSelect({ type, id, trigger: el });
    };
    svg.addEventListener('click', act);
    svg.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-sel]')) { e.preventDefault(); e.stopPropagation(); act(e); } });
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  load(sc) { this.sc = sc; this.key = ''; }
  update(sc, state, opts = {}) {
    this.sc = sc;
    const m = storyModel(sc, state, opts);
    const key = JSON.stringify([sc.pathId, sc.conditionId, state.stage, m.started, opts.full, opts.inspectCa, state.activeFault, state.halted, state.direction, state.leafState, state.keyAssociation, state.pendingRequest, state.trust, state.selectedArtifact, opts.selected, state.trustDecision, state.requestRecord, state.requester, state.revocationState]);
    if (key !== this.key) { this.key = key; this.model = m; this.svg.innerHTML = this.draw(m, state, opts); this.svg.dataset.activeConnectors = String(m.connectors.filter((c) => ['active', 'blocked', 'association'].includes(c.kind)).length); }
    this.animate(state);
  }
  animate(state) {
    const dot = this.svg.querySelector('#packet'); if (!dot || !this.model) return;
    const c = this.model.connectors.find((x) => x.kind === 'active' || x.kind === 'blocked');
    if (!c || this.reduced || state.direction === 'reverse') { dot.setAttribute('visibility', 'hidden'); return; }
    const p = Math.min(1, state.stageProgress / 0.8); const end = c.kind === 'blocked' ? 0.5 : 1;
    const [x, y] = pointAt(c.points, p * end); dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('visibility', p > 0 && p < 1 ? 'visible' : 'hidden');
  }

  draw(m, state, opts) {
    const sel = opts.selected ?? state.selectedArtifact;
    let out = '<defs><marker id="sarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk"/></marker></defs>';
    out += '<rect class="bg" x="0" y="0" width="1600" height="720"/>';
    // Offline trust (muted unless the chain is explained or a CA certificate is inspected).
    const ot = m.ot.rect;
    out += `<g class="ot ${m.ot.emphasis ? 'emph' : 'muted'}" data-sel="entity:rootca" tabindex="0" role="button" aria-label="Offline trust: SIMSI2027 Root CA, offline. Not contacted for this request.">
      <rect x="${ot.x}" y="${ot.y}" width="${ot.w}" height="${ot.h}" rx="10"/>${icon('a-cert-anchor', ot.x + 10, ot.y + 22, 40)}
      ${txt(ot.x + 58, ot.y + 26, 'Offline trust', 't16')}${txt(ot.x + 58, ot.y + 48, 'SIMSI2027-ROOTCA')}${txt(ot.x + 58, ot.y + 70, 'offline · not contacted')}</g>`;
    // Zones
    for (const z of m.zones) out += this.zoneHtml(z, m, sel);
    // PUB strip (verify milestones only): AIA and CDP are two separate labelled endpoints.
    if (m.pub.visible) {
      const r = m.pub.rect, e = m.pub.endpoints;
      out += `<g class="pub"><rect class="pubstrip" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>
        <g class="pubep aia" data-sel="pub:aia" tabindex="0" role="button" aria-label="AIA on PKIWEB01: where to download the issuer certificate. Not needed here because the Issuing CA certificate is already in the Intermediate store."><rect x="${e.aia.x}" y="${e.aia.y}" width="${e.aia.w}" height="${e.aia.h}" rx="6"/>${txt(e.aia.x + 10, e.aia.y + 20, 'AIA (PKIWEB01) · issuer cert', 't14b')}${txt(e.aia.x + 10, e.aia.y + 40, 'not needed: ICA cert is local')}</g>
        <g class="pubep cdp" data-sel="pub:cdp" tabindex="0" role="button" aria-label="CDP on PKIWEB01: where to download the CRL (revocation list)."><rect x="${e.cdp.x}" y="${e.cdp.y}" width="${e.cdp.w}" height="${e.cdp.h}" rx="6"/>${txt(e.cdp.x + 10, e.cdp.y + 20, 'CDP (PKIWEB01) · CRL', 't14b')}${txt(e.cdp.x + 10, e.cdp.y + 40, state.revocationState === 'offline' ? 'unreachable: revocation offline' : '/cdp/SIMSI2027-ICA01.crl')}</g></g>`;
    }
    // Key vault on DC01 (Certificate Enrollment Requests).
    if (m.vault.visible) {
      const v = VAULT; const st = m.vault.state;
      const lines = st === 'present' ? ['pending request + private key', 'stays on DC01 · non-exportable'] : st === 'consumed' ? ['empty: request consumed by', 'certreq -accept (key now linked)'] : st === 'user-store' ? ['empty: the key went to the', 'operator\'s user store (fault)'] : st === 'lost' ? ['empty: request 1042 lost', '(fault)'] : ['empty', ''];
      out += `<g class="vault ${st === 'present' ? 'held' : 'empty'}" data-sel="artifact:private-key" tabindex="0" role="button" aria-label="DC01 key vault, Local Computer Certificate Enrollment Requests: ${esc(lines.join(' '))}">
        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="8"/>${icon('a-key', v.x + 8, v.y + 10, 32)}
        ${txt(v.x + 46, v.y + 22, 'Certificate Enrollment', 't14b')}${txt(v.x + 46, v.y + 40, 'Requests (DC01)', 't14b')}${txt(v.x + 10, v.y + 66, lines[0])}${txt(v.x + 10, v.y + 86, lines[1])}</g>`;
    }
    // Stores on DC01.
    if (m.stores) for (const s of m.stores) out += this.storeHtml(s, sel);
    // Connectors
    for (const c of m.connectors) out += this.connectorHtml(c);
    // Spotlight artifact (active artifact only).
    if (m.spotlight) out += this.spotHtml(m.spotlight, state, sel);
    out += '<circle id="packet" r="7" class="packet" visibility="hidden"/>';
    // Before START FLOW: a short invitation; nothing else moves.
    if (!m.started) out += `<text x="800" y="660" class="t16 muted-text" text-anchor="middle">Press START FLOW to begin. Six zones, one step at a time.</text>`;
    return out;
  }

  zoneHtml(z, m, sel) {
    const label = `Zone ${z.n}: ${z.name}${z.sameComputer ? ' (DC01, same computer)' : ''}. ${z.mode}`;
    let h = `<g class="szone z-${z.mode}" data-zone="${z.id}" data-mode="${z.mode}"><rect class="zrect" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="12"/>`;
    if (z.station) {
      const r = z.station; const badgeIn = m.badge?.inStation && m.badge.zone === z.id;
      h += `<g class="station" data-sel="zone:${z.id}" tabindex="0" role="button" aria-label="${esc(label)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>${txt(r.x + 12, r.y + 24, z.title, 't16')}`;
      if (badgeIn) h += `<g class="badge in" aria-label="${esc(m.badge.full)}"><rect x="${r.x + 10}" y="${r.y + 34}" width="150" height="24" rx="12"/>${txt(r.x + 22, r.y + 51, m.badge.text, 't14b')}</g>`;
      else z.lines.forEach((l, i) => { h += txt(r.x + 12, r.y + 42 + i * 17, l); });
      h += '</g>';
    } else {
      h += `<g class="ph" data-sel="zone:${z.id}" tabindex="0" role="button" aria-label="${esc(label)}">${txt(z.x + 16, 162, z.title, 't16 ph-t')}${z.lines.map((l, i) => txt(z.x + 16, 184 + i * 17, l, 't14 ph-t')).join('')}</g>`;
    }
    for (const c of z.crumbs) {
      const r = c.rect; const a = ARTIFACTS[c.artifact];
      h += `<g class="crumb ${sel === c.artifact ? 'selected' : ''}" data-sel="artifact:${c.artifact}" tabindex="0" role="button" aria-label="Earlier artifact: ${esc(a?.label)}. Open details"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14"/>${icon(a?.icon ?? 'a-doc', r.x + 6, r.y + 4, 20)}${txt(r.x + 32, r.y + 19, a?.label ?? c.artifact)}</g>`;
    }
    if (m.badge && m.badge.zone === z.id && m.badge.rect) {
      const b = m.badge.rect;
      h += `<g class="badge actor-${m.badge.actor}" role="img" aria-label="${esc(m.badge.full)}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="16"/>${txt(b.x + 14, b.y + 21, m.badge.text, 't14b')}</g>`;
    }
    return `${h}</g>`;
  }

  spotHtml(sp, state, sel) {
    const a = ARTIFACTS[sp.artifact]; const r = sp.rect; const pathB = this.sc?.pathId === 'mmc';
    let tag = pathB && a.mmcTag ? a.mmcTag : a.tag;
    let lines;
    if (sp.artifact === 'record') lines = [`Request 1042 · ${state.requestRecord === 'pending' ? 'Pending' : state.requestRecord === 'issued' ? 'Issued' : state.requestRecord === 'approved' ? 'Approved' : state.requestRecord === 'denied' ? 'Denied' : 'Received'}`, 'Requester:', state.requester ?? '—'];
    if (sp.artifact === 'csr' && pathB) tag = sp.blocked ? 'not delivered: RPC/DCOM blocked' : 'built in memory · signed by the new DC01 key';
    if (sp.artifact === 'remediation') tag = 'root cause still open · open items in Details';
    lines ??= wrap(tag, 26).slice(0, 3);
    let body = `${icon(a.icon, r.x + 10, r.y + 10, 40)}${txt(r.x + 58, r.y + 34, a.label, 't16')}`;
    lines.forEach((l, i) => { body += txt(r.x + 12, r.y + 72 + i * 18, l); });
    if (a.stamp) body += `<g class="stamp"><rect x="${r.x + 12}" y="${r.y + 110}" width="120" height="22" rx="4"/>${txt(r.x + 20, r.y + 126, a.stamp, 't14b')}</g>`;
    const ins = a.role ? 'Open details and inspector' : 'Open details';
    return `<g class="spot c-${a.color} ${sel === sp.artifact ? 'selected' : ''}" data-sel="artifact:${sp.artifact}" data-artifact="${sp.artifact}" tabindex="0" role="button" aria-label="Active artifact: ${esc(a.label)}, ${esc(tag)}. ${ins}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>${body}</g>`;
  }

  storeHtml(s, sel) {
    const r = s.rect; const name = s.short ?? s.name;
    let h = `<g class="store ${s.target ? 'target' : ''}" data-store="${s.id}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>
      <g data-sel="store:${s.id}" tabindex="0" role="button" aria-label="Store ${esc(s.full)} on DC01">${icon('store', r.x + 8, r.y + 6, 26)}${txt(r.x + 40, r.y + 25, name, 't16')}</g>`;
    if (!s.entries.length) h += txt(r.x + 12, r.y + 60, s.status, 't14 muted-text');
    for (const e of s.entries) {
      const a = ARTIFACTS[e.artifact];
      h += `<g class="entry ${e.active ? 'active' : ''} ${sel === e.artifact ? 'selected' : ''}" data-sel="artifact:${e.artifact}" data-artifact="${e.artifact}" data-key="${e.key}" tabindex="0" role="button" aria-label="${esc(`${a.label} in ${s.full}: ${e.label}. ${e.keyText}${e.source ? `. Source: ${e.source}` : ''}. Open details`)}">
        <rect x="${r.x + 8}" y="${r.y + 36}" width="${r.w - 16}" height="${r.h - 44}" rx="6"/>${icon(a.icon, r.x + 12, r.y + 42, 28)}${txt(r.x + 46, r.y + 58, e.label, 't14b')}
        ${txt(r.x + 46, r.y + 78, e.key ? 'private key on DC01 ✓' : e.keyText.split(' · ')[0])}${txt(r.x + 46, r.y + 96, e.source ? `source: ${e.source.replace(' (manual, emergency)', ' (emergency)')}` : e.key ? (this.sc?.pathId === 'mmc' ? 'installed by the wizard' : 'linked by -accept') : '', 't14')}</g>`;
    }
    return `${h}</g>`;
  }

  connectorHtml(c) {
    const cls = { active: 'cn-active', blocked: 'cn-blocked', association: 'cn-assoc', history: 'cn-history', finished: 'cn-done' }[c.kind];
    let h = `<g class="conn ${cls}" data-connector="${c.id}" data-kind="${c.kind}" role="img" aria-label="${esc(c.kind === 'history' ? `Root CA history link: ${c.label}` : `${c.label}`)}">`;
    h += `<path d="${roundedPath(c.points)}" ${c.kind === 'active' || c.kind === 'association' ? 'marker-end="url(#sarrow)"' : ''}/>`;
    if (c.cross) h += `<g class="cross"><path d="M${c.cross[0] - 10} ${c.cross[1] - 10}L${c.cross[0] + 10} ${c.cross[1] + 10}M${c.cross[0] + 10} ${c.cross[1] - 10}L${c.cross[0] - 10} ${c.cross[1] + 10}"/></g>`;
    if (c.kind !== 'finished') {
      const { x, y, anchor } = c.labelAt; const w = Math.round(c.label.length * 7.4 + 18);
      const rx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - 8;
      h += `<g class="clabel"><rect x="${rx}" y="${y - 13}" width="${w}" height="24" rx="12"/>${txt(anchor === 'start' ? x : x, y + 5, c.label, 't14b', `text-anchor="${anchor}"`)}</g>`;
    }
    return `${h}</g>`;
  }
}
void OFFLINE_TRUST; void STORES; void ASSOC_Y;
