// Captures representative screenshots locally into ./screenshots (git-ignored). Requires the dev server on :5183.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const base = process.env.CFL_URL ?? 'http://127.0.0.1:5183/';
const b = await chromium.launch({ channel: 'msedge' });
const shot = async (name, q, { w = 1600, h = 950, act } = {}) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + q); await p.waitForFunction(() => window.__cfl);
  if (act) await act(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `screenshots/${name}.png` });
  await p.close();
};
await shot('01-start', '');
await shot('02-owner-keygen-csr', '?t=6', { act: (p) => p.click('.chip[data-artifact="csr"]') });
await shot('03-policy-gate', '?t=7', { act: (p) => p.click('[data-entity="template"]') });
await shot('04-issued-certificate', '?t=11', { act: (p) => p.click('.chip[data-artifact="leaf"]') });
await shot('05-chain-validation', '?t=17', { act: (p) => p.click('[data-entity="pkiweb01"]') });
await shot('06-trusted', '?t=19');
await shot('07-reverse-evidence', '?dir=reverse', { act: async (p) => { for (let i = 0; i < 4; i++) await p.click('#btn-step-fwd'); } });
await shot('08-fault-revoked', '?fault=revoked&t=18');
await shot('09-fault-missing-ica', '?fault=missing-ica&t=15');
await shot('10-narrow', '?t=19', { w: 390, h: 844 });
await b.close();
console.log('screenshots written to ./screenshots');
