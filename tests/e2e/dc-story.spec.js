// v0.4.0 Domain Controller story (layoutMode story-zones): Path A and Path B, conditions, faults, panel and keyboard.
import { test, expect } from '@playwright/test';

const DCID = 'dc-manual-certificate-request', TLS = 'tls-manual-enrollment';
const st = (page) => page.evaluate(() => window.__cfl.getState());
const go = async (page, q = '') => { await page.goto(`/?${q}`); await page.waitForFunction(() => window.__cfl); };
const open = (page, extra = '') => go(page, `scenario=${DCID}${extra ? `&${extra}` : ''}`);
const next = async (page, n = 1) => { for (let i = 0; i < n; i++) await page.click('#s-next'); };
const quiet = (m) => !/ERR_CONNECTION_REFUSED|5184/.test(m.text() + (m.location().url ?? ''));
const body = (page, k) => page.evaluate((key) => document.body.dataset[key], k);
const activeConnectors = (page) => page.locator('#story-scene .conn[data-kind="active"], #story-scene .conn[data-kind="blocked"], #story-scene .conn[data-kind="association"]').count();

test('home card describes both paths; START FLOW reveals the first step; path switch works', async ({ page }) => {
  const problems = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && quiet(m)) problems.push(m.text()); }); page.on('pageerror', (e) => problems.push(e.message));
  await go(page);
  const card = page.locator(`.scard[data-scenario="${DCID}"]`);
  await expect(card).toContainText('Manual CSR transfer: 24 steps'); await expect(card).toContainText('Certificates MMC enrollment: 11 steps');
  await page.click(`[data-start="${DCID}"]`);
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'story');
  await expect(page.locator('#s-start')).toBeVisible(); await expect(page.locator('#s-caption')).toBeHidden();
  expect(await page.locator('#story-scene .szone[data-mode="placeholder"]').count()).toBe(6);
  expect(await page.locator('#story-scene .conn').count()).toBe(0);
  await expect(page.locator('#story-scene .ot')).toBeVisible();
  // classic controls are hidden in story mode
  await expect(page.locator('#scrubber')).toBeHidden(); await expect(page.locator('#sel-jump')).toBeHidden(); await expect(page.locator('#rail')).toBeHidden();
  await expect(page.locator('#s-rail .mchip')).toHaveCount(10);
  expect(await page.locator('#s-rail .mchip').allTextContents()).toEqual(['1 Diagnose', '2 Define request', '3 Create key and CSR', '4 Transfer CSR', '5 Submit and approve', '6 Issue and retrieve', '7 Return package', '8 Install CA certificates', '9 Accept leaf', '10 Verify and follow up']);
  await page.click('[data-path="mmc"]'); await expect(page.locator('[data-path="mmc"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#s-rail .mchip')).toHaveCount(6); await expect(page.locator('#s-condition')).toBeDisabled();
  await page.click('[data-path="csr"]');
  await page.click('#s-start'); await page.click('#s-play'); // pause the autoplay
  await page.click('#s-restart'); await page.click('#s-next');
  await expect(page.locator('#s-caption')).toHaveText('Step 1 of 24 · Personal has no suitable DC certificate');
  expect(problems).toEqual([]);
});

test('Path A: step to the final card with one active zone, one active route and the key staying on DC01', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, 'start=1');
  for (let i = 1; i <= 24; i++) {
    await page.click('#s-next');
    const s = await st(page); expect(s.stage).toBe(i - 1);
    expect(await page.locator('#story-scene .szone[data-mode="active"]').count()).toBe(1);
    const has = await page.evaluate(() => { const v = window.__cfl.app.sc; return !!v.stages[window.__cfl.getState().stage].connector; });
    expect(await activeConnectors(page)).toBe(has ? 1 : 0);
    if (i === 7) { await expect(page.locator('#story-scene .vault')).toContainText('pending request + private key'); await expect(page.locator('#story-scene .spot[data-artifact="csr"]')).toBeVisible(); }
    if (i === 20) { await expect(page.locator('#story-scene .cn-assoc')).toContainText('certreq -accept links this certificate to the existing key'); await expect(page.locator('#story-scene .entry[data-artifact="accepted"]')).toHaveAttribute('data-key', 'true'); }
  }
  const s = await st(page); expect(s).toMatchObject({ trustDecision: 'suitable', keyAssociation: 'matched', halted: false });
  await expect(page.locator('#final-card')).toBeVisible(); await expect(page.locator('#final-card h2')).toHaveText('Suitable now; root cause still open');
  await expect(page.locator('#story-scene .entry[data-artifact="ica"]')).toHaveAttribute('data-key', 'false'); await expect(page.locator('#story-scene .entry[data-artifact="root"]')).toHaveAttribute('data-key', 'false');
  await page.click('#fc-reverse'); expect((await st(page)).direction).toBe('reverse');
});

test('home path picker starts Path B directly', async ({ page }) => {
  await go(page); await page.click(`[data-start="${DCID}"][data-start-path="mmc"]`);
  await expect(page.locator('[data-path="mmc"]')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('#s-rail .mchip')).toHaveCount(6);
});

test('Path B: step to the final card; requester DC01$, no accept step, no key vault', async ({ page }) => {
  await open(page, 'path=mmc&start=1');
  await next(page, 7); await expect(page.locator('#s-caption')).toContainText('Key, request and direct submission'); expect((await st(page)).requester).toBe('SIMSI2027\\DC01$');
  await expect(page.locator('#story-scene .vault')).toHaveCount(0);
  await next(page, 4); const s = await st(page); expect(s).toMatchObject({ trustDecision: 'suitable', stage: 10 });
  await expect(page.locator('#final-card h2')).toHaveText('Suitable now; root cause still open');
  expect(await page.evaluate(() => window.__cfl.app.sc.stages.some((x) => /accept/.test(x.id)))).toBe(false);
});

test('trust-present condition skips the CA installation steps ("Already present — skipped")', async ({ page }) => {
  await open(page, 'condition=trust-present&t=17');
  await page.click('#s-next'); await expect(page.locator('#s-caption')).toContainText('Step 20 of 24 · Accept on the original DC01');
  await page.click('#s-prev'); await expect(page.locator('#s-caption')).toContainText('Step 17 of 24');
  await open(page, 'condition=trust-present&t=18'); await expect(page.locator('#s-caption')).toContainText('Already present — skipped');
});

test('reverse evidence walks the Path A trace with evidence kinds', async ({ page }) => {
  await open(page, 'start=1'); await page.click('#s-rev');
  await expect(page.locator('#s-caption')).toContainText('Evidence 1 of 10 · Is the DC01 certificate suitable?');
  await page.click('#spanel .popen');
  const ev = page.locator('#sec-evidence'); await expect(ev).toBeVisible(); await expect(ev).toContainText('Derived conclusion'); await expect(ev).toContainText('Real fixture data');
  await next(page, 9); await expect(page.locator('#s-caption')).toContainText('Evidence 10 of 10 · Why manual enrollment?');
  expect((await st(page)).trustDecision).toBe('suitable');
});

const FAULTS = [['rpc-blocked', 'path=mmc', 'b-enroll', 'The RPC server is unavailable'], ['wrong-template-handoff', '', 'a-policy', 'PKIOperator'], ['accepted-on-wrong-machine', '', 'a-accept', 'PKI-TRANSFER01'], ['root-thumbprint-mismatch', '', 'a-return-move', 'known-good']];
for (const [fault, extra, stage, words] of FAULTS) {
  test(`fault ${fault} halts at ${stage}; Troubleshoot moves to position 2 and opens`, async ({ page }) => {
    await open(page, `fault=${fault}&start=1${extra ? `&${extra}` : ''}`); await next(page, 25);
    const s = await st(page); expect(s.halted).toBe(true); expect(await body(page, 'stage')).toBe(stage);
    await expect(page.locator('#fault-banner')).toBeVisible(); await expect(page.locator('#final-card h2')).toContainText('Stopped');
    await page.click('#spanel .popen');
    expect(await page.locator('#spanel .psec').evaluateAll((e) => e.map((x) => x.dataset.sec))).toEqual(['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence']);
    const t = page.locator('#sec-troubleshoot'); await expect(t).toBeVisible();
    for (const w of ['Symptom', 'Evidence', 'Owner', 'Remediation', 'Stops the flow?', 'Long term']) await expect(t).toContainText(w);
    await expect(t).toContainText(words);
    if (fault === 'rpc-blocked') { await page.click('#sec-troubleshoot [data-switch-path="csr"]'); expect(await body(page, 'storyPath')).toBe('csr'); }
  });
}
test('fault cdp-unreachable continues to the verdict and withholds it', async ({ page }) => {
  await open(page, 'fault=cdp-unreachable&start=1'); await next(page, 24);
  const s = await st(page); expect(s).toMatchObject({ halted: false, trustDecision: 'withheld', revocationState: 'offline' });
  await expect(page.locator('#final-card h2')).toHaveText('Not confirmed suitable — revocation status unknown');
  await page.click('#s-prev'); await expect(page.locator('#story-scene .pubep.cdp')).toContainText('unreachable');
});

test('details panel: collapsed by default, expands, ordered sections, Escape closes and returns focus; selection keeps the step', async ({ page }) => {
  await open(page, 't=8');
  await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'false');
  const before = await st(page);
  await page.locator('#story-scene .spot[data-artifact="csr"]').click();
  await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'true');
  expect(await page.locator('#spanel .psec').evaluateAll((e) => e.map((x) => x.dataset.sec))).toEqual(['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot']);
  await expect(page.locator('#sec-plain')).toBeVisible(); await expect(page.locator('#sec-technical')).toContainText('SPKI SHA-256');
  await expect(page.locator('#sec-technical')).toContainText('DCOfflineKerberosAuth'); await expect(page.locator('#sec-technical')).toContainText('Requester (CA record)');
  const after = await st(page); expect([after.stage, after.stageProgress]).toEqual([before.stage, before.stageProgress]);
  await page.click('[data-sec-toggle="command"]'); await expect(page.locator('#sec-command')).toContainText('Shown for learning; never executed by this simulator.');
  await page.click('#sec-command [data-token="0"]'); await expect(page.locator('#sec-command .token-meaning')).toContainText('certutil');
  await page.click('[data-sec-toggle="raw"]'); await page.click('#sec-raw [data-raw="pem"]'); await expect(page.locator('#sec-raw')).toContainText('BEGIN CERTIFICATE REQUEST'); await expect(page.locator('#sec-raw')).not.toContainText('PRIVATE KEY');
  await page.keyboard.press('Escape'); await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement?.dataset?.artifact ?? document.activeElement?.closest?.('[data-artifact]')?.dataset.artifact)).toBe('csr');
  await expect(page.locator('#spanel .popen').first()).toBeVisible();
});

test('INF, CSR download and store inspector come from the real fixtures', async ({ page }) => {
  await open(page, 't=6'); await page.locator('#story-scene .spot[data-artifact="inf"]').click();
  await expect(page.locator('#sec-technical')).toContainText('MachineKeySet'); await expect(page.locator('#sec-technical')).toContainText('dns=DC01.simsi2027.test&dns=simsi2027.test&dns=SIMSI2027');
  await open(page, 't=21'); await page.locator('#story-scene [data-sel="store:personal"]').click();
  for (const q of ['What is it?', 'Who issued it?', 'Why this store?', 'Private key on DC01?', 'How did it get here?']) await expect(page.locator('#sec-technical')).toContainText(q);
  await open(page, 't=8'); await page.locator('#story-scene .spot[data-artifact="csr"]').click();
  const bytes = await page.evaluate(async () => { const h = document.querySelector('[data-download="dc01-request.der"]').href; return [...new Uint8Array(await (await fetch(h)).arrayBuffer())]; });
  expect(bytes[0]).toBe(0x30); expect(Buffer.from(bytes).toString('latin1')).not.toContain('PRIVATE KEY');
});

test('Root CA appears only as the muted history link in the chain step', async ({ page }) => {
  await open(page, 't=11'); await expect(page.locator('#story-scene .cn-history')).toHaveCount(0);
  await open(page, 't=23'); await expect(page.locator('#story-scene .cn-history')).toContainText('signed the Issuing CA certificate earlier (offline)');
  await expect(page.locator('#story-scene .pubep.aia')).toBeVisible(); await expect(page.locator('#story-scene .pubep.cdp')).toBeVisible();
  await expect(page.locator('#story-scene .conn[data-kind="active"]')).toContainText('HTTP (CDP)');
});

test('keyboard: Space plays/pauses, arrows step, Enter selects a focused artifact; controls have accessible names', async ({ page }) => {
  await open(page, 'start=1');
  await page.locator('#story-scene').focus(); await page.keyboard.press('Space'); await page.keyboard.press('Space');
  await page.click('#s-restart');
  await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); expect((await st(page)).stage).toBe(1);
  await page.locator('body').press('ArrowLeft'); expect((await st(page)).stage).toBe(0);
  await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight'); await page.locator('body').press('ArrowRight');
  await page.locator('#story-scene .spot').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#spanel')).toHaveAttribute('data-expanded', 'true');
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#story-scene [data-sel], .story-only button, .story-only select, .story-only input, #spanel button')].filter((e) => e.offsetParent !== null || e.closest('svg')).filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.labels?.length || e.title)).length);
  expect(unnamed).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('#story-scene [data-sel]')].every((n) => n.getAttribute('tabindex') === '0' && n.getAttribute('role') === 'button'))).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('.disc')].every((b) => b.hasAttribute('aria-expanded') && b.hasAttribute('aria-controls')))).toBe(true);
  await page.click('#s-rail .mchip[data-milestone="Accept leaf"]'); await expect(page.locator('#s-caption')).toContainText('Step 20 of 24');
});

test('audit W2: the URL reflects path, condition, fault and step, and a reload returns to the same step', async ({ page }) => {
  await open(page, 'start=1'); await page.click('#s-play'); await page.click('#s-restart');
  await page.selectOption('#s-condition', 'trust-present'); await next(page, 3);
  await expect.poll(() => new URL(page.url()).searchParams.get('t')).toBe('3');
  const q = new URL(page.url()).searchParams; expect([q.get('path'), q.get('condition'), q.get('fault')]).toEqual(['csr', 'trust-present', null]);
  await page.reload(); await page.waitForFunction(() => window.__cfl);
  await expect(page.locator('#s-caption')).toHaveText('Step 3 of 24 · Inspect trust stores');
  await page.click('#s-home'); expect(new URL(page.url()).search).toBe('');
});

test('v0.4.1 design: copy buttons copy (never execute), tokens explain on focus, final card lists open items, plate headline follows reverse evidence', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage();
  await page.goto(`/?scenario=${DCID}&t=11`); await page.waitForFunction(() => window.__cfl);
  await page.click('#spanel .popen'); await page.click('[data-sec-toggle="command"]');
  await page.locator('#sec-command [data-token="2"]').focus(); await expect(page.locator('#sec-command .token-meaning')).toContainText('-config');
  await page.click('#sec-command [data-copy]'); await expect(page.locator('#sec-command [data-copy]')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('certreq -submit -config "ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01" dc01-request.req');
  await expect(page.locator('#copy-status')).toHaveText('Command copied to the clipboard.');
  expect((await page.evaluate(() => window.__cfl.getState())).stage).toBe(10);
  await page.goto(`/?scenario=${DCID}&t=24`); await page.waitForFunction(() => window.__cfl);
  await page.click('#final-card summary'); await expect(page.locator('#final-card details li')).toHaveCount(7);
  await expect(page.locator('#final-card details')).toContainText('Unpublish DCOfflineKerberosAuth');
  await page.click('#fc-reverse'); await expect(page.locator('#story-scene .plate-head')).toContainText('Evidence 1 of 10');
  await ctx.close();
});

test('reduced motion disables the moving packet', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto(`/?scenario=${DCID}&t=6.5`); await page.waitForFunction(() => window.__cfl);
  await expect(page.locator('#story-scene #packet')).toBeHidden();
  expect(await page.evaluate(() => window.__cfl.app.storyCtl.scene.reduced)).toBe(true);
  await ctx.close();
});

// v0.5.0: the TLS lesson moved from the classic layout to the story layout; this smoke test was migrated to it (same intent: the
// other lesson still loads, steps and ends trusted next to the DC story).
test('TLS regression smoke: the story layout loads, steps and ends trusted', async ({ page }) => {
  await go(page, `scenario=${TLS}&start=1`); await expect(page.locator('body')).toHaveAttribute('data-layout', 'story');
  await expect(page.locator('#story-scene')).toBeVisible(); await expect(page.locator('#s-title')).toHaveText('Website TLS Certificate');
  for (let i = 0; i < 26; i++) await page.click('#s-next');
  expect((await st(page)).trustDecision).toBe('trusted');
});
