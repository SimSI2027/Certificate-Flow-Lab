// Home screen and the Website TLS lesson. v0.5.0: the classic TLS workspace (scrubber, jump select, five tabs, legend, Labels and Reset
// camera) was replaced by the story layout; each classic test below was migrated deliberately and keeps its original intent.
import { test, expect } from '@playwright/test';

const TLS = 'tls-manual-enrollment', DCID = 'dc-manual-certificate-request';
const st = (page) => page.evaluate(() => window.__cfl.getState());
const go = async (page, q = '') => { await page.goto(`/?${q}`); await page.waitForFunction(() => window.__cfl); };
const open = (page, extra = '') => go(page, `scenario=${TLS}${extra ? `&${extra}` : ''}`);
const next = async (page, n = 1) => { for (let i = 0; i < n; i++) await page.click('#s-next'); };
const quiet = (m, loc = '') => !/ERR_CONNECTION_REFUSED|5184/.test(m.text() + loc);
const openSec = async (page, id) => { if ((await page.locator(`[data-sec-toggle="${id}"]`).getAttribute('aria-expanded')) !== 'true') await page.click(`[data-sec-toggle="${id}"]`); };

test('scenario home appears first, offers two scenarios, a quiet future list and no auto-started tour', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && quiet(m, m.location().url ?? '')) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  await go(page);
  await expect(page).toHaveTitle('Certificate Flow Lab');
  await expect(page.locator('#home')).toBeVisible(); await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.locator('#home h1')).toHaveText('Certificate Flow Lab');
  await expect(page.locator('#home')).toContainText('Interactive certificate issuance, deployment and trust visualization');
  await expect(page.locator('.synthetic-note')).toContainText('Synthetic simulation');
  await expect(page.locator('.scard')).toHaveCount(2);
  await expect(page.locator('.scard').first()).toContainText('Website TLS Certificate');
  await expect(page.locator('.scard').nth(1)).toContainText('Domain Controller Manual Enrollment');
  for (const w of ['Purpose', 'Primary requester', 'Certificate destination', 'Enrollment method', 'Steps']) await expect(page.locator('.scard').first()).toContainText(w);
  // v0.4.1: the DC card starts from a path picker (Path A and Path B), so there are three start controls; TLS keeps one.
  await expect(page.locator('[data-start]')).toHaveCount(3);
  await expect(page.locator(`[data-start="${TLS}"]`)).toHaveCount(1);
  expect(await page.locator(`[data-start="${DCID}"]`).evaluateAll((els) => els.map((e) => e.dataset.startPath))).toEqual(['csr', 'mmc']);
  await expect(page.locator(`.scard[data-scenario="${DCID}"] .cond`)).toContainText('Exceptional condition for this lesson'.toLowerCase());
  await expect(page.locator('.later li')).toHaveCount(5);
  await expect(page.locator('.later')).toContainText('NDES / SCEP Device Enrollment');
  await expect(page.locator('body')).not.toHaveAttribute('data-tour', 'running');
  await expect(page.locator('#btn-topology')).toBeVisible(); await expect(page.locator('#btn-about')).toBeVisible();
  await page.click('#btn-about'); await expect(page.locator('#about')).toBeVisible(); await expect(page.locator('#about')).toContainText('not official Microsoft icons'); await page.keyboard.press('Escape');
  expect(problems).toEqual([]);
});

test('TLS home card: 26 steps in two acts, the visitor only reports; Start opens the story; Home returns and Continue resumes', async ({ page }) => {
  await go(page);
  const card = page.locator(`.scard[data-scenario="${TLS}"]`);
  await expect(card).toContainText('26 steps in 2 acts'); await expect(card).toContainText('SIMSI2027\\Morgan, the application owner'); await expect(card).toContainText('only reports the problem');
  await page.click(`[data-start="${TLS}"]`);
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'story'); await expect(page.locator('#s-title')).toHaveText('Website TLS Certificate');
  await expect(page.locator('#s-pathseg')).toBeHidden(); await expect(page.locator('#s-condwrap')).toBeHidden(); await expect(page.locator('#s-full')).not.toBeChecked();
  expect(await page.locator('#story-scene .szone[data-mode="placeholder"]').count()).toBe(6);
  await expect(page.locator('#story-scene .ot')).toHaveClass(/muted/);
  await expect(page.locator('#s-rail .act')).toHaveCount(2);
  expect(await page.locator('#s-rail .act-label').allTextContents()).toEqual(['Act 1 · Get the certificate', 'Act 2 · Use the certificate']);
  await expect(page.locator('#s-rail .act').first().locator('.mchip')).toHaveCount(6); await expect(page.locator('#s-rail .act').nth(1).locator('.mchip')).toHaveCount(4);
  await page.click('#s-home'); await expect(page.locator('#home')).toBeVisible(); await expect(page.locator('#btn-continue')).toBeVisible();
  await page.click('#btn-continue'); await expect(page.locator('#workspace')).toBeVisible(); await expect(page.locator('#s-title')).toHaveText('Website TLS Certificate');
});

test('the classic workspace is gone: no scrubber, jump select, tabs, legend, Labels or Reset camera', async ({ page }) => {
  await open(page, 't=5');
  for (const sel of ['#scrubber', '#sel-jump', '[data-tabbtn]', '.legend', '#chk-labels', '#btn-reset-camera', '#scene']) await expect(page.locator(sel)).toHaveCount(0);
});

test('the offline Root CA stays muted; the history link appears only while the chain is built or a CA certificate is inspected; full topology reveals every zone', async ({ page }) => {
  await open(page, 't=12');
  await expect(page.locator('#story-scene .cn-history')).toHaveCount(0); await expect(page.locator('#story-scene .ot')).toHaveClass(/muted/);
  await page.check('#s-full'); expect(await page.locator('#story-scene .szone[data-mode="placeholder"], #story-scene .szone[data-mode="finished"]').count()).toBe(0);
  await expect(page.locator('#story-scene .szone[data-mode="active"]')).toHaveCount(1); await page.uncheck('#s-full');
  await open(page, 't=21'); await expect(page.locator('#story-scene .cn-history')).toContainText('signed the Issuing CA certificate earlier (offline)');
  expect(await page.evaluate(() => window.__cfl.app.sc.flows.filter((f) => /OT|root/i.test(f.from + f.to)).length)).toBe(0);
});

test('play at 2x advances; pause freezes; Next and Previous move one step', async ({ page }) => {
  await open(page, 'start=1');
  await page.selectOption('#s-speed', '2'); await page.click('#s-play');
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  await page.click('#s-play'); const a = await st(page); await page.waitForTimeout(400); expect((await st(page)).stageProgress).toBe(a.stageProgress);
  await page.click('#s-restart'); await next(page, 3);
  let s = await st(page); expect([s.stage, s.stageProgress, s.requestState]).toEqual([2, 1, 'needed']);
  await page.click('#s-prev'); s = await st(page); expect([s.stage, s.stageProgress]).toEqual([1, 1]);
});

test('milestone rail and speed control the same state; selection does not reset the position', async ({ page }) => {
  await open(page, 'start=1');
  await page.click('#s-rail .mchip[data-milestone="Create key and CSR"]');
  let s = await st(page); expect([s.stage, s.csrState]).toEqual([6, 'created']);
  for (const v of ['0.5', '1', '2']) { await page.selectOption('#s-speed', v); expect((await st(page)).playbackSpeed).toBe(Number(v)); }
  await page.locator('#story-scene .spot[data-artifact="csr"]').click(); s = await st(page); expect([s.stage, s.stageProgress]).toEqual([6, 1]);
  await expect(page.locator('#sec-technical')).toContainText('SPKI SHA-256');
});

test('reverse evidence traces evidence for TLS and keeps the finished world', async ({ page }) => {
  await open(page, 'start=1'); await page.click('#s-rev');
  let s = await st(page); expect([s.direction, s.trustDecision, s.evidenceIndex]).toEqual(['reverse', 'trusted', 0]);
  await expect(page.locator('#s-caption')).toContainText('Evidence 1 of 11 · Why is the connection trusted?');
  await next(page, 10); s = await st(page); expect(s.evidenceIndex).toBe(10); expect(s.keyState).toBe('associated');
  await expect(page.locator('#story-scene .plate-head')).toContainText('Why did the work start?');
  await page.click('#s-fwd'); expect((await st(page)).direction).toBe('forward');
});

test('clicking zones explains people and computers; the IP address is context only', async ({ page }) => {
  await open(page, 't=1');
  await page.locator('#story-scene [data-sel="zone:Z1"]').click(); await expect(page.locator('#sec-plain')).toContainText('CLIENT01, where Jordan browses');
  await page.keyboard.press('Escape'); await page.click('#spanel .popen'); await openSec(page, 'technical');
  await expect(page.locator('#sec-technical')).toContainText('SIMSI2027\\Jordan on CLIENT01 (10.20.10.45)');
  await expect(page.locator('#sec-technical')).toContainText('an address grants no certificate rights');
  // Below 1600 px the open panel is a drawer over the plate: close it (Escape) before selecting the next object.
  await page.keyboard.press('Escape'); await page.locator('#story-scene .ot').click(); await expect(page.locator('#sec-plain')).toContainText('never signs the website certificate');
});

test('template, request record and AIA/CDP endpoints expose technical details', async ({ page }) => {
  await open(page, 't=5'); await page.locator('#story-scene .spot[data-artifact="requirements"]').click();
  for (const t of ['SIMSI2027 Web Server', 'Supply in the request', 'Server Authentication only', 'Web Server Certificate Requesters', 'Web Server (built-in)', 'Domain Admins and Enterprise Admins by default', 'Depends on your configuration']) await expect(page.locator('#sec-technical')).toContainText(t);
  await open(page, 't=10'); await page.locator('#story-scene .spot[data-artifact="record"]').click();
  for (const t of ['1043', 'SIMSI2027\\Morgan', 'SIMSI2027WebServer', 'Allowed by policy']) await expect(page.locator('#sec-technical')).toContainText(t);
  await open(page, 't=21'); await page.locator('#story-scene [data-sel="pub:aia"]').click(); await expect(page.locator('#sec-plain')).toContainText('issuer certificate');
  await page.keyboard.press('Escape'); await page.locator('#story-scene [data-sel="pub:cdp"]').click(); await expect(page.locator('#sec-plain')).toContainText('different URL from the AIA');
});

test('certificate inspector shows the parsed fields; CSR and CRL inspectors open from their cards', async ({ page }) => {
  await open(page, 't=23'); await page.locator('#story-scene .spot[data-artifact="leaf"]').click();
  for (const w of ['DNS=portal.simsi2027.test', 'Server Authentication', 'SIMSI2027WebServer', 'Thumbprint (SHA-1, as Windows shows it)', 'Certification path', '/aia/SIMSI2027-ICA01.crt', '/cdp/SIMSI2027-ICA01.crl', 'valid at the simulation clock']) await expect(page.locator('#sec-technical')).toContainText(w);
  await open(page, 't=8'); await page.locator('#story-scene .spot[data-artifact="csr"]').click(); await expect(page.locator('#sec-technical')).toContainText('proof of possession');
  await open(page, 't=24'); await page.locator('#story-scene .spot[data-artifact="crl"]').click(); await expect(page.locator('#sec-technical')).toContainText('2027000000000000000000000000DD99');
});

test('public certificate artifact can be downloaded and is real DER', async ({ page }) => {
  await open(page, 't=23'); await page.locator('#story-scene .spot[data-artifact="leaf"]').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="portal.simsi2027.test.cer"]')]);
  expect(dl.suggestedFilename()).toBe('portal.simsi2027.test.cer');
  const bytes = await page.evaluate(async () => { const h = document.querySelector('[data-download="portal.simsi2027.test.cer"]').href; return [...new Uint8Array(await (await fetch(h)).arrayBuffer())]; });
  expect(bytes[0]).toBe(0x30); expect(Buffer.from(bytes).toString('latin1')).not.toContain('PRIVATE KEY');
});

test('healthy TLS lesson completes trusted', async ({ page }) => {
  await open(page, 'start=1'); await next(page, 26);
  const s = await st(page); expect(s).toMatchObject({ trustDecision: 'trusted', connectionState: 'trusted', iisBindingState: 'bound', halted: false });
  await expect(page.locator('#final-card h2')).toHaveText('Trusted connection: portal.simsi2027.test is who it says it is');
  await page.click('#s-next'); expect((await st(page)).stage).toBe(25);
});

const TLS_FAULTS = [['no-enroll-permission', 't-policy', 'Web Server Certificate Requesters'], ['template-not-published', 't-policy', 'not in ICA01'], ['user-context', 't-accept', 'MachineKeySet = FALSE'],
  ['no-private-key', 't-bind', 'imported into Personal'], ['wrong-binding', 't-cert-msg', 'temporary self-signed'], ['missing-ica', 't-chain', 'sent only the leaf'], ['untrusted-root', 't-chain', 'does not contain it'],
  ['wrong-dns', 't-checks', 'www.portal.simsi2027.test'], ['expired', 't-checks', '2026-09-30'], ['wrong-eku', 't-checks', 'Client Authentication'], ['revoked', 't-revocation', 'CC14'], ['cdp-unavailable', 't-revocation', 'times out']];
for (const [fault, stage, evidence] of TLS_FAULTS) {
  test(`TLS fault ${fault} halts at ${stage}; Troubleshoot moves to position 2 with the evidence`, async ({ page }) => {
    await open(page, `fault=${fault}&start=1`); await next(page, 27);
    const s = await st(page); expect(s.halted).toBe(true); expect(s.trustDecision).not.toBe('trusted');
    expect(await page.evaluate(() => document.body.dataset.stage)).toBe(stage);
    await expect(page.locator('#fault-banner')).toBeVisible(); await expect(page.locator('#final-card h2')).toContainText('Stopped');
    await page.click('#spanel .popen');
    expect(await page.locator('#spanel .psec').evaluateAll((e) => e.map((x) => x.dataset.sec))).toEqual(['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence']);
    const t = page.locator('#sec-troubleshoot'); for (const w of ['Symptom', 'Evidence', 'Owner', 'Remediation', 'Stops the flow?', 'Long term']) await expect(t).toContainText(w);
    await expect(t).toContainText(evidence);
    await openSec(page, 'evidence'); await expect(page.locator('#sec-evidence')).toContainText('User-selected fault');
    await page.click('#s-next'); expect((await st(page)).stage).toBe(s.stage);
  });
}

test('AIA and CDP stay separate in the certificate inspector', async ({ page }) => {
  await open(page, 't=23'); await page.locator('#story-scene .spot[data-artifact="leaf"]').click();
  const rows = await page.locator('#sec-technical dt').allTextContents();
  expect(rows).toContain('AIA (issuer certificate location)'); expect(rows).toContain('CDP (CRL location)');
  const aia = await page.locator('#sec-technical dt:text-is("AIA (issuer certificate location)") + dd').textContent(); expect(aia).toMatch(/\.crt$/); expect(aia).not.toContain('.crl');
});

test('narrow layout has no horizontal page overflow and the TLS story stays operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await go(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.click(`[data-start="${TLS}"]`); await expect(page.locator('#story-scene')).toBeVisible();
  await page.click('#s-next'); expect((await st(page)).stage).toBe(0); await page.click('#s-next'); expect((await st(page)).stage).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const box = await page.locator('#s-rail .mchip').first().boundingBox(); expect(box.height).toBeGreaterThanOrEqual(24);
});

test('guided tour: interaction pauses it, it resumes after inactivity and hands control back', async ({ page }) => {
  await go(page, `scenario=${TLS}&tourResume=1500`);
  await page.selectOption('#s-speed', '2'); await page.click('#s-tour');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running'); await expect(page.locator('.s-tour-bar')).toBeVisible();
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  await page.locator('#story-scene').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'paused'); await expect(page.locator('.s-tour-text')).toContainText('paused');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running', { timeout: 6000 });
  await page.evaluate(() => { const t = window.__cfl.tour; t.index = t.steps.length - 1; t.phase = 'enter'; });
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'finished', { timeout: 20000 });
  const s = await st(page); expect([s.direction, s.trustDecision]).toEqual(['forward', 'trusted']); await expect(page.locator('.s-tour-text')).toContainText('You are in control');
});

test('native viewer control: explained and disabled without a companion; works through a mocked local companion', async ({ page }) => {
  await page.route('http://127.0.0.1:5184/**', (r) => r.abort());
  await open(page, 't=23'); await page.locator('#story-scene .spot[data-artifact="leaf"]').click();
  await expect(page.locator('[data-native="portal-leaf"]')).toBeDisabled(); await expect(page.locator('[data-native-note]')).toContainText('local companion');
  await expect(page.locator('[data-download="portal.simsi2027.test.cer"]')).toBeVisible();
  const calls = []; const p2 = await page.context().newPage();
  await p2.route('http://127.0.0.1:5184/**', async (r) => {
    const req = r.request(); const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5183', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.url().endsWith('/health')) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'certificate-flow-lab-companion', artifacts: ['portal-leaf', 'dc-issued'] }) });
    calls.push({ token: req.headers()['x-cfl-token'], body: req.postData() }); return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  // v0.4.0: the DC certificate is opened from the story spotlight (a-sign) instead of the v0.3.0 chip.
  await p2.goto(`/?scenario=${DCID}&t=14#nt=abcdefghijklmnopqrstuvwx`); await p2.waitForFunction(() => window.__cfl);
  await p2.click('.spot[data-artifact="leaf"]'); await expect(p2.locator('[data-native="dc-issued"]')).toBeEnabled(); expect(p2.url()).not.toContain('nt=');
  await p2.click('[data-native="dc-issued"]'); await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({ token: 'abcdefghijklmnopqrstuvwx', body: JSON.stringify({ artifactId: 'dc-issued' }) });
});
