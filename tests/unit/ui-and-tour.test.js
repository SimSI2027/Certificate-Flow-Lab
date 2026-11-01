// Details panels and inspectors (TLS story panel since v0.5.0) and the guided tour controller.
// v0.5.0: the classic TLS detail panels (details.js) and the tabbed inspector (inspector.js) were removed with the classic workspace.
// Their intents are migrated deliberately to the story panel: every object explains itself without throwing for every fault; required
// identity fields; the IP address is context only; the Root CA does not issue the website certificate; AIA and CDP stay separate;
// a fault explains symptom, evidence, owner and remediation; private keys are never exposed; inspector fields come from the fixtures.
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import * as E from '../../src/engine/engine.js';
import { loadModel } from '../helpers/fixtures.js';
import * as TP from '../../src/ui/tls-panel.js';
import { ARTIFACTS } from '../../src/scenarios/tls/shared.js';
import { colonHex } from '../../src/artifacts/model.js';
import { Tour } from '../../src/tour/tour.js';

let ctxFor;
beforeAll(async () => {
  const { model, evidence, scenario } = await loadModel();
  ctxFor = (faultId = 'healthy', t = 26, selection = null) => { const state = E.computeState(scenario, { faultId, t }); return { scenario, state, model, evidence, ev: evidence[faultId], started: true, selection, gloss: new Set() }; };
});

const FAULT_IDS = ['wrong-dns', 'expired', 'untrusted-root', 'wrong-eku', 'missing-ica', 'revoked', 'cdp-unavailable', 'no-private-key', 'no-enroll-permission', 'template-not-published', 'user-context', 'wrong-binding'];
const SECTIONS = ['plainHtml', 'technicalHtml', 'evidenceHtml', 'troubleshootHtml'];

describe('detail panels', () => {
  it('every artifact, store and zone produces content without throwing, for every fault', () => {
    for (const f of ['healthy', ...FAULT_IDS]) {
      const sels = [...Object.keys(ARTIFACTS).map((id) => ({ type: 'artifact', id })), ...['personal', 'intermediate', 'root', 'client-root'].map((id) => ({ type: 'store', id })), ...['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'].map((id) => ({ type: 'zone', id })), { type: 'entity', id: 'rootca' }, { type: 'pub', id: 'aia' }, { type: 'pub', id: 'cdp' }];
      for (const sel of sels) for (const fn of SECTIONS) expect(TP[fn](ctxFor(f, 99, sel)).length, `${f}/${sel.type}:${sel.id}/${fn}`).toBeGreaterThan(40);
    }
  });
  it('required identity fields: visitor, subject, operator and requester are separate', () => {
    const h = TP.technicalHtml(ctxFor('healthy', 10));
    for (const w of ['Visitor (reports only)', 'SIMSI2027\\Jordan on CLIENT01 (10.20.10.45)', 'Subject (certificate identity)', 'portal.simsi2027.test', 'Operator (human)', 'SIMSI2027\\Morgan (application owner)', 'Requester (CA record)']) expect(h, w).toContain(w);
    expect(TP.technicalHtml(ctxFor('healthy', 6))).toContain('Not recorded yet (no submission)');
  });
  it('the IP address is presented as context, never as enrollment authority', () => {
    const t = TP.technicalHtml(ctxFor('healthy', 1));
    expect(t).toContain('CLIENT01 10.20.10.45 is context only: an address grants no certificate rights.');
  });
  it('the Root CA does not issue the website certificate; the owner (not the visitor) is the requester', () => {
    expect(TP.plainHtml(ctxFor('healthy', 26, { type: 'entity', id: 'rootca' }))).toMatch(/never signs the website certificate/);
    expect(TP.technicalHtml(ctxFor('healthy', 10, { type: 'artifact', id: 'record' }))).toContain('SIMSI2027\\Morgan');
    expect(TP.plainHtml(ctxFor('healthy', 3))).toMatch(/Jordan never requests a certificate|never asks for a certificate/);
  });
  it('AIA and CDP explanations stay separate', () => {
    expect(TP.plainHtml(ctxFor('healthy', 21, { type: 'pub', id: 'aia' }))).toMatch(/issuer certificate/); expect(TP.plainHtml(ctxFor('healthy', 21, { type: 'pub', id: 'aia' }))).not.toMatch(/revocation list/i);
    expect(TP.plainHtml(ctxFor('healthy', 24, { type: 'pub', id: 'cdp' }))).toMatch(/Revocation List/); expect(TP.plainHtml(ctxFor('healthy', 24, { type: 'pub', id: 'cdp' }))).toMatch(/different URL from the AIA/);
  });
  it('fault explanation answers symptom, evidence, owner, remediation, stops and long term', () => {
    for (const f of FAULT_IDS) { const h = TP.troubleshootHtml(ctxFor(f, 99)); for (const w of ['Symptom', 'Evidence', 'Owner', 'Remediation', 'Stops the flow?', 'Long term']) expect(h, `${f}:${w}`).toContain(w); }
    expect(TP.troubleshootHtml(ctxFor('healthy', 99))).toContain('No fault selected');
  });
  it('private key panel never exposes key material', () => {
    const h = TP.technicalHtml(ctxFor('healthy', 8, { type: 'artifact', id: 'private-key' }));
    expect(h).not.toMatch(/BEGIN|[A-Za-z0-9+/]{80}/); expect(h).toContain('Never');
  });
});

describe('artifact inspector fields', () => {
  it('certificate, CSR, CRL, chain and INF inspectors render from real fixture values and never expose private keys', () => {
    for (const id of ['leaf', 'ica', 'root', 'csr', 'crl', 'chain', 'handshake', 'inf', 'selfsigned']) { const h = TP.technicalHtml(ctxFor('healthy', 26, { type: 'artifact', id })); expect(h.length, id).toBeGreaterThan(200); expect(h).not.toMatch(/PRIVATE KEY/); }
    const c = ctxFor(); const leaf = c.model.resolve('leaf', null).parsed;
    const h = TP.technicalHtml(ctxFor('healthy', 26, { type: 'artifact', id: 'leaf' }));
    for (const w of [colonHex(leaf.thumbprints.sha1), colonHex(leaf.thumbprints.sha256), 'Thumbprint (SHA-1, as Windows shows it)', 'SIMSI2027WebServer (1.3.6.1.4.1.311.21.8.2027.1.1 v100.4; name resolved from the OID)', 'Server Authentication', 'DNS=portal.simsi2027.test', '/aia/SIMSI2027-ICA01.crt', '/cdp/SIMSI2027-ICA01.crl', 'Local Computer\\Personal on WEB01', 'Certification path', 'CA:FALSE']) expect(h, w).toContain(w);
    expect(TP.rawHtml(ctxFor('healthy', 26, { type: 'artifact', id: 'leaf' }), 'pem')).toContain('BEGIN CERTIFICATE');
    expect(TP.technicalHtml(ctxFor('healthy', 8, { type: 'artifact', id: 'csr' }))).toContain('SIMSI2027WebServer');
    expect(TP.technicalHtml(ctxFor('healthy', 26, { type: 'artifact', id: 'crl' }))).toContain('2027000000000000000000000000DD99');
  });
});

describe('guided tour controller', () => {
  afterEach(() => vi.useRealTimers());
  const mk = (resumeMs = 25000) => {
    const log = []; let done = false;
    const api = { guard: (f) => f(), speed: () => 1, applyTourStep: (s) => { log.push(`apply:${s.id}`); done = false; }, tourStepDone: () => done, handoff: () => log.push('handoff'), onTourChange: () => {} };
    const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c', handoff: true }];
    const t = new Tour(steps, api, { resumeMs, tickMs: 100, dwellMs: 200 });
    return { t, log, finish: () => { done = true; } };
  };
  it('advances through steps and hands control back at the end', () => {
    vi.useFakeTimers();
    const { t, log, finish } = mk();
    t.start();
    for (let i = 0; i < 3; i++) { vi.advanceTimersByTime(100); finish(); vi.advanceTimersByTime(600); }
    expect(log).toEqual(['apply:a', 'apply:b', 'apply:c', 'handoff']);
    expect(t.state).toBe('finished');
  });
  it('pauses on interaction and resumes after 25 s of inactivity (default)', () => {
    vi.useFakeTimers();
    const { t, log } = mk();
    t.start(); vi.advanceTimersByTime(150);
    expect(t.state).toBe('running');
    t.interrupt();
    expect(t.state).toBe('paused');
    vi.advanceTimersByTime(24000); t.interrupt(); // more activity restarts the inactivity timer
    vi.advanceTimersByTime(24900);
    expect(t.state).toBe('paused');
    vi.advanceTimersByTime(200);
    expect(t.state).toBe('running');
    vi.advanceTimersByTime(150);
    expect(log.filter((l) => l === 'apply:a')).toHaveLength(2);
  });
  it('does not resume after being stopped', () => {
    vi.useFakeTimers();
    const { t } = mk(500);
    t.start(); t.interrupt(); t.stop(); vi.advanceTimersByTime(2000);
    expect(t.state).toBe('idle');
  });
});
