import './ui/styles.css';
import scenario from './scenarios/tls-manual-enrollment.js';
import { buildFixtureModel, evaluateAll } from './artifacts/model.js';
import manifest from '../fixtures/manifests/manifest.json';
import { App } from './ui/app.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl}', { query: '?raw', import: 'default', eager: true });

const strip = (p) => p.replace(/^\/fixtures\//, '');
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [strip(k), v]));

const info = document.getElementById('build-info');
if (info) info.textContent = `· v${__CFL_VERSION__} (${String(__CFL_COMMIT__).slice(0, 7)})`;

try {
  const model = await buildFixtureModel(files, manifest);
  const evidence = await evaluateAll(model, scenario);
  new App({ scenario, model, evidence, texts: files, params: new URLSearchParams(location.search) });
} catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Failed to start: ${String(err.message ?? err)}</pre>`);
}
