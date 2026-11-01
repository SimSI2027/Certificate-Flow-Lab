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

const DCS = scenarioById['dc-manual-certificate-request'], TLS = scenarioById['tls-manual-enrollment'];
const ids = DCS.stages.map((s) => s.id);
let M, EV;
beforeAll(async () => { const l = await loadModel(); M = l.model; EV = await evaluateAll(M, DCS); });
const ctx = (faultId = 'healthy', t = 99) => ({ scenario: DCS, state: E.computeState(DCS, { faultId, t }), model: M, evidence: EV, ev: EV[faultId] });

describe('scenario home', () => {
  it('defines two available scenarios with all card fields and five quiet future entries', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['tls-manual-enrollment', 'dc-manual-certificate-request']);
    for (const s of scenarios) { for (const k of ['purpose', 'requester', 'destination', 'method']) expect(s.home[k], `${s.id}.${k}`).toBeTruthy(); expect(s.subtitle).toBeTruthy(); expect(s.stages.length).toBeGreaterThan(10); }
    expect(COMING_LATER.map((c) => c.title)).toEqual(['NDES / SCEP Device Enrollment', 'CEP / CES Enrollment', 'Autoenrollment', 'AIA Chain Retrieval', 'CRL and OCSP Validation']);
    expect(scenarios.some((s) => COMING_LATER.some((c) => c.id === s.id))).toBe(false);
  });
});

describe('focused layout, full topology and active path', () => {
  for (const sc of scenarios) {
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
    for (const sc of scenarios) { const z = sc.zones.find((q) => q.offline); for (const f of sc.flows) for (const p of routeFor(sc, f) ?? []) expect(p[0], `${sc.id} ${f.id}`).toBeLessThan(z.x); }
  });
});

describe('Domain Controller scenario model', () => {
  it('has the logical stage order and milestone groups', () => {
    expect(ids).toEqual(['detect', 'inspect-dc01', 'choose-template', 'verify-permission', 'request-policy', 'keygen', 'csr', 'inspect-csr', 'submit', 'evaluate-policy', 'issue', 'retrieve', 'accept', 'key-match', 'inspect-purposes', 'verify-chain', 'confirm', 'followup']);
    const groups = []; for (const s of DCS.stages) if (groups.at(-1) !== s.phase) groups.push(s.phase);
    expect(groups).toEqual(['Problem', 'Identity', 'Key', 'CSR', 'Submission', 'Policy', 'Issuance', 'Retrieval', 'Acceptance', 'Verification']);
  });
  it('forward transitions: machine context, key retained on DC01, accepted certificate matched, result suitable', () => {
    const at = (id) => E.worldAt(DCS, 'healthy', E.stageEndT(ids.indexOf(id)));
    expect(at('detect').dcCertState).toBe('missing');
    expect(at('request-policy').contextState).toBe('machine');
    expect(at('keygen').keyState).toBe('held-on-dc01');
    expect(at('submit')).toMatchObject({ requestState: 'received', csrState: 'submitted' });
    expect(at('issue').issuanceState).toBe('issued');
    expect(at('accept')).toMatchObject({ installationState: 'accepted', certificateState: 'installed' });
    expect(at('key-match').keyAssociation).toBe('matched');
    expect(at('followup')).toMatchObject({ trustDecision: 'trusted', followupState: 'investigate-autoenrollment' });
    for (let t = 0; t <= ids.length; t += 0.1) for (const v of Object.values(E.worldAt(DCS, 'healthy', t))) expect(v === null || typeof v !== 'number' || Number.isFinite(v)).toBe(true);
  });
  it('the private key never leaves DC01 and the Root CA never touches the request', () => {
    const key = DCS.artifacts.find((a) => a.id === 'private-key');
    expect(key.presence.every((p) => p.at === 'dc01' && !p.via)).toBe(true);
    for (let t = 0; t <= ids.length; t += 0.25) { const loc = E.artifactLocation(DCS, E.worldAt(DCS, 'healthy', t), key); if (loc.visible) expect(loc.at).toBe('dc01'); }
    expect(DCS.flows.find((f) => f.id === 'f-submit')).toMatchObject({ from: 'dc01', to: 'ica01' });
  });
  it('request identity belongs to DC01; the operator is distinct', () => {
    const cert = M.resolve('dc-cert', null).parsed, csr = M.resolve('dc-csr', null).parsed;
    expect(cert.subject).toBe('CN=DC01.simsi2027.test'); expect(csr.subject).toBe(cert.subject);
    expect(DC.operator).toBe('SIMSI2027\\PKIOperator');
    expect(cert.subject).not.toMatch(/PKIOperator/); expect(cert.san.some((n) => /operator/i.test(n.value))).toBe(false);
    expect(DCS.flows.find((f) => f.id === 'f-submit').identity).toContain('PKIOperator');
  });
  it('CSR and certificate relate correctly: SAN, key, EKUs, template, chain', async () => {
    const cert = M.resolve('dc-cert', null).parsed, csr = M.resolve('dc-csr', null).parsed, ica = M.resolve('ica', null).parsed, rootc = M.resolve('root', null).parsed;
    expect(csr.san).toEqual([{ type: 'DNS', value: 'DC01.simsi2027.test' }]); expect(cert.san).toEqual(csr.san);
    expect(csr.publicKey.spkiSha256).toBe(cert.publicKey.spkiSha256); expect(csr.signatureValid).toBe(true);
    expect(cert.eku.map((e) => e.name)).toEqual(['Client Authentication', 'Server Authentication', 'KDC Authentication', 'Smart Card Logon']);
    expect(cert.keyUsage).toEqual(['Digital Signature', 'Key Encipherment']);
    expect(cert.template).toMatchObject({ name: 'KerberosAuthentication', oid: DC.templateOid });
    expect(String(csr.templateRequest)).toBe('KerberosAuthentication');
    expect(cert.issuer).toBe(ica.subject); expect(ica.issuer).toBe(rootc.subject);
    expect(await cert.x509.verify({ publicKey: ica.x509, signatureOnly: true })).toBe(true);
    expect(await cert.x509.verify({ publicKey: rootc.x509, signatureOnly: true })).toBe(false);
    expect(cert.aia[0].location).toMatch(/\.crt$/); expect(cert.cdp[0]).toMatch(/\.crl$/); expect(cert.aia[0].location).not.toBe(cert.cdp[0]);
  });
  it('teaching INF is parsed from the fixture and requests machine context', () => {
    const inf = M.resolve('dc-inf', null).parsed;
    expect(inf.machineContext).toBe(true); expect(inf.template).toBe('KerberosAuthentication'); expect(inf.fields['NewRequest.KeyLength']).toBe('2048'); expect(inf.fields['NewRequest.Exportable']).toBe('FALSE');
    expect(M.resolve('dc-inf', 'user-context').parsed.machineContext).toBe(false);
  });
  it('certreq educational commands are present and never executed', () => {
    expect(DCS.commands.new).toBe('certreq.exe -new dc01-request.inf dc01-request.req');
    // v0.4.0: the CA configuration string is derived from DC.caHost and DC.caName (the Issuing CA certificate CN).
    expect(DCS.commands.submit).toBe('certreq.exe -submit -config "ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01" dc01-request.req dc01-issued.cer');
    expect(DCS.commands.accept).toBe('certreq.exe -accept dc01-issued.cer');
    const src = readFileSync(join(root, 'src/scenarios/dc-manual-certificate-request.js'), 'utf8'); expect(src).not.toMatch(/child_process|execFile|spawn/);
  });
  it('reverse evidence follows the specified causal order and cites an evidence kind', () => {
    const t = E.buildTrace(DCS, 'healthy');
    expect(t.map((e) => e.id)).toEqual(['usable', 'purposes', 'dns', 'key-assoc', 'chain-root', 'revocation', 'issued-by', 'template', 'permission', 'pop', 'key-local', 'initiated']);
    for (const e of t) expect(['Real fixture data', 'Simulated environment', 'Derived conclusion', 'User-selected fault']).toContain(e.evidenceKind);
    const r = E.computeState(DCS, { faultId: 'healthy', direction: 'reverse', tReverse: 4 });
    expect(r.direction).toBe('reverse'); expect(r.trustDecision).toBe('trusted'); expect(r.evidenceIndex).toBe(3);
  });
  const expected = { 'template-not-published': 'choose-template', 'no-enroll-permission': 'verify-permission', 'user-context': 'evaluate-policy', 'ca-unavailable': 'submit', 'pending-approval': 'evaluate-policy',
    'wrong-eku': 'inspect-purposes', 'san-missing': 'inspect-purposes', 'key-mismatch': 'key-match', 'ica-cert-unavailable': 'verify-chain', 'cdp-unavailable': 'verify-chain', expired: 'inspect-purposes' };
  it('has exactly the requested faults', () => { expect(DCS.faults.map((f) => f.id)).toEqual(['healthy', ...Object.keys(expected)]); });
  for (const [id, stage] of Object.entries(expected)) {
    it(`fault ${id} halts at ${stage}, real/simulated evidence agrees, and every field is explained`, () => {
      expect(E.maxT(DCS, id)).toBe(ids.indexOf(stage) + 1);
      const w = E.worldAt(DCS, id, 99); expect(w.halted).toBe(true); expect(w.stage).toBe(ids.indexOf(stage)); expect(w.trustDecision).not.toBe('trusted');
      expect(EV[id].failStage).toBe(stage); expect(EV[id].firstFailure.id).toBe(DCS.faults.find((f) => f.id === id).check);
      const fault = DCS.faults.find((f) => f.id === id); expect(fault.owner && fault.remediation && typeof fault.continues === 'boolean').toBeTruthy();
      const t = troubleshootHtml(ctx(id));
      for (const k of ['Expected result', 'Current result', 'Likely failure causes', 'Suggested checks', 'Simulated remediation', 'Should the manual request continue?', 'autoenrollment issue still need investigation']) expect(t, k).toContain(k);
      expect(evidenceItems(ctx(id)).some((i) => i.kind === 'User-selected fault')).toBe(true);
    });
  }
  it('healthy evidence passes; user-context only changes the request-policy stage and the INF evidence', () => {
    expect(EV.healthy.firstFailure).toBeNull();
    expect(E.worldAt(DCS, 'user-context', E.stageEndT(ids.indexOf('request-policy'))).contextState).toBe('user');
    expect(EV['user-context'].firstFailure.kind).toBe('User-selected fault'); expect(EV['user-context'].firstFailure.basis).toBe('Real fixture data');
  });
  it('AIA and CDP stay separate in the DC evidence', () => {
    for (const k of ['aia', 'cdp']) for (const f of ['raw', 'resolved', 'expected', 'result', 'timestamp']) expect(EV.healthy[k]).toHaveProperty(f);
    expect(EV.healthy.aia.resolved).not.toBe(EV.healthy.cdp.resolved);
    expect(EV['ica-cert-unavailable'].aia.ok).toBe(false); expect(EV['ica-cert-unavailable'].cdp.ok).toBe(true);
    expect(EV['cdp-unavailable'].cdp.ok).toBe(false); expect(EV['cdp-unavailable'].aia.ok).toBe(true);
  });
});

describe('educational content', () => {
  it('every stage of every scenario has a complete plain-language explanation', () => {
    for (const sc of scenarios) for (const s of sc.stages) { const x = s.explain; expect(x, `${sc.id}/${s.id}`).toBeTruthy(); for (const k of ['what', 'why', 'who', 'where', 'next', 'local', 'owner']) expect(x[k], `${s.id}.${k}`).toBeTruthy(); expect(x.wrong.length).toBeGreaterThan(0); expect(x.checks.length).toBeGreaterThan(0); }
  });
  it('explain tab answers the required questions and defines abbreviations on first use', () => {
    const h = explainHtml(ctx('healthy', 7), { entity: 'dc01' });
    for (const q of ['What is happening?', 'Why is this necessary?', 'Who performs this action?', 'Where does it happen?', 'What moves to the next step?', 'What remains private or local?', 'What could commonly go wrong?']) expect(h).toContain(q);
    expect(h).toContain('Certificate Signing Request');
  });
  it('evidence items are classified into the four allowed kinds for every stage and fault', () => {
    const kinds = new Set(['Real fixture data', 'Simulated environment', 'Derived conclusion', 'User-selected fault']);
    for (const f of ['healthy', ...DCS.faults.map((x) => x.id)]) for (let t = 1; t <= ids.length; t += 1) for (const i of evidenceItems(ctx(f, t))) expect(kinds.has(i.kind), `${f}/${t}/${i.label}`).toBe(true);
    expect(evidenceHtml(ctx())).toContain('Real fixture data');
  });
  it('CSR friendly summary distinguishes public and private keys and the machine context', () => {
    const h = friendlyHtml(ctx('healthy', 8), 'csr');
    for (const w of ['Certificate Signing Request (CSR)', 'public key', 'does <strong>not</strong> contain the private key', 'private key remains on', 'Local Computer', 'KerberosAuthentication', 'PKIOperator', 'What happens next', 'Common failures']) expect(h, w).toContain(w);
    expect(describeDcEntity('operator', ctx())).toContain('does NOT own'.replace('does NOT own', 'Does NOT own'));
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
