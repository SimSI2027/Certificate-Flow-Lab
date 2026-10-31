import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import * as E from '../../src/engine/engine.js';
import { loadModel } from '../helpers/fixtures.js';
import { describeEntity, describeFlow, describeOtherArtifact, faultExplanation } from '../../src/ui/details.js';
import { entities } from '../../src/entities/entities.js';
import { tabsFor, tabId, renderTab, CERT_TABS, CSR_TABS, CRL_TABS } from '../../src/inspectors/inspector.js';
import { Tour } from '../../src/tour/tour.js';

let ctxFor;
beforeAll(async () => {
  const { model, evidence, scenario } = await loadModel();
  ctxFor = (faultId = 'healthy', t = 19) => { const state = E.computeState(scenario, { faultId, t }); return { scenario, state, model, evidence, ev: evidence[faultId] }; };
});

const FAULT_IDS = ['wrong-dns', 'expired', 'untrusted-root', 'wrong-eku', 'missing-ica', 'revoked', 'cdp-unavailable', 'no-private-key'];

describe('detail panels', () => {
  it('every entity and flow produces content without throwing, for every fault', () => {
    for (const f of ['healthy', ...FAULT_IDS]) {
      const c = ctxFor(f, 99);
      for (const e of entities) expect(describeEntity(e.id, c).length, `${f}/${e.id}`).toBeGreaterThan(100);
      for (const fl of c.scenario.flows) expect(describeFlow(fl.id, c)).toContain('Conceptual protocol');
    }
  });
  it('required fields are present for visitor, client, owner, WEB01, template, CAs and PKIWEB01', () => {
    const c = ctxFor();
    const need = {
      visitor: ['SIMSI2027\\Jordan', 'Role', 'Client computer', 'Synthetic IP', 'Authentication context', 'Observed browser error', 'Report submitted'],
      client01: ['Hostname', 'Domain', 'Operating system', 'DNS server', 'Trust store', 'Active browser session', 'enrollment authority'],
      owner: ['SIMSI2027\\Morgan', 'Group memberships', 'Assigned application', 'Permission to request', 'Request history'],
      web01: ['Hostname', 'IIS role', 'Certificate store', 'Private-key state', 'Current HTTPS binding', 'SNI state', 'Installed certificate thumbprint'],
      template: ['Template OID', 'Schema version', 'Subject / SAN source', 'EKU', 'Key requirements', 'Validity period', 'Renewal period', 'Enrollment permissions', 'Approval requirement', 'Issuing CA availability', 'Policy decision'],
      ica01: ['CA name', 'Role', 'CA certificate', 'Request ID', 'Request disposition', 'Requester', 'Template', 'Issued serial number', 'Signature algorithm', 'Database record', 'AIA configuration', 'CDP configuration'],
      rootca: ['Offline root', 'Self-signed', 'Trust-anchor purpose', 'Path-length', 'does'],
      pkiweb01: ['Publication role', 'Available issuing CA certificate', 'Available CRL', 'AIA endpoint', 'CDP endpoint', 'Simulated retrieval result']
    };
    for (const [id, words] of Object.entries(need)) { const h = describeEntity(id, c); for (const w of words) expect(h, `${id}:${w}`).toContain(w); }
  });
  it('IP address is presented as context, never as enrollment authority', () => {
    const h = describeEntity('client01', ctxFor());
    expect(h).toMatch(/contextual information/);
    expect(h).toMatch(/not<\/strong> the enrollment authority/);
  });
  it('root CA does not issue the website certificate; the owner (not the visitor) is the requester', () => {
    expect(describeEntity('rootca', ctxFor())).toMatch(/does <strong>not<\/strong> issue the website certificate/);
    expect(describeEntity('visitor', ctxFor())).toMatch(/does not enroll/);
    expect(describeEntity('ica01', ctxFor())).toContain('SIMSI2027\\Morgan');
  });
  it('AIA and CDP blocks show raw value, resolved URL, expected object, result, status and timestamp', () => {
    const h = describeEntity('pkiweb01', ctxFor());
    for (const w of ['Raw extension value', 'Resolved synthetic URL', 'Expected object', 'Simulated retrieval result', 'Status', 'Evidence timestamp']) expect(h.split(w).length - 1, w).toBeGreaterThanOrEqual(2);
  });
  it('fault explanation answers the five required questions', () => {
    for (const f of FAULT_IDS) {
      const h = faultExplanation(ctxFor(f, 99));
      for (const w of ['What failed', 'Evidence', 'Still healthy', 'Likely remediation', 'Owner of the correction']) expect(h, `${f}:${w}`).toContain(w);
    }
    expect(faultExplanation(ctxFor('healthy', 99))).toBe('');
  });
  it('private key panel never exposes key material', () => { expect(describeOtherArtifact('private-key', ctxFor())).not.toMatch(/BEGIN|[A-Za-z0-9+/]{80}/); });
});

describe('artifact inspector fields', () => {
  it('has the required certificate, CSR and CRL tab sets', () => {
    expect(CERT_TABS).toEqual(['General', 'Details', 'Certification Path', 'Subject Alternative Names', 'Enhanced Key Usage', 'Key Usage', 'Basic Constraints', 'Authority Information Access', 'CRL Distribution Points', 'Thumbprints', 'PEM', 'Raw ASN.1 summary', 'Issuance history', 'Matching CSR']);
    expect(CSR_TABS).toEqual(['Subject', 'SAN', 'Public key', 'Signature', 'Requested extensions', 'Template request', 'PEM', 'Raw ASN.1 summary']);
    expect(CRL_TABS).toEqual(['Issuer', 'This Update', 'Next Update', 'CRL number', 'Revoked entries', 'Signature', 'Distribution location', 'Raw data summary']);
  });
  it('every tab renders from real fixture values and never exposes private keys', () => {
    const c = ctxFor();
    for (const role of ['leaf', 'ica', 'root', 'csr', 'crl', 'chain']) {
      const p = c.model.resolve(role, null).parsed;
      for (const tab of tabsFor(p)) { const h = renderTab(p, tab, c); expect(h.length, `${role}/${tab}`).toBeGreaterThan(10); expect(h).not.toMatch(/PRIVATE KEY/); }
    }
    const leaf = c.model.resolve('leaf', null).parsed;
    expect(renderTab(leaf, 'Thumbprints', c)).toContain(leaf.thumbprints.sha1.match(/../g).join(' '));
    expect(renderTab(leaf, 'PEM', c)).toContain('BEGIN CERTIFICATE');
    expect(renderTab(leaf, 'Matching CSR', c)).toContain('yes');
    expect(renderTab(c.model.resolve('csr', null).parsed, 'Template request', c)).toContain('WebServer');
    expect(tabId('Raw ASN.1 summary')).toBe('raw-asn-1-summary');
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
