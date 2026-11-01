// Application controller: scenario home + focused flow workspace. The session is the only mutable simulation input;
// everything on screen is rendered from computeState().
import * as E from '../engine/engine.js';
import { Scene } from '../views/scene.js';
import { spriteHtml, legendHtml } from '../views/icons.js';
import { entityById } from '../entities/entities.js';
import { describeEntity, describeFlow, describeOtherArtifact, esc } from './details.js';
import { explainHtml, evidenceHtml, troubleshootHtml, friendlyHtml, fixtureFor } from './teach.js';
import { tabsFor, tabId, renderTab } from '../inspectors/inspector.js';
import { Tour, TOUR_RESUME_MS } from '../tour/tour.js';
import { Native } from './native.js';
import { nativeIdForFilename } from '../artifacts/native-ids.js';
import { COMING_LATER } from '../scenarios/index.js';
import { StoryController } from './story-app.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const base = (p) => p.split('/').pop();
const TABS = ['explain', 'details', 'inspector', 'evidence', 'troubleshoot'];

export class App {
  constructor({ scenarios, model, evidence, texts, params = new URLSearchParams() }) {
    this.scenarios = scenarios; this.byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
    this.model = model; this.evidenceMap = evidence; this.texts = texts; this.blobs = {}; this.params = params;
    this.screen = 'home'; this.tab = 'explain'; this.inspTab = null; this.lastKey = ''; this.lastFrame = 0; this.full = params.get('full') === '1'; this.last = null;
    document.body.insertAdjacentHTML('afterbegin', spriteHtml());
    this.scene = new Scene($('#scene'), (sel) => this.select(sel));
    this.native = new Native();
    this.tour = new Tour([], this.tourApi(), { resumeMs: Number(params.get('tourResume')) || TOUR_RESUME_MS });
    this.storyCtl = new StoryController(this); this.storyMode = false; this.sigs = {}; this.sigList = [];
    this.computeSigs().then(() => this.render(true));
    this.bind(); this.renderHome();
    if (!params.has('film')) this.native.init(() => this.render(true));
    const want = params.get('scenario');
    if (want && this.byId[want]) this.startScenario(want, { params });
    requestAnimationFrame((ts) => this.frame(ts));
    window.__cfl = { app: this, getState: () => (this.sc ? this.state() : null), get session() { return window.__cfl.app.session; }, tour: this.tour };
  }

  // ---------- canonical state ----------
  state() { return E.computeState(this.base ?? this.sc, this.session); }
  // Live signature checks for the certification-path view (computed once from the parsed fixtures).
  async computeSigs() {
    const ica = this.model.resolve('ica', null)?.parsed, root = this.model.resolve('root', null)?.parsed; if (!ica || !root) return;
    for (const e of Object.values(this.model.byFilename)) {
      const c = e.parsed; if (c.kind !== 'certificate') continue;
      const byIca = await c.x509.verify({ publicKey: ica.x509, signatureOnly: true }).catch(() => false);
      const byRoot = await c.x509.verify({ publicKey: root.x509, signatureOnly: true }).catch(() => false);
      const self = c.selfSigned;
      this.sigs[c.thumbprints.sha256] = { byIca, byRoot, self };
    }
  }
  chainOf(c, id) {
    const root = this.model.resolve('root', null).parsed, ica = this.model.resolve('ica', null).parsed; const s = this.sigs;
    const rootLink = { name: `${root.subject.split(',')[0]} (Root CA, self-signed)`, ok: !!s[root.thumbprints.sha256]?.self, text: 'self-signature verifies' };
    const icaLink = { name: `${ica.subject.split(',')[0]} (Issuing CA)`, ok: !!s[ica.thumbprints.sha256]?.byRoot, text: 'signed by the Root CA (verified)' };
    if (id === 'root') return c.thumbprints.sha256 === root.thumbprints.sha256 ? [rootLink] : [{ name: `${c.subject.split(',')[0]} (file under review)`, ok: false, text: '' }];
    if (id === 'ica') return [rootLink, icaLink];
    return [rootLink, icaLink, { name: c.subject ? `${c.subject.split(',')[0]} (DC01 leaf)` : 'DC01 leaf (empty subject)', ok: !!s[c.thumbprints.sha256]?.byIca, text: 'signed by the Issuing CA (verified)' }];
  }
  downloadLinks(fx) {
    const m = fx.manifest, parsed = fx.parsed;
    if (!['certificate', 'csr', 'crl', 'p7b', 'inf', 'chain'].includes(parsed.kind)) return '';
    const pairs = [[m.filename, false], [m.pemFilename, true]].filter(([f], i, arr) => arr.findIndex(([g]) => g === f) === i);
    return `<div class="downloads">${pairs.map(([f, isPem]) => `<a class="btn small" data-download="${esc(base(f))}" href="${this.blobUrl(m, parsed, isPem)}" download="${esc(base(f))}">Download ${esc(base(f))}</a>`).join('')}</div>`;
  }
  get max() { return this.session.direction === 'reverse' ? E.buildTrace(this.sc, this.session.faultId).length : E.maxT(this.sc, this.session.faultId); }
  get tKey() { return this.session.direction === 'reverse' ? 'tReverse' : 't'; }
  get tVal() { return this.session[this.tKey]; }
  setT(v) { this.session[this.tKey] = E.clampT(v, this.max); }
  ctx(s = this.state()) { return { scenario: this.sc, state: s, model: this.model, evidence: this.evidence, ev: this.evidence[s.activeFault] }; }

  // ---------- screens ----------
  renderHome() {
    const cards = this.scenarios.map((sc) => `<article class="scard" data-scenario="${sc.id}"><span class="avail">Available</span><h2>${esc(sc.title)}</h2><p class="sub">${esc(sc.subtitle)}</p>
      <dl class="kv small"><dt>Purpose</dt><dd>${esc(sc.home.purpose)}</dd><dt>Primary requester</dt><dd>${esc(sc.home.requester)}</dd><dt>Certificate destination</dt><dd>${esc(sc.home.destination)}</dd><dt>Enrollment method</dt><dd>${esc(sc.home.method)}</dd><dt>Steps</dt><dd>${sc.paths ? Object.values(sc.paths).map((p) => `${esc(p.pathLabel)}: ${p.stages.length} steps`).join(' · ') : `${sc.stages.length} steps`}</dd></dl>
      <button class="btn primary big" data-start="${sc.id}">Start scenario</button></article>`).join('');
    $('#home').innerHTML = `<header class="htop"><h1>Certificate Flow Lab</h1><p class="subtitle">Interactive certificate issuance, deployment and trust visualization</p>
      <p class="synthetic-note" role="note">Synthetic simulation: SIMSI2027 names, addresses and events are invented; nothing here connects to a real PKI.</p></header>
      <section aria-label="Choose a scenario"><h2 class="sr-only">Scenarios</h2><div class="cards">${cards}</div></section>
      <div class="home-actions"><button class="btn" id="btn-continue" ${this.last ? '' : 'hidden'}>Continue last scenario</button><button class="btn" id="btn-topology">View full PKI topology</button><button class="btn" id="btn-about">About the simulator</button></div>
      <section class="later" aria-label="Coming later"><h3>Coming later</h3><ul>${COMING_LATER.map((c) => `<li aria-disabled="true">${esc(c.title)}</li>`).join('')}</ul></section>
      <footer class="hfoot"><span id="build-info"></span></footer>
      <dialog id="about"><h2>About the simulator</h2><p>Certificate Flow Lab is an educational simulation of certificate enrollment, deployment and trust validation. All names, addresses and events are synthetic. Certificate, CSR and CRL files are real but generated only for this project; no private keys are distributed.</p>
        <h3>Icon legend</h3><p class="muted">Custom icons drawn for this project; they are not official Microsoft icons.</p>${legendHtml()}<form method="dialog"><button class="btn primary">Close</button></form></dialog>`;
    const info = $('#build-info'); if (info && typeof __CFL_VERSION__ !== 'undefined') info.textContent = `v${__CFL_VERSION__} (${String(__CFL_COMMIT__).slice(0, 7)})`;
  }

  showHome() {
    this.pause(); this.tour.stop(); if (this.sc) this.last = { id: this.sc.id, session: this.session }; this.screen = 'home'; this.renderHome();
    $('#home').hidden = false; $('#workspace').hidden = true; document.body.dataset.screen = 'home'; document.body.dataset.scenario = ''; document.body.dataset.layout = '';
    // Home has no lesson position: drop the story parameters so a refresh shows the home screen.
    if (this.storyMode && !this.params.has('film') && location.search) history.replaceState(null, '', `${location.pathname}${location.hash}`);
    this.storyMode = false;
  }

  startScenario(id, { params, full } = {}) {
    const sc = this.byId[id]; if (!sc) return;
    if (this.sc && this.sc.id !== id && this.session) this.last = { id: this.sc.id, session: this.session };
    this.base = sc; this.sc = sc; this.evidence = this.evidenceMap[id]; this.storyMode = sc.layoutMode === 'story-zones';
    document.body.dataset.layout = this.storyMode ? 'story' : 'classic';
    const p = params ?? new URLSearchParams();
    if (this.storyMode) {
      this.session = { faultId: 'healthy', direction: 'forward', t: 0, tReverse: 0, selectedEntity: null, selectedArtifact: null, selectedFlow: null, playbackSpeed: 1, playing: false };
      if (full !== undefined) this.full = full;
      this.tour.steps = sc.tour; this.tour.state = 'idle';
      this.screen = 'workspace'; $('#home').hidden = true; $('#workspace').hidden = false; document.body.dataset.screen = 'workspace'; document.body.dataset.scenario = id;
      this.storyCtl.start(p); this.renderTour(); return;
    }
    const fault = p.get('fault');
    this.session = { faultId: fault && sc.faults.some((f) => f.id === fault) ? fault : 'healthy', direction: p.get('dir') === 'reverse' ? 'reverse' : 'forward', t: Number(p.get('t')) || 0, tReverse: 0,
      selectedEntity: null, selectedArtifact: null, selectedFlow: null, playbackSpeed: 1, playing: false };
    if (full !== undefined) this.full = full;
    this.tour.steps = sc.tour; this.tour.state = 'idle'; this.tab = 'explain'; this.inspTab = null;
    this.scene.load(sc); this.scene.setLabels($('#chk-labels').checked);
    this.screen = 'workspace'; $('#home').hidden = true; $('#workspace').hidden = false; document.body.dataset.screen = 'workspace'; document.body.dataset.scenario = id;
    $('#ws-title').textContent = sc.title; $('#ws-sub').textContent = sc.subtitle;
    $('#chk-topology').checked = this.full;
    this.buildStaticControls(); this.renderTour(); this.render(true);
  }

  // ---------- playback ----------
  frame(ts) {
    const dt = Math.min(0.1, (ts - (this.lastFrame || ts)) / 1000); this.lastFrame = ts;
    if (this.screen === 'workspace' && this.session.playing) {
      this.setT(E.advanceT(this.tVal, dt, this.session.playbackSpeed, this.max));
      if (this.tVal >= this.max) { this.session.playing = false; if (this.storyMode) this.render(true); }
    }
    if (this.screen === 'workspace') this.render();
    requestAnimationFrame((t) => this.frame(t));
  }
  play() { if (this.tVal >= this.max) this.setT(0); this.session.playing = true; }
  pause() { if (this.session) this.session.playing = false; }
  stepForward() { this.pause(); this.setT(E.stepForwardT(this.tVal, this.max)); }
  stepBackward() { this.pause(); this.setT(E.stepBackwardT(this.tVal, this.max)); }
  restart() { this.pause(); this.session.t = 0; this.session.tReverse = 0; this.clearSelection(); }
  seekStage(i, complete = true) { this.setT(complete ? E.stageEndT(i) : E.stageStartT(i)); }
  setDirection(d) { this.pause(); this.session.direction = d; if (d === 'reverse') { this.session.tReverse = Math.min(this.session.tReverse, this.max); this.tab = 'evidence'; } this.buildJump(); }
  setFault(id) { this.pause(); this.session.faultId = id; this.session.t = 0; this.session.tReverse = 0; this.clearSelection(); this.buildJump(); }
  setSpeed(v) { this.session.playbackSpeed = v; }
  clearSelection() { Object.assign(this.session, { selectedEntity: null, selectedArtifact: null, selectedFlow: null }); }

  select(sel) {
    if (this.storyMode) { this.storyCtl.select(sel); return; }
    this.clearSelection(); const ss = this.session;
    if (sel.type === 'entity') { ss.selectedEntity = sel.id; this.tab = 'explain'; }
    else if (sel.type === 'flow') { ss.selectedFlow = sel.id; this.tab = 'details'; }
    else if (sel.type === 'artifact') { ss.selectedArtifact = sel.id; const a = this.sc.artifacts.find((x) => x.id === sel.id); this.tab = a?.inspectable ? 'inspector' : 'details'; this.inspTab = null; }
    this.render(true);
  }

  // ---------- controls ----------
  bind() {
    const click = (id, fn) => $(id).addEventListener('click', fn);
    click('#btn-play', () => { this.play(); this.render(true); }); click('#btn-pause', () => { this.pause(); this.render(true); });
    click('#btn-step-fwd', () => { this.stepForward(); this.render(true); }); click('#btn-step-back', () => { this.stepBackward(); this.render(true); });
    click('#btn-restart', () => { this.restart(); this.render(true); });
    click('#btn-mode-forward', () => { this.setDirection('forward'); this.render(true); }); click('#btn-mode-reverse', () => { this.setDirection('reverse'); this.render(true); });
    click('#btn-reset-camera', () => this.scene.resetCamera());
    click('#btn-back', () => this.showHome());
    click('#btn-tour', () => { if (this.tour.state === 'running' || this.tour.state === 'paused') this.tour.stop(); else this.tour.start(); this.render(true); });
    click('#btn-tour-resume', () => this.tour.resume());
    $('.s-tour-resume')?.addEventListener('click', () => this.tour.resume());
    $('#chk-labels').addEventListener('change', (e) => this.scene.setLabels(e.target.checked));
    $('#chk-topology').addEventListener('change', (e) => { this.full = e.target.checked; this.render(true); });
    $$('[data-speed]').forEach((b) => b.addEventListener('click', () => { this.setSpeed(Number(b.dataset.speed)); this.render(true); }));
    $('#scrubber').addEventListener('input', (e) => { this.pause(); this.setT(Number(e.target.value) / 100); this.render(true); });
    $('#sel-jump').addEventListener('change', (e) => { this.pause(); this.setT(Number(e.target.value)); this.render(true); });
    $('#sel-fault').addEventListener('change', (e) => { this.setFault(e.target.value); this.render(true); });
    $$('[data-tabbtn]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tabbtn; this.render(true); }));
    $('#side').addEventListener('click', (e) => this.sideClick(e));
    $('#home').addEventListener('click', (e) => {
      const st = e.target.closest('[data-start]'); if (st) { this.startScenario(st.dataset.start, { full: false }); return; }
      if (e.target.closest('#btn-continue') && this.last) {
        this.startScenario(this.last.id, { full: false }); Object.assign(this.session, this.last.session, { playing: false });
        if (this.storyMode) { this.storyCtl.applyPath(false); this.storyCtl.buildControls(); } else this.buildJump();
        this.render(true); return;
      }
      if (e.target.closest('#btn-topology')) { this.startScenario(this.last?.id ?? this.scenarios[0].id, { full: true }); return; }
      if (e.target.closest('#btn-about')) $('#about').showModal();
    });
    document.addEventListener('keydown', (e) => {
      if (this.screen !== 'workspace' || this.storyMode) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Escape') return;
      if (e.key === ' ' && e.target.tagName !== 'BUTTON' && !e.target.closest?.('[role=button]')) { e.preventDefault(); this.session.playing ? this.pause() : this.play(); this.render(true); }
      if (e.key === 'ArrowRight' && !e.target.closest?.('[role=tablist]')) { this.stepForward(); this.render(true); }
      if (e.key === 'ArrowLeft' && !e.target.closest?.('[role=tablist]')) { this.stepBackward(); this.render(true); }
    });
    const interrupt = (e) => { if (e.target.closest?.('#btn-tour, #btn-tour-resume, #s-tour, .s-tour-resume')) return; this.tour.interrupt(); };
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'input', 'change']) document.addEventListener(ev, interrupt, true);
  }

  sideClick(e) {
    const open = e.target.closest('[data-open]');
    if (open) { const [type, id] = open.dataset.open.split(':'); this.select({ type, id }); return; }
    const tab = e.target.closest('[data-tab]'); if (tab) { this.inspTab = tab.dataset.tab; this.render(true); return; }
    const nat = e.target.closest('[data-native]'); if (nat && !nat.disabled) { this.native.open(nat.dataset.native).then(() => this.render(true)); return; }
    const ev = e.target.closest('[data-evidence]');
    if (ev) { this.pause(); if (this.session.direction !== 'reverse') this.session.direction = 'reverse'; this.session.tReverse = Number(ev.dataset.evidence) + 1; this.tab = 'evidence'; this.buildJump(); this.render(true); }
  }

  buildStaticControls() {
    const f = $('#sel-fault'); f.innerHTML = this.sc.faults.map((x) => `<option value="${x.id}">${esc(x.id === 'healthy' ? 'Healthy (no fault)' : x.label)}</option>`).join(''); f.value = this.session.faultId;
    const groups = []; this.sc.stages.forEach((s, i) => { const g = groups.at(-1); if (g?.name === s.phase) g.items.push(i); else groups.push({ name: s.phase, items: [i] }); });
    $('#rail').innerHTML = groups.map((g) => `<div class="grp" data-group="${esc(g.name)}"><span class="gl">${esc(g.name)}</span><span class="dots">${g.items.map((i) => `<button class="tick" data-tick="${i}" aria-label="Step ${i + 1}: ${esc(this.sc.stages[i].title)}" title="${esc(this.sc.stages[i].title)}">${i + 1}</button>`).join('')}</span></div>`).join('');
    $$('#rail .tick').forEach((b) => b.addEventListener('click', () => { this.pause(); if (this.session.direction === 'forward') { this.seekStage(Number(b.dataset.tick)); this.render(true); } }));
    this.buildJump();
  }
  buildJump() {
    const j = $('#sel-jump');
    if (this.session.direction === 'reverse') j.innerHTML = E.buildTrace(this.sc, this.session.faultId).map((e, i) => `<option value="${i + 1}">${i + 1}. ${esc(e.question)}</option>`).join('');
    else j.innerHTML = E.reachableStages(this.sc, this.session.faultId).map((s) => `<option value="${s.index + 1}">${s.index + 1}. ${esc(s.phase)}: ${esc(s.title)}</option>`).join('');
    $('#scrubber').max = String(Math.round(this.max * 100)); $('#sel-fault').value = this.session.faultId;
    $$('#rail .tick').forEach((b, i) => b.classList.toggle('blocked', this.session.direction === 'forward' && i >= this.max));
  }

  // ---------- rendering ----------
  render(force = false) {
    if (this.screen !== 'workspace') return;
    if (this.storyMode) { this.storyCtl.render(force); return; }
    const s = this.state(); const c = this.ctx(s);
    this.scene.update(s, { full: this.full });
    const rev = s.direction === 'reverse'; const trace = rev ? E.buildTrace(this.sc, s.activeFault) : null; const st = this.sc.stages[s.stage];
    const sc = $('#scrubber'); if (document.activeElement !== sc || force) sc.value = String(Math.round(this.tVal * 100));
    $('#btn-play').disabled = this.session.playing; $('#btn-pause').disabled = !this.session.playing;
    $('#btn-mode-forward').setAttribute('aria-pressed', String(!rev)); $('#btn-mode-reverse').setAttribute('aria-pressed', String(rev));
    $$('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === this.session.playbackSpeed)));
    $('#sel-jump').value = String(rev ? s.evidenceIndex + 1 : Math.min(this.max, s.stage + 1));
    $$('#rail .tick').forEach((b, i) => { b.classList.toggle('done', !rev && this.tVal >= i + 1); b.classList.toggle('current', !rev && s.stage === i && this.tVal > 0 && this.tVal < i + 1); b.classList.toggle('fail', s.halted && !rev && i === s.stage); b.setAttribute('aria-current', !rev && s.stage === i ? 'step' : 'false'); });
    $$('#rail .grp').forEach((g) => g.classList.toggle('active', !rev && [...g.querySelectorAll('.tick')].some((b) => Number(b.dataset.tick) === s.stage)));
    const started = this.tVal > 0;
    $('#step-count').textContent = rev ? `Evidence ${s.evidenceIndex + 1} of ${trace.length}` : `Step ${s.stage + 1} of ${this.sc.stages.length}`;
    $('#step-title').textContent = rev ? trace[s.evidenceIndex].question : st.title;
    $('#step-purpose').textContent = rev ? trace[s.evidenceIndex].claim : st.narrative;
    $('#step-bar').style.width = `${Math.round((started ? s.stageProgress : 0) * 100)}%`;
    $('#pos-label').textContent = started ? `${Math.round(s.stageProgress * 100)}% of this step` : 'Not started';
    $('#fault-banner').hidden = !s.halted;
    if (s.halted) $('#fault-banner').textContent = `Simulated failure: ${E.getFault(this.sc, s.activeFault).label}. The flow stops at “${this.sc.stages[E.stageIndex(this.sc, E.getFault(this.sc, s.activeFault).failStage)].title}”.`;
    Object.assign(document.body.dataset, { stage: st.id, direction: s.direction, fault: s.activeFault, t: this.tVal.toFixed(2), playing: String(this.session.playing), tour: this.tour.state, full: String(this.full) });
    const key = JSON.stringify([{ ...s, stageProgress: 0 }, this.tab, this.inspTab, this.full]);
    if (force || key !== this.lastKey) { this.lastKey = key; this.renderPanels(s, c); }
  }

  technical(id, c) { return describeEntity(id, c); } // classic layout (TLS); the DC story renders its own panel

  renderPanels(s, c) {
    $$('[data-tabbtn]').forEach((b) => { const on = b.dataset.tabbtn === this.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $(`#panel-${b.dataset.tabbtn}`).hidden = !on; });
    const sel = { entity: s.selectedEntity, flow: s.selectedFlow };
    $('#panel-explain').innerHTML = explainHtml(c, sel);
    const dEl = $('#panel-details'); const st = this.sc.stages[s.stage];
    if (s.selectedEntity) dEl.innerHTML = this.technical(s.selectedEntity, c);
    else if (s.selectedFlow) dEl.innerHTML = describeFlow(s.selectedFlow, c);
    else if (s.selectedArtifact && !this.sc.artifacts.find((a) => a.id === s.selectedArtifact)?.inspectable) dEl.innerHTML = describeOtherArtifact(s.selectedArtifact, c);
    else dEl.innerHTML = this.technical(st.focus.entity, c);
    this.renderInspector(s, c);
    $('#panel-evidence').innerHTML = evidenceHtml(c);
    $('#panel-troubleshoot').innerHTML = troubleshootHtml(c);
  }

  blobUrl(m, parsed, isPem) {
    const key = isPem ? m.pemFilename : m.filename;
    if (!this.blobs[key]) this.blobs[key] = URL.createObjectURL(isPem ? new Blob([this.texts[m.pemFilename]], { type: 'text/plain' }) : new Blob([parsed.der], { type: 'application/octet-stream' }));
    return this.blobs[key];
  }

  nativeBlock(m, parsed) {
    if (parsed.kind !== 'certificate') return '';
    const id = nativeIdForFilename(m.filename); if (!id) return '';
    const n = this.native; const ok = n.ready && n.ids.includes(id);
    return `<div class="native"><button class="btn small" data-native="${id}" ${ok ? '' : 'disabled'}>Open in Windows Certificate Viewer</button> <span class="muted" data-native-note>${esc(n.note())}</span></div>`;
  }

  renderInspector(s, c) {
    const el = $('#panel-inspector'); const st = this.sc.stages[s.stage];
    const id = s.selectedArtifact ?? st.focus.artifact;
    const a = this.sc.artifacts.find((x) => x.id === id);
    if (!a?.inspectable) {
      const avail = this.sc.artifacts.filter((x) => x.inspectable);
      el.innerHTML = `<h2>Artifact</h2><p class="synth-note">Click a CSR, certificate, CRL or chain item in the scene (gold or blue labels) to inspect the real file. Only public artifacts exist here; no private key is stored in this project.</p><p>${avail.map((x) => `<button class="linkbtn" data-open="artifact:${x.id}">${esc(x.label)}</button>`).join(' ')}</p>`; return;
    }
    const fx = fixtureFor(c, id); const parsed = fx.parsed; const m = fx.manifest; const tabs = tabsFor(parsed);
    const cur = tabs.find((t) => tabId(t) === this.inspTab) ?? tabs[0];
    const dl = [[m.filename, false], [m.pemFilename, true]].filter(([f], i, arr) => arr.findIndex(([g]) => g === f) === i)
      .map(([f, isPem]) => `<a class="btn small" data-download="${esc(base(f))}" href="${this.blobUrl(m, parsed, isPem)}" download="${esc(base(f))}">Download ${esc(base(f))}</a>`).join('');
    const chainDl = id === 'leaf' ? (() => { const cf = this.model.resolve('chain', null); return cf ? `<a class="btn small" data-download="${esc(base(cf.manifest.filename))}" href="${this.blobUrl(cf.manifest, cf.parsed, true)}" download="${esc(base(cf.manifest.filename))}">Download chain</a>` : ''; })() : '';
    const title = parsed.kind === 'chain' ? 'Certificate chain file' : parsed.kind === 'inf' ? 'Teaching request policy' : parsed.subject ?? parsed.issuer;
    el.innerHTML = `<h2>${esc(a.label)}</h2><p class="syn">Demonstration fixture, synthetic, parsed from <span class="mono">${esc(m.filename)}</span>.</p>${friendlyHtml(c, id)}<p class="insp-title">${esc(title)}</p>
      <div class="downloads">${dl}${chainDl}</div>${this.nativeBlock(m, parsed)}
      <div role="tablist" class="tabs" aria-label="Inspector tabs">${tabs.map((t) => `<button role="tab" class="tab" data-tab="${tabId(t)}" aria-selected="${t === cur}">${esc(t)}</button>`).join('')}</div>
      <div class="tabpanel" role="tabpanel" data-active-tab="${tabId(cur)}">${renderTab(parsed, cur, c)}</div>`;
  }

  // ---------- tour ----------
  tourApi() {
    const app = this;
    return {
      guard: (fn) => fn(), speed: () => app.session?.playbackSpeed ?? 1,
      applyTourStep(step) {
        const ss = app.session; const idx = E.stageIndex(app.sc, step.stage);
        if (app.storyMode) { ss.started = true; app.storyCtl.clearSelection(); }
        if (ss.faultId !== 'healthy') { ss.faultId = 'healthy'; app.buildJump(); }
        app.clearSelection();
        if (step.reverse) { app.setDirection('reverse'); ss.tReverse = 0; app.tab = 'evidence'; ss.playing = true; }
        else {
          if (ss.direction !== 'forward') app.setDirection('forward');
          ss.t = idx === 0 ? 0 : E.stageEndT(idx - 1); ss.playing = true; app.tab = 'explain';
          if (step.select?.entity) ss.selectedEntity = step.select.entity;
          if (step.select?.artifact) { ss.selectedArtifact = step.select.artifact; app.tab = 'inspector'; app.inspTab = null; }
        }
        app.render(true);
      },
      tourStepDone(step) {
        if (step.reverse) return app.session.tReverse >= 4 || !app.session.playing;
        const idx = E.stageIndex(app.sc, step.stage);
        return app.session.t >= E.stageEndT(idx) - 1e-6 || !app.session.playing;
      },
      handoff() { app.setDirection('forward'); app.session.t = app.max; app.clearSelection(); app.session.selectedEntity = app.sc.stages.at(-1).focus.entity; app.tab = 'explain'; app.pause(); app.render(true); },
      onTourChange() { app.renderTour(); }
    };
  }
  renderTour() {
    const t = this.tour; const bar = $('#tour-bar'); const btn = $('#btn-tour'); if (!bar) return;
    const active = t.state === 'running' || t.state === 'paused';
    btn.textContent = active ? 'Stop tour' : 'Guided tour'; btn.setAttribute('aria-pressed', String(active));
    bar.hidden = t.state === 'idle';
    const step = t.step ?? { title: '', text: '' };
    $('#tour-step').textContent = t.state === 'finished' ? 'Tour finished' : `Tour ${t.index + 1}/${t.steps.length}: ${step.title}`;
    $('#tour-text').textContent = t.state === 'finished' ? 'You are in control. Explore any object, mode or failure scenario.' : t.state === 'paused' ? `Tour paused by your interaction. It resumes after ${Math.round(t.resumeMs / 1000)} s of inactivity.` : step.text;
    $('#btn-tour-resume').hidden = t.state !== 'paused'; document.body.dataset.tour = t.state;
    // Story mode mirrors the tour state into its own bar.
    const sb = $('.s-tour-bar'); if (sb) {
      sb.hidden = t.state === 'idle'; $('.s-tour-step').textContent = $('#tour-step').textContent; $('.s-tour-text').textContent = $('#tour-text').textContent; $('.s-tour-resume').hidden = t.state !== 'paused';
      const sbtn = $('#s-tour'); sbtn.textContent = active ? 'Stop tour' : 'Guided tour'; sbtn.setAttribute('aria-pressed', String(active));
    }
  }
}
void entityById; void TABS;
