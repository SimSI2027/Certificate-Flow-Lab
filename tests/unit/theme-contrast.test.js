// v0.4.1 design tokens: both themes meet WCAG AA (text >= 4.5:1, UI graphics >= 3:1). Tokens are parsed from src/ui/styles.css.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../helpers/fixtures.js';

const css = readFileSync(join(root, 'src/ui/styles.css'), 'utf8');
function tokens(block) { const out = {}; for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2].toLowerCase(); return out; }
const light = tokens(/:root, body\[data-layout='classic'\] \{([\s\S]*?)\n\}/.exec(css)[1]);
const dark = { ...light, ...tokens(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n {2}\}/.exec(css)[1]) };
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum]
const TEXT = [['ink', 'sheet'], ['ink', 'plate'], ['ink', 'paper'], ['ink-2', 'sheet'], ['ink-2', 'plate'], ['muted', 'sheet'], ['muted', 'plate'], ['muted', 'paper'], ['muted', 'sheet-2'],
  ['accent-ink', 'sheet'], ['accent-ink', 'accent-soft'], ['on-accent', 'accent'], ['ink', 'accent-soft'], ['ink', 'warn-soft'], ['ink', 'good-soft'], ['good', 'good-soft'], ['good', 'sheet'], ['warn', 'sheet'], ['warn', 'paper'],
  ['crit', 'sheet'], ['crit', 'crit-soft'], ['code-ink', 'code-bg'], ['sheet', 'ink'], ['ink', 'a-key-soft'], ['ink-2', 'a-csr-soft'], ['ink-2', 'a-leaf-soft'], ['ink-2', 'a-rec-soft'], ['ink-2', 'a-ica-soft'], ['ink-2', 'a-root-soft'], ['ink-2', 'a-pkg-soft'], ['ink-2', 'a-inf-soft'],
  ['a-rec', 'a-rec-soft'], ['paper', 'ink']].map(([f, b]) => [f, b, 4.5]);
const GRAPHICS = [['accent', 'sheet'], ['accent', 'plate'], ['crit', 'plate'], ['a-key', 'plate'], ['a-key', 'a-key-soft'], ['a-csr', 'a-csr-soft'], ['a-leaf', 'a-leaf-soft'], ['a-ica', 'a-ica-soft'], ['a-root', 'a-root-soft'],
  ['a-rec', 'a-rec-soft'], ['a-pkg', 'a-pkg-soft'], ['a-inf', 'a-inf-soft'], ['line-strong', 'plate'], ['focus', 'sheet'], ['good', 'plate']].map(([f, b]) => [f, b, 3]);

describe('design tokens meet WCAG AA in light and dark', () => {
  for (const [name, set] of [['light', light], ['dark', dark]]) {
    it(`${name}: every token pair resolves and meets its minimum`, () => {
      const fails = [];
      for (const [f, b, min] of [...TEXT, ...GRAPHICS]) {
        expect(set[f], `${name} --${f}`).toMatch(/^#/); expect(set[b], `${name} --${b}`).toMatch(/^#/);
        const r = ratio(set[f], set[b]); if (r < min) fails.push(`${f} on ${b}: ${r.toFixed(2)} < ${min}`);
      }
      expect(fails).toEqual([]);
    });
  }
  it('dark mode redefines the surfaces (it is a real theme, not the light one)', () => {
    for (const k of ['paper', 'plate', 'sheet', 'ink', 'accent']) expect(dark[k]).not.toBe(light[k]);
  });
});
