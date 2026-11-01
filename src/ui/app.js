// Application controller: scenario home + story workspace (every lesson uses the story-zone layout since v0.5.0). The session is the only
// mutable simulation input; everything on screen is rendered from computeState().
import * as E from '../engine/engine.js';
import { spriteHtml, legendHtml } from '../views/icons.js';
import { esc } from './story-panel.js';
import { Tour, TOUR_RESUME_MS } from '../tour/tour.js';
import { Native } from './native.js';
import { nativeIdForFilename } from '../artifacts/native-ids.js';
import { COMING_LATER } from '../scenarios/index.js';
import { StoryController } from './story-app.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const base = (p) => p.split('/').pop();

export class App {
  constructor({ scenarios, model, evidence, texts, params = new URLSearchParams() }) {
    this.scenarios = scenarios; this.byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
    this.model = model; this.evidenceMap = evidence; this.texts = texts; this.blobs = {}; this.params = params;
    this.screen = 'home'; this.lastFrame = 0; this.full = params.get('full') === '1'; this.last = null;
    document.body.insertAdjacentHTML('afterbegin', spriteHtml());
    this.native = new Native();
    this.tour = new Tour([], this.tourApi(), { resumeMs: Number(params.get('tourResume')) || TOUR_RESUME_MS });
    this.storyCtl = new StoryController(this); this.storyMode = false; this.sigs = {};
    this.computeSigs().then(() => { if (this.screen === 'workspace') this.render(true); });
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
      this.sigs[c.thumbprints.sha256] = { byIca, byRoot, self: c.selfSigned };
    }
  }
  // Certification path for the Domain Controller panel (the TLS panel builds its own from ctx.sigs).
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
  get max() { return this.session.direction === 'reverse' ? E.buildTrace(this.sc, this.session.faultId).length : E.maxT(this.sc, this.session.faultId); }
  get tKey() { return this.session.direction === 'reverse' ? 'tReverse' : 't'; }
  get tVal() { return this.session[this.tKey]; }
  setT(v) { this.session[this.tKey] = E.clampT(v, this.max); }

  // ---------- screens ----------
  // Multi-path scenarios (the DC story) start from a path picker; the lesson condition is stated up front.
  pathPicker(sc) {
    const desc = { csr: 'DC01 cannot reach the CA. Carry the CSR through PKI-TRANSFER01 under change control.', mmc: 'DC01 can reach the CA. Enroll from Certificates (Local Computer) as DC01$.' };
    const cond = sc.conditions?.find((c) => c.id === sc.defaultCondition);
    return `<div class="paths" role="group" aria-label="Start ${esc(sc.title)}">${Object.values(sc.paths).map((p, i) => `<button class="pathpick" data-start="${sc.id}" data-start-path="${p.pathId}">
      <span class="pl">${i === 0 ? 'A' : 'B'}</span><strong>Start Path ${i === 0 ? 'A' : 'B'}: ${esc(p.pathLabel)}</strong><span class="pd">${esc(desc[p.pathId] ?? '')} ${p.stages.length} steps.</span></button>`).join('')}
      ${cond ? `<p class="cond">Path A starts with “${esc(cond.label)}”: ${esc(cond.note.toLowerCase())}. You can change it in the lesson.</p>` : ''}</div>`;
  }
  renderHome() {
    const steps = (sc) => (sc.paths ? Object.values(sc.paths).map((p) => `${esc(p.pathLabel)}: ${p.stages.length} steps`).join(' · ') : `${sc.stages.length} steps${sc.acts ? ` in ${sc.acts.length} acts (${sc.acts.map((a) => esc(a.title)).join(', ')})` : ''}`);
    const cards = this.scenarios.map((sc) => `<article class="scard" data-scenario="${sc.id}"><span class="avail">Available</span><h2>${esc(sc.title)}</h2><p class="sub">${esc(sc.subtitle)}</p>
      <dl class="kv small"><dt>Purpose</dt><dd>${esc(sc.home.purpose)}</dd><dt>Primary requester</dt><dd>${esc(sc.home.requester)}</dd><dt>Certificate destination</dt><dd>${esc(sc.home.destination)}</dd><dt>Enrollment method</dt><dd>${esc(sc.home.method)}</dd><dt>Steps</dt><dd>${steps(sc)}</dd></dl>
      ${sc.paths ? this.pathPicker(sc) : `<button class="btn primary big" data-start="${sc.id}">Start ${esc(sc.title)}</button>`}</article>`).join('');
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
    this.pause(); this.tour.stop(); if (this.sc) this.last = { id: this.base.id, session: this.session }; this.screen = 'home'; this.renderHome();
    $('#home').hidden = false; $('#workspace').hidden = true; document.body.dataset.screen = 'home'; document.body.dataset.scenario = ''; document.body.dataset.layout = '';
    // Home has no lesson position: drop the lesson parameters so a refresh shows the home screen.
    if (!this.params.has('film') && location.search) history.replaceState(null, '', `${location.pathname}${location.hash}`);
    this.storyMode = false;
  }

  startScenario(id, { params, full } = {}) {
    const sc = this.byId[id]; if (!sc) return;
    if (this.sc && this.base?.id !== id && this.session) this.last = { id: this.base.id, session: this.session };
    this.base = sc; this.sc = sc; this.evidence = this.evidenceMap[id]; this.storyMode = true;
    document.body.dataset.layout = 'story';
    this.session = { faultId: 'healthy', direction: 'forward', t: 0, tReverse: 0, selectedEntity: null, selectedArtifact: null, selectedFlow: null, playbackSpeed: 1, playing: false };
    if (full !== undefined) this.full = full;
    this.tour.steps = sc.tour; this.tour.state = 'idle';
    this.screen = 'workspace'; $('#home').hidden = true; $('#workspace').hidden = false; document.body.dataset.screen = 'workspace'; document.body.dataset.scenario = id;
    this.storyCtl.start(params ?? new URLSearchParams()); this.renderTour();
  }

  // ---------- playback ----------
  frame(ts) {
    const dt = Math.min(0.1, (ts - (this.lastFrame || ts)) / 1000); this.lastFrame = ts;
    if (this.screen === 'workspace' && this.session.playing) {
      this.setT(E.advanceT(this.tVal, dt, this.session.playbackSpeed, this.max));
      if (this.tVal >= this.max) { this.session.playing = false; this.render(true); }
    }
    if (this.screen === 'workspace') this.render();
    requestAnimationFrame((t) => this.frame(t));
  }
  play() { if (this.tVal >= this.max) this.setT(0); this.session.playing = true; }
  pause() { if (this.session) this.session.playing = false; }
  clearSelection() { Object.assign(this.session, { selectedEntity: null, selectedArtifact: null, selectedFlow: null }); }
  select(sel) { this.storyCtl.select(sel); }

  // ---------- controls ----------
  bind() {
    $('.s-tour-resume')?.addEventListener('click', () => this.tour.resume());
    // Skip link: focus whichever main landmark is visible (home or the story workspace).
    $('[data-skip]')?.addEventListener('click', (e) => { e.preventDefault(); const m = $$('main').find((x) => x.offsetParent !== null); if (m) { e.currentTarget.setAttribute('href', `#${m.id}`); m.focus(); m.scrollIntoView?.({ block: 'start' }); } });
    // Keep the skip-link target pointing at the visible main landmark.
    new MutationObserver(() => { const m = $$('main').find((x) => x.offsetParent !== null); if (m) $('[data-skip]')?.setAttribute('href', `#${m.id}`); }).observe(document.body, { attributes: true, attributeFilter: ['data-screen', 'data-layout'] });
    $('#home').addEventListener('click', (e) => {
      const st = e.target.closest('[data-start]'); if (st) { this.startScenario(st.dataset.start, { full: false, params: st.dataset.startPath ? new URLSearchParams({ path: st.dataset.startPath }) : undefined }); return; }
      if (e.target.closest('#btn-continue') && this.last) {
        this.startScenario(this.last.id, { full: false }); Object.assign(this.session, this.last.session, { playing: false });
        this.storyCtl.applyPath(false); this.storyCtl.buildControls(); this.render(true); return;
      }
      if (e.target.closest('#btn-topology')) { this.startScenario(this.last?.id ?? this.scenarios[0].id, { full: true, params: new URLSearchParams('start=1&t=1') }); return; }
      if (e.target.closest('#btn-about')) $('#about').showModal();
    });
    const interrupt = (e) => { if (e.target.closest?.('#s-tour, .s-tour-resume')) return; this.tour.interrupt(); };
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'input', 'change']) document.addEventListener(ev, interrupt, true);
  }

  // ---------- rendering ----------
  render(force = false) { if (this.screen === 'workspace') this.storyCtl.render(force); }

  // ---------- tour ----------
  tourApi() {
    const app = this;
    return {
      guard: (fn) => fn(), speed: () => app.session?.playbackSpeed ?? 1,
      applyTourStep(step) {
        const ss = app.session; const idx = E.stageIndex(app.sc, step.stage);
        ss.started = true; app.storyCtl.clearSelection();
        if (ss.faultId !== 'healthy') ss.faultId = 'healthy';
        if (step.reverse) { app.storyCtl.setDirection('reverse'); ss.tReverse = 0; ss.playing = true; }
        else { ss.direction = 'forward'; ss.t = idx === 0 ? 0 : E.stageEndT(idx - 1); ss.playing = true; if (step.select?.artifact) ss.selectedArtifact = step.select.artifact; }
        app.render(true);
      },
      tourStepDone(step) {
        if (step.reverse) return app.session.tReverse >= 4 || !app.session.playing;
        const idx = E.stageIndex(app.sc, step.stage);
        return app.session.t >= E.stageEndT(idx) - 1e-6 || !app.session.playing;
      },
      handoff() { app.session.direction = 'forward'; app.session.t = app.max; app.storyCtl.clearSelection(); app.pause(); app.render(true); },
      onTourChange() { app.renderTour(); }
    };
  }
  renderTour() {
    const t = this.tour; const active = t.state === 'running' || t.state === 'paused'; document.body.dataset.tour = t.state;
    const sb = $('.s-tour-bar'); if (!sb) return;
    const step = t.step ?? { title: '', text: '' };
    sb.hidden = t.state === 'idle';
    $('.s-tour-step').textContent = t.state === 'finished' ? 'Tour finished' : `Tour ${t.index + 1}/${t.steps.length}: ${step.title}`;
    $('.s-tour-text').textContent = t.state === 'finished' ? 'You are in control. Explore any object, mode or fault.' : t.state === 'paused' ? `Tour paused by your interaction. It resumes after ${Math.round(t.resumeMs / 1000)} s of inactivity.` : step.text;
    $('.s-tour-resume').hidden = t.state !== 'paused';
    const sbtn = $('#s-tour'); sbtn.textContent = active ? 'Stop tour' : 'Guided tour'; sbtn.setAttribute('aria-pressed', String(active));
  }
}
