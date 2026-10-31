// Film entry point. Exposes window.__film.setTime(seconds): every film timestamp maps to exactly one canonical state.
import '../ui/styles.css';
import scenario from '../scenarios/tls-manual-enrollment.js';
import { buildFixtureModel, evaluateAll } from '../artifacts/model.js';
import manifest from '../../fixtures/manifests/manifest.json';
import { App } from '../ui/app.js';
import { buildTrace } from '../engine/engine.js';
import { frameAt, DURATION, FPS } from './schedule.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\/fixtures\//, ''), v]));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const model = await buildFixtureModel(files, manifest);
const evidence = await evaluateAll(model, scenario);
const app = new App({ scenario, model, evidence, texts: files, params: new URLSearchParams('film=1') });
const trace = buildTrace(scenario, 'healthy');

function setTime(time) {
  const f = frameAt(time);
  Object.assign(app.session, { faultId: 'healthy', playing: false, playbackSpeed: 1, selectedFlow: null }, f.session);
  app.panel = f.panel; app.inspTab = f.inspTab;
  const k = f.cam.k;
  Object.assign(app.scene.cam, { x: -k * (f.cam.cx - 800), y: -k * (f.cam.cy - 450), k });
  app.scene.applyCam();
  app.render(true);
  const s = app.state();
  // Captions are derived from the canonical state, so they cannot disagree with what is shown.
  const rev = s.direction === 'reverse';
  const st = scenario.stages[s.stage];
  $('film-caption').innerHTML = f.segment === 'title' || f.segment === 'outro' ? '' : rev
    ? `<span class="ph">Evidence ${s.evidenceIndex + 1}/${trace.length}</span>${esc(trace[s.evidenceIndex].question)}`
    : `<span class="ph">${esc(st.phase)}</span>${esc(st.title)}`;
  $('film-caption').style.display = f.segment === 'title' || f.segment === 'outro' ? 'none' : 'block';
  $('film-badge').style.display = !rev && s.trustDecision === 'trusted' && f.segment === 'forward' ? 'block' : 'none';
  const chips = ['visitorState', 'requestState', 'keyState', 'csrState', 'templateDecision', 'issuanceState', 'certificateState', 'installationState', 'iisBindingState', 'connectionState', 'chainState', 'aiaState', 'revocationState', 'trustDecision'];
  $('film-state').innerHTML = f.segment === 'title' || f.segment === 'outro' ? '' : chips.map((k) => `<span>${k.replace('State', '')}: <b>${esc(s[k])}</b></span>`).join('');
  $('film-title').style.opacity = String(f.titleOpacity);
  $('film-outro').style.opacity = String(f.outroOpacity);
  return { stage: s.stage, direction: s.direction, evidenceIndex: s.evidenceIndex, trust: s.trustDecision };
}

window.__film = { duration: DURATION, fps: FPS, setTime, ready: true };
setTime(0);
