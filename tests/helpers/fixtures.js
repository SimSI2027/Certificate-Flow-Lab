import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureModel, evaluateAll } from '../../src/artifacts/model.js';
import scenario from '../../src/scenarios/tls-manual-enrollment.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const manifest = JSON.parse(readFileSync(join(root, 'fixtures/manifests/manifest.json'), 'utf8'));
let cache;
export async function loadModel() {
  if (cache) return cache;
  const files = {};
  for (const m of manifest.artifacts) files[m.pemFilename] = readFileSync(join(root, 'fixtures', m.pemFilename), 'utf8');
  const model = await buildFixtureModel(files, manifest);
  cache = { model, evidence: await evaluateAll(model, scenario), scenario };
  return cache;
}
export { scenario, existsSync, readFileSync };
