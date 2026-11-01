// Learning film entry. Exposes window.renderAt(t): every frame is a pure function of t (seconds).
// Capture mode (?capture) shows only the 1920x1080 frame; the exporter sets each timestamp explicitly.
// Preview mode adds keyboard-operable controls; playback may call renderAt from requestAnimationFrame, but the frame
// itself never reads a clock.
import './film.css';
import { buildFixtureModel } from '../artifacts/model.js';
import manifest from '../../fixtures/manifests/manifest.json';
import { filmFacts } from './facts.js';
import { createRenderer } from './render.js';
import { filmStateAt } from './state.js';
import { SHOTS, CAPTIONS, DURATION, FPS, FRAME_COUNT, abs } from './timeline.js';

const raw = import.meta.glob('/fixtures/**/*.{pem,csr,crl,req,inf}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\/fixtures\//, ''), v]));
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
document.body.classList.toggle('lf-capture', capture);
const $ = (id) => document.getElementById(id);

const model = await buildFixtureModel(files, manifest);
const facts = filmFacts(model);
const frame = $('lf-frame');
const { renderAt: draw } = createRenderer(frame, facts);

const summary = (S) => ({ t: S.t, shot: S.shotId, caption: S.caption?.head ?? null, route: S.route, overlay: S.overlay?.id ?? null, keyLocation: S.key.location, csrLocation: S.csr.location });
let current = 0;
function renderAt(t) { current = Math.min(Math.max(Number(t) || 0, 0), DURATION); const S = draw(current); onFrame(S); return summary(S); }
window.renderAt = renderAt;
window.__learningFilm = { ready: false, duration: DURATION, fps: FPS, frameCount: FRAME_COUNT, renderAt, state: (t) => summary(filmStateAt(t)), facts, shots: SHOTS.map((s) => ({ id: s.id, n: s.n, title: s.title, start: s.start, end: s.end })) };

// ---------- preview controls ----------
const seek = $('lf-seek'), play = $('lf-play'), time = $('lf-time'), live = $('lf-live'), rmBox = $('lf-rm'), shotList = $('lf-shotlist');
const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced = !!mq?.matches; if (rmBox) rmBox.checked = reduced;
let playing = false, lastTs = null, lastCaption = null;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function onFrame(S) {
  if (capture) return;
  if (seek) seek.value = String(S.t.toFixed(2));
  if (time) time.textContent = `${fmt(S.t)} / ${fmt(DURATION)}`;
  if (seek) seek.setAttribute('aria-valuetext', `${fmt(S.t)}, shot ${S.shotN}: ${S.shotTitle}`);
  const key = S.caption ? `${S.caption.shot}:${S.caption.index}` : null;
  if (key !== lastCaption && live) { lastCaption = key; live.textContent = S.caption ? `${S.caption.head} ${S.caption.body}` : ''; }
  shotList?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.n) === S.shotN)));
}
// Reduced motion: show each caption's settled frame instead of continuous motion.
const settled = (t) => { const c = CAPTIONS.find((x) => t >= x.start && t < x.end); return c ? Math.max(c.start, c.end - 0.05) : t; };
function tick(ts) {
  if (!playing) return;
  if (lastTs !== null) {
    const next = current + (ts - lastTs) / 1000; // preview pacing only; frames remain a pure function of the film time
    if (next >= DURATION) { renderAt(DURATION); setPlaying(false); return; }
    current = next; reduced ? (draw(settled(current)), onFrame(filmStateAt(current))) : renderAt(current);
  }
  lastTs = ts; requestAnimationFrame(tick);
}
function setPlaying(on) {
  playing = on; lastTs = null; if (play) { play.textContent = on ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(on)); }
  if (on) { if (current >= DURATION - 0.01) current = 0; requestAnimationFrame(tick); }
}
const jump = (dir) => { const i = SHOTS.findIndex((s) => current >= s.start && current < s.end); const j = Math.min(SHOTS.length - 1, Math.max(0, (i < 0 ? SHOTS.length - 1 : i) + dir)); renderAt(SHOTS[j].start + 0.6); };
if (!capture) {
  play?.addEventListener('click', () => setPlaying(!playing));
  $('lf-prev')?.addEventListener('click', () => jump(-1));
  $('lf-next')?.addEventListener('click', () => jump(1));
  seek?.setAttribute('max', String(DURATION));
  seek?.addEventListener('input', () => { setPlaying(false); renderAt(Number(seek.value)); });
  rmBox?.addEventListener('change', () => { reduced = rmBox.checked; });
  if (shotList) {
    shotList.innerHTML = SHOTS.map((s) => `<li><button type="button" data-n="${s.n}" aria-current="false">${String(s.n).padStart(2, '0')} ${s.title} <span class="sr-only">at ${fmt(s.start)}</span></button></li>`).join('');
    shotList.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setPlaying(false); renderAt(SHOTS[Number(b.dataset.n) - 1].start + 0.6); } });
  }
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, button, select, textarea') && e.key === ' ') return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === 'ArrowRight' && !e.target.closest?.('input')) jump(1);
    else if (e.key === 'ArrowLeft' && !e.target.closest?.('input')) jump(-1);
  });
  const vp = $('lf-viewport');
  const fit = () => { const k = vp.clientWidth / 1920; frame.style.transform = `scale(${k})`; };
  new ResizeObserver(fit).observe(vp); fit();
}
// Initial frame: ?t=<seconds> (review and stills), otherwise a poster on the newly signed certificate.
const t0 = params.has('t') ? Number(params.get('t')) : capture ? 0 : abs('issue', 8.6);
renderAt(t0);
window.__learningFilm.ready = true;
