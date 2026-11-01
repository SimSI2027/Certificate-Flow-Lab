// v0.4.0 Domain Controller Manual Enrollment story: scenario data, golden PKI rules 1-27, paths, conditions, faults and reverse evidence.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as E from '../../src/engine/engine.js';
import DCS from '../../src/scenarios/dc-manual-certificate-request.js';
import TLS from '../../src/scenarios/tls-manual-enrollment.js';
import { DC } from '../../src/artifacts/synthetic.js';
import { FAULTS, CONDITIONS, TEMPLATE_CARDS, STORE_MAP, ESC1_WARNING, NEVER_EXECUTED, CFG, ZONES, RETIRED_FAULTS, tokenize } from '../../src/scenarios/dc/shared.js';
import { FOLLOWUP_ITEMS } from '../../src/scenarios/dc/path-csr.js';
import { loadModel, root } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';

const A = E.pathOf(DCS, { pathId: 'csr' }), B = E.pathOf(DCS, { pathId: 'mmc' }), AP = E.pathOf(DCS, { pathId: 'csr', conditionId: 'trust-present' });
const ids = (p) => p.stages.map((s) => s.id);
const at = (p, id, faultId = 'healthy') => E.worldAt(p, faultId, E.stageEndT(ids(p).indexOf(id)));
let M, EVA, EVB;
beforeAll(async () => { M = (await loadModel()).model; EVA = await evaluateAll(M, A); EVB = await evaluateAll(M, B); });

// Every user-visible string of the DC scenario (steps, faults, trace, templates, follow-up).
function strings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => strings(x, out));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (!['id', 'during', 'done', 'patch', 'finalPatch', 'effects', 'fixtures'].includes(k)) strings(v, out);
  return out;
}
const ALL_TEXT = strings([A.stages, B.stages, FAULTS, A.evidenceTrace, B.evidenceTrace, TEMPLATE_CARDS, FOLLOWUP_ITEMS, DCS.tour, DCS.home, DCS.subtitle, CONDITIONS]);

describe('paths, milestones and step schema', () => {
  it('Path A has 24 steps in 10 named milestones', () => {
    expect(A.stages).toHaveLength(24);
    expect([...new Set(A.stages.map((s) => s.milestone))]).toEqual(['Diagnose', 'Define request', 'Create key and CSR', 'Transfer CSR', 'Submit and approve', 'Issue and retrieve', 'Return package', 'Install CA certificates', 'Accept leaf', 'Verify and follow up']);
    expect(ids(A)).toEqual(['a-detect', 'a-why', 'a-trust-check', 'a-identity', 'a-template', 'a-inf', 'a-new', 'a-inspect-csr', 'a-package', 'a-move', 'a-submit', 'a-policy', 'a-approve', 'a-sign', 'a-retrieve', 'a-return-pack', 'a-return-move', 'a-root', 'a-ica', 'a-accept', 'a-key', 'a-purposes', 'a-chain', 'a-followup']);
  });
  it('Path B has 11 steps in 6 named milestones', () => {
    expect(B.stages).toHaveLength(11);
    expect([...new Set(B.stages.map((s) => s.milestone))]).toEqual(['Diagnose', 'Check prerequisites', 'Open Local Computer store', 'Enroll', 'Verify', 'Follow up']);
    expect(ids(B)).toEqual(['b-detect', 'b-connect', 'b-template', 'b-permission', 'b-open', 'b-wizard', 'b-enroll', 'b-issue', 'b-verify', 'b-chain', 'b-followup']);
  });
  it('scenario identity, layout mode, paths and conditions', () => {
    expect(DCS).toMatchObject({ id: 'dc-manual-certificate-request', title: 'Domain Controller Manual Enrollment', layoutMode: 'story-zones', defaultPath: 'csr' });
    expect(Object.keys(DCS.paths)).toEqual(['csr', 'mmc']);
    // v0.4.1: trust-missing also carries its long-term fix (audit P8), so the specified fields are matched rather than the whole object.
    expect(DCS.conditions).toHaveLength(2);
    expect(DCS.conditions[0]).toMatchObject({ id: 'trust-missing', label: 'Trust certificates missing on DC01', note: 'Exceptional condition for this lesson', default: true });
    expect(DCS.conditions[1]).toEqual({ id: 'trust-present', label: 'Trust certificates present via AD (Enterprise store)' });
    expect(E.pathOf(DCS, {}).pathId).toBe('csr'); expect(E.pathOf(DCS, {}).conditionId).toBe('trust-missing');
    expect(E.pathOf(TLS, { pathId: 'mmc' })).toBe(TLS);
  });
  it('every step has the v0.4.0 schema and a plain-language explanation', () => {
    for (const p of [A, B]) for (const s of p.stages) {
      for (const k of ['id', 'milestone', 'title', 'purpose', 'zone', 'adjacent', 'actor', 'explain', 'during', 'done', 'show']) expect(s, `${s.id}.${k}`).toHaveProperty(k);
      expect(['OP', 'MGR', 'SYS']).toContain(s.actor);
      expect(ZONES.map((z) => z.id)).toContain(s.zone);
      for (const k of ['what', 'who', 'moves', 'staysLocal', 'canGoWrong']) expect(s.explain[k], `${s.id}.explain.${k}`).toBeTruthy();
      expect(s.adjacent.length).toBeLessThanOrEqual(2);
    }
  });
  it('session gains pathId and conditionId; TLS state is unaffected', () => {
    const s = E.computeState(DCS, { pathId: 'mmc', t: 3 }); expect(s).toMatchObject({ pathId: 'mmc', conditionId: 'trust-missing' }); expect(s.stage).toBe(2);
    expect(E.computeState(TLS, { t: 3 })).not.toHaveProperty('pathId');
  });
});

describe('golden PKI rules', () => {
  it('1-5: subject, operator and the two requester records are distinct', () => {
    expect(M.resolve('dc-cert', null).parsed.subject).toBe('CN=DC01.simsi2027.test');
    expect(DC.operator).toBe('SIMSI2027\\PKIOperator');
    expect(at(A, 'a-submit').requester).toBe('SIMSI2027\\PKIOperator');
    expect(at(B, 'b-enroll').requester).toBe('SIMSI2027\\DC01$');
    expect(M.resolve('dc-csr', null).parsed.clientInfo.user).toBe('SIMSI2027\\PKIOperator');
  });
  it('6-8: certreq -new creates key and CSR in one step; machine set, non-exportable; pending request until accept', () => {
    const s = A.stages.find((x) => x.id === 'a-new');
    expect(s.command.text).toBe('certreq -new -machine dc01-request.inf dc01-request.req');
    expect(s.done).toMatchObject({ keyState: 'pending-on-dc01', pendingRequest: 'present', csrState: 'created' });
    const inf = M.resolve('dc-inf', null).parsed; expect(inf.fields['NewRequest.MachineKeySet']).toBe('TRUE'); expect(inf.fields['NewRequest.Exportable']).toBe('FALSE');
    for (const id of ['a-new', 'a-submit', 'a-sign', 'a-root']) expect(at(A, id).pendingRequest, id).toBe('present');
    expect(at(A, 'a-accept').pendingRequest).toBe('consumed');
    expect(A.stages.filter((x) => x.vault).map((x) => x.id)[0]).toBe('a-new');
    expect(A.stages.find((x) => x.id === 'a-accept').vault).toBe(true);
  });
  it('9-10: the CSR holds the public key and names, never the private key, and its signature proves possession', () => {
    for (const role of ['dc-csr', 'dc-mmc-csr']) { const c = M.resolve(role, null).parsed; expect(c.hasPrivateKeyMaterial).toBe(false); expect(c.signatureValid).toBe(true); expect(c.pem).not.toMatch(/PRIVATE KEY/); expect(c.publicKey.bits).toBe(2048); }
  });
  it('11: the Issuing CA creates and signs a NEW certificate with the CSR public key; no text says the CA signs the CSR', async () => {
    const leaf = M.resolve('dc-cert', null).parsed, csr = M.resolve('dc-csr', null).parsed, ica = M.resolve('ica', null).parsed;
    expect(leaf.publicKey.spkiSha256).toBe(csr.publicKey.spkiSha256); expect(await leaf.x509.verify({ publicKey: ica.x509, signatureOnly: true })).toBe(true);
    expect(A.stages.find((x) => x.id === 'a-sign').title).toBe('ICA01 creates and signs a new leaf');
    for (const t of ALL_TEXT) expect(t).not.toMatch(/sign(s|ed)? the CSR/i);
    const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    for (const f of walk(join(root, 'src')).filter((f) => /\.(js|html)$/.test(f))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/sign(s|ed)? the CSR/i);
  });
  it('12: the Root CA never signs the leaf and is never a connector endpoint', async () => {
    const leaf = M.resolve('dc-cert', null).parsed, rootc = M.resolve('root', null).parsed;
    expect(await leaf.x509.verify({ publicKey: rootc.x509, signatureOnly: true })).toBe(false);
    for (const p of [A, B]) for (const f of p.flows) { expect(f.from).not.toMatch(/OT|root/i); expect(f.to).not.toMatch(/^OT|rootca/i); }
  });
  it('13-14: Path A template card and the ESC1 warning', () => {
    const t = TEMPLATE_CARDS.find((x) => x.id === 'offline');
    expect(t).toMatchObject({ name: 'DCOfflineKerberosAuth', display: 'SIMSI2027 DC Offline Kerberos Authentication', simulated: true });
    expect(Object.fromEntries(t.rows)).toMatchObject({ 'Subject name': 'Supply in the request', Enroll: 'Only the "PKI Operators" group', 'Issuance requirement': 'CA certificate manager approval', Autoenroll: 'No', Publication: 'On ICA01 only for the duration of the change' });
    for (const w of ['Supply in the request', 'authentication EKU', 'privilege-escalation', 'ESC1', 'restricted', 'approval', 'temporary', 'audited']) expect(ESC1_WARNING).toContain(w);
    expect(A.stages.find((x) => x.id === 'a-template').explain.canGoWrong).toContain('ESC1');
  });
  it('15-16: Path B KerberosAuthentication prerequisites; DomainControllerAuthentication is a comparison card only', () => {
    const k = TEMPLATE_CARDS.find((x) => x.id === 'kerberos'); expect(k.name).toBe('KerberosAuthentication'); expect(JSON.stringify(k.rows)).toMatch(/Active Directory/); expect(JSON.stringify(k.rows)).toMatch(/RPC\/DCOM/); expect(JSON.stringify(k.rows)).toMatch(/DC01\$ needs Read and Enroll/);
    expect(B.stages.find((s) => s.id === 'b-connect').connector.channel).toBe('RPC/DCOM');
    const d = TEMPLATE_CARDS.find((x) => x.id === 'dcauth'); expect(d.comparison).toBe(true); expect(d.note).toMatch(/not universally wrong or right/);
    expect(JSON.stringify(d.rows)).toMatch(/Client Authentication, Server Authentication, Smart Card Logon/); expect(JSON.stringify(d.rows)).toMatch(/GUID/); expect(JSON.stringify(d.rows)).toMatch(/KDC Authentication/);
    for (const p of [A, B]) expect(p.stages.some((s) => s.artifact === 'template' && s.id.includes('dcauth'))).toBe(false);
  });
  it('17-21: CA certificates are pre-existing public copies; store mapping and key association', () => {
    expect(STORE_MAP).toEqual({ leaf: { store: 'personal', privateKeyOnDc01: true }, ica: { store: 'intermediate', privateKeyOnDc01: false }, root: { store: 'root', privateKeyOnDc01: false } });
    expect(A.stages.find((s) => s.id === 'a-root').connector.store).toBe('root');
    expect(A.stages.find((s) => s.id === 'a-ica').connector.store).toBe('intermediate');
    expect(A.stages.find((s) => s.id === 'a-return-pack').explain.what).toMatch(/pre-existing public chain certificates/);
    expect(A.stages.find((s) => s.id === 'a-sign').artifact).toBe('leaf');
    expect(DCS.paths.csr.artifacts.find((a) => a.id === 'root').tag).toMatch(/public copy/);
  });
  it('22-23: accept runs only on DC01 and copying a CER never moves the key', () => {
    const s = A.stages.find((x) => x.id === 'a-accept'); expect(s.command.text).toBe('certreq -accept -machine dc01-issued.cer'); expect(s.zone).toBe('Z6');
    expect(ZONES.find((z) => z.id === 'Z6').sameComputer).toBe(true); expect(ZONES.find((z) => z.id === 'Z1').sameComputer).toBe(true);
    expect(s.connector).toMatchObject({ from: 'Z1', to: 'Z6', association: true });
    expect(A.stages.find((x) => x.id === 'a-retrieve').explain.staysLocal).toMatch(/neither copies nor recreates the private key/);
  });
  it('24: CA certificates are verified and installed before the leaf is accepted; certreq behavior is marked configuration-dependent', () => {
    const i = (id) => ids(A).indexOf(id);
    expect(i('a-return-move')).toBeLessThan(i('a-root')); expect(i('a-root')).toBeLessThan(i('a-ica')); expect(i('a-ica')).toBeLessThan(i('a-accept'));
    expect(A.stages.find((x) => x.id === 'a-accept').notes.join(' ')).toContain(CFG);
    for (const t of ALL_TEXT) expect(t).not.toMatch(/(-accept|\.p7b import) (makes|will make) .* trust/i);
  });
  it('25: AIA and CDP stay distinct concepts, URLs, connectors and evidence items', () => {
    expect(EVA.healthy.aia.resolved).not.toBe(EVA.healthy.cdp.resolved);
    expect(A.flows.find((f) => f.stage === 'a-chain').channel).toBe('HTTP (CDP)');
    const checks = EVA.healthy.checks.filter((c) => c.stage === 'a-chain').map((c) => c.id); expect(checks).toContain('cdp');
    expect(A.stages.find((x) => x.id === 'a-chain').explain.what).toMatch(/AIA \(Authority Information Access: where to download the issuer certificate\)/);
    expect(A.stages.find((x) => x.id === 'a-chain').explain.what).toMatch(/CDP \(CRL Distribution Point\)/);
  });
  it('26: manual enrollment is an exception, not a permanent repair', () => {
    const f = A.stages.at(-1); expect(f.title).toBe('Suitable now; root cause still open'); expect(f.explain.what).toMatch(/exception, not a repair/);
    expect(FOLLOWUP_ITEMS.join(' ')).toMatch(/will not be renewed automatically/); expect(FOLLOWUP_ITEMS.join(' ')).toMatch(/Unpublish DCOfflineKerberosAuth/);
  });
  it('27: every configuration-dependent statement carries the marker', () => {
    const dependent = /\bports?\b|event details|event ID|Group Policy|\bdefaults?\b|enforce|pickup timing|replication/i;
    const offenders = ALL_TEXT.filter((t) => dependent.test(t) && !t.includes(CFG) && !/^(Check prerequisites)$/.test(t));
    expect(offenders).toEqual([]);
    // Audit P7: the marker follows a complete sentence and names what varies ("… . Depends on your configuration: <aspect>.").
    for (const t of ALL_TEXT.filter((x) => x.includes(CFG))) {
      expect(t, t).toMatch(new RegExp(`[.!?)"] ${CFG}: [a-z][^.]*\\.$`));
      expect(t, t).not.toMatch(/\(Depends on your configuration\.\)/);
    }
  });
});

describe('plain-language content', () => {
  it('defines CSR, SAN, EKU, KU, AIA, CDP, CRL, KDC and PKCS #7 on first use in each path', () => {
    const terms = { CSR: /Certificate Signing Request/, SAN: /Subject Alternative Name/, EKU: /Enhanced Key Usage/, KU: /Key Usage/, AIA: /Authority Information Access/, CDP: /CRL Distribution Point/, CRL: /Certificate Revocation List/, KDC: /Key Distribution Center/, 'PKCS #7': /container/ };
    for (const p of [A, B]) for (const [abbr, def] of Object.entries(terms)) {
      const re = new RegExp(`\\b${abbr.replace('#', '\\#')}\\b`);
      const first = p.stages.find((s) => re.test(s.explain.what)); if (!first) continue;
      expect(first.explain.what, `${p.pathId}: ${abbr} first used in ${first.id}`).toMatch(def);
    }
  });
  it('the DC tour has 8 stops in Path A order', () => {
    expect(DCS.tour.map((t) => t.stage)).toEqual(['a-why', 'a-template', 'a-new', 'a-submit', 'a-sign', 'a-root', 'a-accept', 'a-followup']);
  });
});

describe('commands', () => {
  it('every command explains every token and carries the never-executed banner', () => {
    const cmds = [...A.stages, ...B.stages].filter((s) => s.command).map((s) => s.command);
    expect(cmds.length).toBeGreaterThan(15);
    for (const c of cmds) { expect(c.banner).toBe(NEVER_EXECUTED); expect(c.tokens.map((x) => x.t)).toEqual(tokenize(c.text)); for (const tk of c.tokens) expect(tk.meaning, `${c.text} :: ${tk.t}`).toBeTruthy(); }
    expect(NEVER_EXECUTED).toBe('Shown for learning; never executed by this simulator.');
    expect(cmds.find((c) => c.text.startsWith('certreq -submit')).text).toBe(`certreq -submit -config "${DC.caConfig}" dc01-request.req`);
    const src = readdirSync(join(root, 'src/scenarios/dc')).map((n) => readFileSync(join(root, 'src/scenarios/dc', n), 'utf8')).join('\n'); expect(src).not.toMatch(/child_process|execFile|spawn\(/);
  });
});

describe('Path B wording (audit P5, P6, P9)', () => {
  it('Path B never calls its leaf "accepted" and says the wizard signs with the DC01 key', () => {
    expect(B.artifacts.find((a) => a.id === 'accepted').label).toBe('Installed leaf');
    expect(A.artifacts.find((a) => a.id === 'accepted').label).toBe('Accepted leaf');
    expect(B.stages.find((s) => s.id === 'b-enroll').purpose).toMatch(/signs it with the new DC01 private key/);
    expect(B.flows.every((f) => !/Accepted/.test(f.payload))).toBe(true);
  });
});

describe('conditions', () => {
  it('trust-missing carries its long-term fix (audit P8)', () => {
    const c = CONDITIONS.find((x) => x.id === 'trust-missing'); expect(c.longTerm).toMatch(/Enterprise store/); expect(c.longTerm).toContain(CFG);
  });
  it('trust-missing (default) installs Root and Issuing CA before accept', () => {
    expect(at(A, 'a-trust-check').trust).toMatchObject({ root: 'missing', ica: 'missing' });
    expect(at(A, 'a-ica').trust).toMatchObject({ root: 'present', ica: 'present', rootSource: 'Local (manual, emergency)', icaSource: 'Local (manual)' });
    expect(A.stages.some((s) => s.skipped)).toBe(false);
  });
  it('trust-present skips the conditional steps, reports "Already present — skipped" and navigation jumps over them', () => {
    const sk = AP.stages.filter((s) => s.skipped).map((s) => s.id); expect(sk).toEqual(['a-root', 'a-ica']);
    for (const s of AP.stages.filter((x) => x.skipped)) { expect(s.result).toBe('Already present — skipped'); expect(s.connector).toBeNull(); }
    expect(at(AP, 'a-trust-check').trust).toMatchObject({ root: 'present', ica: 'present', rootSource: 'Enterprise (AD)' });
    const iMove = ids(AP).indexOf('a-return-move'), iAccept = ids(AP).indexOf('a-accept');
    expect(E.nextStepT(AP, iMove + 1, AP.stages.length)).toBe(iAccept + 1);
    expect(E.prevStepT(AP, iAccept + 1, AP.stages.length)).toBe(iMove + 1);
    expect(E.nextStepT(A, iMove + 1, A.stages.length)).toBe(iMove + 2);
    expect(AP.flows.some((f) => ['a-root', 'a-ica'].includes(f.stage))).toBe(false);
  });
});

describe('faults', () => {
  const expectA = { 'wrong-template-handoff': 'a-policy', 'no-enroll-permission': 'a-policy', 'template-not-published': 'a-policy', 'pending-no-approver': 'a-approve', 'user-context': 'a-accept', 'accepted-on-wrong-machine': 'a-accept', 'pending-request-lost': 'a-accept', 'root-thumbprint-mismatch': 'a-return-move', 'cdp-unreachable': 'a-chain', 'wrong-eku': 'a-purposes', 'san-no-domain': 'a-purposes', 'key-mismatch': 'a-key', expired: 'a-purposes' };
  const expectB = { 'rpc-blocked': 'b-enroll', 'no-enroll-permission': 'b-permission', 'template-not-published': 'b-template', 'cdp-unreachable': 'b-chain', 'wrong-eku': 'b-verify', 'san-no-domain': 'b-verify', expired: 'b-verify' };
  it('has the 14 v0.4.0 faults; ca-unavailable and ica-cert-unavailable are retired', () => {
    expect(FAULTS.map((f) => f.id).sort()).toEqual([...new Set([...Object.keys(expectA), ...Object.keys(expectB)])].sort());
    expect(RETIRED_FAULTS).toEqual({ 'ca-unavailable': 'rpc-blocked', 'ica-cert-unavailable': 'condition trust-missing' });
    expect(A.faults.map((f) => f.id)).toEqual(['healthy', ...FAULTS.filter((f) => f.at.csr).map((f) => f.id)]);
  });
  for (const [p, exp, EVname] of [['A', expectA, 'EVA'], ['B', expectB, 'EVB']]) {
    for (const [id, stage] of Object.entries(exp)) {
      it(`Path ${p}: ${id} manifests at ${stage} with symptom, evidence, owner, remediation, stops and longTerm`, () => {
        const view = p === 'A' ? A : B; const EV = EVname === 'EVA' ? EVA : EVB;
        const f = view.faults.find((x) => x.id === id);
        for (const k of ['symptom', 'evidence', 'owner', 'remediation', 'longTerm']) expect(f[k], k).toBeTruthy();
        expect(typeof f.stops).toBe('boolean'); for (const e of f.evidence) expect(Object.values({ r: 'Real fixture data', s: 'Simulated environment', d: 'Derived conclusion' })).toContain(e.kind);
        expect(EV[id].failStage).toBe(stage); expect(EV[id].firstFailure.id).toBe(f.check); expect(EV[id].firstFailure.kind).toBe('User-selected fault');
        const w = E.worldAt(view, id, 99);
        if (f.stops) { expect(w.halted).toBe(true); expect(view.stages[w.stage].id).toBe(stage); expect(w.trustDecision).toBe('rejected'); }
        else { expect(w.halted).toBe(false); expect(w.trustDecision).toBe('withheld'); expect(at(view, stage, id).revocationState).toBe('offline'); }
      });
    }
  }
  it('rpc-blocked offers switching to Path A; user-context changes the earlier INF and key steps', () => {
    expect(FAULTS.find((f) => f.id === 'rpc-blocked').switchPath).toBe('csr');
    expect(at(A, 'a-new', 'user-context')).toMatchObject({ keyState: 'user-store', pendingRequest: 'user-store' });
    expect(at(A, 'a-inf', 'user-context').infState).toBe('written-user');
  });
  it('healthy runs pass every check and end "suitable"', () => {
    expect(EVA.healthy.firstFailure).toBeNull(); expect(EVB.healthy.firstFailure).toBeNull();
    expect(E.worldAt(A, 'healthy', 99).trustDecision).toBe('suitable'); expect(E.worldAt(B, 'healthy', 99).trustDecision).toBe('suitable');
  });
});

describe('reverse evidence', () => {
  const kinds = /^(Real fixture data|Simulated environment|Derived conclusion|User-selected fault)( \+ (Real fixture data|Simulated environment))?$/;
  it('Path A order and kinds', () => {
    const t = E.buildTrace(A, 'healthy');
    expect(t.map((e) => e.id)).toEqual(['suitable', 'purposes', 'key', 'chain', 'revocation', 'root-auth', 'issuance', 'pop', 'key-origin', 'origin']);
    expect(t.map((e) => e.evidenceKind)).toEqual(['Derived conclusion', 'Real fixture data', 'Real fixture data + Simulated environment', 'Real fixture data', 'Real fixture data', 'Simulated environment', 'Simulated environment + Real fixture data', 'Real fixture data', 'Real fixture data + Simulated environment', 'Simulated environment']);
    for (const e of t) { expect(e.evidenceKind).toMatch(kinds); expect(e.question && e.claim).toBeTruthy(); }
    expect(t[0].claim).toMatch(/root cause is still open/);
    expect(t.find((e) => e.id === 'chain').claim).toMatch(/Root CA was not contacted/);
  });
  it('Path B order replaces items 6, 7 and 10', () => {
    const t = E.buildTrace(B, 'healthy');
    expect(t.map((e) => e.id)).toEqual(['suitable', 'purposes', 'key', 'chain', 'revocation', 'ca-certs', 'requester', 'pop', 'key-origin', 'origin']);
    expect(t.find((e) => e.id === 'ca-certs').claim).toMatch(/Enterprise store/); expect(t.find((e) => e.id === 'requester').claim).toMatch(/DC01\$/);
    expect(t.at(-1).claim).toBe('Autoenrollment had not yet produced a certificate; enrollment was triggered manually.');
  });
  it('a selected fault labels the affected item as User-selected fault', () => {
    const t = E.buildTrace(A, 'cdp-unreachable'); expect(t.find((e) => e.id === 'revocation')).toMatchObject({ evidenceKind: 'User-selected fault', verdict: 'fail' });
    const h = E.buildTrace(A, 'key-mismatch'); expect(h[0].question).toBe('Why is the DC01 certificate NOT suitable?'); expect(h.find((e) => e.id === 'key').evidenceKind).toBe('User-selected fault');
    expect(E.buildTrace(TLS, 'healthy').every((e) => !e.affected)).toBe(true);
  });
});
