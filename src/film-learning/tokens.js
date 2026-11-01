// Learning film (v0.6.0): central motion and colour tokens. Every timing constant used by the film lives here.
// Pure functions only: no clocks, no randomness.

// ---------- Durations (seconds) ----------
export const MOTION = {
  feedback: 0.15,
  smallMove: 0.4,
  heroMove: 0.85,
  callout: 0.42,
  captionIn: 0.35,
  captionOut: 0.2, // exits are roughly half the matching entrance
  camera: 1.0,
  overlayIn: 0.5,
  overlayOut: 0.3,
  stamp: 0.55,
  typePerChar: 0.028,
  ambientDrift: 6 // world px; < 3 % of a hero travel of ~1200 px
};

// Reading rule: a caption stays readable for at least 0.3 s per word + 0.5 s.
export const READ = { perWord: 0.3, base: 0.5 };
export const wordCount = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
export const minHold = (text) => READ.perWord * wordCount(text) + READ.base;

// ---------- Easing ----------
// Cubic Bézier solver (same curve definition as CSS cubic-bezier()).
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) { const e = sx(u) - x; const d = dx(u); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; u -= e / d; }
    let lo = 0, hi = 1;
    if (Math.abs(sx(u) - x) > 1e-5) { u = x; for (let i = 0; i < 30; i++) { if (sx(u) < x) lo = u; else hi = u; u = (lo + hi) / 2; } }
    return sy(u);
  };
}
export const EASE = {
  enter: cubicBezier(0.16, 1, 0.3, 1),
  move: cubicBezier(0.76, 0, 0.24, 1),
  exit: cubicBezier(0.7, 0, 0.84, 0),
  camera: cubicBezier(0.65, 0, 0.35, 1),
  linear: (x) => Math.min(1, Math.max(0, x))
};

// Damped spring for hero position settles (damping ratio 0.82: one barely visible settle, no playful overshoot).
// Normalised so spring(0) = 0 and spring(1) = 1 exactly.
export const SPRING = { damping: 0.82, omega: 9 };
export function spring(u, zeta = SPRING.damping, w = SPRING.omega) {
  if (u <= 0) return 0; if (u >= 1) return 1;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const f = (x) => 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + (zeta * w / wd) * Math.sin(wd * x));
  return f(u) / f(1);
}

// Progress of a timed segment [t0, t0 + d] (clamped 0..1), optionally eased.
export const prog = (t, t0, d, ease = EASE.linear) => ease(Math.min(1, Math.max(0, (t - t0) / Math.max(d, 1e-6))));
export const lerp = (a, b, u) => a + (b - a) * u;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
// Fade in at t0 (enter curve), optionally fade out at t1 (exit curve, half duration).
export function fade(t, t0, t1 = Infinity, din = MOTION.callout, dout = MOTION.captionOut) {
  const a = prog(t, t0, din, EASE.enter);
  const b = t1 === Infinity ? 0 : prog(t, t1 - dout, dout, EASE.exit);
  return clamp01(a * (1 - b));
}

// ---------- Colour (semantic; text colours are the dark "ink" variants, all ≥ 4.5:1 on the paper) ----------
export const COLOR = {
  paper: '#EEEDE8', plate: '#FBFAF7', grid: '#E2E0D8', ink: '#16243A', ink2: '#3C4A5E', muted: '#5B6577', line: '#CBC8BE',
  navy: '#1B2A41',
  key: '#9A5800', keyFill: '#F2A93B', keySoft: '#FFF1DA',
  csr: '#2353B5', csrFill: '#3B73DB', csrSoft: '#E6EEFF',
  leaf: '#7D5C00', leafFill: '#E2B53D', leafSoft: '#FFF5D6',
  ica: '#0A6A64', icaFill: '#1E9C93', icaSoft: '#DFF3F0',
  root: '#226A33', rootFill: '#3A9A52', rootSoft: '#E4F3E7',
  policy: '#5E37AE', policySoft: '#F0EAFE',
  fail: '#A8231B', failSoft: '#FCE9E7',
  validate: '#086E8C', validateSoft: '#E0F3F8',
  wire: '#3F35A8', wireSoft: '#ECEAFE',
  ok: '#1C6E3E'
};
