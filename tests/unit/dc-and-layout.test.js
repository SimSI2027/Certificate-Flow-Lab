import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as E from '../../src/engine/engine.js';
import { scenarios, scenarioById, COMING_LATER } from '../../src/scenarios/index.js';
import { visibleSets, routeFor, stageEndpoints } from '../../src/views/scene.js';
import { entities } from '../../src/entities/entities.js';
import { ICONS, ICON_IDS } from '../../src/views/icons.js';
import { loadModel, root } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';
import { explainHtml, evidenceItems, evidenceHtml, troubleshootHtml, friendlyHtml } from '../../src/ui/teach.js';
import { describeDcEntity } from '../../src/ui/details-dc.js';
import { DC } from '../../src/artifacts/synthetic.js';

// v0.4.0: the DC scenario is a two-path story (layoutMode 'story-zones'); its model tests live in dc-story.test.js and its layout
// tests in story-scene.test.js. The focused-layout tests below now apply to the classic-layout scenarios (TLS) only.
const DCS = E.pathOf(scenarioById['dc-manual-certificate-request'], { pathId: 'csr' }), TLS = scenarioById['tls-manual-enrollment'];
const classic = scenarios.filter((s) => !s.layoutMode);
let M, EV;
beforeAll(async () => { const l = await loadModel(); M = l.model; EV = await evaluateAll(M, DCS); });
const ctx = (faultId = 'healthy', t = 99) => ({ scenario: DCS, state: E.computeState(DCS, { faultId, t }), model: M, evidence: EV, ev: EV[faultId] });
void DC; void describeDcEntity;

describe('scenario home', () => {
  it('defines two available scenarios with all card fields and five quiet future entries', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['tls-manual-enrollment', 'dc-manual-certificate-request']);
    for (const s of scenarios) { for (const k of ['purpose', 'requester', 'destination', 'method']) expect(s.home[k], `${s.id}.${k}`).toBeTruthy(); expect(s.subtitle).toBeTruthy(); expect(s.stages.length).toBeGreaterThan(10); }
    expect(COMING_LATER.map((c) => c.title)).toEqual(['NDES / SCEP Device Enrollment', 'CEP / CES Enrollment', 'Autoenrollment', 'AIA Chain Retrieval', 'CRL and OCSP Validation']);
    expect(scenarios.some((s) => COMING_LATER.some((c) => c.id === s.id))).toBe(false);
  });
});

describe('focused layout, full topology and active path (classic layout scenarios)', () => {
  it('the classic focused layout still serves TLS; the DC scenario uses the story layout', () => {
    expect(classic.map((s) => s.id)).toEqual(['tls-manual-enrollment']); expect(scenarioById['dc-manual-certificate-request'].layoutMode).toBe('story-zones');
  });
  for (const sc of classic) {
    it(`${sc.id}: focused views show fewer entities than full topology, and full shows every scenario entity`, () => {
      const full = visibleSets(sc, 3, { full: true });
      expect([...full.all].sort()).toEqual([...sc.entityIds].sort());
      for (let i = 0; i < sc.stages.length; i++) { const v = visibleSets(sc, i); expect(v.all.size, `${sc.id}#${i}`).toBeLessThan(sc.entityIds.length); expect(v.current.has(sc.stages[i].focus.entity)).toBe(true); for (const e of v.all) expect(sc.layout[e], e).toBeTruthy(); }
    });
    it(`${sc.id}: offline Root CA sits in the far-right Offline Trust zone and never in an active request path`, () => {
      expect(sc.zoneOf.rootca).toBe('offline');
      const z = sc.zones.find((q) => q.id === 'offline'); expect(z.offline).toBe(true);
      expect(Math.max(...sc.zones.map((q) => q.x))).toBe(z.x);
      expect(sc.layout.rootca[0]).toBe(Math.max(...Object.values(sc.layout).map((p) => p[0])));
      expect(sc.flows.some((f) => f.from === 'rootca' || f.to === 'rootca')).toBe(false);
      for (const art of sc.artifacts) for (const p of art.presence) if (p.via) expect(p.at === 'rootca').toBe(false);
      const rootStages = sc.stages.filter((s) => visibleSets(sc, sc.stages.indexOf(s)).all.has('rootca')).map((s) => s.id);
      for (const id of rootStages) { const s = sc.stages.find((q) => q.id === id); expect((s.show ?? []).includes('rootca') || s.focus.entity === 'rootca').toBe(true); }
      expect(visibleSets(sc, 0).all.has('rootca')).toBe(false);
    });
    it(`${sc.id}: connectors are orthogonal and active-path filtering follows the stage`, () => {
      for (const f of sc.flows) {
        const pts = routeFor(sc, f); if (!pts) { expect(f.from).toBe(f.to); continue; }
        for (let i = 0; i < pts.length - 1; i++) expect(pts[i][0] === pts[i + 1][0] || pts[i][1] === pts[i + 1][1], `${f.id} segment ${i}`).toBe(true);
        expect(['request', 'policy', 'cert', 'install', 'validate', 'trust']).toContain(f.kind);
      }
      for (let i = 0; i < sc.stages.length; i++) { const v = visibleSets(sc, i); for (const e of stageEndpoints(sc, sc.stages[i].id)) expect(v.current.has(e)).toBe(true); }
    });
  }
  it('flows never cross through the Root CA zone: only the muted history link reaches it', () => {
    for (const sc of classic) { const z = sc.zones.find((q) => q.offline); for (const f of sc.flows) for (const p of routeFor(sc, f) ?? []) expect(p[0], `${sc.id} ${f.id}`).toBeLessThan(z.x); }
  });
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
  it('every TLS stage has the classic explanation; every DC step has the v0.4.0 plain-language explanation', () => {
    for (const s of TLS.stages) { const x = s.explain; expect(x, s.id).toBeTruthy(); for (const k of ['what', 'why', 'who', 'where', 'next', 'local', 'owner']) expect(x[k], `${s.id}.${k}`).toBeTruthy(); expect(x.wrong.length).toBeGreaterThan(0); expect(x.checks.length).toBeGreaterThan(0); }
    for (const p of Object.values(scenarioById['dc-manual-certificate-request'].paths)) for (const s of p.stages) for (const k of ['what', 'who', 'moves', 'staysLocal', 'canGoWrong']) expect(s.explain[k], `${s.id}.${k}`).toBeTruthy();
  });
  it('explain tab answers the required questions (TLS classic panel)', () => {
    const tm = { scenario: TLS, state: E.computeState(TLS, { faultId: 'healthy', t: 7 }), model: M, evidence: {}, ev: null };
    const h = explainHtml(tm, { entity: 'web01' });
    for (const q of ['What is happening?', 'Why is this necessary?', 'Who performs this action?', 'Where does it happen?', 'What moves to the next step?', 'What remains private or local?', 'What could commonly go wrong?']) expect(h).toContain(q);
  });
  it('evidence items are classified into the four allowed kinds for every DC step and fault', () => {
    const kinds = /^(Real fixture data|Simulated environment|Derived conclusion|User-selected fault)$/;
    for (const f of DCS.faults.map((x) => x.id)) for (let t = 1; t <= DCS.stages.length; t += 1) for (const i of evidenceItems(ctx(f, t))) expect(i.kind, `${f}/${t}/${i.label}`).toMatch(kinds);
    expect(evidenceHtml(ctx())).toContain('Real fixture data');
    expect(troubleshootHtml(ctx('key-mismatch'))).toContain('Simulated remediation');
  });
  it('CSR friendly summary distinguishes public and private keys and the machine context', () => {
    const h = friendlyHtml(ctx('healthy', 8), 'csr');
    for (const w of ['Certificate Signing Request (CSR)', 'public key', 'does <strong>not</strong> contain the private key', 'private key remains on', 'Local Computer', 'DCOfflineKerberosAuth', 'PKIOperator', 'What happens next', 'Common failures']) expect(h, w).toContain(w);
  });
});

describe('icon family', () => {
  it('manifest matches the custom icons and records that none are official', () => {
    const m = JSON.parse(readFileSync(join(root, 'assets/icons/manifest.json'), 'utf8'));
    expect(m.icons.map((i) => i.id).sort()).toEqual([...ICON_IDS].sort());
    for (const i of m.icons) { expect(i.label && i.description).toBeTruthy(); expect(i.official).toBe(false); expect(i.origin).toBe('custom'); }
    const src = readFileSync(join(root, 'assets/icons/SOURCES.md'), 'utf8'); expect(src).toMatch(/No official Microsoft icons are used/); expect(src).toMatch(/source URL/);
  });
  it('every entity icon exists and names accompany icons', () => {
    for (const e of entities) { expect(ICONS[e.icon], `${e.id}:${e.icon}`).toBeTruthy(); expect(e.label).toBeTruthy(); }
  });
});
