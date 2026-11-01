// Learning film v1 "From CSR to Trust": deterministic export through window.renderAt(t).
// Output (git-ignored):
//   output/certificate-flow-lab-learning-film-v1.mp4              1920x1080, 60 fps, H.264, yuv420p, faststart, silent
//   output/certificate-flow-lab-learning-film-v1-contact-sheet.jpg
// Usage:
//   node scripts/video/export-learning-film.mjs                  full render, contact sheet and ffprobe report
//   node scripts/video/export-learning-film.mjs --stills         representative stills + shot-boundary audit frames + a draft sheet
//                                                                (screenshots/learning-film/, no video)
//   node scripts/video/export-learning-film.mjs --seconds 12     preview render of the first N seconds (separate -preview file)
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, run, requireFfmpeg, openPage, encode, contactSheet, probe } from './lib.mjs';
import { DURATION, FPS, SHOTS, contactBeats, boundaryFrames } from '../../src/film-learning/timeline.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const stills = process.argv.includes('--stills');
const seconds = Math.min(DURATION, Number(arg('--seconds', DURATION)));
const out = join(root, 'output'); mkdirSync(out, { recursive: true });
const base = seconds < DURATION ? 'certificate-flow-lab-learning-film-v1-preview' : 'certificate-flow-lab-learning-film-v1';
const mp4 = join(out, `${base}.mp4`), sheet = join(out, `${base}-contact-sheet.jpg`);
requireFfmpeg();

const { page, errors, close } = await openPage('learning-film.html?capture', { port: 5189, ready: 'window.__learningFilm?.ready' });
const setTime = (t) => window.renderAt(t);
try {
  if (stills) {
    // Representative stills (contact beats) and the shot-boundary audit: frame before, boundary, after, and a hold frame per shot.
    const dir = join(root, 'screenshots', 'learning-film'); rmSync(dir, { recursive: true, force: true }); mkdirSync(join(dir, 'boundaries'), { recursive: true });
    const blank = [];
    const shoot = async (t, file) => {
      await page.evaluate(setTime, t);
      const buf = await page.screenshot({ type: 'png' }); writeFileSync(file, buf);
      // Non-blank check: the frame must contain enough distinct pixels (rough luminance spread from a downscaled copy).
      const spread = await page.evaluate(async (b64) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = new OffscreenCanvas(96, 54); const x = c.getContext('2d'); x.drawImage(img, 0, 0, 96, 54); const d = x.getImageData(0, 0, 96, 54).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; mn = Math.min(mn, l); mx = Math.max(mx, l); } return mx - mn; }, buf.toString('base64'));
      if (spread < 40) blank.push(`${file} (spread ${spread.toFixed(0)})`);
    };
    const beats = contactBeats();
    for (const [i, [t, label]] of beats.entries()) await shoot(t, join(dir, `${String(i).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`));
    for (const b of boundaryFrames()) for (const k of ['before', 'boundary', 'after', 'hold']) if (b[k] >= 0) await shoot(b[k] / FPS, join(dir, 'boundaries', `${b.shot}-${k}-f${b[k]}.png`));
    // Draft contact sheet straight from the PNG stills.
    const list = beats.map((_, i) => i);
    const font = 'C\\:/Windows/Fonts/segoeui.ttf';
    const tmp = join(dir, 'tiles'); mkdirSync(tmp, { recursive: true });
    for (const i of list) {
      const [t, label] = beats[i]; const src = join(dir, `${String(i).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`);
      run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=640:360,drawtext=fontfile='${font}':text='${`${t.toFixed(1)}s  ${label}`.replace(/[:'\\%,]/g, ' ')}':x=8:y=h-30:fontsize=20:fontcolor=white:box=1:boxcolor=0x1b2a41@0.85:boxborderw=5`, join(tmp, `c${String(i).padStart(2, '0')}.png`)]);
    }
    run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(tmp, 'c%02d.png'), '-vf', `tile=4x${Math.ceil(list.length / 4)}:padding=6:color=0xdfe6f1`, '-frames:v', '1', '-q:v', '3', join(dir, 'draft-contact-sheet.jpg')]);
    rmSync(tmp, { recursive: true, force: true });
    console.log(`Stills: ${beats.length} beats + ${boundaryFrames().length * 4} boundary frames in ${dir}`);
    if (blank.length) throw new Error(`Blank-looking frames: ${blank.join(', ')}`);
  } else {
    await encode(page, { setTime, fps: FPS, seconds, mp4 });
    contactSheet(mp4, contactBeats().filter(([t]) => t < seconds), sheet);
    const p = probe(mp4);
    console.log(`MP4: ${mp4} (${(statSync(mp4).size / 1048576).toFixed(1)} MB)`);
    console.log(`Contact sheet: ${sheet} (${(statSync(sheet).size / 1024).toFixed(0)} KB)`);
    console.log(`ffprobe: ${JSON.stringify(p)}`);
    console.log(`Shots: ${SHOTS.length} · duration ${DURATION.toFixed(2)} s`);
  }
  if (errors.length) throw new Error(`Page errors: ${errors.slice(0, 3).join(' | ')}`);
} catch (e) {
  console.error(`Learning film export failed: ${e.message}`); process.exitCode = 1;
} finally { await close(); }
