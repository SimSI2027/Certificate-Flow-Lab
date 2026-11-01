// v0.4.0 details panel: section order, plain language first, identity fields, parser-backed inspectors and store cards.
import { describe, it, expect, beforeAll } from 'vitest';
import * as E from '../../src/engine/engine.js';
import DCS from '../../src/scenarios/dc-manual-certificate-request.js';
import { loadModel } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';
import * as P from '../../src/ui/story-panel.js';

let M, EVA, EVB;
beforeAll(async () => { M = (await loadModel()).model; EVA = await evaluateAll(M, E.pathOf(DCS, { pathId: 'csr' })); EVB = await evaluateAll(M, E.pathOf(DCS, { pathId: 'mmc' })); });
const ctx = (stepId, { pathId = 'csr', faultId = 'healthy', selection = null, conditionId } = {}) => {
  const sc = E.pathOf(DCS, { pathId, conditionId }); const i = sc.stages.findIndex((s) => s.id === stepId);
  const EV = pathId === 'csr' ? EVA : EVB;
  return { scenario: sc, state: E.computeState(DCS, { pathId, conditionId, faultId, t: i + 1 }), model: M, evidence: EV, ev: EV[faultId], started: true, selection };
};

describe('details panel', () => {
  it('orders sections Plain language first; Troubleshoot moves to position 2 when a fault halts', () => {
    expect(P.sectionOrder(ctx('a-new'))).toEqual(['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot']);
    expect(P.sectionOrder(ctx('a-return-move', { faultId: 'root-thumbprint-mismatch' }))).toEqual(['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence']);
    expect(P.sectionOrder(ctx('a-chain', { faultId: 'cdp-unreachable' }))[1]).toBe('troubleshoot');
    expect(Object.values(P.SECTION_TITLES)).toEqual(['Plain language', 'Technical details', 'Command explanation', 'Raw artifact', 'Evidence', 'Troubleshoot']);
  });
  it('collapsed summary answers What happens / Who acts / What moves', () => {
    const h = P.summaryHtml(ctx('a-submit')); for (const w of ['What happens', 'Who acts', 'What moves']) expect(h).toContain(w);
    expect(P.summaryHtml({ ...ctx('a-submit'), started: false })).toContain('START FLOW');
  });
  it('skipped conditional steps read "Already present — skipped"', () => {
    expect(P.plainHtml(ctx('a-root', { conditionId: 'trust-present' }))).toContain('Already present — skipped');
  });
  it('golden rule 5: Subject, Operator and Requester are three separate labelled fields', () => {
    for (const [step, pathId, req] of [['a-submit', 'csr', 'SIMSI2027\\PKIOperator'], ['b-enroll', 'mmc', 'SIMSI2027\\DC01$']]) {
      const h = P.technicalHtml(ctx(step, { pathId }));
      for (const f of ['Subject (certificate identity)', 'Operator (human)', 'Requester (CA record)']) expect(h).toContain(f);
      expect(h).toContain(req.replace(/\\/g, '\\'));
    }
    expect(P.technicalHtml(ctx('a-inf'))).toContain('Not recorded yet (no submission)');
  });
  it('command explanation shows the never-executed banner and every token meaning', () => {
    const h = P.commandHtml(ctx('a-submit'), 2);
    expect(h).toContain('Shown for learning; never executed by this simulator.');
    expect(h).toContain('-config'); expect(h).toContain('CA configuration string');
    expect(P.commandHtml(ctx('a-approve'))).toContain('Pending Requests');
    expect(P.commandHtml(ctx('a-identity'))).toContain('No command');
  });
  it('CSR inspector: plain language first, then parsed fields, client information note and identity', () => {
    const h = P.technicalHtml(ctx('a-inspect-csr', { selection: { type: 'artifact', id: 'csr' } }));
    expect(h.indexOf('In plain language')).toBeLessThan(h.indexOf('SPKI SHA-256'));
    for (const w of ['does <strong>not</strong> contain the private key', 'proof of possession', 'DNS=simsi2027.test', 'exponent 65537', 'DCOfflineKerberosAuth', 'certreq.exe', 'The CA records the authenticated submitter as Requester', 'MachineKeySet = TRUE', 'Simulated environment', 'Subject (certificate identity)']) expect(h, w).toContain(w);
    const b = P.technicalHtml(ctx('b-enroll', { pathId: 'mmc', selection: { type: 'artifact', id: 'csr' } })); expect(b).toContain('mmc.exe'); expect(b).toContain('KerberosAuthentication');
  });
  it('certificate inspector: fields from the fixture, template decoded, both thumbprints, AIA and CDP, expected store', () => {
    const h = P.technicalHtml(ctx('a-purposes', { selection: { type: 'artifact', id: 'accepted' } }));
    for (const w of ['KDC Authentication', '1.3.6.1.5.2.3.5', 'DCOfflineKerberosAuth (1.3.6.1.4.1.311.21.8.2027.1.3 v100.1; name resolved from the OID)', 'Thumbprint (SHA-1, as Windows shows it)', 'SHA-256', '/aia/SIMSI2027-ICA01.crt', '/cdp/SIMSI2027-ICA01.crl', 'Local Computer\\Personal', 'Yes: linked on DC01', 'CA:FALSE']) expect(h, w).toContain(w);
    const b = P.technicalHtml(ctx('b-verify', { pathId: 'mmc', selection: { type: 'artifact', id: 'accepted' } })); expect(b).toContain('(empty — identity is in the SAN)'); expect(b).toContain('(critical)');
    expect(P.technicalHtml(ctx('a-chain', { selection: { type: 'artifact', id: 'ica' } }))).toContain('No. That private key lives only on the CA.');
  });
  it('private-key association text follows the state', () => {
    expect(P.privateKeyText(ctx('a-retrieve'), 'leaf')).toMatch(/^Not yet/);
    expect(P.privateKeyText(ctx('a-key'), 'accepted')).toMatch(/^Yes/);
    expect(P.privateKeyText(ctx('a-accept', { faultId: 'accepted-on-wrong-machine' }), 'leaf')).toMatch(/PKI-TRANSFER01 has no private key/);
    expect(P.privateKeyText(ctx('a-key'), 'root')).toBe('No. That private key lives only on the CA.');
  });
  it('store inspector: Personal, Intermediate, Trusted Root and the transient request store; eight questions per certificate', () => {
    const h = P.technicalHtml(ctx('a-key', { selection: { type: 'store', id: 'personal' } }));
    for (const w of ['Local Computer\\Personal', 'Local Computer\\Intermediate Certification Authorities', 'Local Computer\\Trusted Root Certification Authorities', 'Local Computer\\Certificate Enrollment Requests']) expect(h, w).toContain(w);
    for (const q of ['What is it?', 'Who issued it?', 'Why this store?', 'Private key on DC01?', 'Role in chain building', 'Identifies DC01?', 'Trust anchor?', 'How did it get here?']) expect(h, q).toContain(q);
    expect(h).toContain('Local (manual, emergency)'); expect(h).toContain('Local (manual)');
    const b = P.technicalHtml(ctx('b-verify', { pathId: 'mmc', selection: { type: 'store', id: 'root' } })); expect(b).toContain('Enterprise (AD)'); expect(b).not.toContain('Certificate Enrollment Requests');
  });
  it('template cards: offline template with ESC1 warning, Kerberos card, DomainControllerAuthentication as comparison only', () => {
    const h = P.technicalHtml(ctx('a-template'));
    for (const w of ['SIMSI2027 DC Offline Kerberos Authentication', 'ESC1', 'comparison only', 'Domain Controller Authentication', 'used on this path']) expect(h, w).toContain(w);
  });
  it('troubleshoot shows symptom, evidence kinds, owner, remediation, stops and long term; rpc-blocked offers Path A', () => {
    const h = P.troubleshootHtml(ctx('b-enroll', { pathId: 'mmc', faultId: 'rpc-blocked' }));
    for (const w of ['Symptom', 'Evidence', 'Owner', 'Remediation', 'Stops the flow?', 'Long term', 'Simulated environment', 'data-switch-path="csr"', 'Depends on your configuration']) expect(h, w).toContain(w);
  });
  it('audit P5: the Path B certificate card says the wizard installed it; Path A says certreq -accept', () => {
    const b = P.technicalHtml(ctx('b-verify', { pathId: 'mmc', selection: { type: 'store', id: 'personal' } }));
    expect(b).toContain('Installed automatically by the enrollment wizard on DC01'); expect(b).not.toContain('certreq -accept on DC01');
    expect(P.technicalHtml(ctx('a-key', { selection: { type: 'store', id: 'personal' } }))).toContain('certreq -accept on DC01');
  });
  it('audit P1-P4: private-key text never claims a link after a failed accept', () => {
    for (const f of ['user-context', 'accepted-on-wrong-machine', 'pending-request-lost']) expect(P.privateKeyText(ctx('a-accept', { faultId: f }), 'accepted'), f).toMatch(/^No/);
    expect(P.privateKeyText(ctx('a-key', { faultId: 'key-mismatch' }), 'accepted')).toMatch(/could not link a key/);
  });
  it('audit P8: the trust-missing condition shows its long-term fix at the trust check and the install steps only', () => {
    expect(P.plainHtml(ctx('a-trust-check'))).toContain('Long term: Repair AD publication');
    expect(P.plainHtml(ctx('a-root'))).toContain('Long term:'); expect(P.plainHtml(ctx('a-new'))).not.toContain('Long term:');
    expect(P.plainHtml(ctx('a-trust-check', { conditionId: 'trust-present' }))).not.toContain('Long term:');
  });
  it('final card: suitable, withheld, or stopped', () => {
    expect(P.finalCardHtml(ctx('a-followup')).title).toBe('Suitable now; root cause still open');
    expect(P.finalCardHtml(ctx('a-followup', { faultId: 'cdp-unreachable' })).title).toBe('Not confirmed suitable — revocation status unknown');
    expect(P.finalCardHtml(ctx('a-key', { faultId: 'key-mismatch' })).title).toMatch(/^Stopped/);
  });
  it('raw artifact is shown only on demand', () => {
    expect(P.rawHtml(ctx('a-inspect-csr'), null)).toContain('Shown on demand'); expect(P.rawHtml(ctx('a-inspect-csr'), 'pem')).toContain('BEGIN CERTIFICATE REQUEST');
  });
});
