// Deterministic video export: renders film time 0..DURATION through window.__film.setTime() and pipes frames to FFmpeg.
// No screen recording. Output (git-ignored): output/certificate-flow-lab-v0.3.0.mp4 and output/certificate-flow-lab-v0.3.0-contact-sheet.jpg
// Usage: node scripts/video/export-video.mjs [--fps 60] [--seconds N]   (--seconds renders only the first N seconds, for quick checks)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, FPS, contactBeats } from '../../src/film/schedule.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const fps = Number(arg('--fps', FPS));
const seconds = Math.min(DURATION, Number(arg('--seconds', DURATION)));
const out = join(root, 'output');
const mp4 = join(out, 'certificate-flow-lab-v0.3.0.mp4');
const sheet = join(out, 'certificate-flow-lab-v0.3.0-contact-sheet.jpg');
mkdirSync(out, { recursive: true });

const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
try { run('ffmpeg', ['-version']); run('ffprobe', ['-version']); } catch { console.error('FFmpeg and ffprobe must be on PATH.'); process.exit(2); }

const PORT = 5186;
const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
let browser, ff;
try {
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/film.html`);
  await page.waitForFunction(() => window.__film?.ready, null, { timeout: 30000 });

  const total = Math.round(seconds * fps);
  console.log(`Rendering ${total} frames (${seconds.toFixed(1)} s at ${fps} fps, 1920x1080)...`);
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); ff.on('error', rej); });
  ff.stdin.on('error', () => {});
  const started = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__film.setTime(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`  frame ${i}/${total} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await ffDone;
  if (errors.length) throw new Error(`Page errors during render: ${errors.slice(0, 3).join(' | ')}`);

  // ---- contact sheet from the encoded MP4 ----
  const beats = contactBeats().filter(([t]) => t < seconds);
  const tmp = join(out, 'sheet-tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const font = 'C\\:/Windows/Fonts/segoeui.ttf';
  const cells = beats.map(([t, label], i) => {
    const f = join(tmp, `c${String(i).padStart(2, '0')}.png`);
    const text = `${t.toFixed(1)}s  ${label}`.replace(/[:'\\]/g, ' ');
    run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-vf',
      `scale=640:360,drawtext=fontfile='${font}':text='${text}':x=8:y=h-30:fontsize=20:fontcolor=white:box=1:boxcolor=0x1b2a41@0.85:boxborderw=5`, f]);
    return f;
  });
  const cols = 4, rows = Math.ceil(cells.length / cols);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(tmp, 'c%02d.png'), '-vf', `tile=${cols}x${rows}:padding=6:color=0xdfe6f1`, '-frames:v', '1', '-q:v', '3', sheet]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`MP4: ${mp4} (${(statSync(mp4).size / 1048576).toFixed(1)} MB)`);
  console.log(`Contact sheet: ${sheet} (${(statSync(sheet).size / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.error(`Export failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  try { ff?.stdin?.destroy(); ff?.kill(); } catch { /* already gone */ }
  await browser?.close();
  await server.close();
}
