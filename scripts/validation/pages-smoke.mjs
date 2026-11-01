// Repository-base-path smoke test: dist must reference assets under /Certificate-Flow-Lab/ and contain them.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
const BASE = '/Certificate-Flow-Lab/';
let fail = 0;
const check = (ok, m) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${m}`); if (!ok) fail++; };

const html = readFileSync(join(dist, 'index.html'), 'utf8');
// In-page fragments (the skip link's "#home") are not asset requests; every other reference must sit under the base path.
const all = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
const fragments = all.filter((u) => u.startsWith('#'));
const refs = all.filter((u) => !u.startsWith('#'));
check(fragments.every((f) => /^#[a-z][\w-]*$/i.test(f) && html.includes(`id="${f.slice(1)}"`)), `in-page links resolve to elements: ${fragments.join(', ') || 'none'}`);
check(refs.length >= 2, `index.html references ${refs.length} assets`);
for (const r of refs) {
  check(r.startsWith(BASE), `asset url under base: ${r}`);
  check(existsSync(join(dist, r.slice(BASE.length))), `asset exists in dist: ${r}`);
}
// v0.6.0: two entry pages share chunks, so every script the app page references is scanned together.
const js = refs.filter((r) => r.endsWith('.js')).map((r) => readFileSync(join(dist, r.slice(BASE.length)), 'utf8')).join('\n');
check(js.includes('BEGIN CERTIFICATE'), 'bundle embeds the public certificate fixtures');
check(!/PRIVATE KEY-----/.test(js) && !/PRIVATE KEY-----/.test(html), 'bundle contains no private key markers');
check(!js.includes('127.0.0.1:5184/open') || js.includes('companion'), 'native viewer is only reachable through the local companion probe');
// v0.6.0: the learning film page is published next to the app, with assets under the base path and no private key markers.
const filmPath = join(dist, 'learning-film.html');
check(existsSync(filmPath), 'learning-film.html is in dist');
if (existsSync(filmPath)) {
  const fh = readFileSync(filmPath, 'utf8');
  const frefs = [...fh.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:') && !u.startsWith('#') && u !== './');
  check(frefs.length >= 1 && frefs.every((r) => r.startsWith(BASE) && existsSync(join(dist, r.slice(BASE.length)))), `learning film assets under base and present: ${frefs.length}`);
  check(fh.includes('href="./"'), 'learning film links back to the app');
  check(!/PRIVATE KEY-----/.test(fh), 'learning film page has no private key markers');
}
check(html.includes('learning-film.html') || js.includes('learning-film.html'), 'home screen links to the learning film');
const v = JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8'));
check(/^[0-9a-f]{40}$/.test(v.commit) || v.commit === 'unknown', `version.json commit ${v.commit.slice(0, 7)} v${v.version}`);
process.exit(fail ? 1 : 0);
