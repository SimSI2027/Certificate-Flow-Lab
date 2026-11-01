// Visual review (v0.4.1): captures the release screen set at 1920x1080 and 1366x768, in light and dark colour schemes, into the
// git-ignored screenshots/visual-review/ folder, and fails on: horizontal scroll, overlapping text boxes, rendered text below
// 11 px, a story step whose active-connector count is not exactly what the step defines (1 when it moves something, else 0),
// story elements or controls outside the scene or viewport, and page errors.
// Usage: npm run review:visual [-- --scheme light|dark] [-- --only <name-substring>]   (starts its own Vite server on 127.0.0.1:5187)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dc from '../../src/scenarios/dc-manual-certificate-request.js';
import tls from '../../src/scenarios/tls-manual-enrollment.js';
import { pathOf } from '../../src/engine/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'screenshots', 'visual-review'); mkdirSync(outDir, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SIZES = [[1920, 1080], [1366, 768]];
const SCHEMES = arg('--scheme') ? [arg('--scheme')] : ['light', 'dark'];
const ONLY = arg('--only');
const MIN_PX = 11;
const DC = `scenario=${dc.id}`;
const click = (sel) => async (p) => { await p.locator(sel).first().click(); await p.waitForTimeout(250); };

// Representative step per milestone: the last (non-skipped) step of each milestone, in its completed state.
function milestoneShots(pathId) {
  const v = pathOf(dc, { pathId });
  return v.milestones.map((m, mi) => { const idx = v.stages.map((s, i) => (s.milestone === m ? i : -1)).filter((i) => i >= 0); const i = idx.at(-1);
    return { name: `${pathId === 'csr' ? 'A' : 'B'}${String(mi + 1).padStart(2, '0')}-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, query: `${DC}&path=${pathId}&t=${i + 1}` }; });
}
const TL = `scenario=${tls.id}`;
// TLS: the last step of each milestone, completed (milestone 10's last step is the final card).
function tlsMilestoneShots() {
  return tls.milestones.map((m, mi) => { const idx = tls.stages.map((s, i) => (s.milestone === m ? i : -1)).filter((i) => i >= 0); const i = idx.at(-1);
    return { name: `W${String(mi + 1).padStart(2, '0')}-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`, query: `${TL}&t=${i + 1}` }; });
}
export const SHOTS = [
  { name: 'H0-home', query: '' },
  { name: 'S0-dc-before-start', query: DC },
  ...milestoneShots('csr'), ...milestoneShots('mmc'),
  { name: 'F1-rpc-blocked', query: `${DC}&path=mmc&fault=rpc-blocked&t=7` },
  { name: 'F2-wrong-template-handoff', query: `${DC}&fault=wrong-template-handoff&t=12` },
  { name: 'F3-accepted-on-wrong-machine', query: `${DC}&fault=accepted-on-wrong-machine&t=20` },
  { name: 'F4-root-thumbprint-mismatch', query: `${DC}&fault=root-thumbprint-mismatch&t=17` },
  { name: 'F5-cdp-unreachable', query: `${DC}&fault=cdp-unreachable&t=23` },
  { name: 'P1-panel-csr', query: `${DC}&t=8`, act: click('#story-scene .spot[data-artifact="csr"]') },
  { name: 'P2-panel-leaf', query: `${DC}&t=14`, act: click('#story-scene .spot[data-artifact="leaf"]') },
  { name: 'P3-panel-root', query: `${DC}&t=18`, act: click('#story-scene [data-sel="artifact:root"]') },
  { name: 'P4-store-personal', query: `${DC}&t=21`, act: click('#story-scene [data-sel="store:personal"]') },
  { name: 'P5-store-intermediate', query: `${DC}&t=21`, act: click('#story-scene [data-sel="store:intermediate"]') },
  { name: 'P6-store-root', query: `${DC}&t=21`, act: click('#story-scene [data-sel="store:root"]') },
  { name: 'P7-store-requests', query: `${DC}&t=12`, act: click('#story-scene [data-sel="artifact:private-key"]') },
  { name: 'R1-reverse-evidence', query: `${DC}&dir=reverse` },
  { name: 'T1-full-topology', query: `${DC}&t=12&full=1` },
  // v0.5.0 Website TLS story: every milestone, four faults, every inspector, the final card, reverse evidence and a glossary chip.
  { name: 'W00-tls-before-start', query: TL },
  ...tlsMilestoneShots(),
  { name: 'WF1-no-enroll-permission', query: `${TL}&fault=no-enroll-permission&t=10` },
  { name: 'WF2-wrong-binding', query: `${TL}&fault=wrong-binding&t=19` },
  { name: 'WF3-missing-ica', query: `${TL}&fault=missing-ica&t=21` },
  { name: 'WF4-wrong-dns', query: `${TL}&fault=wrong-dns&t=23` },
  { name: 'WP01-inf', query: `${TL}&t=6`, act: click('#story-scene .spot[data-artifact="inf"]') },
  { name: 'WP02-csr', query: `${TL}&t=8`, act: click('#story-scene .spot[data-artifact="csr"]') },
  { name: 'WP03-request-record', query: `${TL}&t=10`, act: click('#story-scene .spot[data-artifact="record"]') },
  { name: 'WP04-leaf', query: `${TL}&t=11`, act: click('#story-scene .spot[data-artifact="leaf"]') },
  { name: 'WP05-store-web01', query: `${TL}&t=14`, act: click('#story-scene [data-sel="store:personal"]') },
  { name: 'WP06-ica', query: `${TL}&t=14`, act: click('#story-scene [data-sel="artifact:ica"]') },
  { name: 'WP07-binding', query: `${TL}&t=15`, act: click('#story-scene [data-sel="artifact:binding"]') },
  { name: 'WP08-handshake', query: `${TL}&t=19`, act: click('#story-scene .spot[data-artifact="handshake"]') },
  { name: 'WP09-store-client01', query: `${TL}&t=21`, act: click('#story-scene [data-sel="store:client-root"]') },
  { name: 'WP10-root', query: `${TL}&t=22`, act: click('#story-scene [data-sel="artifact:root"]') },
  { name: 'WP11-crl', query: `${TL}&t=24`, act: click('#story-scene .spot[data-artifact="crl"]') },
  { name: 'WP12-selfsigned', query: `${TL}&t=2`, act: click('#story-scene .spot[data-artifact="selfsigned"]') },
  { name: 'WP13-private-key', query: `${TL}&t=8`, act: click('#story-scene [data-sel="artifact:private-key"]') },
  { name: 'WP14-glossary', query: `${TL}&t=18&panel=open`, act: click('#sec-plain [data-gloss="SNI"]') },
  { name: 'WR1-reverse-evidence', query: `${TL}&dir=reverse` },
  { name: 'WT1-full-topology', query: `${TL}&t=19&full=1` }
].filter((s) => !ONLY || s.name.includes(ONLY));

// Runs inside the page: returns the list of problems for the current screen.
function inspect(minPx) {
  const problems = []; const vw = innerWidth, vh = innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && el.closest('[hidden]') === null; };
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) problems.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
  const overlaps = (els, label) => {
    const boxes = els.map((e) => ({ t: e.textContent.trim().slice(0, 36), r: e.getBoundingClientRect(), e }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2 && !boxes[i].e.contains(boxes[j].e) && !boxes[j].e.contains(boxes[i].e)) problems.push(`${label} text overlap: "${boxes[i].t}" / "${boxes[j].t}"`);
    }
  };
  const story = document.querySelector('#story-scene'); const storyOn = story && vis(story);
  let scale = 1, minSvg = null;
  if (storyOn) {
    scale = story.getScreenCTM().a;
    const texts = [...story.querySelectorAll('text')].filter((t) => vis(t) && t.textContent.trim());
    for (const t of texts) { const px = parseFloat(getComputedStyle(t).fontSize) * scale; minSvg = Math.min(minSvg ?? 99, px); if (px < minPx - 0.05) problems.push(`svg text ${px.toFixed(1)} px: "${t.textContent.slice(0, 40)}"`); }
    overlaps(texts, 'svg');
    const st = window.__cfl.getState(); const step = window.__cfl.app.sc.stages[st.stage];
    const started = document.body.dataset.started === 'true';
    // A step moves something when it has a connector, or when the selected fault adds a route at this step (TLS missing-ica: blocked AIA).
    const faultRoute = window.__cfl.app.sc.faults.find((f) => f.id === st.activeFault)?.connector?.[step.id];
    // Reverse evidence shows the evidence step's route statically (never animated), so the same rule applies in both directions.
    const expected = (started || st.direction === 'reverse') && (step.connector || faultRoute) && !step.skipped ? 1 : 0;
    const active = story.querySelectorAll('.conn[data-kind="active"], .conn[data-kind="blocked"], .conn[data-kind="association"]').length;
    if (active !== expected) problems.push(`${active} active connectors (expected ${expected} at ${step.id})`);
    // HTML overlays (final card, tour bar) must not cover any SVG text.
    for (const ov of document.querySelectorAll('#final-card, .s-tour-bar')) {
      if (!vis(ov)) continue; const o = ov.getBoundingClientRect();
      for (const t of texts) { const r = t.getBoundingClientRect(); if (Math.min(o.right, r.right) - Math.max(o.left, r.left) > 2 && Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > 2) { problems.push(`${ov.id || ov.className} covers svg text "${t.textContent.trim().slice(0, 30)}"`); break; } }
    }
    const sr = story.getBoundingClientRect();
    for (const el of story.querySelectorAll('[data-sel], .conn, .szone')) { if (!vis(el)) continue; const r = el.getBoundingClientRect();
      if (r.left < sr.left - 1 || r.right > sr.right + 1 || r.top < sr.top - 1 || r.bottom > sr.bottom + 1 || r.right > vw + 1 || r.bottom > vh + 1) problems.push(`outside the scene/viewport: ${el.getAttribute('aria-label')?.slice(0, 50) ?? el.className.baseVal}`); }
  }
  // HTML text: size everywhere visible; overlaps within each chrome region.
  const regions = ['.stop', '.sbar', '#spanel', '#final-card', '#home', '.wtop', '.controls'];
  for (const sel of regions) {
    const reg = document.querySelector(sel); if (!reg || !vis(reg)) continue;
    const els = [...reg.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    for (const e of els) { const px = parseFloat(getComputedStyle(e).fontSize); if (px < minPx - 0.05) problems.push(`${sel} text ${px} px: "${e.textContent.trim().slice(0, 40)}"`); }
    overlaps(els.filter((e) => !els.some((o) => o !== e && e.contains(o))), sel);
    if (!['#spanel', '#home'].includes(sel)) { const r = reg.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) problems.push(`${sel} outside the viewport horizontally`); }
  }
  for (const el of document.querySelectorAll('.stop button, .stop select, .sbar button, .sbar select')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.bottom > vh + 1) problems.push(`control outside the viewport: ${el.textContent.trim() || el.id}`); }
  return { problems, scale: Number(scale.toFixed(3)), minSvgText: minSvg === null ? '—' : minSvg.toFixed(1) };
}

const server = await createServer({ root, server: { port: 5187, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const report = []; let failures = 0; let browser;
try {
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch(); }
  for (const scheme of SCHEMES) for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/5184|ERR_CONNECTION_REFUSED/.test(m.text() + (m.location().url ?? ''))) errors.push(m.text()); });
    for (const s of SHOTS) {
      await page.goto(`http://127.0.0.1:5187/${s.query ? `?${s.query}` : ''}`); await page.waitForFunction(() => window.__cfl);
      await page.waitForTimeout(300); if (s.act) await s.act(page);
      const file = join(outDir, `${s.name}-${w}x${h}-${scheme}.png`); await page.screenshot({ path: file });
      const r = await page.evaluate(inspect, MIN_PX); r.problems.push(...errors.splice(0).map((e) => `page error: ${e}`));
      report.push({ shot: s.name, size: `${w}x${h}`, scheme, file, ...r });
      console.log(`${r.problems.length ? 'FAIL' : 'PASS'}  ${s.name} ${w}x${h} ${scheme} (scale ${r.scale}, smallest SVG text ${r.minSvgText} px)`);
      for (const p of r.problems.slice(0, 8)) console.log(`      - ${p}`);
      failures += r.problems.length ? 1 : 0;
    }
    await ctx.close();
  }
} finally { await browser?.close(); await server.close(); }
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.length} screens checked; ${failures} with problems. Screenshots and report.json in screenshots/visual-review/ (git-ignored).`);
process.exit(failures ? 1 : 0);
