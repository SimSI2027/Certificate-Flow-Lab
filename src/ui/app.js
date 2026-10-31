// Application controller. Owns the session (the only mutable simulation input) and renders everything from computeState().
import * as E from '../engine/engine.js';
import { Scene } from '../views/scene.js';
import { entityById } from '../entities/entities.js';
import { describeEntity, describeFlow, describeOtherArtifact, faultExplanation, esc } from './details.js';
import { tabsFor, tabId, renderTab } from '../inspectors/inspector.js';
import { Tour, TOUR_RESUME_MS } from '../tour/tour.js';
import { ENV } from '../artifacts/synthetic.js';
import { Native } from './native.js';
import { nativeIdForFilename } from '../artifacts/native-ids.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const base = (p) => p.split('/').pop();

export class App {
  constructor({ scenario, model, evidence, texts, params = new URLSearchParams() }) {
    this.sc = scenario; this.model = model; this.evidence = evidence; this.texts = texts; this.blobs = {};
    this.session = { faultId: params.get('fault') && scenario.faults.some((f) => f.id === params.get('fault')) ? params.get('fault') : 'healthy', direction: params.get('dir') === 'reverse' ? 'reverse' : 'forward',
      t: Number(params.get('t')) || 0, tReverse: 0, selectedEntity: null, selectedArtifact: null, selectedFlow: null, playbackSpeed: 1, playing: false };
    this.panel = 'overview'; this.inspTab = null; this.lastKey = ''; this.lastFrame = 0;
    this.scene = new Scene($('#scene'), (sel) => this.select(sel), scenario);
    this.tour = new Tour(scenario.tour, this.tourApi(), { resumeMs: Number(params.get('tourResume')) || TOUR_RESUME_MS });
    this.native = new Native();
    this.bind(); this.buildStaticControls();
    if (!params.has('film')) this.native.init(() => this.render(true));
    this.render(true);
    requestAnimationFrame((ts) => this.frame(ts));
    window.__cfl = { app: this, getState: () => this.state(), session: this.session, tour: this.tour };
  }

  // ---- canonical state ----
  state() { return E.computeState(this.sc, this.session); }
  get max() { return this.session.direction === 'reverse' ? E.buildTrace(this.sc, this.session.faultId).length : E.maxT(this.sc, this.session.faultId); }
  get tKey() { return this.session.direction === 'reverse' ? 'tReverse' : 't'; }
  get tVal() { return this.session[this.tKey]; }
  setT(v) { this.session[this.tKey] = E.clampT(v, this.max); }
  ctx(s = this.state()) { return { scenario: this.sc, state: s, model: this.model, evidence: this.evidence, ev: this.evidence[s.activeFault], }; }

  // ---- playback ----
  frame(ts) {
    const dt = Math.min(0.1, (ts - (this.lastFrame || ts)) / 1000); this.lastFrame = ts;
    if (this.session.playing) {
      this.setT(E.advanceT(this.tVal, dt, this.session.playbackSpeed, this.max));
      if (this.tVal >= this.max) this.session.playing = false;
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }
  play() { if (this.tVal >= this.max) this.setT(0); this.session.playing = true; }
  pause() { this.session.playing = false; }
  stepForward() { this.pause(); this.setT(E.stepForwardT(this.tVal, this.max)); }
  stepBackward() { this.pause(); this.setT(E.stepBackwardT(this.tVal, this.max)); }
  restart() { this.pause(); this.session.t = 0; this.session.tReverse = 0; this.clearSelection(); }
  seekStage(i, complete = true) { this.setT(complete ? E.stageEndT(i) : E.stageStartT(i)); }
  setDirection(d) { this.pause(); this.session.direction = d; if (d === 'reverse') this.session.tReverse = Math.min(this.session.tReverse, this.max); this.buildJump(); this.panel = d === 'reverse' ? 'evidence' : this.panel; }
  setFault(id) { this.pause(); this.session.faultId = id; this.session.t = 0; this.session.tReverse = 0; this.clearSelection(); this.buildJump(); }
  setSpeed(v) { this.session.playbackSpeed = v; }
  clearSelection() { Object.assign(this.session, { selectedEntity: null, selectedArtifact: null, selectedFlow: null }); }

  select(sel) {
    this.clearSelection();
    const ss = this.session;
    if (sel.type === 'entity') { ss.selectedEntity = sel.id; this.panel = 'details'; }
    else if (sel.type === 'flow') { ss.selectedFlow = sel.id; this.panel = 'details'; }
    else if (sel.type === 'artifact') {
      ss.selectedArtifact = sel.id;
      const a = this.sc.artifacts.find((x) => x.id === sel.id);
      this.panel = a?.inspectable ? 'inspector' : 'details'; this.inspTab = null;
    }
    this.render(true);
  }

  // ---- controls ----
  bind() {
    const click = (id, fn) => $(id).addEventListener('click', fn);
    click('#btn-play', () => { this.play(); this.render(true); });
    click('#btn-pause', () => { this.pause(); this.render(true); });
    click('#btn-step-fwd', () => { this.stepForward(); this.render(true); });
    click('#btn-step-back', () => { this.stepBackward(); this.render(true); });
    click('#btn-restart', () => { this.restart(); this.render(true); });
    click('#btn-mode-forward', () => { this.setDirection('forward'); this.render(true); });
    click('#btn-mode-reverse', () => { this.setDirection('reverse'); this.render(true); });
    click('#btn-reset-camera', () => this.scene.resetCamera());
    click('#btn-tour', () => { if (this.tour.state === 'running' || this.tour.state === 'paused') this.tour.stop(); else this.tour.start(); this.render(true); });
    click('#btn-tour-resume', () => { this.tour.resume(); });
    $('#chk-labels').addEventListener('change', (e) => this.scene.setLabels(e.target.checked));
    $$('[data-speed]').forEach((b) => b.addEventListener('click', () => { this.setSpeed(Number(b.dataset.speed)); this.render(true); }));
    $('#scrubber').addEventListener('input', (e) => { this.pause(); this.setT(Number(e.target.value) / 100); this.render(true); });
    $('#sel-jump').addEventListener('change', (e) => { this.pause(); this.setT(Number(e.target.value)); this.render(true); });
    $('#sel-fault').addEventListener('change', (e) => { this.setFault(e.target.value); this.render(true); });
    $('#sel-scenario').addEventListener('change', (e) => { e.target.value = this.sc.id; });
    $$('[data-panel]').forEach((b) => b.addEventListener('click', () => { this.panel = b.dataset.panel; this.render(true); }));
    $('#side').addEventListener('click', (e) => this.sideClick(e));
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Escape') return;
      if (e.key === ' ' && e.target.tagName !== 'BUTTON' && !e.target.closest?.('[role=button]')) { e.preventDefault(); this.session.playing ? this.pause() : this.play(); this.render(true); }
      if (e.key === 'ArrowRight' && !e.target.closest?.('[role=tablist]')) { this.stepForward(); this.render(true); }
      if (e.key === 'ArrowLeft' && !e.target.closest?.('[role=tablist]')) { this.stepBackward(); this.render(true); }
    });
    // any user interaction pauses the guided tour (the tour's own start/stop buttons excepted)
    const interrupt = (e) => { if (e.target.closest?.('#btn-tour, #btn-tour-resume')) return; this.tour.interrupt(); };
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'input', 'change']) document.addEventListener(ev, interrupt, true);
  }

  sideClick(e) {
    const open = e.target.closest('[data-open]');
    if (open) { const [type, id] = open.dataset.open.split(':'); this.select({ type, id }); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { this.inspTab = tab.dataset.tab; this.render(true); return; }
    const nat = e.target.closest('[data-native]');
    if (nat && !nat.disabled) { this.native.open(nat.dataset.native).then(() => this.render(true)); return; }
    const ev = e.target.closest('[data-evidence]');
    if (ev) { this.pause(); if (this.session.direction !== 'reverse') this.session.direction = 'reverse'; this.session.tReverse = Number(ev.dataset.evidence) + 1; this.panel = 'evidence'; this.buildJump(); this.render(true); }
  }

  buildStaticControls() {
    const f = $('#sel-fault'); f.innerHTML = this.sc.faults.map((x) => `<option value="${x.id}">${esc(x.id === 'healthy' ? 'Healthy (no fault)' : x.label)}</option>`).join('');
    f.value = this.session.faultId;
    const sc = $('#sel-scenario');
    sc.innerHTML = `<option value="${this.sc.id}">${esc(this.sc.title)} (${this.sc.id})</option>` + this.sc.futureScenarios.map((id) => `<option value="${id}" disabled>${id} — planned</option>`).join('');
    sc.value = this.sc.id;
    $('#phase-band').innerHTML = this.sc.stages.map((s, i) => `<button class="tick" data-tick="${i}" title="${esc(s.title)}" aria-label="Jump to stage ${i + 1}: ${esc(s.title)}"></button>`).join('');
    $$('#phase-band .tick').forEach((b) => b.addEventListener('click', () => { this.pause(); if (this.session.direction === 'forward') { this.seekStage(Number(b.dataset.tick)); this.render(true); } }));
    this.buildJump();
  }
  buildJump() {
    const j = $('#sel-jump');
    if (this.session.direction === 'reverse') {
      j.innerHTML = E.buildTrace(this.sc, this.session.faultId).map((e, i) => `<option value="${i + 1}">${i + 1}. ${esc(e.question)}</option>`).join('');
    } else {
      j.innerHTML = E.reachableStages(this.sc, this.session.faultId).map((s) => `<option value="${s.index + 1}">${s.index + 1}. ${esc(s.phase)} · ${esc(s.title)}</option>`).join('');
    }
    $('#scrubber').max = String(Math.round(this.max * 100));
    $('#sel-fault').value = this.session.faultId;
    const blocked = this.session.direction === 'forward' ? this.sc.stages.length - this.max : 0;
    $('#phase-band').style.setProperty('--blocked', String(blocked));
    $$('#phase-band .tick').forEach((b, i) => b.classList.toggle('blocked', this.session.direction === 'forward' && i >= this.max));
  }

  // Public downloads are generated client-side from the parsed fixtures (no private material exists to leak).
  blobUrl(m, parsed, isPem) {
    const key = isPem ? m.pemFilename : m.filename;
    if (!this.blobs[key]) this.blobs[key] = URL.createObjectURL(isPem ? new Blob([this.texts[m.pemFilename]], { type: 'application/x-pem-file' }) : new Blob([parsed.der], { type: 'application/octet-stream' }));
    return this.blobs[key];
  }

  // ---- rendering ----
  render(force = false) {
    const s = this.state(); const c = this.ctx(s);
    this.scene.update(s, c);
    const rev = s.direction === 'reverse';
    const trace = rev ? E.buildTrace(this.sc, s.activeFault) : null;
    const posLabel = rev ? `${trace[s.evidenceIndex].question}` : `${s.stage + 1}/${this.sc.stages.length} ${this.sc.stages[s.stage].title}${s.stageProgress < 1 && this.tVal > 0 ? ` (${Math.round(s.stageProgress * 100)}%)` : ''}`;
    const sc = $('#scrubber'); if (document.activeElement !== sc || force) sc.value = String(Math.round(this.tVal * 100));
    sc.setAttribute('aria-valuetext', posLabel);
    $('#pos-label').textContent = this.tVal === 0 ? 'Start' : posLabel;
    $('#btn-play').disabled = this.session.playing; $('#btn-pause').disabled = !this.session.playing;
    $('#btn-mode-forward').setAttribute('aria-pressed', String(!rev)); $('#btn-mode-reverse').setAttribute('aria-pressed', String(rev));
    $$('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === this.session.playbackSpeed)));
    $('#sel-jump').value = String(rev ? s.evidenceIndex + 1 : Math.min(this.max, s.stage + 1));
    $$('#phase-band .tick').forEach((b, i) => { b.classList.toggle('done', !rev && this.tVal >= i + 1); b.classList.toggle('current', !rev && s.stage === i && this.tVal > 0 && this.tVal < i + 1); b.classList.toggle('fail', s.halted && !rev && i === s.stage); });
    $('#fault-banner').hidden = !s.halted; if (s.halted) $('#fault-banner').textContent = `Simulated failure: ${E.getFault(this.sc, s.activeFault).label} — progression stops at “${this.sc.stages[E.stageIndex(this.sc, E.getFault(this.sc, s.activeFault).failStage)].title}”.`;
    document.body.dataset.stage = this.sc.stages[s.stage].id; document.body.dataset.direction = s.direction; document.body.dataset.fault = s.activeFault; document.body.dataset.t = this.tVal.toFixed(2);
    document.body.dataset.playing = String(this.session.playing); document.body.dataset.tour = this.tour.state;
    const key = JSON.stringify([{ ...s, stageProgress: 0 }, this.panel, this.inspTab]);
    if (force || key !== this.lastKey) { this.lastKey = key; this.renderPanels(s, c); }
    const pb = $('#panel-overview .progress-bar'); if (pb) pb.style.width = `${Math.round(s.stageProgress * 100)}%`;
  }

  renderPanels(s, c) {
    $$('[data-panel]').forEach((b) => { const on = b.dataset.panel === this.panel; b.setAttribute('aria-selected', String(on)); $(`#panel-${b.dataset.panel}`).hidden = !on; });
    // overview
    const st = this.sc.stages[s.stage]; const rev = s.direction === 'reverse';
    const fields = ['visitorState', 'requestState', 'keyState', 'csrState', 'templateDecision', 'issuanceState', 'certificateState', 'installationState', 'iisBindingState', 'connectionState', 'chainState', 'aiaState', 'revocationState', 'trustDecision', 'activeFault'];
    $('#panel-overview').innerHTML = `
      <section class="card"><div class="phase-chip">${esc(st.phase)}</div><h2>${s.stage + 1}. ${esc(st.title)}</h2><p>${esc(st.narrative)}</p>
      ${rev ? `<p class="muted">Reverse evidence mode: the world is shown in its final state while the trace walks backward through the evidence that explains it.</p>` : '<div class="progress"><div class="progress-bar"></div></div>'}</section>
      ${faultExplanation(c)}
      <section class="card"><h3>Canonical scenario state</h3><dl class="kv state" id="state-table">${['direction', 'stage', 'stageProgress'].map((k) => `<dt>${k}</dt><dd data-k="${k}">${k === 'stage' ? esc(`${s.stage} (${st.id})`) : k === 'stageProgress' ? s.stageProgress.toFixed(2) : esc(s[k])}</dd>`).join('')}
      ${fields.map((k) => `<dt>${k}</dt><dd data-k="${k}">${esc(s[k])}</dd>`).join('')}</dl></section>`;
    // details
    const dEl = $('#panel-details');
    if (s.selectedEntity) dEl.innerHTML = describeEntity(s.selectedEntity, c);
    else if (s.selectedFlow) dEl.innerHTML = describeFlow(s.selectedFlow, c);
    else if (s.selectedArtifact && !this.sc.artifacts.find((a) => a.id === s.selectedArtifact)?.inspectable) dEl.innerHTML = describeOtherArtifact(s.selectedArtifact, c);
    else dEl.innerHTML = `<h2>Details</h2><p class="synth-note">Click any object in the scene — the visitor, CLIENT01, the application owner, WEB01, the template gate, the CAs, PKIWEB01, an arrow, or a moving artifact — to see its details here.</p>`;
    this.renderInspector(s, c);
    this.renderEvidence(s, c);
  }

  renderInspector(s, c) {
    const el = $('#panel-inspector');
    const a = this.sc.artifacts.find((x) => x.id === s.selectedArtifact);
    if (!a?.inspectable) { el.innerHTML = '<h2>Artifact inspector</h2><p class="synth-note">Click a certificate, CSR, CRL or chain artifact (gold or blue chips) to inspect the real fixture file. Only public artifacts are available; no private keys exist in this project.</p>'; return; }
    const fx = this.model.resolve(a.fixtureRole, s.activeFault);
    const parsed = fx.parsed; const tabs = tabsFor(parsed);
    const cur = tabs.find((t) => tabId(t) === this.inspTab) ?? tabs[0];
    const m = fx.manifest;
    const dl = [[m.filename, false], [m.pemFilename, true]].filter(([f], i, arr) => arr.findIndex(([g]) => g === f) === i)
      .map(([f, isPem]) => `<a class="btn small" data-download="${esc(base(f))}" href="${this.blobUrl(m, parsed, isPem)}" download="${esc(base(f))}">Download ${esc(base(f))}</a>`).join('');
    const chainDl = a.id === 'leaf' ? (() => { const cf = this.model.resolve('chain', null); return `<a class="btn small" data-download="${esc(base(cf.manifest.filename))}" href="${this.blobUrl(cf.manifest, cf.parsed, true)}" download="${esc(base(cf.manifest.filename))}">Download chain</a>`; })() : '';
    const title = parsed.kind === 'chain' ? 'Certificate chain file' : parsed.subject ?? parsed.issuer;
    el.innerHTML = `<h2>${esc(a.label)}</h2><p class="syn">Demonstration fixture — synthetic, parsed from <span class="mono">${esc(m.filename)}</span>.</p><p class="insp-title">${esc(title)}</p>
      <div class="downloads">${dl}${chainDl}</div>
      ${this.nativeBlock(m, parsed)}
      <div role="tablist" class="tabs" aria-label="Inspector tabs">${tabs.map((t) => `<button role="tab" class="tab" data-tab="${tabId(t)}" aria-selected="${t === cur}">${esc(t)}</button>`).join('')}</div>
      <div class="tabpanel" role="tabpanel" data-active-tab="${tabId(cur)}">${renderTab(parsed, cur, c)}</div>`;
  }

  renderEvidence(s, c) {
    const el = $('#panel-evidence');
    const trace = E.buildTrace(this.sc, s.activeFault);
    const rev = s.direction === 'reverse';
    el.innerHTML = `<h2>Evidence trace</h2><p class="muted">${rev ? 'Reverse mode: each step cites the evidence that explains the one before it.' : 'Switch to “Reverse evidence” to walk this trace. Click an item to jump to it.'}</p>
      <ol class="trace">${trace.map((e, i) => {
        const checks = c.ev.checks.filter((k) => k.stage === e.stage && (e.id === 'verdict' ? k.status === 'fail' : true) && ['validate', 'chain-build', 'root-trust', 'revocation', 'install'].includes(k.stage));
        return `<li class="${rev && i === s.evidenceIndex ? 'current' : ''} ${e.verdict === 'fail' ? 'fail' : ''}"><button class="trace-btn" data-evidence="${i}"><span class="q">${esc(e.question)}</span><span class="a">${esc(e.claim)}</span></button>
          ${rev && i === s.evidenceIndex ? `<div class="evi"><p class="muted">Forward stage: ${esc(this.sc.stages[e.stageIndex].title)}${e.entity ? ` · ${esc(entityById[e.entity].label)}` : ''}</p>
          ${checks.map((k) => `<p><span class="pill pill-${k.status === 'pass' ? 'ok' : 'fail'}">${k.status}</span> ${esc(k.label)} — ${esc(k.detail)}</p>`).join('')}
          ${e.artifact ? `<p>${this.sc.artifacts.find((a) => a.id === e.artifact)?.inspectable ? `<button class="linkbtn" data-open="artifact:${e.artifact}">Inspect ${esc(this.sc.artifacts.find((a) => a.id === e.artifact).label)}</button>` : `<button class="linkbtn" data-open="artifact:${e.artifact}">View ${esc(e.artifact)}</button>`}</p>` : ''}
          ${e.entity ? `<p><button class="linkbtn" data-open="entity:${e.entity}">Open ${esc(entityById[e.entity].label)}</button></p>` : ''}</div>` : ''}</li>`;
      }).join('')}</ol>`;
  }

  // Native Windows viewer control: certificates only; operational only when the local companion is reachable.
  nativeBlock(m, parsed) {
    if (parsed.kind !== 'certificate') return '';
    const id = nativeIdForFilename(m.filename);
    if (!id) return '';
    const n = this.native;
    const ok = n.ready && n.ids.includes(id);
    return `<div class="native"><button class="btn small" data-native="${id}" ${ok ? '' : 'disabled'}>Open in Windows Certificate Viewer</button> <span class="muted" data-native-note>${esc(n.note())}</span></div>`;
  }

  // ---- tour ----
  tourApi() {
    const app = this;
    return {
      guard: (fn) => fn(),
      speed: () => app.session.playbackSpeed,
      applyTourStep(step) {
        const ss = app.session; const idx = E.stageIndex(app.sc, step.stage);
        if (ss.faultId !== 'healthy') { ss.faultId = 'healthy'; app.buildJump(); }
        app.clearSelection();
        if (step.reverse) {
          app.setDirection('reverse'); ss.tReverse = 0; app.panel = 'evidence'; ss.playing = true;
        } else {
          if (ss.direction !== 'forward') app.setDirection('forward');
          ss.t = idx === 0 ? 0 : E.stageEndT(idx - 1); ss.playing = true;
          if (step.select?.entity) { ss.selectedEntity = step.select.entity; app.panel = 'details'; }
          if (step.select?.artifact) { ss.selectedArtifact = step.select.artifact; app.panel = 'inspector'; app.inspTab = null; }
          if (!step.select) app.panel = 'overview';
        }
        app.render(true);
      },
      tourStepDone(step) {
        if (step.reverse) return app.session.tReverse >= 4 || !app.session.playing;
        const idx = E.stageIndex(app.sc, step.stage);
        return app.session.t >= E.stageEndT(idx) - 1e-6 || !app.session.playing;
      },
      handoff() {
        app.setDirection('forward'); app.session.t = app.max; app.clearSelection(); app.session.selectedEntity = 'visitor'; app.panel = 'details'; app.pause(); app.render(true);
      },
      onTourChange(t) { app.renderTour(); }
    };
  }
  renderTour() {
    const t = this.tour; const bar = $('#tour-bar'); const btn = $('#btn-tour');
    btn.textContent = t.state === 'running' || t.state === 'paused' ? 'Stop tour' : 'Guided tour';
    btn.setAttribute('aria-pressed', String(t.state === 'running' || t.state === 'paused'));
    bar.hidden = t.state === 'idle';
    const step = t.step;
    $('#tour-step').textContent = t.state === 'finished' ? 'Tour finished' : `Tour ${t.index + 1}/${t.steps.length}: ${step.title}`;
    $('#tour-text').textContent = t.state === 'finished' ? 'You are in control. Explore any object, mode or failure scenario.' : t.state === 'paused' ? `Tour paused by your interaction — resumes after ${Math.round(t.resumeMs / 1000)} s of inactivity.` : step.text;
    $('#btn-tour-resume').hidden = t.state !== 'paused';
    document.body.dataset.tour = t.state;
  }
}
