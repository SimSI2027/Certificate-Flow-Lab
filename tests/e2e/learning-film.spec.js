// v0.6.0 learning film page: loads without console errors, renderAt(t) is deterministic in the browser, representative
// timestamps render non-blank frames, preview controls are keyboard operable, and axe reports no serious/critical issues.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const open = async (page, q = '') => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/learning-film.html${q}`);
  await page.waitForFunction(() => window.__learningFilm?.ready, null, { timeout: 30000 });
  return errors;
};

test('learning film page loads without console errors and exposes renderAt', async ({ page }) => {
  const errors = await open(page);
  const info = await page.evaluate(() => ({ d: window.__learningFilm.duration, fps: window.__learningFilm.fps, shots: window.__learningFilm.shots.length, fn: typeof window.renderAt }));
  expect(info).toMatchObject({ fps: 60, shots: 18, fn: 'function' }); expect(info.d).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});

test('renderAt(t) is deterministic: same timestamp, same frame DOM, regardless of order', async ({ page }) => {
  await open(page, '?capture');
  const snap = (t) => page.evaluate((x) => { window.renderAt(x); return document.getElementById('lf-frame').innerHTML; }, t);
  const a = await snap(96.3); await snap(12); await snap(210); const b = await snap(96.3);
  expect(b).toBe(a);
  // Capture mode places the 1920x1080 frame exactly at the origin (a shifted frame would crop the export).
  expect(await page.locator('#lf-frame').boundingBox()).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  const s1 = await page.evaluate(() => window.renderAt(150)); const s2 = await page.evaluate(() => window.renderAt(150)); expect(s2).toEqual(s1);
});

test('every shot renders a non-blank frame with its caption and the key stays on WEB01', async ({ page }) => {
  await open(page, '?capture');
  const shots = await page.evaluate(() => window.__learningFilm.shots);
  for (const s of shots) {
    const t = s.start + Math.min(3, (s.end - s.start) / 2);
    const r = await page.evaluate((x) => window.renderAt(x), t);
    expect(r.shot).toBe(s.id); expect(r.keyLocation).toBe('WEB01');
    const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    expect(shot.length, s.id).toBeGreaterThan(30000); // a flat blank frame compresses far smaller
    if (s.id !== 'end') await expect(page.locator('.lf-cap h2')).not.toBeEmpty();
  }
  await page.evaluate((x) => window.renderAt(x), shots.at(-1).start + 4);
  await expect(page.locator('.lf-furl')).toHaveText('simsi2027.github.io/Certificate-Flow-Lab/');
});

test('preview controls are keyboard operable and named', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Film position' })).toBeVisible();
  await page.getByRole('button', { name: 'Next shot' }).focus(); await page.keyboard.press('Enter');
  const t1 = await page.evaluate(() => Number(document.getElementById('lf-seek').value));
  await page.getByRole('button', { name: 'Previous shot' }).focus(); await page.keyboard.press('Enter');
  const t2 = await page.evaluate(() => Number(document.getElementById('lf-seek').value));
  expect(t2).toBeLessThan(t1);
  await page.locator('#lf-shotlist button').nth(6).click();
  await expect(page.locator('#lf-shotlist button').nth(6)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#lf-live')).not.toBeEmpty();
});

test('axe: the learning film page has no serious or critical violations', async ({ page }) => {
  await open(page);
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('home screen links to the learning film', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: /Learning film/ });
  await expect(link).toHaveAttribute('href', /learning-film\.html$/);
});
