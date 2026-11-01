// Visual review (v0.4.0): captures every Path A milestone, every Path B milestone, three faults and the expanded panel at
// 1920x1080 and 1366x768 into the git-ignored screenshots/ folder, and fails on: horizontal scroll, overlapping text boxes,
// rendered text below 11 px, more than one active connector, or story elements outside the viewport.
// Usage: npm run review:visual   (starts its own Vite server on 127.0.0.1:5187)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dc from '../../src/scenarios/dc-manual-certificate-request.js';
import { pathOf } from '../../src/engine/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'screenshots', 'visual-review'); mkdirSync(outDir, { recursive: true });
const SIZES = [[1920, 1080], [1366, 768]];
const MIN_PX = 11;

// Representative step per milestone: the last (non-skipped) step of each milestone, in its completed state.
function milestoneShots(pathId) {
  const v = pathOf(dc, { pathId });
  return v.milestones.map((m, mi) => { const idx = v.stages.map((s, i) => (s.milestone === m ? i : -1)).filter((i) => i >= 0); const i = idx.at(-1);
    return { name: `${pathId === 'csr' ? 'A' : 'B'}${String(mi + 1).padStart(2, '0')}-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, query: `path=${pathId}&t=${i + 1}` }; });
}
const SHOTS = [...milestoneShots('csr'), ...milestoneShots('mmc'),
  { name: 'F1-rpc-blocked', query: 'path=mmc&fault=rpc-blocked&t=7' }, { name: 'F2-root-thumbprint-mismatch', query: 'fault=root-thumbprint-mismatch&t=17' }, { name: 'F3-cdp-unreachable', query: 'fault=cdp-unreachable&t=23' },
  { name: 'P1-expanded-panel', query: 't=8', act: async (p) => { await p.locator('#story-scene .spot[data-artifact="csr"]').click(); await p.waitForTimeout(200); } }];

// Runs inside the page: returns the list of problems for the current screen.
function inspect(minPx) {
  const problems = []; const vw = innerWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) problems.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
  const svg = document.querySelector('#story-scene'); const scale = svg.getScreenCTM().a;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'; };
  // SVG text: size and overlaps
  const texts = [...svg.querySelectorAll('text')].filter((t) => vis(t) && t.textContent.trim());
  for (const t of texts) { const px = parseFloat(getComputedStyle(t).fontSize) * scale; if (px < minPx - 0.05) problems.push(`svg text ${px.toFixed(1)} px: "${t.textContent.slice(0, 40)}"`); }
  const boxes = texts.map((t) => ({ t: t.textContent.slice(0, 40), r: t.getBoundingClientRect() }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, b = boxes[j].r; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 2 && h > 2) problems.push(`svg text overlap: "${boxes[i].t}" / "${boxes[j].t}"`);
  }
  // HTML chrome text (header, rail, controls, panel, final card): size, overlaps within each region
  const regions = ['.stop', '.sbar', '#spanel', '#final-card'];
  for (const sel of regions) {
    const reg = document.querySelector(sel); if (!reg || !vis(reg)) continue;
    const els = [...reg.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    for (const e of els) { const px = parseFloat(getComputedStyle(e).fontSize); if (px < minPx - 0.05) problems.push(`${sel} text ${px} px: "${e.textContent.trim().slice(0, 40)}"`); }
    const leafs = els.filter((e) => !els.some((o) => o !== e && e.contains(o)));
    for (let i = 0; i < leafs.length; i++) for (let j = i + 1; j < leafs.length; j++) {
      const a = leafs[i].getBoundingClientRect(), b = leafs[j].getBoundingClientRect(); const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2 && !leafs[i].contains(leafs[j]) && !leafs[j].contains(leafs[i])) problems.push(`${sel} text overlap: "${leafs[i].textContent.trim().slice(0, 30)}" / "${leafs[j].textContent.trim().slice(0, 30)}"`);
    }
    if (sel !== '#spanel') { const r = reg.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) problems.push(`${sel} outside the viewport horizontally`); }
  }
  // Active connectors
  const active = svg.querySelectorAll('.conn[data-kind="active"], .conn[data-kind="blocked"], .conn[data-kind="association"]').length;
  if (active > 1) problems.push(`${active} active connectors`);
  // Story elements inside the scene and the viewport
  const sr = svg.getBoundingClientRect();
  for (const el of svg.querySelectorAll('[data-sel], .conn, .szone')) { if (!vis(el)) continue; const r = el.getBoundingClientRect();
    if (r.left < sr.left - 1 || r.right > sr.right + 1 || r.top < sr.top - 1 || r.bottom > sr.bottom + 1 || r.right > vw + 1 || r.bottom > vh + 1) problems.push(`outside the scene/viewport: ${el.getAttribute('aria-label')?.slice(0, 50) ?? el.className.baseVal}`); }
  for (const el of document.querySelectorAll('.stop button, .stop select, .sbar button, .sbar select')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.bottom > vh + 1) problems.push(`control outside the viewport: ${el.textContent.trim() || el.id}`); }
  return { problems, scale: Number(scale.toFixed(3)), minSvgText: Math.min(...texts.map((t) => parseFloat(getComputedStyle(t).fontSize) * scale)).toFixed(1) };
}

const server = await createServer({ root, server: { port: 5187, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const report = []; let failures = 0; let browser;
try {
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch(); }
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    for (const s of SHOTS) {
      await page.goto(`http://127.0.0.1:5187/?scenario=${dc.id}&${s.query}`); await page.waitForFunction(() => window.__cfl);
      await page.waitForTimeout(250); if (s.act) await s.act(page);
      const file = join(outDir, `${s.name}-${w}x${h}.png`); await page.screenshot({ path: file });
      const r = await page.evaluate(inspect, MIN_PX); r.problems.push(...errors.splice(0).map((e) => `page error: ${e}`));
      report.push({ shot: s.name, size: `${w}x${h}`, file, ...r });
      console.log(`${r.problems.length ? 'FAIL' : 'PASS'}  ${s.name} ${w}x${h} (scale ${r.scale}, smallest SVG text ${r.minSvgText} px)`);
      for (const p of r.problems) console.log(`      - ${p}`);
      failures += r.problems.length ? 1 : 0;
    }
    await page.close();
  }
} finally { await browser?.close(); await server.close(); }
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.length} screens checked; ${failures} with problems. Screenshots and report.json in screenshots/visual-review/ (git-ignored).`);
process.exit(failures ? 1 : 0);
