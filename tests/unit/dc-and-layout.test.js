import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as E from '../../src/engine/engine.js';
import { scenarios, scenarioById, COMING_LATER } from '../../src/scenarios/index.js';
import { storyModel, isOrthogonal } from '../../src/views/story-layout.js';
import { ICONS, ICON_IDS } from '../../src/views/icons.js';
import { loadModel, root } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';
import * as TP from '../../src/ui/tls-panel.js';
import { DC } from '../../src/artifacts/synthetic.js';

// v0.4.0: the DC scenario is a two-path story (layoutMode 'story-zones'); its model tests live in dc-story.test.js and its layout
// tests in story-scene.test.js. v0.5.0: the TLS lesson uses the story layout too (tests/unit/tls-*.test.js).
const DCS = E.pathOf(scenarioById['dc-manual-certificate-request'], { pathId: 'csr' }), TLS = scenarioById['tls-manual-enrollment'];
let M, EV;
beforeAll(async () => { const l = await loadModel(); M = l.model; EV = await evaluateAll(M, DCS); });
const ctx = (faultId = 'healthy', t = 99) => ({ scenario: DCS, state: E.computeState(DCS, { faultId, t }), model: M, evidence: EV, ev: EV[faultId] });
void DC;

describe('scenario home', () => {
  it('defines two available scenarios with all card fields and five quiet future entries', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['tls-manual-enrollment', 'dc-manual-certificate-request']);
    for (const s of scenarios) { for (const k of ['purpose', 'requester', 'destination', 'method']) expect(s.home[k], `${s.id}.${k}`).toBeTruthy(); expect(s.subtitle).toBeTruthy(); expect(s.stages.length).toBeGreaterThan(10); }
    expect(COMING_LATER.map((c) => c.title)).toEqual(['NDES / SCEP Device Enrollment', 'CEP / CES Enrollment', 'Autoenrollment', 'AIA Chain Retrieval', 'CRL and OCSP Validation']);
    expect(scenarios.some((s) => COMING_LATER.some((c) => c.id === s.id))).toBe(false);
  });
});

// v0.5.0: the classic focused layout (src/views/scene.js) was removed with the classic TLS workspace. Its assertions (Root CA at the far
// right and never on a request path; orthogonal routes; disclosure follows the step) now run on the story layout for every scenario;
// the detailed TLS geometry tests live in tests/unit/tls-scene.test.js.
describe('story layout for every scenario (migrated from the v0.3.0 classic focused-layout block)', () => {
  it('every scenario uses the story layout; there is no classic layout any more', () => {
    expect(scenarios.every((s) => s.layoutMode === 'story-zones')).toBe(true); expect(scenarioById['dc-manual-certificate-request'].layoutMode).toBe('story-zones');
  });
  for (const sc of scenarios) {
    const v = E.pathOf(sc, {});
    it(`${sc.id}: focused views show fewer zones than full topology; the step's zone is always active`, () => {
      for (let i = 0; i < v.stages.length; i++) {
        const s = E.worldAt(v, 'healthy', i + 1);
        const shown = storyModel(v, s).zones.filter((z) => ['active', 'adjacent'].includes(z.mode)).length;
        expect(shown, `${sc.id}#${i}`).toBeLessThan(storyModel(v, s, { full: true }).zones.length);
        expect(storyModel(v, s).zones.find((z) => z.mode === 'active').id).toBe(v.stages[i].zone);
      }
    });
    it(`${sc.id}: the offline Root CA sits in the far-right Offline Trust box and never in an active request path`, () => {
      const m = storyModel(v, E.worldAt(v, 'healthy', 1));
      expect(m.ot.rect.x).toBe(Math.max(...m.zones.map((z) => z.x))); expect(m.ot.rect.y).toBeLessThan(m.zones[0].y);
      expect(v.flows.some((f) => /OT|root/i.test(f.from) || /^OT|rootca/i.test(f.to))).toBe(false);
    });
    it(`${sc.id}: connectors are orthogonal`, () => {
      for (let i = 0; i < v.stages.length; i++) for (const c of storyModel(v, E.worldAt(v, 'healthy', i + 1)).connectors) expect(isOrthogonal(c.points), `${sc.id} ${c.id}`).toBe(true);
    });
  }
});

// v0.4.0: the v0.3.0 "Domain Controller scenario model" block (18 stages, ca-unavailable / ica-cert-unavailable faults, KerberosAuthentication
// in the CSR, CLIENT-trusted root) encoded the superseded model. Its assertions were migrated to tests/unit/dc-story.test.js
// (paths, golden rules 1-27, 14 faults, conditions, reverse evidence) and tests/unit/story-scene.test.js (layout).
describe('Domain Controller scenario model (v0.4.0 Path A view, kept from v0.3.0 where still true)', () => {
  it('the private key never travels and the Root CA never touches the request', () => {
    expect(DCS.artifacts.find((a) => a.id === 'private-key').inspectable).toBe(false);
    for (const f of DCS.flows) { expect(f.artifact).not.toBe('private-key'); expect(['OT', 'rootca']).not.toContain(f.to); expect(['OT', 'rootca']).not.toContain(f.from); }
  });
  it('request identity belongs to DC01; the operator is distinct', () => {
    const cert = M.resolve('dc-cert', null).parsed, csr = M.resolve('dc-csr', null).parsed;
    expect(cert.subject).toBe('CN=DC01.simsi2027.test'); expect(csr.subject).toBe(cert.subject);
    expect(DC.operator).toBe('SIMSI2027\\PKIOperator');
    expect(cert.subject).not.toMatch(/PKIOperator/); expect(cert.san.some((n) => /operator/i.test(n.value))).toBe(false);
  });
  it('CSR and certificate relate correctly: SAN, key, EKUs, template, chain', async () => {
    const cert = M.resolve('dc-cert', null).parsed, csr = M.resolve('dc-csr', null).parsed, ica = M.resolve('ica', null).parsed, rootc = M.resolve('root', null).parsed;
    // v0.4.0: Path A requests three DNS names (host FQDN, domain DNS name, NetBIOS name) under the offline-handoff template DCOfflineKerberosAuth.
    expect(csr.san.map((n) => n.value)).toEqual(['DC01.simsi2027.test', 'simsi2027.test', 'SIMSI2027']); expect(cert.san).toEqual(csr.san);
    expect(csr.publicKey.spkiSha256).toBe(cert.publicKey.spkiSha256); expect(csr.signatureValid).toBe(true);
    expect(cert.eku.map((e) => e.name)).toEqual(['Client Authentication', 'Server Authentication', 'Smart Card Logon', 'KDC Authentication']);
    expect(cert.keyUsage).toEqual(['Digital Signature', 'Key Encipherment']);
    expect(cert.template).toMatchObject({ name: 'DCOfflineKerberosAuth', oid: DC.offlineTemplateOid, version: '100.1' });
    expect(String(csr.templateRequest)).toBe('DCOfflineKerberosAuth');
    expect(cert.issuer).toBe(ica.subject); expect(ica.issuer).toBe(rootc.subject);
    expect(await cert.x509.verify({ publicKey: ica.x509, signatureOnly: true })).toBe(true);
    expect(await cert.x509.verify({ publicKey: rootc.x509, signatureOnly: true })).toBe(false);
    expect(cert.aia[0].location).toMatch(/\.crt$/); expect(cert.cdp[0]).toMatch(/\.crl$/); expect(cert.aia[0].location).not.toBe(cert.cdp[0]);
  });
  it('teaching INF is parsed from the fixture and requests machine context', () => {
    const inf = M.resolve('dc-inf', null).parsed;
    expect(inf.machineContext).toBe(true); expect(inf.template).toBe('DCOfflineKerberosAuth'); // v0.4.0 Path A template
    expect(inf.fields['NewRequest.KeyLength']).toBe('2048'); expect(inf.fields['NewRequest.Exportable']).toBe('FALSE');
    expect(M.resolve('dc-inf', 'user-context').parsed.machineContext).toBe(false);
  });
  it('certreq educational commands are present and never executed', () => {
    const cmd = (id) => DCS.stages.find((s) => s.id === id).command.text;
    expect(cmd('a-new')).toBe('certreq -new -machine dc01-request.inf dc01-request.req');
    // v0.4.0: the CA configuration string is derived from DC.caHost and DC.caName (the Issuing CA certificate CN).
    expect(cmd('a-submit')).toBe('certreq -submit -config "ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01" dc01-request.req');
    expect(cmd('a-accept')).toBe('certreq -accept -machine dc01-issued.cer');
    const src = readFileSync(join(root, 'src/scenarios/dc-manual-certificate-request.js'), 'utf8'); expect(src).not.toMatch(/child_process|execFile|spawn/);
  });
  it('reverse evidence cites an evidence kind; the old "which CLIENT trusts" wording is gone', () => {
    const t = E.buildTrace(DCS, 'healthy');
    for (const e of t) expect(e.evidenceKind).toMatch(/^(Real fixture data|Simulated environment|Derived conclusion|User-selected fault)/);
    expect(JSON.stringify(t)).not.toMatch(/CLIENT trusts/);
    const r = E.computeState(scenarioById['dc-manual-certificate-request'], { faultId: 'healthy', direction: 'reverse', tReverse: 4 });
    expect(r.direction).toBe('reverse'); expect(r.trustDecision).toBe('suitable'); expect(r.evidenceIndex).toBe(3);
  });
  it('AIA and CDP stay separate in the DC evidence', () => {
    for (const k of ['aia', 'cdp']) for (const f of ['raw', 'resolved', 'expected', 'result', 'timestamp']) expect(EV.healthy[k]).toHaveProperty(f);
    expect(EV.healthy.aia.resolved).not.toBe(EV.healthy.cdp.resolved);
    expect(EV['cdp-unreachable'].cdp.ok).toBe(false); expect(EV['cdp-unreachable'].aia.ok).toBe(true);
  });
});

describe('educational content', () => {
  // v0.5.0: the TLS lesson moved from the classic explain panel (teach.js) to the story panel (tls-panel.js). The intents are kept:
  // every step explains itself in plain language, the panel answers the required questions, evidence uses the four kinds, and the
  // CSR summary separates public and private keys.
  it('every TLS step has the v0.5.0 plain-language explanation; every DC step has the v0.4.0 one', () => {
    for (const s of TLS.stages) for (const k of ['what', 'why', 'who', 'where', 'moves', 'staysPrivate', 'checked', 'canGoWrong']) expect(s.explain[k], `${s.id}.${k}`).toBeTruthy();
    for (const p of Object.values(scenarioById['dc-manual-certificate-request'].paths)) for (const s of p.stages) for (const k of ['what', 'who', 'moves', 'staysLocal', 'canGoWrong']) expect(s.explain[k], `${s.id}.${k}`).toBeTruthy();
  });
  it('the TLS plain-language section answers the required questions', async () => {
    const tev = await evaluateAll(M, TLS);
    const h = TP.plainHtml({ scenario: TLS, state: E.computeState(TLS, { faultId: 'healthy', t: 7 }), model: M, evidence: tev, ev: tev.healthy, started: true, selection: null, gloss: new Set() });
    for (const q of ['What is happening', 'Why', 'Who', 'Where', 'What moves', 'What stays private', 'What is checked', 'What could go wrong']) expect(h).toContain(`<dt>${q}</dt>`);
  });
  it('evidence items are classified into the four allowed kinds: every DC and every TLS step and fault (story panels)', async () => {
    const kinds = /^(Real fixture data|Simulated environment|Derived conclusion|User-selected fault)$/;
    const { evidenceHtml: storyEvidence } = await import('../../src/ui/story-panel.js');
    const pill = (h) => [...h.matchAll(/class="pill pill-[a-z]+">([^<]+)</g)].map((m) => m[1]).filter((x) => !['pass', 'fail'].includes(x));
    for (const pathId of ['csr', 'mmc']) {
      const v = E.pathOf(scenarioById['dc-manual-certificate-request'], { pathId }); const ev = await evaluateAll(M, v);
      for (const f of v.faults.map((x) => x.id)) for (let t = 1; t <= v.stages.length; t += 1) {
        const c = { scenario: v, state: E.computeState(v, { faultId: f, t }), model: M, evidence: ev, ev: ev[f] };
        for (const k of pill(storyEvidence(c))) expect(k, `${pathId}/${f}/${t}`).toMatch(kinds);
      }
    }
    const tev = await evaluateAll(M, TLS);
    for (const f of TLS.faults.map((x) => x.id)) for (let t = 1; t <= E.maxT(TLS, f); t += 1) {
      const c = { scenario: TLS, state: E.computeState(TLS, { faultId: f, t }), model: M, evidence: tev, ev: tev[f] };
      for (const k of pill(TP.evidenceHtml(c))) expect(k, `tls/${f}/${t}`).toMatch(kinds);
    }
    const tc = { scenario: TLS, state: E.computeState(TLS, { faultId: 'revoked', t: 99 }), model: M, evidence: tev, ev: tev.revoked, started: true };
    expect(TP.evidenceHtml(tc)).toContain('Real fixture data'); expect(TP.troubleshootHtml(tc)).toContain('Remediation');
  });
  it('TLS CSR summary distinguishes public and private keys', async () => {
    const tev = await evaluateAll(M, TLS);
    const h = TP.technicalHtml({ scenario: TLS, state: E.computeState(TLS, { t: 8 }), model: M, evidence: tev, ev: tev.healthy, started: true, selection: { type: 'artifact', id: 'csr' } });
    for (const w of ['Certificate Signing Request', 'public key', 'does <strong>not</strong> contain the private key', 'The key stays on WEB01', 'SIMSI2027WebServer', 'Next:', 'Common failures']) expect(h, w).toContain(w);
  });
});

describe('icon family', () => {
  it('manifest matches the custom icons and records that none are official', () => {
    const m = JSON.parse(readFileSync(join(root, 'assets/icons/manifest.json'), 'utf8'));
    expect(m.icons.map((i) => i.id).sort()).toEqual([...ICON_IDS].sort());
    for (const i of m.icons) { expect(i.label && i.description).toBeTruthy(); expect(i.official).toBe(false); expect(i.origin).toBe('custom'); }
    const src = readFileSync(join(root, 'assets/icons/SOURCES.md'), 'utf8'); expect(src).toMatch(/No official Microsoft icons are used/); expect(src).toMatch(/source URL/);
  });
  // v0.5.0: entities.js (classic) was removed; every story artifact icon must exist and is always paired with its label.
  it('every story artifact icon exists and names accompany icons', () => {
    for (const sc of scenarios) { const S = sc.story ?? null; const arts = S ? S.artifacts : E.pathOf(sc, {}).artifacts.reduce((o, a) => ({ ...o, [a.id]: a }), {}); for (const [id, a] of Object.entries(arts)) { expect(ICONS[a.icon], `${sc.id}:${id}:${a.icon}`).toBeTruthy(); expect(a.label).toBeTruthy(); } }
  });
});
