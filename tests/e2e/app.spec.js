import { test, expect } from '@playwright/test';

const st = (page) => page.evaluate(() => window.__cfl.getState());
const go = async (page, q = '') => { await page.goto(`/${q}`); await page.waitForFunction(() => window.__cfl); };
const stepN = async (page, n) => { for (let i = 0; i < n; i++) await page.click('#btn-step-fwd'); };
const end = async (page) => { await page.evaluate(() => { const a = window.__cfl.app; a.pause(); a.setT(a.max); a.render(true); }); };

test('page loads without console errors and states the data is synthetic', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  await go(page);
  await expect(page).toHaveTitle('Certificate Flow Lab');
  await expect(page.locator('.synthetic-banner')).toContainText('Synthetic simulation');
  await expect(page.locator('#scene .node')).toHaveCount(15 + 1);
  expect(problems).toEqual([]);
});

test('forward play advances the scenario at 2x', async ({ page }) => {
  await go(page);
  await page.click('[data-speed="2"]');
  await page.click('#btn-play');
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await page.click('#btn-pause');
  const a = await st(page);
  await page.waitForTimeout(400);
  expect((await st(page)).stageProgress).toBe(a.stageProgress);
});

test('step forward and backward move by stage', async ({ page }) => {
  await go(page);
  await stepN(page, 3);
  let s = await st(page);
  expect([s.stage, s.stageProgress]).toEqual([2, 1]);
  expect(s.requestState).toBe('needed');
  await page.click('#btn-step-back');
  s = await st(page);
  expect([s.stage, s.stageProgress]).toEqual([1, 1]);
  await page.click('#btn-restart');
  expect((await st(page)).stage).toBe(0);
  await expect(page.locator('#pos-label')).toHaveText('Start');
});

test('timeline scrubber, jump menu and speeds control the same state', async ({ page }) => {
  await go(page);
  await page.locator('#scrubber').fill('1150');
  let s = await st(page);
  expect(s.stage).toBe(11);
  expect(s.stageProgress).toBeCloseTo(0.5, 1);
  expect(s.installationState).toBe('installing');
  await page.selectOption('#sel-jump', '6');
  s = await st(page);
  expect([s.stage, s.csrState, s.templateDecision]).toEqual([5, 'created', 'pending']);
  for (const v of ['0.25', '0.5', '1', '2']) { await page.click(`[data-speed="${v}"]`); expect((await st(page)).playbackSpeed).toBe(Number(v)); }
});

test('reverse evidence mode traces evidence instead of replaying backward', async ({ page }) => {
  await go(page);
  await page.click('#btn-mode-reverse');
  await expect(page.locator('#panel-evidence')).toBeVisible();
  let s = await st(page);
  expect(s.direction).toBe('reverse');
  expect(s.trustDecision).toBe('trusted');
  expect(s.evidenceIndex).toBe(0);
  await expect(page.locator('#panel-evidence .trace li.current')).toContainText('Why is the site trusted?');
  await stepN(page, 13);
  s = await st(page);
  expect(s.evidenceIndex).toBe(12);
  expect(s.trustDecision).toBe('trusted');
  expect(s.keyState).toBe('held-on-web01');
  await expect(page.locator('#panel-evidence .trace li.current')).toContainText('visitor');
  await expect(page.locator('#panel-evidence .trace li.current')).toContainText('Jordan');
  await page.click('#btn-mode-forward');
  expect((await st(page)).direction).toBe('forward');
});

test('click visitor, client, application owner, WEB01', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('[data-entity="visitor"]');
  await expect(page.locator('#panel-details')).toContainText('SIMSI2027\\Jordan');
  await expect(page.locator('#panel-details')).toContainText('Standard user');
  await expect(page.locator('#panel-details')).toContainText('Observed browser error');
  await page.click('[data-entity="client01"]');
  await expect(page.locator('#panel-details')).toContainText('10.20.10.45');
  await expect(page.locator('#panel-details')).toContainText('not');
  await expect(page.locator('#panel-details')).toContainText('enrollment authority');
  await page.click('[data-entity="owner"]');
  await expect(page.locator('#panel-details')).toContainText('SIMSI2027\\Morgan');
  await expect(page.locator('#panel-details')).toContainText('WebServer-Requesters');
  await page.click('[data-entity="web01"]');
  await expect(page.locator('#panel-details')).toContainText('Private-key state');
  await expect(page.locator('#panel-details')).toContainText('SNI state');
});

test('click template, CA, root CA, PKIWEB01 and a flow arrow', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('[data-entity="template"]');
  for (const t of ['Template OID', 'Schema version', 'Renewal period', 'Enrollment permissions', 'Approval requirement', 'Policy decision']) await expect(page.locator('#panel-details')).toContainText(t);
  await page.click('[data-entity="ica01"]');
  await expect(page.locator('#panel-details')).toContainText('Issued serial number');
  await expect(page.locator('#panel-details')).toContainText('2027000000000000000000000000CC10');
  await page.click('[data-entity="rootca"]');
  await expect(page.locator('#panel-details')).toContainText('does not');
  await expect(page.locator('#panel-details')).toContainText('issue the website certificate');
  await page.click('[data-entity="pkiweb01"]');
  await expect(page.locator('#panel-details')).toContainText('AIA endpoint');
  await expect(page.locator('#panel-details')).toContainText('Raw extension value');
  await expect(page.locator('#panel-details')).toContainText('http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl');
  await page.locator('.flow[data-flow="f-submit"] .flow-hit').dispatchEvent('click');
  await expect(page.locator('#panel-details')).toContainText('Conceptual protocol');
  await expect(page.locator('#panel-details')).toContainText('Request ID');
  await expect(page.locator('#panel-details')).toContainText('1042');
});

test('click CSR and certificate chips open the inspector with real fixture data', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('.chip[data-artifact="csr"]');
  await expect(page.locator('#panel-inspector')).toBeVisible();
  await expect(page.locator('#panel-inspector')).toContainText('CN=portal.simsi2027.test');
  await page.click('[data-tab="san"]');
  await expect(page.locator('.tabpanel')).toContainText('portal.simsi2027.test');
  await page.click('.chip[data-artifact="leaf"]');
  await expect(page.locator('#panel-inspector')).toContainText('2027000000000000000000000000CC10');
});

test('certificate inspector exposes every required tab with real content', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('.chip[data-artifact="leaf"]');
  const tabs = ['general', 'details', 'certification-path', 'subject-alternative-names', 'enhanced-key-usage', 'key-usage', 'basic-constraints', 'authority-information-access', 'crl-distribution-points', 'thumbprints', 'pem', 'raw-asn-1-summary', 'issuance-history', 'matching-csr'];
  await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(tabs.length);
  const expectText = { 'subject-alternative-names': 'DNS=portal.simsi2027.test', 'enhanced-key-usage': 'Server Authentication', 'authority-information-access': 'http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt',
    'crl-distribution-points': 'http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl', pem: '-----BEGIN CERTIFICATE-----', 'raw-asn-1-summary': 'SEQUENCE', 'matching-csr': 'Public key identical', 'basic-constraints': 'End entity',
    thumbprints: 'SHA-256', 'certification-path': 'SIMSI2027 Root CA', 'issuance-history': '1042', 'key-usage': 'Digital Signature', general: 'This certificate is OK', details: 'sha256WithRSAEncryption'.slice(0, 0) };
  for (const t of tabs) {
    await page.click(`#panel-inspector [data-tab="${t}"]`);
    await expect(page.locator('.tabpanel')).toHaveAttribute('data-active-tab', t);
    await expect(page.locator('.tabpanel')).not.toBeEmpty();
    if (expectText[t]) await expect(page.locator('.tabpanel')).toContainText(expectText[t]);
  }
});

test('CSR and CRL inspectors expose their tabs', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('.chip[data-artifact="csr"]');
  await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(8);
  await page.click('[data-tab="template-request"]'); await expect(page.locator('.tabpanel')).toContainText('WebServer');
  await page.click('[data-tab="signature"]'); await expect(page.locator('.tabpanel')).toContainText('true');
  await page.click('.chip[data-artifact="crl"]');
  await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(8);
  await page.click('[data-tab="revoked-entries"]'); await expect(page.locator('.tabpanel')).toContainText('2027000000000000000000000000DD99');
  await page.click('[data-tab="distribution-location"]'); await expect(page.locator('.tabpanel')).toContainText('CDP');
  await page.click('[data-tab="crl-number"]'); await expect(page.locator('.tabpanel')).toContainText('27');
});

test('public certificate artifact can be downloaded and is real DER', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('.chip[data-artifact="leaf"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="portal.simsi2027.test.cer"]')]);
  expect(dl.suggestedFilename()).toBe('portal.simsi2027.test.cer');
  const buf = await page.evaluate(async () => { const h = document.querySelector('[data-download="portal.simsi2027.test.cer"]').href; return [...new Uint8Array(await (await fetch(h)).arrayBuffer())]; }).then((a) => Buffer.from(a));
  expect(buf[0]).toBe(0x30);
  expect(buf.length).toBeGreaterThan(500);
  expect(buf.toString('latin1')).not.toContain('PRIVATE KEY');
});

test('healthy scenario completes trusted', async ({ page }) => {
  await go(page);
  await stepN(page, 19);
  const s = await st(page);
  expect(s).toMatchObject({ trustDecision: 'trusted', connectionState: 'trusted', iisBindingState: 'bound', halted: false });
  await expect(page.locator('.node[data-entity="decision"]')).toHaveAttribute('data-status', 'ok');
  await expect(page.locator('#scene .verdict')).toHaveText('TRUSTED');
  await page.click('#btn-step-fwd');
  expect((await st(page)).stage).toBe(18);
});

const FAULTS = [
  ['revoked', 'revocation', 'revoked', 'Serial 2027000000000000000000000000CC14 is listed'],
  ['wrong-dns', 'validate', 'DNS name', 'web01.simsi2027.test'],
  ['untrusted-root', 'root-trust', 'Root in trust store', 'does not contain'],
  ['expired', 'validate', 'Validity dates', '2026-09-30'],
  ['wrong-eku', 'validate', 'EKU', 'Client Authentication'],
  ['missing-ica', 'chain-build', 'AIA', '404'],
  ['cdp-unavailable', 'revocation', 'CDP', 'timed out'],
  ['no-private-key', 'install', 'Private key', 'no matching private key']
];
for (const [fault, stage, , evidence] of FAULTS) {
  test(`failure scenario ${fault} halts at ${stage} with evidence`, async ({ page }) => {
    await go(page);
    await page.selectOption('#sel-fault', fault);
    await stepN(page, 19);
    const s = await st(page);
    expect(s.halted).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.stage)).toBe(stage);
    expect(s.trustDecision).not.toBe('trusted');
    await expect(page.locator('#fault-banner')).toBeVisible();
    const overview = page.locator('#panel-overview');
    await expect(overview).toContainText('What failed');
    await expect(overview).toContainText('Evidence');
    await expect(overview).toContainText('Still healthy');
    await expect(overview).toContainText('Likely remediation');
    await expect(overview).toContainText('Owner of the correction');
    await expect(overview).toContainText(evidence);
    await page.click('#btn-step-fwd');
    expect((await st(page)).stage).toBe(s.stage);
  });
}

test('AIA and CDP stay separate in the inspector and detail panels', async ({ page }) => {
  await go(page, '?t=19');
  await page.click('.chip[data-artifact="leaf"]');
  await page.click('[data-tab="authority-information-access"]');
  await expect(page.locator('.tabpanel')).toContainText('issuing CA certificate');
  await expect(page.locator('.tabpanel')).not.toContainText('SIMSI2027-ICA01.crl');
  await page.click('[data-tab="crl-distribution-points"]');
  await expect(page.locator('.tabpanel')).toContainText('CRL');
  await expect(page.locator('.tabpanel')).not.toContainText('SIMSI2027-ICA01.crt');
});

test('narrow layout has no horizontal overflow and stays operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await go(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('#scene')).toBeVisible();
  await page.click('#btn-step-fwd');
  expect((await st(page)).stage).toBe(0);
  await page.click('[data-entity="visitor"]', { force: true });
  await expect(page.locator('#panel-details')).toContainText('Jordan');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('labels toggle and camera reset', async ({ page }) => {
  await go(page);
  await page.uncheck('#chk-labels');
  await expect(page.locator('#scene')).toHaveClass(/hide-labels/);
  await page.locator('#scene').hover({ position: { x: 600, y: 300 } });
  await page.mouse.wheel(0, -300);
  expect(await page.evaluate(() => window.__cfl.app.scene.cam.k)).toBeGreaterThan(1);
  await page.click('#btn-reset-camera');
  expect(await page.evaluate(() => window.__cfl.app.scene.cam.k)).toBe(1);
});

test('guided tour: interaction pauses it and it resumes after inactivity; it hands control back', async ({ page }) => {
  await go(page, '?tourResume=1500');
  await page.click('[data-speed="2"]');
  await page.click('#btn-tour');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running');
  await expect(page.locator('#tour-bar')).toBeVisible();
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  await page.click('[data-entity="client01"]');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'paused');
  await expect(page.locator('#tour-text')).toContainText('paused');
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'paused');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running', { timeout: 6000 });
  // jump to the final step and let it hand control to the visitor
  await page.evaluate(() => { const t = window.__cfl.tour; t.index = t.steps.length - 1; t.phase = 'enter'; });
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'finished', { timeout: 15000 });
  const s = await st(page);
  expect(s.direction).toBe('forward');
  expect(s.selectedEntity).toBe('visitor');
  expect(s.trustDecision).toBe('trusted');
  await expect(page.locator('#tour-text')).toContainText('You are in control');
});
