// Film entry point. window.__film.setTime(seconds) maps every film timestamp to exactly one canonical state.
import '../ui/styles.css';
import { scenarios } from '../scenarios/index.js';
import { buildFixtureModel, evaluateAll } from '../artifacts/model.js';
import manifest from '../../fixtures/manifests/manifest.json';
import { App } from '../ui/app.js';
import { frameAt, DURATION, FPS, SCENARIO_ID } from './schedule.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl,req,inf}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\/fixtures\//, ''), v]));
const $ = (id) => document.getElementById(id);

const model = await buildFixtureModel(files, manifest);
const evidence = {};
for (const sc of scenarios) evidence[sc.id] = await evaluateAll(model, sc);
const app = new App({ scenarios, model, evidence, texts: files, params: new URLSearchParams('film=1') });

function setTime(time) {
  const f = frameAt(time);
  if (f.screen === 'home') { if (app.screen !== 'home') app.showHome(); }
  else {
    if (app.screen !== 'workspace' || app.sc.id !== SCENARIO_ID) app.startScenario(SCENARIO_ID, { full: false });
    app.full = f.full; $('chk-topology').checked = f.full;
    Object.assign(app.session, { faultId: 'healthy', playing: false, playbackSpeed: 1, selectedFlow: null }, f.session);
    app.tab = f.tab; app.inspTab = f.inspTab; app.render(true);
  }
  const s = app.sc ? app.state() : null;
  // The badge is derived from the canonical state, never from the film clock.
  $('film-badge').style.display = s && app.screen === 'workspace' && s.direction === 'forward' && s.trustDecision === 'trusted' && f.segment === 'forward' ? 'block' : 'none';
  $('film-title').style.opacity = String(f.titleOpacity); $('film-outro').style.opacity = String(f.outroOpacity);
  return s ? { stage: s.stage, direction: s.direction, evidenceIndex: s.evidenceIndex, trust: s.trustDecision, screen: app.screen } : { screen: app.screen };
}

window.__film = { duration: DURATION, fps: FPS, setTime, ready: true };
setTime(0);
