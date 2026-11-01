// Shared deterministic video pipeline: in-process Vite server, headless Edge/Chromium via Playwright, JPEG frames piped
// straight into FFmpeg (no temp frames), and contact sheets cut from the encoded MP4. Used by export-video.mjs (the app
// film) and export-learning-film.mjs (the learning film). No screen recording; the page is told each timestamp.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
export function requireFfmpeg() {
  try { run('ffmpeg', ['-version']); run('ffprobe', ['-version']); } catch { console.error('FFmpeg and ffprobe must be on PATH.'); process.exit(2); }
}

// Starts Vite and a 1920x1080 page; collects console errors and page errors.
export async function openPage(path, { port = 5186, ready = 'window.__film?.ready' } = {}) {
  const server = await createServer({ root, server: { port, strictPort: true, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
  // No HMR and no file watching: an edit during a long render must never reload the page mid-capture.
  await server.listen();
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${path}`);
  await page.waitForFunction(ready, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready);
  const close = async () => { await browser?.close(); await server.close(); };
  return { page, errors, close };
}

// Renders frames 0..total-1 by calling setTime(i / fps) in the page and encodes H.264 yuv420p, faststart, silent.
export async function encode(page, { setTime, fps, seconds, mp4, log = console.log }) {
  const total = Math.round(seconds * fps);
  log(`Rendering ${total} frames (${seconds.toFixed(1)} s at ${fps} fps, 1920x1080)...`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); ff.on('error', rej); });
  done.catch(() => {}); // awaited below; avoids an unhandled rejection if capture fails first
  ff.stdin.on('error', () => {});
  const started = Date.now(); // progress logging only
  try {
    for (let i = 0; i < total; i++) {
      await page.evaluate(setTime, i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 600 === 0) log(`  frame ${i}/${total} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await done;
  } catch (e) { try { ff.stdin.destroy(); ff.kill(); } catch { /* gone */ } throw e; }
  return total;
}

// Contact sheet cut from the encoded MP4: beats = [[seconds, label], ...].
export function contactSheet(mp4, beats, sheet, { cols = 4, width = 640 } = {}) {
  const tmp = join(dirname(sheet), 'sheet-tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const font = 'C\\:/Windows/Fonts/segoeui.ttf'; const h = Math.round(width * 9 / 16);
  beats.forEach(([t, label], i) => {
    const text = `${t.toFixed(1)}s  ${label}`.replace(/[:'\\%,]/g, ' ');
    run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-vf',
      `scale=${width}:${h},drawtext=fontfile='${font}':text='${text}':x=8:y=h-30:fontsize=20:fontcolor=white:box=1:boxcolor=0x1b2a41@0.85:boxborderw=5`, join(tmp, `c${String(i).padStart(2, '0')}.png`)]);
  });
  const rows = Math.ceil(beats.length / cols);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(tmp, 'c%02d.png'), '-vf', `tile=${cols}x${rows}:padding=6:color=0xdfe6f1`, '-frames:v', '1', '-q:v', '3', sheet]);
  rmSync(tmp, { recursive: true, force: true });
}

// ffprobe summary of the first video stream plus the audio-stream count and the moov/mdat order (faststart).
export function probe(mp4) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,nb_read_packets:format=duration,size', '-of', 'json', mp4]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const audio = j.streams.filter((s) => s.codec_type === 'audio').length;
  return { codec: v.codec_name, width: v.width, height: v.height, avgFrameRate: v.avg_frame_rate, pixFmt: v.pix_fmt, frames: Number(v.nb_read_packets), duration: Number(j.format.duration), size: Number(j.format.size), audioStreams: audio, topLevelAtoms: atoms(mp4) };
}
// Top-level MP4 atom order; faststart means 'moov' comes before 'mdat'.
export function atoms(mp4) {
  const fd = openSync(mp4, 'r'); const out = []; let pos = 0; const size = fstatSync(fd).size; const b = Buffer.alloc(16);
  try {
    while (pos < size && out.length < 12) {
      readSync(fd, b, 0, 16, pos); let len = b.readUInt32BE(0); const type = b.toString('latin1', 4, 8);
      if (len === 1) len = Number(b.readBigUInt64BE(8)); else if (len === 0) len = size - pos;
      out.push(type); if (len < 8) break; pos += len;
    }
  } finally { closeSync(fd); }
  return out;
}
