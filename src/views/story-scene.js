// StoryScene (v0.4.0): renders the Domain Controller story as six fixed zones, one active zone, one active artifact and one active
// route. All geometry comes from story-layout.js; this module only draws it and reports selections. The classic Scene keeps serving TLS.
import { storyModel, pointAt, VIEW, VAULT, ASSOC_Y, HEADLINE } from './story-layout.js';
import { buildTrace } from '../engine/engine.js';
import { ARTIFACTS, OFFLINE_TRUST, STORES, artifactLabel, artifactTag } from '../scenarios/dc/shared.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function wrap(text, max) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
// The surrounding spaces separate words when assistive technology concatenates sibling <text> elements; SVG drops them when rendering.
const txt = (x, y, s, cls = 't14', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}> ${esc(s)} </text>`;
// Accessible name = the visible words in reading order, then any extra context (WCAG 2.5.3 Label in Name).
const named = (visible, extra = '') => esc(`${visible.filter(Boolean).join(' ')}${extra ? `. ${extra}` : ''}`);
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

const TRAVEL_MS = 750; // artifact travel along the active route (600-900 ms band), ease-in-out
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

export class StoryScene {
  // options.film: deterministic film rendering (travel position follows the canonical stage progress, never the wall clock).
  constructor(svg, onSelect, options = {}) {
    this.svg = svg; this.onSelect = onSelect; this.key = ''; this.model = null; this.film = !!options.film; this.travel = null; this.stepKey = '';
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
    const key = JSON.stringify([sc.pathId, sc.conditionId, state.stage, m.started, opts.full, opts.inspectCa, opts.final, state.activeFault, state.halted, state.direction, state.evidenceIndex, state.leafState, state.keyAssociation, state.pendingRequest, state.trust, state.selectedArtifact, opts.selected, state.trustDecision, state.requestRecord, state.requester, state.revocationState, state.stageProgress >= 1]);
    if (key !== this.key) { this.key = key; this.model = m; this.svg.innerHTML = this.draw(m, state, opts); this.svg.dataset.activeConnectors = String(m.connectors.filter((c) => ['active', 'blocked', 'association'].includes(c.kind)).length); }
    // A new forward step starts one short travel of the artifact token along the active route.
    const stepKey = `${sc.pathId}|${state.stage}|${state.direction}|${m.started}`;
    if (stepKey !== this.stepKey) {
      this.stepKey = stepKey;
      this.travel = m.started && state.direction === 'forward' && !this.reduced && !this.film && this.routeFor() ? { start: performance.now() } : null;
    }
    this.animate(state);
  }
  routeFor() { return this.model?.connectors.find((x) => ['active', 'blocked', 'association'].includes(x.kind)) ?? null; }
  animate(state) {
    const g = this.svg.querySelector('#packet-g'); if (!g || !this.model) return;
    const c = this.routeFor();
    let p = null;
    if (c && !this.reduced && state.direction === 'forward') {
      if (this.film) p = state.stageProgress > 0 && state.stageProgress < 0.8 ? state.stageProgress / 0.8 : null;
      else if (this.travel) { const u = (performance.now() - this.travel.start) / TRAVEL_MS; if (u >= 1) this.travel = null; else p = u; }
    }
    if (p === null) { g.setAttribute('visibility', 'hidden'); return; }
    const end = c.kind === 'blocked' ? 0.5 : 1; // a blocked route stops at its cross
    const [x, y] = pointAt(c.points, easeInOut(Math.max(0, Math.min(1, p))) * end);
    g.setAttribute('transform', `translate(${x} ${y})`); g.setAttribute('visibility', 'visible');
  }

  draw(m, state, opts) {
    const sel = opts.selected ?? state.selectedArtifact;
    let out = '<defs><marker id="sarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk"/></marker>'
      + '<marker id="sarrow-k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk-assoc"/></marker>'
      + '<pattern id="plate-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" class="gridline" fill="none"/></pattern></defs>';
    // The plate: paper with a faint drafting grid.
    out += '<rect class="bg" x="0" y="0" width="1600" height="720"/><rect x="0" y="0" width="1600" height="720" fill="url(#plate-grid)" aria-hidden="true"/>';
    if (!opts.final) out += this.headlineHtml(m, state);
    // Offline trust (muted unless the chain is explained or a CA certificate is inspected).
    const ot = m.ot.rect;
    out += `<g class="ot ${m.ot.emphasis ? 'emph' : 'muted'}" data-sel="entity:rootca" tabindex="0" role="button" aria-label="Offline trust, SIMSI2027-ROOTCA, offline · not contacted. It signed the Issuing CA certificate earlier and never signs the DC01 certificate.">
      <rect x="${ot.x}" y="${ot.y}" width="${ot.w}" height="${ot.h}" rx="10"/>${icon('a-cert-anchor', ot.x + 10, ot.y + 22, 40)}
      ${txt(ot.x + 58, ot.y + 26, 'Offline trust', 't16')}${txt(ot.x + 58, ot.y + 48, 'SIMSI2027-ROOTCA')}${txt(ot.x + 58, ot.y + 70, 'offline · not contacted')}</g>`;
    // Zones
    for (const z of m.zones) out += this.zoneHtml(z, m, sel);
    // PUB strip (verify milestones only): AIA and CDP are two separate labelled endpoints.
    if (m.pub.visible) {
      const r = m.pub.rect, e = m.pub.endpoints;
      out += `<g class="pub"><rect class="pubstrip" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>
        <g class="pubep aia" data-sel="pub:aia" tabindex="0" role="button" aria-label="AIA (PKIWEB01) · issuer cert, not needed: ICA cert is local. AIA is where to download the issuer certificate; the Intermediate store already holds it."><rect x="${e.aia.x}" y="${e.aia.y}" width="${e.aia.w}" height="${e.aia.h}" rx="6"/>${txt(e.aia.x + 10, e.aia.y + 20, 'AIA (PKIWEB01) · issuer cert', 't14b')}${txt(e.aia.x + 10, e.aia.y + 40, 'not needed: ICA cert is local')}</g>
        ${(() => { const l2 = state.revocationState === 'offline' ? 'unreachable: revocation offline' : '/cdp/SIMSI2027-ICA01.crl'; return `<g class="pubep cdp" data-sel="pub:cdp" tabindex="0" role="button" aria-label="CDP (PKIWEB01) · CRL, ${l2}. The CDP is where DC01 downloads the revocation list."><rect x="${e.cdp.x}" y="${e.cdp.y}" width="${e.cdp.w}" height="${e.cdp.h}" rx="6"/>${txt(e.cdp.x + 10, e.cdp.y + 20, 'CDP (PKIWEB01) · CRL', 't14b')}${txt(e.cdp.x + 10, e.cdp.y + 40, l2)}</g>`; })()}</g>`;
    }
    // Key vault on DC01 (Certificate Enrollment Requests).
    if (m.vault.visible) {
      const v = VAULT; const st = m.vault.state;
      const lines = st === 'present' ? ['pending request + private key', 'stays on DC01 · non-exportable'] : st === 'consumed' ? ['empty: request consumed by', 'certreq -accept (key now linked)'] : st === 'user-store' ? ['empty: the key went to the', 'operator\'s user store (fault)'] : st === 'lost' ? ['empty: request 1042 lost', '(fault)'] : ['empty', ''];
      out += `<g class="vault ${st === 'present' ? 'held' : 'empty'}" data-sel="artifact:private-key" tabindex="0" role="button" aria-label="Certificate Enrollment Requests (DC01), ${esc(lines.join(' ').trim())}. DC01 key vault in Local Computer\\Certificate Enrollment Requests.">
        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="8"/>${icon('a-key', v.x + 8, v.y + 10, 32)}
        ${txt(v.x + 46, v.y + 22, 'Certificate Enrollment', 't14b')}${txt(v.x + 46, v.y + 40, 'Requests (DC01)', 't14b')}${txt(v.x + 10, v.y + 66, lines[0])}${txt(v.x + 10, v.y + 86, lines[1])}</g>`;
    }
    // Stores on DC01.
    if (m.stores) for (const s of m.stores) out += this.storeHtml(s, sel);
    // Connectors
    for (const c of m.connectors) out += this.connectorHtml(c);
    // Spotlight artifact (active artifact only).
    if (m.spotlight) out += this.spotHtml(m.spotlight, state, sel);
    // Travel token: one short eased trip along the active route when a step begins (hidden under reduced motion).
    out += '<g id="packet-g" class="packet-g" visibility="hidden" aria-hidden="true"><circle id="packet" r="8" class="packet"/></g>';
    return out;
  }

  // Plate headline in the free top band: "Step n of N · title" and one plain-language sentence (or the evidence question in reverse).
  headlineHtml(m, state) {
    const sc = this.sc; let num, title, lede;
    if (!m.started) { num = ''; title = 'Domain Controller Manual Enrollment'; lede = 'Choose a path, then press START FLOW. One zone, one artifact and one route are active at a time.'; }
    else if (state.direction === 'reverse') {
      const trace = buildTrace(sc, state.activeFault); const e = trace[state.evidenceIndex] ?? trace[0];
      num = `Evidence ${state.evidenceIndex + 1} of ${trace.length}`; title = e.question; lede = `${e.claim} (${e.evidenceKind ?? 'Derived conclusion'})`;
    } else {
      const st = sc.stages[state.stage]; num = `Step ${state.stage + 1} of ${sc.stages.length}`; title = st.title;
      lede = st.skipped ? `${st.result}: the Root and Issuing CA certificates already arrived from Active Directory.` : st.purpose;
    }
    const width = m.step?.rootHistory ? HEADLINE.narrowWidth : HEADLINE.width;
    const lines = wrap(lede, Math.floor(width / 7.6)).slice(0, 2);
    let h = `<g class="plate-head"><text x="${HEADLINE.x}" y="${HEADLINE.y}" class="headline"> ${num ? `<tspan class="num">${esc(num)}</tspan> · ` : ''}${esc(title)} </text>`;
    lines.forEach((l, i) => { h += txt(HEADLINE.x, HEADLINE.y + 28 + i * 20, l, 'lede'); });
    return `${h}</g>`;
  }

  zoneHtml(z, m, sel) {
    // Accessible names start with the visible text (WCAG 2.5.3), then add the zone's full name and state.
    const badgeIn = z.station && m.badge?.inStation && m.badge.zone === z.id;
    const label = named([z.title, ...(badgeIn ? [m.badge.text] : z.lines)], `Zone ${z.n}: ${z.name}${z.sameComputer ? ' (DC01, same computer)' : ''}, ${z.mode}`);
    let h = `<g class="szone z-${z.mode}" data-zone="${z.id}" data-mode="${z.mode}"><rect class="zrect" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="12"/>`;
    if (z.station) {
      const r = z.station;
      h += `<g class="station" data-sel="zone:${z.id}" tabindex="0" role="button" aria-label="${label}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>${txt(r.x + 12, r.y + 24, z.title, 't16')}`;
      if (badgeIn) h += `<g class="badge in"><rect x="${r.x + 10}" y="${r.y + 34}" width="150" height="24" rx="12"/>${txt(r.x + 22, r.y + 51, m.badge.text, 't14b')}</g>`;
      else z.lines.forEach((l, i) => { h += txt(r.x + 12, r.y + 42 + i * 17, l); });
      h += '</g>';
    } else {
      h += `<g class="ph" data-sel="zone:${z.id}" tabindex="0" role="button" aria-label="${label}">${txt(z.x + 16, 162, z.title, 't16 ph-t')}${z.lines.map((l, i) => txt(z.x + 16, 184 + i * 17, l, 't14 ph-t')).join('')}</g>`;
    }
    for (const c of z.crumbs) {
      const r = c.rect; const a = ARTIFACTS[c.artifact];
      h += `<g class="crumb ${sel === c.artifact ? 'selected' : ''}" data-sel="artifact:${c.artifact}" tabindex="0" role="button" aria-label="${named([c.label], 'earlier artifact, open details')}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14"/>${icon(a?.icon ?? 'a-doc', r.x + 6, r.y + 4, 20)}${txt(r.x + 32, r.y + 19, c.label)}</g>`;
    }
    if (m.badge && m.badge.zone === z.id && m.badge.rect) {
      const b = m.badge.rect;
      h += `<g class="badge actor-${m.badge.actor}" role="img" aria-label="${esc(`${m.badge.text}: ${m.badge.full}`)}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="16"/>${txt(b.x + 14, b.y + 21, m.badge.text, 't14b')}</g>`;
    }
    return `${h}</g>`;
  }

  spotHtml(sp, state, sel) {
    const a = ARTIFACTS[sp.artifact]; const r = sp.rect; const pathB = this.sc?.pathId === 'mmc';
    let tag = artifactTag(sp.artifact, this.sc?.pathId); const label = artifactLabel(sp.artifact, this.sc?.pathId);
    let lines;
    if (sp.artifact === 'record') lines = [`Request 1042 · ${state.requestRecord === 'pending' ? 'Pending' : state.requestRecord === 'issued' ? 'Issued' : state.requestRecord === 'approved' ? 'Approved' : state.requestRecord === 'denied' ? 'Denied' : 'Received'}`, 'Requester:', state.requester ?? '—'];
    if (sp.artifact === 'csr' && pathB) tag = sp.blocked ? 'not delivered: RPC/DCOM blocked' : 'built in memory · signed by the new DC01 key';
    if (sp.artifact === 'remediation') tag = 'root cause still open · open items in Details';
    lines ??= wrap(tag, 26).slice(0, 3);
    // Card anatomy (shape + label + colour, never colour alone): colour band, icon, name, what it is, where it is now.
    let body = `<rect class="band" x="${r.x}" y="${r.y + 10}" width="5" height="${r.h - 20}" rx="2"/>${icon(a.icon, r.x + 14, r.y + 12, 38)}${txt(r.x + 60, r.y + 36, label, 't16')}`;
    lines.forEach((l, i) => { body += txt(r.x + 16, r.y + 72 + i * 18, l); });
    const where = this.whereText(sp, state);
    if (a.stamp) body += `<g class="stamp"><rect x="${r.x + 16}" y="${r.y + 110}" width="120" height="22" rx="4"/>${txt(r.x + 24, r.y + 126, a.stamp, 't14b')}</g>`;
    else if (lines.length < 3 && where) body += txt(r.x + 16, r.y + 126, where, 'foot');
    const ins = a.role ? 'active artifact, open details and inspector' : 'active artifact, open details';
    return `<g class="spot c-${a.color} ${sel === sp.artifact ? 'selected' : ''}" data-sel="artifact:${sp.artifact}" data-artifact="${sp.artifact}" tabindex="0" role="button" aria-label="${named([label, ...lines, a.stamp ?? (lines.length < 3 ? where : '')], ins)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>${body}</g>`;
  }
  // Where the active artifact is now, in words (the zone's host).
  whereText(sp, state) {
    if (sp.blocked) return 'still in the wizard on DC01';
    // Step-specific locations: the return package reaches DC01 in a-return-move; the CA copies are installed from it on DC01.
    const stepId = this.sc?.stages[state.stage]?.id; const done = state.stageProgress >= 1;
    const special = { 'a-return-move': done ? 'on DC01, in the return package' : 'on the way to DC01', 'a-root': 'from the return package on DC01', 'a-ica': 'from the return package on DC01', 'a-template': 'chosen for the change record' }[stepId];
    if (special) return special;
    const host = { Z1: 'on DC01', Z2: this.sc?.pathId === 'mmc' ? 'in the wizard on DC01' : 'on DC01', Z3: this.sc?.pathId === 'mmc' ? 'on the wire' : 'on PKI-TRANSFER01', Z4: 'at ICA01', Z5: this.sc?.pathId === 'mmc' ? 'arriving on DC01' : 'on PKI-TRANSFER01', Z6: 'on DC01' }[sp.zone];
    return sp.source && state.stageProgress < 1 ? `leaving ${host?.replace(/^(on|at|in) /, '')}` : host ?? '';
  }

  storeHtml(s, sel) {
    const r = s.rect; const name = s.short ?? s.name;
    let h = `<g class="store ${s.target ? 'target' : ''}" data-store="${s.id}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>
      <g data-sel="store:${s.id}" tabindex="0" role="button" aria-label="${esc(`${name}: ${s.full} on DC01`)}">${icon('store', r.x + 8, r.y + 6, 26)}${txt(r.x + 40, r.y + 25, name, 't16')}</g>`;
    if (!s.entries.length) h += txt(r.x + 12, r.y + 60, s.status, 't14 muted-text');
    for (const e of s.entries) {
      const a = ARTIFACTS[e.artifact];
      const l2 = e.key ? 'private key on DC01 ✓' : e.keyText.split(' · ')[0];
      const l3 = e.source ? `source: ${e.source.replace(' (manual, emergency)', ' (emergency)')}` : e.key ? (this.sc?.pathId === 'mmc' ? 'installed by the wizard' : 'linked by -accept') : '';
      h += `<g class="entry ${e.active ? 'active' : ''} ${sel === e.artifact ? 'selected' : ''}" data-sel="artifact:${e.artifact}" data-artifact="${e.artifact}" data-key="${e.key}" tabindex="0" role="button" aria-label="${named([e.label, l2, l3], `${artifactLabel(e.artifact, this.sc?.pathId)} in ${s.full}, open details`)}">
        <rect x="${r.x + 8}" y="${r.y + 36}" width="${r.w - 16}" height="${r.h - 44}" rx="6"/>${icon(a.icon, r.x + 12, r.y + 42, 28)}${txt(r.x + 46, r.y + 58, e.label, 't14b')}
        ${txt(r.x + 46, r.y + 78, l2, e.key ? 't14 keyok' : 't14')}${l3 ? txt(r.x + 46, r.y + 96, l3, 't14') : ''}</g>`;
    }
    return `${h}</g>`;
  }

  connectorHtml(c) {
    const cls = { active: 'cn-active', blocked: 'cn-blocked', association: 'cn-assoc', history: 'cn-history', finished: 'cn-done' }[c.kind];
    let h = `<g class="conn ${cls}" data-connector="${c.id}" data-kind="${c.kind}" role="img" aria-label="${esc(c.kind === 'history' ? `${c.label}: Root CA history link, not a request route` : c.label)}">`;
    h += `<path d="${roundedPath(c.points)}" ${c.kind === 'active' ? 'marker-end="url(#sarrow)"' : c.kind === 'association' ? 'marker-end="url(#sarrow-k)"' : ''}/>`;
    if (c.cross) h += `<g class="cross"><path d="M${c.cross[0] - 10} ${c.cross[1] - 10}L${c.cross[0] + 10} ${c.cross[1] + 10}M${c.cross[0] + 10} ${c.cross[1] - 10}L${c.cross[0] - 10} ${c.cross[1] + 10}"/></g>`;
    if (c.kind !== 'finished') {
      const { x, y, anchor } = c.labelAt; const w = Math.round(c.label.length * 7.4 + 18);
      const rx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - 8;
      const tx = anchor === 'end' ? x - 9 : x; // keep end-anchored text inside its pill
      h += `<g class="clabel"><rect x="${rx}" y="${y - 13}" width="${w}" height="24" rx="12"/>${txt(tx, y + 5, c.label, 't14b', `text-anchor="${anchor}"`)}</g>`;
    }
    return `${h}</g>`;
  }
}
void OFFLINE_TRUST; void STORES; void ASSOC_Y;
