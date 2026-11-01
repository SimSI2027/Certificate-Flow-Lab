// Accessibility (axe-core) on the home screen and the DC story workspace: both paths, panel closed and open.
// Release gate: zero serious or critical violations. All violations are written to test-results/axe/ for the audit record.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const DCID = 'dc-manual-certificate-request';
const SCREENS = [
  { name: 'home', url: '/' },
  { name: 'dc-a-before-start', url: `/?scenario=${DCID}` },
  { name: 'dc-a-step8-panel-closed', url: `/?scenario=${DCID}&t=8` },
  { name: 'dc-a-step8-panel-open', url: `/?scenario=${DCID}&t=8`, open: '#story-scene .spot[data-artifact="csr"]' },
  { name: 'dc-a-step21-store-open', url: `/?scenario=${DCID}&t=21`, open: '#story-scene [data-sel="store:personal"]' },
  { name: 'dc-b-step8-panel-closed', url: `/?scenario=${DCID}&path=mmc&t=8` },
  { name: 'dc-b-step8-panel-open', url: `/?scenario=${DCID}&path=mmc&t=8`, open: '#story-scene .spot' },
  { name: 'dc-a-fault-halt', url: `/?scenario=${DCID}&fault=root-thumbprint-mismatch&t=17` }
];
for (const scheme of ['light', 'dark']) {
  for (const s of SCREENS) {
    test(`axe ${scheme}: ${s.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(s.url); await page.waitForFunction(() => window.__cfl);
      if (s.open) { await page.locator(s.open).first().click(); await page.waitForTimeout(150); }
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      const rows = r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      mkdirSync('test-results/axe', { recursive: true }); writeFileSync(`test-results/axe/${scheme}-${s.name}.json`, JSON.stringify(rows, null, 2));
      expect(rows.filter((v) => ['serious', 'critical'].includes(v.impact)), JSON.stringify(rows, null, 1)).toEqual([]);
    });
  }
}
