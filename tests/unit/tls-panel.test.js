// v0.5.0 TLS details panel: collapsed summary, section order, plain-language questions, glossary chips, inspectors (CSR, certificate,
// WEB01 and CLIENT01 stores, handshake), command and GUI path explanation, troubleshooting and the final card.
import { describe, it, expect, beforeAll } from 'vitest';
import * as E from '../../src/engine/engine.js';
import S from '../../src/scenarios/tls-manual-enrollment.js';
import { loadModel } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';
import * as P from '../../src/ui/tls-panel.js';
import { NATIVE_CERTIFICATES } from '../../src/artifacts/native-ids.js';
import { manifest } from '../helpers/fixtures.js';

let M, EV;
beforeAll(async () => { M = (await loadModel()).model; EV = await evaluateAll(M, S); });
const ctx = (stepId, { faultId = 'healthy', selection = null, gloss = new Set(), started = true, direction = 'forward' } = {}) => {
  const i = S.stages.findIndex((s) => s.id === stepId);
  return { scenario: S, state: E.computeState(S, { faultId, t: i + 1, direction, tReverse: 1 }), model: M, evidence: EV, ev: EV[faultId], started, selection, gloss, sigs: {} };
};

describe('TLS details panel', () => {
  it('collapsed summary: What happens · Why it is needed · Who acts · What moves', () => {
    const h = P.summaryHtml(ctx('t-new')); for (const w of ['What happens', 'Why it is needed', 'Who acts', 'What moves']) expect(h).toContain(w);
    expect(P.summaryHtml(ctx('t-bind'))).toContain('Nothing leaves this computer');
    expect(P.summaryHtml({ ...ctx('t-visit'), started: false })).toContain('START FLOW');
  });
  it('section order: Plain language first; Troubleshoot moves to position 2 when a fault halts', () => {
    expect(P.sectionOrder(ctx('t-new'))).toEqual(['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot']);
    expect(P.sectionOrder(ctx('t-checks', { faultId: 'wrong-dns' }))).toEqual(['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence']);
    expect(Object.values(P.SECTION_TITLES)).toEqual(['Plain language', 'Technical details', 'Command or GUI path', 'Raw artifact', 'Evidence', 'Troubleshoot']);
  });
  it('plain language answers eight questions; a fault note appears on the steps it changes', () => {
    const h = P.plainHtml(ctx('t-cert-msg')); for (const q of ['What is happening', 'Why', 'Who', 'Where', 'What moves', 'What stays private', 'What is checked', 'What could go wrong']) expect(h).toContain(`<dt>${q}</dt>`);
    expect(P.plainHtml(ctx('t-stores', { faultId: 'missing-ica' }))).toContain('In the selected fault:');
    expect(P.plainHtml(ctx('t-stores'))).not.toContain('In the selected fault:');
  });
  it('glossary: the first use of each term is a focusable button; opening it shows a one-line definition', () => {
    const closed = P.plainHtml(ctx('t-hello'));
    expect(closed).toMatch(/<button type="button" class="gloss" data-gloss="SNI" aria-expanded="false"/);
    expect(closed.match(/data-gloss="SNI"/g)).toHaveLength(1);
    const open = P.plainHtml(ctx('t-hello', { gloss: new Set(['SNI']) }));
    expect(open).toContain('aria-expanded="true"'); expect(open).toContain('Server Name Indication: the site name the browser sends');
    expect(P.glossarize('EKU and KU', new Set())).toMatch(/data-gloss="EKU".*data-gloss="KU"/);
    expect(P.glossarize('the trust anchor', new Set())).toContain('data-gloss="trust anchor"');
  });
  it('identity: Visitor, Subject, Operator and Requester are separate labelled fields', () => {
    expect(P.identityRows(ctx('t-submit')).map((r) => r[0])).toEqual(['Visitor (reports only)', 'Subject (certificate identity)', 'Operator (human)', 'Requester (CA record)']);
    expect(P.identityRows(ctx('t-submit'))[3][1]).toMatch(/^SIMSI2027\\Morgan/); expect(P.identityRows(ctx('t-new'))[3][1]).toBe('Not recorded yet (no submission)');
  });
  it('CSR inspector: plain language first, parsed fields, template attribute, client information and machine context', () => {
    const h = P.technicalHtml(ctx('t-inspect-csr', { selection: { type: 'artifact', id: 'csr' } }));
    expect(h.indexOf('In plain language')).toBeLessThan(h.indexOf('SPKI SHA-256'));
    for (const w of ['does <strong>not</strong> contain the private key', 'proof of possession', 'DNS=portal.simsi2027.test', 'exponent 65537', 'SIMSI2027WebServer', 'WEB01.simsi2027.test', 'certreq.exe', 'MachineKeySet = TRUE', 'no EKU: the template sets it', 'Simulated environment']) expect(h, w).toContain(w);
  });
  it('certificate inspector: decoded template, both thumbprints, validity vs clock, AIA and CDP, path, expected store, key by state and machine', () => {
    const h = P.technicalHtml(ctx('t-checks', { selection: { type: 'artifact', id: 'leaf' } }));
    for (const w of ['SIMSI2027WebServer (1.3.6.1.4.1.311.21.8.2027.1.1 v100.4', 'SHA-256', 'valid at the simulation clock', 'Private key on WEB01', 'Yes: linked on WEB01', 'Private key on CLIENT01', 'Never']) expect(h, w).toContain(w);
    expect(P.technicalHtml(ctx('t-return', { selection: { type: 'artifact', id: 'leaf' } }))).toContain('Not yet: the key waits in the pending request on WEB01');
    expect(P.technicalHtml(ctx('t-bind', { faultId: 'no-private-key', selection: { type: 'artifact', id: 'accepted' } }))).toContain('imported from portal.cer');
    expect(P.technicalHtml(ctx('t-warning', { selection: { type: 'artifact', id: 'selfsigned' } }))).toContain('no chain to a trusted root');
    expect(P.technicalHtml(ctx('t-checks', { faultId: 'expired', selection: { type: 'artifact', id: 'leaf' } }))).toContain('outside validity at the simulation clock');
  });
  it('store inspector: WEB01 shows four cards (Personal, Intermediate, Trusted Root, Certificate Enrollment Requests); CLIENT01 Trusted Root shows the Root with its source and no private key', () => {
    const h = P.technicalHtml(ctx('t-stores', { selection: { type: 'store', id: 'personal' } }));
    for (const w of ['Local Computer\\Personal (WEB01)', 'Local Computer\\Intermediate Certification Authorities (WEB01)', 'Local Computer\\Trusted Root Certification Authorities (WEB01)', 'Local Computer\\Certificate Enrollment Requests (WEB01)', 'Enterprise (AD)', 'What is it?', 'Private key on WEB01?', 'Trust anchor?']) expect(h, w).toContain(w);
    const c = P.technicalHtml(ctx('t-chain', { selection: { type: 'store', id: 'client-root' } }));
    expect(c).toContain('on CLIENT01'); expect(c).toContain('Enterprise (AD) / Group Policy'); expect(c).toContain('CLIENT01 holds no private key for portal.simsi2027.test');
    expect(P.technicalHtml(ctx('t-chain', { faultId: 'untrusted-root', selection: { type: 'store', id: 'client-root' } }))).toContain('No SIMSI2027 Root CA');
  });
  it('handshake inspector: SNI, simulated version and cipher suite, certificates sent, CertificateVerify, what is encrypted, what never travels', () => {
    const h = P.technicalHtml(ctx('t-cert-msg', { selection: { type: 'artifact', id: 'handshake' } }));
    for (const w of ['ClientHello SNI', 'portal.simsi2027.test', 'TLS 1.3', 'TLS_AES_256_GCM_SHA384', 'Simulated environment', 'Certificate list sent', 'SIMSI2027 Issuing CA 01 (Issuing CA)', 'Root not sent', 'CertificateVerify', 'What is encrypted', 'What never travels', 'private key', 'Session keys']) expect(h, w).toContain(w);
    expect(P.technicalHtml(ctx('t-cert-msg', { faultId: 'missing-ica', selection: { type: 'artifact', id: 'handshake' } }))).toContain('leaf only');
    expect(P.technicalHtml(ctx('t-cert-msg', { faultId: 'wrong-binding', selection: { type: 'artifact', id: 'handshake' } }))).toContain('self-signed temporary certificate');
  });
  it('command and GUI path: banner, copy button, every token explained', () => {
    const c = P.commandHtml(ctx('t-submit'), 3);
    expect(c).toContain('Shown for learning; never executed by this simulator.'); expect(c).toContain('data-copy'); expect(c).toContain('CA configuration string');
    const g = P.commandHtml(ctx('t-bind'));
    expect(g).toContain('GUI path (IIS Manager)'); expect(g).toContain('Require Server Name Indication'); expect(g).toContain('Shown for learning; never executed by this simulator.');
    expect(P.commandHtml(ctx('t-visit'))).toContain('No command or GUI path');
  });
  it('troubleshoot, final card and raw artifact', () => {
    const t = P.troubleshootHtml(ctx('t-chain', { faultId: 'untrusted-root' })); for (const w of ['Symptom', 'Evidence', 'Owner', 'Remediation', 'Stops the flow?', 'Long term', 'Never tell visitors to click through']) expect(t, w).toContain(w);
    const f = P.finalCardHtml(ctx('t-followup')); expect(f.title).toBe('Trusted connection: portal.simsi2027.test is who it says it is'); expect(f.openItems[0]).toMatch(/Renew before 2027-10-30/); expect(f.text).toMatch(/Session keys encrypt the traffic/);
    expect(P.finalCardHtml(ctx('t-revocation', { faultId: 'revoked' })).title).toBe('Stopped: Certificate revoked');
    expect(P.rawHtml(ctx('t-inspect-csr'), null)).toContain('Shown on demand'); expect(P.rawHtml(ctx('t-inspect-csr'), 'pem')).toContain('BEGIN CERTIFICATE REQUEST');
  });
  it('audit T3: configuration-dependent sentences rendered by the panel carry the marker (every step and selection)', () => {
    const dependent = /Group Policy|\bdefaults?\b|by default|replication|enforce|word this warning|TLS versions client/i;
    const sels = [null, ...['personal', 'intermediate', 'root', 'client-root'].map((id) => ({ type: 'store', id })), { type: 'pub', id: 'aia' }, { type: 'pub', id: 'cdp' }, { type: 'entity', id: 'rootca' }, ...['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'].map((id) => ({ type: 'zone', id }))];
    const offenders = [];
    for (const st of S.stages) for (const selection of sels) {
      const html = P.plainHtml(ctx(st.id, { selection })) + P.troubleshootHtml(ctx(st.id, { selection }));
      for (const block of html.split(/<\/(?:dd|p|li|h4)>/)) { const text = block.replace(/<[^>]+>/g, ''); if (dependent.test(text) && !text.includes('Depends on your configuration')) offenders.push(`${st.id}: ${text.trim().slice(0, 90)}`); }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
  it('companion allowlist includes every public TLS CER fixture (CER only)', () => {
    const cers = manifest.artifacts.filter((a) => a.path === 'tls' && a.filename.endsWith('.cer')).map((a) => a.filename.replace('certificates/', ''));
    for (const c of cers) expect(Object.values(NATIVE_CERTIFICATES), c).toContain(c);
  });
});
