import { test, expect } from '@playwright/test';

const TLS = 'tls-manual-enrollment', DCID = 'dc-manual-certificate-request';
const st = (page) => page.evaluate(() => window.__cfl.getState());
const go = async (page, q = '') => { await page.goto(`/?${q}`); await page.waitForFunction(() => window.__cfl); };
const open = (page, id, extra = '') => go(page, `scenario=${id}${extra ? `&${extra}` : ''}`);
const stepN = async (page, n) => { for (let i = 0; i < n; i++) await page.click('#btn-step-fwd'); };
const panel = (page, name) => page.locator(`#panel-${name}`);
const tab = (page, name) => page.click(`[data-tabbtn="${name}"]`);
const quiet = (m, loc = '') => !/ERR_CONNECTION_REFUSED|5184/.test(m.text() + loc);

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
  await expect(page.locator('[data-start]')).toHaveCount(2);
  await expect(page.locator('.later li')).toHaveCount(5);
  await expect(page.locator('.later')).toContainText('NDES / SCEP Device Enrollment');
  await expect(page.locator('body')).not.toHaveAttribute('data-tour', 'running');
  await expect(page.locator('#btn-topology')).toBeVisible(); await expect(page.locator('#btn-about')).toBeVisible();
  await page.click('#btn-about'); await expect(page.locator('#about')).toBeVisible(); await expect(page.locator('#about')).toContainText('not official Microsoft icons'); await page.keyboard.press('Escape');
  expect(problems).toEqual([]);
});

test('TLS scenario starts from the home card in the focused view; Root CA is hidden; Back returns home', async ({ page }) => {
  await go(page);
  await page.click(`[data-start="${TLS}"]`);
  await expect(page.locator('#workspace')).toBeVisible(); await expect(page.locator('#home')).toBeHidden();
  await expect(page.locator('#ws-title')).toHaveText('Website TLS Certificate');
  await expect(page.locator('#chk-topology')).not.toBeChecked();
  expect(await page.locator('.node:visible').count()).toBeLessThan(8);
  await expect(page.locator('.node[data-entity="rootca"]')).toBeHidden();
  await expect(page.locator('#step-count')).toContainText('Step 1 of 19');
  await page.click('#btn-back'); await expect(page.locator('#home')).toBeVisible(); await expect(page.locator('#btn-continue')).toBeVisible();
  await page.click('#btn-continue'); await expect(page.locator('#workspace')).toBeVisible();
});

test('Domain Controller scenario starts and shows the problem stage with milestone groups', async ({ page }) => {
  await go(page);
  await page.click(`[data-start="${DCID}"]`);
  await expect(page.locator('#ws-title')).toHaveText('Domain Controller Manual Enrollment');
  await expect(page.locator('#step-count')).toContainText('Step 1 of 18');
  await expect(page.locator('#step-title')).toHaveText('Detect the missing certificate');
  expect(await page.locator('#rail .gl').allTextContents()).toEqual(['Problem', 'Identity', 'Key', 'CSR', 'Submission', 'Policy', 'Issuance', 'Retrieval', 'Acceptance', 'Verification']);
  await expect(page.locator('#panel-explain')).toContainText('What is happening?');
  await expect(page.locator('#panel-explain')).toContainText('Local Computer certificate store');
});

test('focused view hides the offline Root CA; full topology reveals it at the far right, off the request path', async ({ page }) => {
  await open(page, DCID, 't=9.8');
  await expect(page.locator('.node[data-entity="rootca"]')).toBeHidden(); await expect(page.locator('.node[data-entity="ica01"]')).toBeVisible();
  const focusedCount = await page.locator('.node:visible').count();
  await page.check('#chk-topology');
  await expect(page.locator('.node[data-entity="rootca"]')).toBeVisible();
  expect(await page.locator('.node:visible').count()).toBeGreaterThan(focusedCount);
  const boxes = await page.locator('.node:visible').evaluateAll((els) => els.map((e) => ({ id: e.dataset.entity, x: e.getBoundingClientRect().x })));
  expect(boxes.find((b) => b.id === 'rootca').x).toBe(Math.max(...boxes.map((b) => b.x)));
  await expect(page.locator('.zone.offline')).toBeVisible(); await expect(page.locator('.rootlink')).toContainText('Previously signed Issuing CA certificate'); await expect(page.locator('.root-note')).toContainText('not contacted for');
  expect(await page.evaluate(() => window.__cfl.app.sc.flows.filter((f) => f.from === 'rootca' || f.to === 'rootca').length)).toBe(0);
  await page.uncheck('#chk-topology'); await expect(page.locator('.node[data-entity="rootca"]')).toBeHidden();
});

test('forward play at 2x advances; pause freezes; step buttons move one step', async ({ page }) => {
  await open(page, TLS);
  await page.click('[data-speed="2"]'); await page.click('#btn-play');
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await page.click('#btn-pause');
  const a = await st(page); await page.waitForTimeout(400); expect((await st(page)).stageProgress).toBe(a.stageProgress);
  await page.click('#btn-restart'); await stepN(page, 3);
  let s = await st(page); expect([s.stage, s.stageProgress, s.requestState]).toEqual([2, 1, 'needed']);
  await page.click('#btn-step-back'); s = await st(page); expect([s.stage, s.stageProgress]).toEqual([1, 1]);
});

test('timeline scrubber, jump menu and speeds control the same state; selection does not reset position', async ({ page }) => {
  await open(page, TLS);
  await page.locator('#scrubber').fill('1150');
  let s = await st(page); expect(s.stage).toBe(11); expect(s.stageProgress).toBeCloseTo(0.5, 1); expect(s.installationState).toBe('installing');
  await page.selectOption('#sel-jump', '6'); s = await st(page); expect([s.stage, s.csrState, s.templateDecision]).toEqual([5, 'created', 'pending']);
  for (const v of ['0.25', '0.5', '1', '2']) { await page.click(`[data-speed="${v}"]`); expect((await st(page)).playbackSpeed).toBe(Number(v)); }
  await page.click('.node[data-entity="web01"]'); s = await st(page); expect([s.stage, s.stageProgress]).toEqual([5, 1]);
  await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('Private-key state');
});

test('reverse evidence mode traces evidence for TLS and keeps the finished world', async ({ page }) => {
  await open(page, TLS);
  await page.click('#btn-mode-reverse'); await expect(panel(page, 'evidence')).toBeVisible();
  let s = await st(page); expect([s.direction, s.trustDecision, s.evidenceIndex]).toEqual(['reverse', 'trusted', 0]);
  await expect(panel(page, 'evidence').locator('.trace li.current')).toContainText('Why is the site trusted?');
  await stepN(page, 13); s = await st(page); expect(s.evidenceIndex).toBe(12); expect(s.keyState).toBe('held-on-web01');
  await expect(panel(page, 'evidence').locator('.trace li.current')).toContainText('Jordan');
  await page.click('#btn-mode-forward'); expect((await st(page)).direction).toBe('forward');
});

test('reverse evidence for the Domain Controller cites evidence kinds', async ({ page }) => {
  await open(page, DCID);
  await page.click('#btn-mode-reverse'); await expect(panel(page, 'evidence').locator('.trace li.current')).toContainText('Why is the Domain Controller certificate considered usable?');
  await stepN(page, 6); let s = await st(page); expect([s.direction, s.evidenceIndex]).toEqual(['reverse', 5]);
  await expect(panel(page, 'evidence').locator('.trace li.current')).toContainText('revocation');
  await expect(panel(page, 'evidence')).toContainText('Real fixture data'); await expect(panel(page, 'evidence')).toContainText('Simulated environment');
  await stepN(page, 6); s = await st(page); expect(s.evidenceIndex).toBe(11);
  await expect(panel(page, 'evidence').locator('.trace li.current')).toContainText('manual request'); expect(s.trustDecision).toBe('trusted');
});

test('TLS: clicking people, computers and servers explains them (IP is context only)', async ({ page }) => {
  await open(page, TLS, 't=19&full=1');
  await page.click('.node[data-entity="visitor"]'); await expect(panel(page, 'explain')).toContainText('does not request or manage certificates');
  await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('SIMSI2027\\Jordan'); await expect(panel(page, 'details')).toContainText('Standard user'); await expect(panel(page, 'details')).toContainText('Observed browser error');
  await page.click('.node[data-entity="client01"]'); await expect(panel(page, 'explain')).toContainText('enrollment authority');
  await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('10.20.10.45');
  await page.click('.node[data-entity="owner"]'); await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('SIMSI2027\\Morgan'); await expect(panel(page, 'details')).toContainText('WebServer-Requesters');
  await page.click('.node[data-entity="web01"]'); await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('SNI state'); await expect(panel(page, 'details')).toContainText('Private-key state');
  await page.click('.node[data-entity="rootca"]'); await expect(panel(page, 'explain')).toContainText('not contacted');
  await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('issue the website certificate');
});

test('TLS: template, CA, AIA/CDP and arrows expose technical details', async ({ page }) => {
  await open(page, TLS, 't=19&full=1');
  await page.click('.node[data-entity="template"]'); await tab(page, 'details');
  for (const t of ['Template OID', 'Schema version', 'Renewal period', 'Enrollment permissions', 'Approval requirement', 'Policy decision']) await expect(panel(page, 'details')).toContainText(t);
  await page.click('.node[data-entity="ica01"]'); await tab(page, 'details'); await expect(panel(page, 'details')).toContainText('2027000000000000000000000000CC10');
  await page.click('.node[data-entity="aia"]'); await tab(page, 'details');
  for (const t of ['Raw extension value', 'AIA endpoint', 'CDP endpoint', 'http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl']) await expect(panel(page, 'details')).toContainText(t);
  await page.locator('.flow[data-flow="f-submit"] .flow-hit').dispatchEvent('click');
  for (const t of ['Conceptual protocol', 'Request ID', '1042']) await expect(panel(page, 'details')).toContainText(t);
});

test('DC: pause and click the CSR for friendly explanation, technical content and raw PEM', async ({ page }) => {
  await open(page, DCID, 't=8');
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'false');
  await page.click('.chip[data-artifact="csr"]');
  const ins = panel(page, 'inspector'); await expect(ins).toBeVisible();
  for (const w of ['Certificate Signing Request (CSR)', 'created by DC01', 'public key', 'KerberosAuthentication', 'does not contain the private key', 'private key remains on DC01']) await expect(ins).toContainText(w);
  for (const w of ['Request identity', 'SIMSI2027\\PKIOperator', 'Local Computer', 'contextual only', 'What happens next', 'Common failures', 'Template not published']) await expect(ins).toContainText(w);
  await page.click('[data-tab="public-key"]'); await expect(page.locator('.tabpanel')).toContainText('RSASSA-PKCS1-v1_5'); await expect(page.locator('.tabpanel')).toContainText('not in this project');
  await page.click('[data-tab="signature"]'); await expect(page.locator('.tabpanel')).toContainText('true');
  await page.click('[data-tab="san"]'); await expect(page.locator('.tabpanel')).toContainText('DNS=DC01.simsi2027.test');
  await page.click('[data-tab="template-request"]'); await expect(page.locator('.tabpanel')).toContainText('KerberosAuthentication');
  await page.click('[data-tab="pem"]'); await expect(page.locator('.tabpanel')).toContainText('-----BEGIN CERTIFICATE REQUEST-----'); await expect(page.locator('.tabpanel')).not.toContainText('PRIVATE KEY');
  await page.click('[data-tab="raw-asn-1-summary"]'); await expect(page.locator('.tabpanel')).toContainText('SEQUENCE');
  await tab(page, 'explain'); await expect(panel(page, 'explain')).toContainText('Certificate Signing Request'); await expect(panel(page, 'explain')).toContainText('certreq');
  const s = await st(page); expect([s.stage, s.stageProgress]).toEqual([7, 1]);
});

test('DC: certificate acceptance explains the private-key association and the inspector shows the match', async ({ page }) => {
  await open(page, DCID, 't=13');
  await expect(panel(page, 'explain')).toContainText('Importing a .cer alone does not create the missing private key');
  await expect(panel(page, 'explain')).toContainText('certreq.exe -accept dc01-issued.cer');
  await open(page, DCID, 't=14');
  await page.click('.chip[data-artifact="dccert"]');
  await expect(panel(page, 'inspector')).toContainText('Its public key matches the CSR');
  await page.click('[data-tab="matching-csr"]'); await expect(page.locator('.tabpanel')).toContainText('Public key identical'); await expect(page.locator('.tabpanel')).toContainText('yes');
  expect((await st(page)).keyAssociation).toBe('matched');
});

test('DC: certificate inspector tabs are populated from the real fixture (SAN, EKU, template, AIA vs CDP)', async ({ page }) => {
  await open(page, DCID, 't=15');
  await page.click('.chip[data-artifact="dccert"]');
  const want = { 'subject-alternative-names': 'DNS=DC01.simsi2027.test', 'enhanced-key-usage': 'KDC Authentication', 'key-usage': 'Key Encipherment', 'authority-information-access': 'SIMSI2027-ICA01.crt', 'crl-distribution-points': 'SIMSI2027-ICA01.crl', 'issuance-history': 'KerberosAuthentication', pem: '-----BEGIN CERTIFICATE-----', 'certification-path': 'SIMSI2027 Root CA' };
  for (const [t, w] of Object.entries(want)) { await page.click(`#panel-inspector [data-tab="${t}"]`); await expect(page.locator('.tabpanel')).toContainText(w); }
  await page.click('#panel-inspector [data-tab="authority-information-access"]'); await expect(page.locator('.tabpanel')).not.toContainText('.crl');
  await page.click('#panel-inspector [data-tab="crl-distribution-points"]'); await expect(page.locator('.tabpanel')).not.toContainText('.crt');
});

test('TLS certificate inspector exposes every required tab; CSR and CRL tabs exist; INF opens in DC', async ({ page }) => {
  await open(page, TLS, 't=19&full=1');
  await page.click('.chip[data-artifact="leaf"]');
  const tabs = ['general', 'details', 'certification-path', 'subject-alternative-names', 'enhanced-key-usage', 'key-usage', 'basic-constraints', 'authority-information-access', 'crl-distribution-points', 'thumbprints', 'pem', 'raw-asn-1-summary', 'issuance-history', 'matching-csr'];
  await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(tabs.length);
  const want = { 'subject-alternative-names': 'DNS=portal.simsi2027.test', 'enhanced-key-usage': 'Server Authentication', pem: '-----BEGIN CERTIFICATE-----', 'matching-csr': 'Public key identical', general: 'This certificate is OK' };
  for (const t of tabs) { await page.click(`#panel-inspector [data-tab="${t}"]`); await expect(page.locator('.tabpanel')).toHaveAttribute('data-active-tab', t); await expect(page.locator('.tabpanel')).not.toBeEmpty(); if (want[t]) await expect(page.locator('.tabpanel')).toContainText(want[t]); }
  await page.click('.chip[data-artifact="csr"]'); await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(8);
  await page.click('.chip[data-artifact="crl"]'); await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(8);
  await page.click('[data-tab="revoked-entries"]'); await expect(page.locator('.tabpanel')).toContainText('2027000000000000000000000000DD99');
  await open(page, DCID, 't=5.9'); await page.click('.chip[data-artifact="inf"]');
  await expect(page.locator('#panel-inspector [role=tab]')).toHaveCount(3);
  await page.click('[data-tab="fields"]'); await expect(page.locator('.tabpanel')).toContainText('NewRequest.MachineKeySet');
  await page.click('[data-tab="raw-inf"]'); await expect(page.locator('.tabpanel')).toContainText('MachineKeySet = TRUE');
});

test('public certificate artifact can be downloaded and is real DER (TLS and DC)', async ({ page }) => {
  await open(page, TLS, 't=19&full=1');
  await page.click('.chip[data-artifact="leaf"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="portal.simsi2027.test.cer"]')]);
  expect(dl.suggestedFilename()).toBe('portal.simsi2027.test.cer');
  const fetchBytes = (name) => page.evaluate(async (n) => { const h = document.querySelector(`[data-download="${n}"]`).href; return [...new Uint8Array(await (await fetch(h)).arrayBuffer())]; }, name).then((a) => Buffer.from(a));
  let buf = await fetchBytes('portal.simsi2027.test.cer'); expect(buf[0]).toBe(0x30); expect(buf.toString('latin1')).not.toContain('PRIVATE KEY');
  await open(page, DCID, 't=12'); await page.click('.chip[data-artifact="dccert"]');
  buf = await fetchBytes('dc01-issued.cer'); expect(buf[0]).toBe(0x30); expect(buf.length).toBeGreaterThan(500);
  await expect(page.locator('[data-download="dc01-chain.pem"]')).toBeVisible();
});

test('healthy TLS and DC scenarios complete trusted/suitable', async ({ page }) => {
  await open(page, TLS); await stepN(page, 19);
  let s = await st(page); expect(s).toMatchObject({ trustDecision: 'trusted', connectionState: 'trusted', iisBindingState: 'bound', halted: false });
  await page.check('#chk-topology'); await expect(page.locator('.node[data-entity="decision"] .n-status')).toHaveText('TRUSTED');
  await page.click('#btn-step-fwd'); expect((await st(page)).stage).toBe(18);
  await open(page, DCID); await stepN(page, 17);
  s = await st(page); expect(s).toMatchObject({ trustDecision: 'trusted', keyAssociation: 'matched', installationState: 'accepted', halted: false });
  await expect(page.locator('.node[data-entity="result"] .n-status')).toHaveText('SUITABLE');
  await page.click('#btn-step-fwd'); await expect(panel(page, 'explain')).toContainText('autoenrollment'); expect((await st(page)).followupState).toBe('investigate-autoenrollment');
});

const TLS_FAULTS = [['revoked', 'revocation', 'Serial 2027000000000000000000000000CC14 is listed'], ['wrong-dns', 'validate', 'web01.simsi2027.test'], ['untrusted-root', 'root-trust', 'does not contain'], ['expired', 'validate', '2026-09-30'],
  ['wrong-eku', 'validate', 'Client Authentication'], ['missing-ica', 'chain-build', '404'], ['cdp-unavailable', 'revocation', 'timed out'], ['no-private-key', 'install', 'no matching private key']];
for (const [fault, stage, evidence] of TLS_FAULTS) {
  test(`TLS failure ${fault} halts at ${stage} with evidence`, async ({ page }) => {
    await open(page, TLS, `fault=${fault}`); await stepN(page, 19);
    const s = await st(page); expect(s.halted).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.stage)).toBe(stage); expect(s.trustDecision).not.toBe('trusted');
    await expect(page.locator('#fault-banner')).toBeVisible();
    await tab(page, 'troubleshoot'); const t = panel(page, 'troubleshoot');
    for (const w of ['What failed', 'Still healthy', 'Likely remediation', 'Owner of the correction', 'Expected result', 'Suggested checks']) await expect(t).toContainText(w);
    await expect(t).toContainText(evidence);
    await tab(page, 'evidence'); await expect(panel(page, 'evidence')).toContainText('User-selected fault');
    await page.click('#btn-step-fwd'); expect((await st(page)).stage).toBe(s.stage);
  });
}

const DC_FAULTS = [['template-not-published', 'choose-template', 'does not list KerberosAuthentication'], ['no-enroll-permission', 'verify-permission', 'no Enroll permission'], ['user-context', 'evaluate-policy', 'MachineKeySet = FALSE'],
  ['ca-unavailable', 'submit', 'did not respond'], ['pending-approval', 'evaluate-policy', 'Pending'], ['wrong-eku', 'inspect-purposes', 'Client Authentication'], ['san-missing', 'inspect-purposes', 'simsi2027.test'],
  ['key-mismatch', 'key-match', 'differs from the CSR key'], ['ica-cert-unavailable', 'verify-chain', '404'], ['cdp-unavailable', 'verify-chain', 'timed out'], ['expired', 'inspect-purposes', '2026-09-30']];
for (const [fault, stage, evidence] of DC_FAULTS) {
  test(`DC failure ${fault} halts at ${stage} with evidence, owner and continuation advice`, async ({ page }) => {
    await open(page, DCID, `fault=${fault}`); await stepN(page, 18);
    const s = await st(page); expect(s.halted).toBe(true); expect(await page.evaluate(() => document.body.dataset.stage)).toBe(stage); expect(s.trustDecision).not.toBe('trusted');
    await expect(page.locator('#fault-banner')).toBeVisible();
    await tab(page, 'troubleshoot'); const t = panel(page, 'troubleshoot');
    for (const w of ['What failed', 'Owner of the correction', 'Likely remediation', 'Should the manual request continue?', 'autoenrollment issue still need investigation']) await expect(t).toContainText(w);
    await expect(t).toContainText(evidence);
    await page.click('#btn-step-fwd'); expect((await st(page)).stage).toBe(s.stage);
  });
}

test('AIA and CDP stay separate in the TLS inspector', async ({ page }) => {
  await open(page, TLS, 't=19&full=1'); await page.click('.chip[data-artifact="leaf"]');
  await page.click('[data-tab="authority-information-access"]'); await expect(page.locator('.tabpanel')).toContainText('issuing CA certificate'); await expect(page.locator('.tabpanel')).not.toContainText('SIMSI2027-ICA01.crl');
  await page.click('[data-tab="crl-distribution-points"]'); await expect(page.locator('.tabpanel')).toContainText('CRL'); await expect(page.locator('.tabpanel')).not.toContainText('SIMSI2027-ICA01.crt');
});

test('narrow layout has no horizontal page overflow and the home and workspace stay operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await go(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.click(`[data-start="${DCID}"]`);
  await expect(page.locator('#scene')).toBeVisible();
  await page.click('#btn-step-fwd'); expect((await st(page)).stage).toBe(0);
  await page.click('#btn-step-fwd'); await expect(page.locator('#step-title')).toContainText('Inspect DC01');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#rail .tick').first()).toBeVisible();
  const box = await page.locator('#rail .tick').first().boundingBox(); expect(box.width).toBeGreaterThanOrEqual(30);
});

test('keyboard accessibility: scenario start, tabs, nodes and stage rail work without a mouse and have accessible names', async ({ page }) => {
  await go(page);
  await page.locator(`[data-start="${DCID}"]`).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeVisible();
  await stepN(page, 8);
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('.node, .chip, .chaincard, #rail .tick, #workspace button, #workspace select, #workspace input')].filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.labels?.length || e.title)).length);
  expect(unnamed).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('.node')].every((n) => n.getAttribute('role') === 'button' && n.tabIndex === 0 && n.getAttribute('aria-label')))).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('svg.icon')].every((s) => s.getAttribute('aria-hidden') === 'true'))).toBe(true);
  await page.locator('.node[data-entity="dc01"]').focus(); await page.keyboard.press('Enter');
  expect((await st(page)).selectedEntity).toBe('dc01'); await expect(panel(page, 'explain')).toContainText('About this object');
  await page.locator('[data-tabbtn="evidence"]').focus(); await page.keyboard.press('Enter'); await expect(panel(page, 'evidence')).toBeVisible();
  await page.locator('#rail .tick[data-tick="3"]').focus(); await page.keyboard.press('Enter'); expect((await st(page)).stage).toBe(3);
});

test('labels toggle and camera reset still work', async ({ page }) => {
  await open(page, TLS, 't=19&full=1');
  await page.uncheck('#chk-labels'); await expect(page.locator('#scene')).toHaveClass(/hide-labels/);
  await page.locator('#scene').hover({ position: { x: 600, y: 300 } }); await page.mouse.wheel(0, -300);
  expect(await page.evaluate(() => window.__cfl.app.scene.cam.k)).toBeGreaterThan(1);
  await page.click('#btn-reset-camera'); expect(await page.evaluate(() => window.__cfl.app.scene.cam.k)).toBe(1);
});

test('guided tour: interaction pauses it, it resumes after inactivity and hands control back', async ({ page }) => {
  await go(page, `scenario=${TLS}&tourResume=1500`);
  await page.click('[data-speed="2"]'); await page.click('#btn-tour');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running'); await expect(page.locator('#tour-bar')).toBeVisible();
  await expect.poll(async () => (await st(page)).stage, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  await page.click('#side', { force: true });
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'paused'); await expect(page.locator('#tour-text')).toContainText('paused');
  await page.waitForTimeout(500); await expect(page.locator('body')).toHaveAttribute('data-tour', 'paused');
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'running', { timeout: 6000 });
  await page.evaluate(() => { const t = window.__cfl.tour; t.index = t.steps.length - 1; t.phase = 'enter'; });
  await expect(page.locator('body')).toHaveAttribute('data-tour', 'finished', { timeout: 15000 });
  const s = await st(page); expect([s.direction, s.trustDecision]).toEqual(['forward', 'trusted']); await expect(page.locator('#tour-text')).toContainText('You are in control');
});

test('native viewer control: explained and disabled without a companion; works through a mocked local companion', async ({ page }) => {
  await page.route('http://127.0.0.1:5184/**', (r) => r.abort());
  await open(page, TLS, 't=19&full=1'); await page.click('.chip[data-artifact="leaf"]');
  await expect(page.locator('[data-native="portal-leaf"]')).toBeDisabled(); await expect(page.locator('[data-native-note]')).toContainText('local companion');
  await expect(panel(page, 'inspector')).toContainText('CN=portal.simsi2027.test'); await expect(page.locator('[data-download="portal.simsi2027.test.cer"]')).toBeVisible();
  const calls = []; const p2 = await page.context().newPage();
  await p2.route('http://127.0.0.1:5184/**', async (r) => {
    const req = r.request(); const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5183', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.url().endsWith('/health')) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'certificate-flow-lab-companion', artifacts: ['portal-leaf', 'dc-issued'] }) });
    calls.push({ token: req.headers()['x-cfl-token'], body: req.postData() }); return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await p2.goto(`/?scenario=${DCID}&t=12#nt=abcdefghijklmnopqrstuvwx`); await p2.waitForFunction(() => window.__cfl);
  await p2.click('.chip[data-artifact="dccert"]'); await expect(p2.locator('[data-native="dc-issued"]')).toBeEnabled(); expect(p2.url()).not.toContain('nt=');
  await p2.click('[data-native="dc-issued"]'); await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({ token: 'abcdefghijklmnopqrstuvwx', body: JSON.stringify({ artifactId: 'dc-issued' }) });
});
