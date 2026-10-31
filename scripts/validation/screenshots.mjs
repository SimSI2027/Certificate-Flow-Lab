// Captures representative screenshots locally into ./screenshots (git-ignored). Requires the dev server on :5183.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const base = process.env.CFL_URL ?? 'http://127.0.0.1:5183/';
const DC = 'scenario=dc-manual-certificate-request', TLS = 'scenario=tls-manual-enrollment';
const b = await chromium.launch({ channel: 'msedge' });
const shot = async (name, q, { w = 1600, h = 950, act } = {}) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${base}?${q}`); await p.waitForFunction(() => window.__cfl);
  if (act) await act(p);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `screenshots/${name}.png` });
  await p.close();
};
await shot('01-home', '');
await shot('02-tls-focused', `${TLS}&t=12.6`);
await shot('03-dc-problem', `${DC}&t=0.9`);
await shot('04-dc-csr', `${DC}&t=8`, { act: (p) => p.click('.chip[data-artifact="csr"]') });
await shot('05-dc-policy', `${DC}&t=9.8`, { act: (p) => p.click('.node[data-entity="template"]') });
await shot('06-dc-issued-cert', `${DC}&t=12`, { act: (p) => p.click('.chip[data-artifact="dccert"]') });
await shot('07-dc-accept-key-match', `${DC}&t=14`, { act: async (p) => { await p.click('.chip[data-artifact="dccert"]'); await p.click('[data-tab="matching-csr"]'); } });
await shot('08-dc-final', `${DC}&t=17`);
await shot('09-dc-reverse', `${DC}&dir=reverse`, { act: async (p) => { for (let i = 0; i < 4; i++) await p.click('#btn-step-fwd'); } });
await shot('10-dc-failure', `${DC}&fault=key-mismatch&t=14`, { act: (p) => p.click('[data-tabbtn="troubleshoot"]') });
await shot('11-full-topology', `${DC}&t=16&full=1`);
await shot('12-narrow', `${DC}&t=8`, { w: 390, h: 844 });
await b.close();
console.log('screenshots written to ./screenshots');
