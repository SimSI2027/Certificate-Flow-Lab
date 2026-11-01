// Story-mode controller for scenarios with layoutMode 'story-zones' (Domain Controller since v0.4.0, Website TLS since v0.5.0). It
// shares the App's canonical session and only adds the story header (path, condition, fault, START FLOW, direction, topology), the
// milestone rail (grouped by act when the lesson has acts), the details panel and the final card. Selecting never moves the timeline.
import * as E from '../engine/engine.js';
import { StoryScene } from '../views/story-scene.js';
import { storyOf } from '../views/story-layout.js';
import * as DCP from './story-panel.js';
import * as TP from './tls-panel.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = DCP.esc;
const WIDE = 1600;

export class StoryController {
  constructor(app) {
    this.app = app; this.scene = new StoryScene($('#story-scene'), (sel) => this.select(sel), { film: app.params.has('film') });
    this.panelOpen = false; this.open = { plain: true }; this.selection = null; this.trigger = null; this.token = null; this.raw = null; this.lastPanelKey = ''; this.inspectCa = false; this.gloss = new Set();
    this.bind();
  }
  get s() { return this.app.session; }
  get sc() { return this.app.sc; }
  get S() { return storyOf(this.sc); }
  // The details panel module for the active lesson.
  get P() { return this.S.kind === 'tls' ? TP : DCP; }

  // ---------- lifecycle ----------
  start(params) {
    const base = this.app.base; const p = params ?? new URLSearchParams();
    const pathId = base.paths ? (base.paths[p.get('path')] ? p.get('path') : base.defaultPath) : base.pathId;
    const conditionId = base.conditions ? (base.conditions.some((c) => c.id === p.get('condition')) ? p.get('condition') : base.defaultCondition) : undefined;
    Object.assign(this.s, { pathId, conditionId, started: p.has('t') || p.get('dir') === 'reverse' || p.get('start') === '1' });
    this.applyPath(false);
    const fault = p.get('fault'); this.s.faultId = this.sc.faults.some((f) => f.id === fault) ? fault : 'healthy';
    this.s.t = E.clampT(Number(p.get('t')) || 0, E.maxT(this.sc, this.s.faultId));
    if (p.get('dir') === 'reverse') { this.s.direction = 'reverse'; this.s.tReverse = 1; }
    if (p.get('panel') === 'open') this.panelOpen = true;
    this.selection = null; this.token = null; this.raw = null; this.gloss = new Set();
    this.buildControls(); this.render(true);
  }
  applyPath(resetT = true) {
    const base = this.app.base;
    this.app.sc = E.pathOf(base, this.s);
    this.app.evidence = this.app.evidenceMap[`${base.id}:${this.app.sc.pathId}`] ?? this.app.evidenceMap[base.id];
    if (!this.sc.faults.some((f) => f.id === this.s.faultId)) this.s.faultId = 'healthy';
    if (resetT) { this.s.t = 0; this.s.tReverse = 0; this.s.direction = 'forward'; this.clearSelection(); }
  }
  setPath(id) { if (!this.app.base.paths) return; this.app.pause(); this.s.pathId = id; this.applyPath(); this.buildControls(); this.render(true); }
  setCondition(id) { this.app.pause(); this.s.conditionId = id; this.applyPath(false); this.s.t = E.clampT(this.s.t, this.app.max); this.buildControls(); this.render(true); }
  setFault(id) { this.app.pause(); this.s.faultId = id; this.s.t = this.s.started ? E.clampT(this.s.t, E.maxT(this.sc, id)) : 0; this.s.tReverse = 0; this.render(true); }
  startFlow() { this.s.started = true; this.s.direction = 'forward'; this.s.t = 0; this.app.play(); this.render(true); $('#s-caption')?.focus?.(); }
  clearSelection() { this.selection = null; this.inspectCa = false; Object.assign(this.s, { selectedArtifact: null, selectedEntity: null, selectedFlow: null }); }

  // ---------- navigation (skips "Already present" steps) ----------
  next() { this.app.pause(); this.s.started = true; if (this.s.direction === 'reverse') this.s.tReverse = E.stepForwardT(this.s.tReverse, this.app.max); else this.s.t = E.nextStepT(this.sc, this.s.t, this.app.max); this.render(true); }
  prev() { this.app.pause(); if (this.s.direction === 'reverse') this.s.tReverse = E.stepBackwardT(this.s.tReverse, this.app.max); else this.s.t = E.prevStepT(this.sc, this.s.t, this.app.max); this.render(true); }
  restart() { this.app.pause(); this.s.t = 0; this.s.tReverse = 0; this.s.direction = 'forward'; this.s.started = false; this.clearSelection(); this.render(true); }
  setDirection(d) { this.app.pause(); this.s.started = true; this.s.direction = d; if (d === 'reverse') { this.s.tReverse = Math.max(1, Math.min(this.s.tReverse, this.app.max)); this.open.evidence = true; } this.render(true); }
  jumpMilestone(name) { this.app.pause(); this.s.started = true; if (this.s.direction !== 'forward') this.s.direction = 'forward'; const i = this.sc.stages.findIndex((st) => st.milestone === name && !st.skipped); if (i >= 0) this.s.t = E.clampT(i + 1, this.app.max); this.render(true); }
  // During playback a skipped step is passed over instantly.
  tick() { const st = this.sc.stages[this.app.state().stage]; if (this.s.playing && this.s.direction === 'forward' && st?.skipped && this.s.t > 0) this.s.t = E.clampT(E.stageEndT(this.sc.stages.indexOf(st)), this.app.max); }

  // ---------- selection and panel ----------
  select(sel) {
    this.clearSelection(); this.selection = { type: sel.type, id: sel.id }; this.trigger = sel.trigger ?? document.activeElement;
    if (sel.type === 'artifact') this.s.selectedArtifact = sel.id; else this.s.selectedEntity = sel.id;
    this.inspectCa = sel.type === 'artifact' && ['ica', 'root'].includes(sel.id) || sel.type === 'entity' && sel.id === 'rootca';
    this.panelOpen = true; this.open.technical = sel.type !== 'zone'; this.open.plain = true; this.raw = null; this.token = null;
    this.render(true); $('#spanel .pclose')?.focus();
  }
  openPanel(trigger) { this.trigger = trigger ?? document.activeElement; this.panelOpen = true; this.render(true); $('#spanel .pclose')?.focus(); }
  closePanel() {
    this.panelOpen = false; this.render(true); const t = this.trigger; this.trigger = null;
    // The scene may have been redrawn since the click: return focus to the same object by its selection identity.
    const sel = t?.dataset?.sel ?? t?.closest?.('[data-sel]')?.dataset.sel;
    const target = t && document.contains(t) ? t : sel ? document.querySelector(`[data-sel="${CSS.escape(sel)}"]`) : null;
    (target ?? $('#spanel .popen'))?.focus();
  }

  bind() {
    const on = (sel, ev, fn) => $(sel)?.addEventListener(ev, fn);
    $$('[data-path]').forEach((b) => b.addEventListener('click', () => this.setPath(b.dataset.path)));
    on('#s-condition', 'change', (e) => this.setCondition(e.target.value));
    on('#s-fault', 'change', (e) => this.setFault(e.target.value));
    on('#s-start', 'click', () => this.startFlow());
    on('#s-fwd', 'click', () => this.setDirection('forward')); on('#s-rev', 'click', () => this.setDirection('reverse'));
    on('#s-full', 'change', (e) => { this.app.full = e.target.checked; this.render(true); });
    on('#s-prev', 'click', () => this.prev()); on('#s-next', 'click', () => this.next()); on('#s-restart', 'click', () => this.restart());
    on('#s-play', 'click', () => { if (this.s.playing) this.app.pause(); else { this.s.started = true; this.app.play(); } this.render(true); });
    on('#s-speed', 'change', (e) => { this.s.playbackSpeed = Number(e.target.value); });
    on('#s-home', 'click', () => this.app.showHome());
    on('#s-tour', 'click', () => { const t = this.app.tour; if (t.state === 'running' || t.state === 'paused') t.stop(); else { if (this.app.base.paths && this.s.pathId !== this.app.base.defaultPath) this.setPath(this.app.base.defaultPath); this.s.started = true; t.start(); } this.render(true); });
    $('#spanel').addEventListener('click', (e) => this.panelClick(e));
    $('#final-card').addEventListener('click', (e) => this.panelClick(e));
    $('#final-card').addEventListener('toggle', (e) => { this.fcOpen = e.target.open; }, true);
    // Command tokens explain themselves on hover and keyboard focus as well as on click (shown in place, no re-render).
    const peek = (e) => { const tk = e.target.closest?.('[data-token]'); if (tk) this.showToken(Number(tk.dataset.token)); };
    $('#spanel').addEventListener('focusin', peek); $('#spanel').addEventListener('mouseover', peek);
    $('#s-rail').addEventListener('click', (e) => { const b = e.target.closest('[data-milestone]'); if (b) this.jumpMilestone(b.dataset.milestone); });
    document.addEventListener('keydown', (e) => {
      if (this.app.screen !== 'workspace' || !this.app.storyMode) return;
      if (e.key === 'Escape' && this.panelOpen) { e.preventDefault(); this.closePanel(); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ' && e.target.tagName !== 'BUTTON' && !e.target.closest?.('[role=button]')) { e.preventDefault(); if (this.s.playing) this.app.pause(); else { this.s.started = true; this.app.play(); } this.render(true); }
      if (e.key === 'ArrowRight' && !e.target.closest?.('.tokens')) { e.preventDefault(); this.next(); }
      if (e.key === 'ArrowLeft' && !e.target.closest?.('.tokens')) { e.preventDefault(); this.prev(); }
    });
    window.addEventListener('resize', () => { if (this.app.storyMode) this.render(true); });
  }
  panelClick(e) {
    const t = (sel) => e.target.closest(sel);
    if (t('.popen')) return this.openPanel(t('.popen'));
    if (t('.pclose')) return this.closePanel();
    const d = t('[data-sec-toggle]'); if (d) { const id = d.dataset.secToggle; this.open[id] = !this.isOpen(id); this.renderPanel(true); $(`[data-sec-toggle="${id}"]`)?.focus(); return; }
    const g = t('[data-gloss]'); if (g) { const term = g.dataset.gloss; if (this.gloss.has(term)) this.gloss.delete(term); else this.gloss.add(term); this.renderPanel(true); $(`[data-gloss="${CSS.escape(term)}"]`)?.focus(); return; }
    const o = t('[data-open]:not(#spanel)'); if (o) { const [type, id] = o.dataset.open.split(':'); return this.select({ type, id, trigger: o }); }
    const tk = t('[data-token]'); if (tk) { this.showToken(Number(tk.dataset.token)); return; }
    const r = t('[data-raw]'); if (r) { this.raw = r.dataset.raw; this.renderPanel(true); return; }
    const ev = t('[data-evidence]'); if (ev) { this.app.pause(); this.s.started = true; this.s.direction = 'reverse'; this.s.tReverse = Number(ev.dataset.evidence) + 1; this.open.evidence = true; this.render(true); return; }
    const sp = t('[data-switch-path]'); if (sp) { this.setPath(sp.dataset.switchPath); this.s.started = true; this.render(true); return; }
    if (t('#fc-restart')) return this.restart();
    if (t('#fc-reverse')) return this.setDirection('reverse');
    const cp = t('[data-copy]'); if (cp) { this.copy(cp); return; }
    const nat = t('[data-native]'); if (nat && !nat.disabled) this.app.native.open(nat.dataset.native).then(() => this.render(true));
  }
  showToken(i) {
    const st = this.sc.stages[this.app.state().stage]; const tok = (st.command?.tokens ?? st.gui?.tokens)?.[i]; const out = $('#sec-command .token-meaning'); if (!tok || !out) return;
    this.token = i; $$('#sec-command [data-token]').forEach((b) => { const on = Number(b.dataset.token) === i; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    out.innerHTML = `<strong>${esc(tok.t)}</strong>: ${esc(tok.meaning)}`;
  }
  // Copy only (commands, thumbprints, PEM): nothing is ever executed.
  copy(btn) {
    const text = btn.dataset.copy; const done = (ok) => { btn.dataset.copied = String(ok); btn.textContent = ok ? 'Copied' : 'Copy failed'; $('#copy-status').textContent = ok ? `${btn.dataset.what ?? 'Text'} copied to the clipboard.` : 'Copy failed: select the text and copy it manually.'; setTimeout(() => { btn.textContent = btn.dataset.label; delete btn.dataset.copied; }, 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); else done(false);
  }
  isOpen(id) { const ctx = this.ctx(); if (id === 'troubleshoot' && this.P.faultHere(ctx) && this.open.troubleshoot === undefined) return true; return id === 'plain' ? this.open.plain !== false : !!this.open[id]; }

  // ---------- rendering ----------
  ctx(s = this.app.state()) {
    const app = this.app;
    return { scenario: this.sc, state: s, model: app.model, evidence: app.evidence, ev: app.evidence[s.activeFault] ?? app.evidence.healthy, started: !!this.s.started, selection: this.selection, sigs: app.sigs, gloss: this.gloss,
      chainOf: (c, id) => app.chainOf(c, id), downloads: (fx) => app.downloadLinks(fx), nativeBlock: (fx) => app.nativeBlock(fx.manifest, fx.parsed) };
  }
  // The URL reflects the lesson position so a refresh or a shared link reopens it (audit W2). Never while the film is rendering.
  syncUrl(s) {
    if (this.app.params.has('film') || typeof history === 'undefined') return;
    const q = new URLSearchParams(location.search); const multi = !!this.app.base.paths;
    q.set('scenario', this.app.base.id);
    if (multi) q.set('path', this.sc.pathId); else q.delete('path');
    if (multi && this.sc.pathId === 'csr') q.set('condition', this.sc.conditionId); else q.delete('condition');
    if (s.activeFault !== 'healthy') q.set('fault', s.activeFault); else q.delete('fault');
    if (this.s.started && s.direction === 'forward') q.set('t', String(Math.floor(this.s.t + 1e-9))); else q.delete('t');
    if (s.direction === 'reverse') q.set('dir', 'reverse'); else q.delete('dir');
    q.delete('start');
    const url = `${location.pathname}?${q.toString()}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }
  buildControls() {
    const base = this.app.base; const S = this.S; this.railKey = null;
    $('#s-title').textContent = base.title; $('#story-scene').setAttribute('aria-label', S.ariaScene); $('#story-stage').setAttribute('aria-label', `${base.title} story`);
    const multi = !!base.paths; $('#s-pathseg').hidden = !multi; $('#s-condwrap').hidden = !multi;
    $$('[data-path]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.path === this.sc.pathId)));
    const cond = $('#s-condition'); cond.disabled = !multi || this.sc.pathId === 'mmc';
    // Path B has no conditional steps: its CA certificates arrive from AD (Enterprise store).
    cond.innerHTML = !multi ? '' : cond.disabled ? '<option value="">Not applicable: CA certificates from AD (Enterprise store)</option>'
      : base.conditions.map((c) => `<option value="${c.id}" title="${esc(c.note ?? '')}">${esc(c.label)}${c.note ? ' (exceptional)' : ''}</option>`).join('');
    if (multi && !cond.disabled) cond.value = this.sc.conditionId;
    const f = $('#s-fault'); f.innerHTML = this.sc.faults.map((x) => `<option value="${x.id}">${esc(x.id === 'healthy' ? 'None (healthy)' : x.label)}</option>`).join(''); f.value = this.s.faultId;
    $('#s-full').checked = this.app.full;
    // Act-grouped rails reserve room for the step dots so the rail never re-flows between steps.
    const dots = (m) => (this.sc.acts ? ` style="--dots:${this.sc.stages.filter((q) => q.milestone === m).length}"` : '');
    const chip = (m, i) => `<button class="mchip" data-milestone="${esc(m)}" data-mi="${i}"><span class="mn">${i + 1}</span> ${esc(m)}<span class="dots" aria-hidden="true"${dots(m)}></span></button>`;
    // Lessons with acts group their milestones under a quiet act label, so the two halves are obvious.
    $('#s-rail').innerHTML = this.sc.acts
      ? this.sc.acts.map((a) => `<div class="act" role="group" aria-label="Act ${a.n}: ${esc(a.title)}"><span class="act-label" aria-hidden="true">Act ${a.n} · ${esc(a.title)}</span><div class="act-chips">${this.sc.milestones.map((m, i) => (this.sc.milestoneAct[m] === a.id ? chip(m, i) : '')).join('')}</div></div>`).join('')
      : this.sc.milestones.map(chip).join('');
  }
  render(force = false) {
    if (this.app.screen !== 'workspace') return;
    this.tick();
    const s = this.app.state(); const st = this.sc.stages[s.stage]; const started = !!this.s.started; const rev = s.direction === 'reverse';
    const atEnd = started && !rev && this.s.t >= this.app.max - 1e-9 && this.s.t > 0;
    this.scene.update(this.sc, s, { started, final: atEnd, full: this.app.full, inspectCa: this.inspectCa, selected: this.selection?.type === 'artifact' ? this.selection.id : null });
    $('#s-start').hidden = started; const cap = $('#s-caption'); cap.hidden = !started; cap.tabIndex = -1;
    if (started) {
      const trace = rev ? E.buildTrace(this.sc, s.activeFault) : null;
      cap.textContent = rev ? `Evidence ${s.evidenceIndex + 1} of ${trace.length} · ${trace[s.evidenceIndex].question}` : `Step ${s.stage + 1} of ${this.sc.stages.length} · ${st.title}${st.skipped ? ' · Already present — skipped' : ''}`;
    }
    $('#s-fwd').setAttribute('aria-pressed', String(!rev)); $('#s-rev').setAttribute('aria-pressed', String(rev));
    const play = $('#s-play'); play.setAttribute('aria-pressed', String(!!this.s.playing)); play.innerHTML = this.s.playing ? '&#10073;&#10073; Pause' : '&#9654; Play';
    $('#s-speed').value = String(this.s.playbackSpeed ?? 1);
    // Rail: current milestone shows step dots; finished milestones are marked done. Rewritten only when its state changes (audit W3).
    const railKey = `${this.sc.id}|${this.sc.pathId}|${this.sc.conditionId}|${s.stage}|${s.stageProgress >= 1}|${rev}|${started}`;
    if (railKey !== this.railKey) { this.railKey = railKey; this.syncUrl(s); $$('#s-rail .mchip').forEach((b) => {
      const m = b.dataset.milestone; const idxs = this.sc.stages.map((q, i) => (q.milestone === m ? i : -1)).filter((i) => i >= 0);
      const cur = started && !rev && idxs.includes(s.stage); const done = started && idxs.every((i) => i < s.stage || (i === s.stage && s.stageProgress >= 1));
      b.classList.toggle('current', cur); b.classList.toggle('done', done && !cur); b.setAttribute('aria-current', cur ? 'step' : 'false');
      b.setAttribute('aria-label', `Milestone ${Number(b.dataset.mi) + 1}: ${m}${cur ? ' (current)' : done ? ' (done)' : ''}. Jump to its first step`);
      b.querySelector('.dots').innerHTML = cur ? idxs.map((i) => `<i class="${i < s.stage || (i === s.stage && s.stageProgress >= 1) ? 'd' : ''} ${i === s.stage ? 'c' : ''} ${this.sc.stages[i].skipped ? 'sk' : ''}"></i>`).join('') : '';
    });
    $$('#s-rail .act').forEach((a) => { const chips = [...a.querySelectorAll('.mchip')]; a.classList.toggle('current', chips.some((c) => c.classList.contains('current'))); a.classList.toggle('done', chips.length > 0 && chips.every((c) => c.classList.contains('done'))); }); }
    const banner = $('#fault-banner'); banner.hidden = !s.halted;
    if (s.halted) banner.textContent = `Simulated fault: ${E.getFault(this.sc, s.activeFault).label}. The flow stops at “${st.title}”.`;
    // Final step card: the lesson's ending (result, what is still open, Restart and Reverse evidence).
    const fc = $('#final-card'); fc.hidden = !atEnd;
    if (atEnd) { const f = this.P.finalCardHtml(this.ctx(s)); const fault = this.sc.faults.find((x) => x.id === s.activeFault);
      const open = f.openItems?.length ? `<details${this.fcOpen ? ' open' : ''}><summary>${esc(f.openLabel ?? 'Open items')} (${f.openItems.length})</summary><ul>${f.openItems.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>` : '';
      const html = `<h2>${esc(f.title)}</h2><p>${esc(f.text)}</p><div class="fc-actions"><button class="btn" id="fc-restart">Restart</button><button class="btn primary" id="fc-reverse">Reverse evidence</button>${s.halted && fault?.switchPath ? `<button class="btn" data-switch-path="${fault.switchPath}">Switch to Path A (approved exception)</button>` : ''}</div>${open}`;
      // Rewrite only when the content changes, so the buttons stay attached between animation frames.
      if (this.fcHtml !== html || !fc.firstChild) { this.fcHtml = html; fc.className = `final-card fc-${f.kind}`; fc.innerHTML = html; } }
    Object.assign(document.body.dataset, { stage: st.id, direction: s.direction, fault: s.activeFault, t: this.s.t.toFixed(2), playing: String(!!this.s.playing), full: String(this.app.full), storyPath: this.sc.pathId ?? '', condition: this.sc.conditionId ?? '', started: String(started), panel: this.panelOpen ? 'open' : 'closed', tour: this.app.tour.state });
    this.renderPanel(force);
  }
  renderPanel(force) {
    const s = this.app.state(); const ctx = this.ctx(s); const P = this.P; const S = this.S;
    const key = JSON.stringify([this.sc.id, s.stage, s.direction, s.evidenceIndex, s.activeFault, s.halted, this.sc.pathId, this.sc.conditionId, this.s.started, this.selection, this.panelOpen, this.open, this.token, this.raw, [...this.gloss], s.stageProgress >= 1, innerWidth >= WIDE]);
    if (!force && key === this.lastPanelKey) return; this.lastPanelKey = key;
    const el = $('#spanel'); el.dataset.expanded = String(this.panelOpen);
    if (!this.panelOpen) {
      el.innerHTML = `<button class="ptab popen" aria-expanded="false" aria-controls="spanel" title="Open details">Details</button><div class="psum">${P.summaryHtml(ctx)}<button class="btn small popen" aria-expanded="false">Open details</button></div>`;
      return;
    }
    const order = P.sectionOrder(ctx);
    const body = { plain: () => P.plainHtml(ctx), technical: () => P.technicalHtml(ctx), command: () => P.commandHtml(ctx, this.token), raw: () => P.rawHtml(ctx, this.raw), evidence: () => P.evidenceHtml(ctx), troubleshoot: () => P.troubleshootHtml(ctx) };
    const sel = this.selection?.type === 'artifact' && S.artifacts[this.selection.id] ? S.label(this.selection.id, this.sc.pathId) : null;
    const title = (id) => P.sectionTitle?.(id) ?? P.SECTION_TITLES[id];
    el.innerHTML = `<div class="phead"><h2>${esc(sel ? `Details: ${sel}` : 'Details')}</h2><button class="btn small pclose" aria-label="Close details (Escape)">Close</button></div>
      ${order.map((id, i) => { const open = this.isOpen(id); return `<section class="psec" data-sec="${id}"><h3><button class="disc" data-sec-toggle="${id}" aria-expanded="${open}" aria-controls="sec-${id}" id="h-${id}">${i + 1} · ${esc(title(id))}</button></h3><div class="psec-body" id="sec-${id}" role="region" aria-labelledby="h-${id}" ${open ? '' : 'hidden'}>${open ? body[id]() : ''}</div></section>`; }).join('')}`;
  }
}
