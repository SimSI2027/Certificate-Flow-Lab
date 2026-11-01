import './ui/styles.css';
import { scenarios } from './scenarios/index.js';
import { buildFixtureModel, evaluateAll } from './artifacts/model.js';
import manifest from '../fixtures/manifests/manifest.json';
import { App } from './ui/app.js';
import { pathOf } from './engine/engine.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl,req,inf}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\/fixtures\//, ''), v]));

try {
  const model = await buildFixtureModel(files, manifest);
  const evidence = {};
  for (const sc of scenarios) {
    evidence[sc.id] = await evaluateAll(model, sc);
    // Story scenarios: evidence per path (pathOf view), keyed "<scenario>:<path>".
    for (const pathId of Object.keys(sc.paths ?? {})) evidence[`${sc.id}:${pathId}`] = await evaluateAll(model, pathOf(sc, { pathId }));
  }
  new App({ scenarios, model, evidence, texts: files, params: new URLSearchParams(location.search) });
} catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Failed to start: ${String(err.message ?? err)}</pre>`);
}
