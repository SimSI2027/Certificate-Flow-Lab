// Film entry point. window.__film.setTime(seconds) maps every film timestamp to exactly one canonical state.
import '../ui/styles.css';
import indexHtml from '../../index.html?raw';
import { scenarios } from '../scenarios/index.js';
import { buildFixtureModel, evaluateAll } from '../artifacts/model.js';
import manifest from '../../fixtures/manifests/manifest.json';
import { pathOf } from '../engine/engine.js';
import { frameAt, filmBadge, DURATION, FPS } from './schedule.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl,req,inf}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\/fixtures\//, ''), v]));
const $ = (id) => document.getElementById(id);

// Reuse the real app markup (home + workspace) from index.html.
const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
$('film-mount').replaceWith(...[...doc.body.children].map((n) => document.importNode(n, true)));
$('film-version').textContent = typeof __CFL_VERSION__ !== 'undefined' ? `v${__CFL_VERSION__}` : '';

const model = await buildFixtureModel(files, manifest);
const evidence = {};
for (const sc of scenarios) {
  evidence[sc.id] = await evaluateAll(model, sc);
  for (const pathId of Object.keys(sc.paths ?? {})) evidence[`${sc.id}:${pathId}`] = await evaluateAll(model, pathOf(sc, { pathId }));
}
const { App } = await import('../ui/app.js');
const app = new App({ scenarios, model, evidence, texts: files, params: new URLSearchParams('film=1') });

function setTime(time) {
  const f = frameAt(time);
  if (f.screen === 'home') { if (app.screen !== 'home') app.showHome(); }
  else {
    if (app.screen !== 'workspace' || app.base?.id !== f.scenario) app.startScenario(f.scenario, { full: false });
    app.full = f.full;
    // Every lesson is a story since v0.5.0; the DC lesson also fixes its path and condition.
    const ctl = app.storyCtl; const dcPath = app.base.paths ? { pathId: 'csr', conditionId: 'trust-missing' } : {};
    Object.assign(app.session, { faultId: 'healthy', playing: false, playbackSpeed: 1, selectedFlow: null, started: true, ...dcPath }, f.session);
    ctl.applyPath(false); ctl.clearSelection();
    if (f.select) { ctl.selection = f.select; if (f.select.type === 'artifact') app.session.selectedArtifact = f.select.id; ctl.inspectCa = ['ica', 'root'].includes(f.select.id); }
    ctl.panelOpen = !!f.panel; ctl.open = { plain: true, technical: !!f.select, evidence: f.segment === 'reverse' };
    ctl.buildControls();
    app.render(true);
  }
  const s = app.sc && app.screen === 'workspace' ? app.state() : null;
  // The badge is derived from the canonical state, never from the film clock.
  const badge = filmBadge(s, f.segment, !$('final-card').hidden);
  $('film-badge').textContent = badge; $('film-badge').style.display = badge ? 'block' : 'none';
  $('film-title').style.opacity = String(f.titleOpacity); $('film-outro').style.opacity = String(f.outroOpacity);
  return s ? { stage: s.stage, direction: s.direction, evidenceIndex: s.evidenceIndex, trust: s.trustDecision, screen: app.screen, scenario: app.base.id } : { screen: app.screen };
}

window.__film = { duration: DURATION, fps: FPS, setTime, ready: true };
setTime(0);
