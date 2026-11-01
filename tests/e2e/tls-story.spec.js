// v0.5.0 Website TLS story (layoutMode story-zones): full walk, one active zone / route, key never on the wire, panel, glossary,
// handshake inspector, keyboard, URL state and reduced motion.
import { test, expect } from '@playwright/test';

const TLS = 'tls-manual-enrollment';
const st = (page) => page.evaluate(() => window.__cfl.getState());
const go = async (page, q = '') => { await page.goto(`/?${q}`); await page.waitForFunction(() => window.__cfl); };
const open = (page, extra = '') => go(page, `scenario=${TLS}${extra ? `&${extra}` : ''}`);
const quiet = (m) => !/ERR_CONNECTION_REFUSED|5184/.test(m.text() + (m.location().url ?? ''));
const activeConnectors = (page) => page.locator('#story-scene .conn[data-kind="active"], #story-scene .conn[data-kind="blocked"], #story-scene .conn[data-kind="association"]').count();

test('home → Start → START FLOW → all 26 steps to the final card: one active zone, one active route, the key never on the wire', async ({ page }) => {
  test.setTimeout(120000);
  const problems = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && quiet(m)) problems.push(m.text()); }); page.on('pageerror', (e) => problems.push(e.message));
  await go(page); await page.click(`[data-start="${TLS}"]`);
  await expect(page.locator('#s-start')).toBeVisible(); await expect(page.locator('#story-scene .plate-head')).toContainText('Act 1 gets the certificate');
  await page.click('#s-start'); await page.click('#s-play'); await page.click('#s-restart');
  for (let i = 1; i <= 26; i++) {
    await page.click('#s-next');
    const s = await st(page); expect(s.stage).toBe(i - 1);
    expect(await page.locator('#story-scene .szone[data-mode="active"]').count()).toBe(1);
    const moves = await page.evaluate(() => !!window.__cfl.app.sc.stages[window.__cfl.getState().stage].connector);
    expect(await activeConnectors(page), `step ${i}`).toBe(moves ? 1 : 0);
    // The private key never appears in the "On the wire" zone (Z5) and never on a route.
    expect(await page.locator('#story-scene .szone[data-zone="Z5"] [data-sel="artifact:private-key"]').count()).toBe(0);
    await expect(page.locator('#s-caption')).toContainText(`Step ${i} of 26`);
    if (i === 7) { await expect(page.locator('#story-scene .vault')).toContainText('pending request + private key'); await expect(page.locator('#story-scene .spot[data-artifact="csr"]')).toBeVisible(); }
    if (i === 9) await expect(page.locator('#story-scene .spot[data-artifact="csr"]')).toContainText('Request 1043');
    if (i === 13) { await expect(page.locator('#story-scene .cn-assoc')).toContainText('same computer (WEB01), never on the network'); await expect(page.locator('#story-scene .entry[data-artifact="accepted"]')).toHaveAttribute('data-key', 'true'); }
    if (i === 15) await expect(page.locator('#story-scene .iiscard')).toContainText('new certificate');
    if (i === 19) await expect(page.locator('#story-scene .conn.cn-wire')).toContainText('HTTPS 443 / TLS');
    if (i === 21) await expect(page.locator('#story-scene .cn-history')).toBeVisible();
    if (i === 24) await expect(page.locator('#story-scene .conn[data-kind="active"]')).toContainText('HTTP (CDP)');
  }
  const s = await st(page); expect(s).toMatchObject({ trustDecision: 'trusted', keyAssociation: 'matched', halted: false });
  await expect(page.locator('#final-card h2')).toHaveText('Trusted connection: portal.simsi2027.test is who it says it is');
  await page.click('#final-card summary'); await expect(page.locator('#final-card details li').first()).toContainText('Renew before 2027-10-30');
  await page.click('#fc-reverse'); expect((await st(page)).direction).toBe('reverse');
  expect(problems).toEqual([]);
});

test('acts: the rail marks the current act; Act 1 is done when Act 2 starts', async ({ page }) => {
  await open(page, 't=17');
  await expect(page.locator('#s-rail .act').nth(1)).toHaveClass(/current/); await expect(page.locator('#s-rail .act').first()).toHaveClass(/done/);
  await page.click('#s-rail .mchip[data-milestone="Bind in IIS"]'); await expect(page.locator('#s-caption')).toContainText('Step 15 of 26');
});

test('details panel: collapsed by default with what/why/who/moves, expands in order, Escape closes and returns focus; selection keeps the step', async ({ page }) => {
  await open(page, 't=19');
  await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'false');
  for (const w of ['What happens', 'Why it is needed', 'Who acts', 'What moves']) await expect(page.locator('#spanel')).toContainText(w);
  const before = await st(page);
  await page.locator('#story-scene .spot[data-artifact="handshake"]').click();
  await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'true');
  expect(await page.locator('#spanel .psec').evaluateAll((e) => e.map((x) => x.dataset.sec))).toEqual(['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot']);
  expect(await page.locator('#spanel .disc').allTextContents()).toEqual(['1 · Plain language', '2 · Technical details', '3 · Command or GUI path', '4 · Raw artifact', '5 · Evidence', '6 · Troubleshoot']);
  // Handshake inspector
  for (const w of ['Handshake inspector (TLS 1.3)', 'ClientHello SNI', 'TLS_AES_256_GCM_SHA384', 'Certificate list sent', 'What never travels']) await expect(page.locator('#sec-technical')).toContainText(w);
  const after = await st(page); expect([after.stage, after.stageProgress]).toEqual([before.stage, before.stageProgress]);
  await page.keyboard.press('Escape'); await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement?.dataset?.artifact ?? document.activeElement?.closest?.('[data-artifact]')?.dataset.artifact)).toBe('handshake');
});

test('glossary chips are focusable buttons that open a one-line definition', async ({ page }) => {
  await open(page, 't=18'); await page.click('#spanel .popen');
  const sni = page.locator('#sec-plain [data-gloss="SNI"]'); await expect(sni).toHaveCount(1); await expect(sni).toHaveAttribute('aria-expanded', 'false');
  await sni.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#sec-plain [data-gloss="SNI"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sec-plain .gloss-def')).toContainText('Server Name Indication');
  expect(await page.evaluate(() => document.activeElement?.dataset?.gloss)).toBe('SNI');
});

test('command and GUI path: banner, tokens explain on focus, copy only', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage();
  await page.goto(`/?scenario=${TLS}&t=9`); await page.waitForFunction(() => window.__cfl);
  await page.click('#spanel .popen'); await page.click('[data-sec-toggle="command"]');
  await expect(page.locator('#sec-command')).toContainText('Shown for learning; never executed by this simulator.');
  await page.locator('#sec-command [data-token="3"]').focus(); await expect(page.locator('#sec-command .token-meaning')).toContainText('CA configuration string');
  await page.click('#sec-command [data-copy]'); expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('certreq -submit -config "ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01" portal.req portal.cer');
  await page.goto(`/?scenario=${TLS}&t=15`); await page.waitForFunction(() => window.__cfl);
  await page.click('#spanel .popen'); await page.click('[data-sec-toggle="command"]');
  await expect(page.locator('#sec-command')).toContainText('GUI path (IIS Manager)'); await page.locator('#sec-command [data-token="9"]').focus();
  await expect(page.locator('#sec-command .token-meaning')).toContainText('Require Server Name Indication');
  await ctx.close();
});

test('stores: WEB01 shows Personal with key, Intermediate and Trusted Root from AD; CLIENT01 Trusted Root holds the Root without a key', async ({ page }) => {
  await open(page, 't=14');
  await expect(page.locator('#story-scene .store[data-store="personal"] .entry')).toHaveAttribute('data-key', 'true');
  for (const id of ['intermediate', 'root']) { await expect(page.locator(`#story-scene .store[data-store="${id}"] .entry`)).toHaveAttribute('data-key', 'false'); await expect(page.locator(`#story-scene .store[data-store="${id}"]`)).toContainText('Enterprise (AD)'); }
  await page.locator('#story-scene [data-sel="store:personal"]').click();
  for (const w of ['Certificate Enrollment Requests (WEB01)', 'Private key on WEB01?']) await expect(page.locator('#sec-technical')).toContainText(w);
  await open(page, 't=21'); await expect(page.locator('#story-scene .store.client .entry')).toHaveAttribute('data-key', 'false');
  await page.locator('#story-scene [data-sel="store:client-root"]').click(); await expect(page.locator('#sec-technical')).toContainText('CLIENT01 holds no private key for portal.simsi2027.test');
});

test('missing-ica draws the blocked AIA route; untrusted-root empties CLIENT01 Trusted Root', async ({ page }) => {
  await open(page, 'fault=missing-ica&t=21');
  await expect(page.locator('#story-scene .conn[data-kind="blocked"]')).toContainText('HTTP (AIA) unreachable'); await expect(page.locator('#story-scene .pubep.aia')).toContainText('unreachable');
  await open(page, 'fault=untrusted-root&t=21'); await expect(page.locator('#story-scene .store.client')).toContainText('No SIMSI2027 Root CA');
});

test('keyboard: arrows step, Enter selects a focused artifact, controls have accessible names; the URL keeps the step', async ({ page }) => {
  await open(page, 'start=1');
  await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); expect((await st(page)).stage).toBe(1);
  await page.locator('body').press('ArrowLeft'); expect((await st(page)).stage).toBe(0);
  for (let i = 0; i < 6; i++) await page.locator('body').press('ArrowRight');
  await page.locator('#story-scene .spot').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'true');
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#story-scene [data-sel], .story-only button, .story-only select, .story-only input, #spanel button')].filter((e) => e.offsetParent !== null || e.closest('svg')).filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.labels?.length || e.title)).length);
  expect(unnamed).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('#story-scene [data-sel]')].every((n) => n.getAttribute('tabindex') === '0' && n.getAttribute('role') === 'button'))).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get('t')).toBe('7'); expect(new URL(page.url()).searchParams.get('path')).toBeNull();
  await page.reload(); await page.waitForFunction(() => window.__cfl); await expect(page.locator('#s-caption')).toContainText('Step 7 of 26');
});

test('reduced motion disables the moving packet', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto(`/?scenario=${TLS}&t=18.5`); await page.waitForFunction(() => window.__cfl);
  await expect(page.locator('#story-scene #packet')).toBeHidden(); expect(await page.evaluate(() => window.__cfl.app.storyCtl.scene.reduced)).toBe(true);
  await ctx.close();
});
