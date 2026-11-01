// v0.5.0 Website TLS story: scenario data, TLS truth rules 1-17 (CLAUDE.md), milestones, faults, reverse evidence and wording.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as E from '../../src/engine/engine.js';
import TLSS from '../../src/scenarios/tls-manual-enrollment.js';
import { TLS, CA, URLS } from '../../src/artifacts/synthetic.js';
import { FAULTS, TEMPLATE_CARDS, STORE_MAP, ZONES, GLOSSARY, CHANNELS, initialState, CFG } from '../../src/scenarios/tls/shared.js';
import { FOLLOWUP_ITEMS, ACTS, MILESTONES } from '../../src/scenarios/tls/steps.js';
import { NEVER_EXECUTED, tokenize } from '../../src/scenarios/story-common.js';
import { loadModel, root } from '../helpers/fixtures.js';
import { evaluateAll } from '../../src/artifacts/model.js';

const S = TLSS;
const ids = S.stages.map((s) => s.id);
const st = (id) => S.stages.find((s) => s.id === id);
const at = (id, faultId = 'healthy') => E.worldAt(S, faultId, E.stageEndT(ids.indexOf(id)));
let M, EV;
beforeAll(async () => { M = (await loadModel()).model; EV = await evaluateAll(M, S); });

function strings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => strings(x, out));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (!['id', 'during', 'done', 'patch', 'effects', 'fixtures', 'connector', 'zone', 'actorZone', 'adjacent', 'storeTargets'].includes(k)) strings(v, out);
  return out;
}
export const TLS_TEXT = strings([S.stages, FAULTS, S.evidenceTrace, TEMPLATE_CARDS, FOLLOWUP_ITEMS, S.tour, S.home, S.subtitle, GLOSSARY, S.story.beforeStart, S.story.assocLabel, S.story.otLabel]);

describe('acts, milestones and steps', () => {
  it('10 milestones, 26 steps, in order, in two acts (1-6 and 7-10)', () => {
    expect(S.stages).toHaveLength(26); expect(S.milestones).toEqual(MILESTONES); expect(MILESTONES).toHaveLength(10);
    expect([...new Set(S.stages.map((s) => s.milestone))]).toEqual(MILESTONES);
    expect(ACTS.map((a) => a.title)).toEqual(['Get the certificate', 'Use the certificate']);
    expect(MILESTONES.filter((m) => S.milestoneAct[m] === 'act1')).toEqual(MILESTONES.slice(0, 6));
    expect(MILESTONES.filter((m) => S.milestoneAct[m] === 'act2')).toEqual(MILESTONES.slice(6));
    for (const s of S.stages) expect(s.act, s.id).toBe(S.milestoneAct[s.milestone]);
    const perMilestone = MILESTONES.map((m) => S.stages.filter((s) => s.milestone === m).length);
    expect(perMilestone).toEqual([3, 3, 2, 4, 2, 2, 4, 2, 2, 2]);
  });
  it('identity and layout: id unchanged, story-zones, single path "main" without a paths map', () => {
    expect(S).toMatchObject({ id: 'tls-manual-enrollment', title: 'Website TLS Certificate', layoutMode: 'story-zones', pathId: 'main' });
    expect(S.paths).toBeUndefined(); expect(E.pathOf(S, { pathId: 'x' })).toBe(S);
  });
  it('every step has the story schema and a full plain-language explanation', () => {
    for (const s of S.stages) {
      for (const k of ['id', 'milestone', 'act', 'title', 'purpose', 'zone', 'actorZone', 'adjacent', 'actor', 'explain', 'during', 'done']) expect(s, `${s.id}.${k}`).toHaveProperty(k);
      for (const k of ['what', 'why', 'who', 'where', 'moves', 'staysPrivate', 'checked', 'canGoWrong']) expect(s.explain[k], `${s.id}.explain.${k}`).toBeTruthy();
      expect(['VIS', 'OWN', 'CA', 'CLI', 'WEB']).toContain(s.actor);
      expect(ZONES.map((z) => z.id)).toContain(s.zone);
      expect(s.adjacent.length + 1).toBeLessThanOrEqual(3);
      expect(s.purpose.split(/(?<=[.!?])\s/).length, `${s.id}: one plain sentence on the plate`).toBe(1);
    }
  });
  it('zone names and the "same computer" labels', () => {
    expect(ZONES.map((z) => z.name)).toEqual(['CLIENT01 — the visitor', 'WEB01 — key and request', 'Issuing CA — SIMSI2027 Issuing CA 01', 'WEB01 — install and IIS binding', 'On the wire — TLS handshake', 'CLIENT01 — validation and trust store']);
    expect(ZONES.filter((z) => z.sameComputer === 'CLIENT01').map((z) => z.id)).toEqual(['Z1', 'Z6']);
    expect(ZONES.filter((z) => z.sameComputer === 'WEB01').map((z) => z.id)).toEqual(['Z2', 'Z4']);
    for (const z of ZONES.filter((x) => x.sameComputer)) expect(z.lines.join(' ')).toContain(`${z.sameComputer} (same computer)`);
  });
  it('the actor badge sits on the acting zone (submit: Morgan on WEB01, hello: CLIENT01, certificate and proof: WEB01)', () => {
    expect([st('t-submit').actorZone, st('t-submit').zone]).toEqual(['Z2', 'Z3']);
    expect(st('t-hello').actorZone).toBe('Z1'); expect(st('t-cert-msg').actorZone).toBe('Z4'); expect(st('t-proof').actorZone).toBe('Z4');
  });
});

describe('TLS truth rules', () => {
  it('1: Visitor, Operator, Requester and Subject are separate; the visitor never requests', () => {
    expect(TLS.visitor).toMatchObject({ user: 'SIMSI2027\\Jordan', host: 'CLIENT01', ip: '10.20.10.45' });
    expect(TLS.owner).toBe('SIMSI2027\\Morgan');
    expect(at('t-submit').requester).toBe('SIMSI2027\\Morgan');
    expect(M.resolve('leaf', null).parsed.subject).toBe('CN=portal.simsi2027.test, O=SIMSI2027 Synthetic Demo');
    expect(M.resolve('csr', null).parsed.clientInfo.user).toBe('SIMSI2027\\Morgan');
    expect(new Set([TLS.visitor.user, TLS.owner, TLS.web.site, TLS.web.host]).size).toBe(4);
    for (const s of S.stages.filter((x) => x.actor === 'VIS')) { expect(s.command).toBeNull(); expect(['csr', 'record', 'leaf', 'accepted', 'inf']).not.toContain(s.artifact); }
    expect(st('t-report').explain.what + st('t-report').purpose).toMatch(/never asks for a certificate|Jordan never requests/);
  });
  it('2: WEB01 10.20.20.30 runs IIS; DNS resolves the site to it', () => {
    expect(TLS.web).toMatchObject({ host: 'WEB01', ip: '10.20.20.30', site: 'portal.simsi2027.test' });
    expect(st('t-visit').result).toBe('DNS resolves portal.simsi2027.test → 10.20.20.30; TCP 443 connects.');
    expect(at('t-visit').dnsState).toBe('resolved');
  });
  it('3: SIMSI2027WebServer (v2) template card; built-in WebServer is v1 with Domain/Enterprise Admins Enroll; permissions and approval are configuration-dependent', () => {
    expect(TLS.template).toMatchObject({ name: 'SIMSI2027WebServer', display: 'SIMSI2027 Web Server', oid: '1.3.6.1.4.1.311.21.8.2027.1.1', version: '100.4', schema: 2 });
    const w = Object.fromEntries(TEMPLATE_CARDS.find((t) => t.id === 'web').rows);
    expect(w).toMatchObject({ 'Subject name': 'Supply in the request', EKU: 'Server Authentication only', 'Key Usage': 'Digital Signature, Key Encipherment', 'Minimum key': 'RSA 2048' });
    expect(w.Enroll).toContain('Web Server Certificate Requesters'); expect(w.Enroll).toContain(CFG); expect(w.Issuance).toMatch(/without manager approval/); expect(w.Issuance).toContain(CFG);
    const b = TEMPLATE_CARDS.find((t) => t.id === 'builtin'); expect(b.comparison).toBe(true); expect(JSON.stringify(b.rows)).toMatch(/Version 1/); expect(JSON.stringify(b.rows)).toMatch(/Domain Admins and Enterprise Admins by default/); expect(b.note).toMatch(/duplicate/);
    expect(st('t-requirements').explain.canGoWrong).toMatch(/version 1.*Domain Admins and Enterprise Admins by default/);
  });
  it('4: certreq -new -machine creates key and CSR together in machine context; Exportable FALSE; pending request until accept', async () => {
    const s = st('t-new'); expect(s.command.text).toBe('certreq -new -machine portal-request.inf portal.req'); expect(s.vault).toBe(true);
    expect(s.done).toMatchObject({ keyState: 'pending-on-web01', pendingRequest: 'present', csrState: 'created' });
    const inf = M.resolve('inf', null).parsed; expect(inf.fields['NewRequest.MachineKeySet']).toBe('TRUE'); expect(inf.fields['NewRequest.Exportable']).toBe('FALSE');
    for (const id of ['t-new', 't-submit', 't-sign', 't-return']) expect(at(id).pendingRequest, id).toBe('present');
    expect(at('t-accept').pendingRequest).toBe('consumed');
    expect(st('t-inf').explain.canGoWrong).toMatch(/Exportable = TRUE/); expect(st('t-inf').explain.canGoWrong).toContain(CFG);
  });
  it('5: the CSR holds public key, SAN and requested extensions, never the private key; WEB01\'s key signs it', () => {
    const c = M.resolve('csr', null).parsed;
    expect(c.hasPrivateKeyMaterial).toBe(false); expect(c.signatureValid).toBe(true); expect(c.pem).not.toMatch(/PRIVATE KEY/);
    expect(c.san).toEqual([{ type: 'DNS', value: 'portal.simsi2027.test' }]); expect(c.requestedExtensions.map((e) => e.oid)).toEqual(['2.5.29.17', '2.5.29.15']);
    expect(st('t-new').explain.what).toMatch(/signs it with the new private key/); expect(st('t-new').explain.what).toMatch(/proof of possession/);
  });
  it('6: submission from WEB01 over RPC/DCOM with the derived config; the CA receives BEFORE policy is evaluated', () => {
    const s = st('t-submit'); expect(s.command.text).toBe(`certreq -submit -config "${TLS.caConfig}" portal.req portal.cer`);
    expect(TLS.caConfig).toBe(`${CA.host}\\${CA.name}`); expect(TLS.caConfig).toBe('ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01');
    expect(s.connector).toMatchObject({ from: 'Z2', to: 'Z3', channel: 'RPC/DCOM' });
    expect(ids.indexOf('t-submit')).toBeLessThan(ids.indexOf('t-policy'));
    expect(at('t-submit')).toMatchObject({ requestRecord: 'received', permissionState: 'unchecked', templateState: 'chosen' });
    expect(at('t-policy')).toMatchObject({ requestRecord: 'allowed', permissionState: 'granted', templateState: 'published' });
    // No step before t-submit mentions a policy decision.
    for (const p of S.stages.slice(0, ids.indexOf('t-submit'))) expect(p.done.permissionState ?? p.done.requestRecord ?? null, p.id).toBeNull();
    expect(EV.healthy.checks.findIndex((c) => c.id === 'received')).toBeLessThan(EV.healthy.checks.findIndex((c) => c.id === 'permission'));
  });
  it('7: the CA creates and signs a NEW certificate with the CSR public key; the Root is offline and never signs or appears on a route', async () => {
    const leaf = M.resolve('leaf', null).parsed, csr = M.resolve('csr', null).parsed, ica = M.resolve('ica', null).parsed, rootc = M.resolve('root', null).parsed;
    expect(leaf.publicKey.spkiSha256).toBe(csr.publicKey.spkiSha256);
    expect(await leaf.x509.verify({ publicKey: ica.x509, signatureOnly: true })).toBe(true); expect(await leaf.x509.verify({ publicKey: rootc.x509, signatureOnly: true })).toBe(false);
    expect(st('t-sign').title).toBe('The Issuing CA creates and signs a new certificate'); expect(st('t-sign').purpose).toMatch(/Root CA is not contacted/);
    for (const f of S.flows) { expect(f.from).not.toMatch(/OT|root/i); expect(f.to).not.toMatch(/^OT|rootca/i); }
  });
  it('8: certreq -accept -machine on WEB01 links the key and installs in Personal; IIS Complete Certificate Request is the GUI equivalent', () => {
    const s = st('t-accept'); expect(s.command.text).toBe('certreq -accept -machine portal.cer'); expect(s.connector).toMatchObject({ from: 'Z2', to: 'Z4', association: true });
    expect(s.done).toMatchObject({ leafState: 'accepted', pendingRequest: 'consumed', keyAssociation: 'linked' });
    expect(s.notes.join(' ')).toMatch(/Complete Certificate Request/); expect(st('t-new').notes.join(' ')).toMatch(/Create Certificate Request/);
  });
  it('9: WEB01 holds Issuing CA (Intermediate) and Root (Trusted Root) from AD; only the leaf has a private key', () => {
    expect(initialState.trust).toEqual({ root: 'present', ica: 'present', rootSource: 'Enterprise (AD)', icaSource: 'Enterprise (AD)' });
    expect(STORE_MAP).toEqual({ leaf: { store: 'personal', privateKeyOnWeb01: true }, ica: { store: 'intermediate', privateKeyOnWeb01: false }, root: { store: 'root', privateKeyOnWeb01: false } });
    expect(st('t-stores').purpose).toMatch(/both delivered by AD/);
  });
  it('10: IIS binding https · All Unassigned · 443 · host · Require SNI · new certificate; key used in place', () => {
    const g = st('t-bind').gui.tokens.map((x) => x.t);
    for (const w of ['Type: https', 'IP address: All Unassigned', 'Port: 443', 'Host name: portal.simsi2027.test', 'Require Server Name Indication', 'SSL certificate: portal.simsi2027.test']) expect(g).toContain(w);
    expect(st('t-bind').result).toMatch(/temporary self-signed certificate is replaced/); expect(st('t-bind').explain.staysPrivate).toMatch(/HTTP.sys uses it in place/);
    expect(at('t-bind').iisBindingState).toBe('bound'); expect(E.worldAt(S, 'healthy', 0).iisBindingState).toBe('temporary-selfsigned');
  });
  it('11: handshake order and content: ClientHello+SNI, Certificate (leaf + Issuing CA, Root not sent, encrypted in TLS 1.3), CertificateVerify, Finished', () => {
    expect(ids.slice(ids.indexOf('t-hello'), ids.indexOf('t-proof') + 1)).toEqual(['t-hello', 't-cert-msg', 't-proof']);
    expect(st('t-hello').purpose).toMatch(/SNI/); expect(st('t-cert-msg').explain.what).toMatch(/TLS 1.3.*encrypted/); expect(st('t-cert-msg').explain.what).toMatch(/never trusts a root just because a server sent it/);
    const hs = M.resolve('handshake', null).parsed.certs; expect(hs).toHaveLength(2); expect(hs[1].subject).toMatch(/Issuing CA/);
    expect(st('t-proof').explain.what).toMatch(/verifies it with the public key/); expect(st('t-proof').explain.staysPrivate).toMatch(/never leaves WEB01/);
    expect(st('t-trusted').purpose).toMatch(/Finished/);
    expect(st('t-cert-msg').technical.join(' ')).toMatch(/TLS 1.2 difference/); expect(st('t-proof').technical.join(' ')).toMatch(/TLS 1.2 difference/);
  });
  it('12: chain leaf → Issuing CA (from the handshake; AIA only if missing) → Root in CLIENT01 Trusted Root (configuration-dependent delivery)', () => {
    const c = st('t-chain'); expect(c.explain.moves).toMatch(/AIA is not needed/); expect(c.explain.checked).toContain(CFG);
    expect(at('t-chain').aiaState).toBe('not-needed'); expect(initialState.clientTrust.root).toBe('present');
    expect(st('t-signatures').explain.what).toMatch(/verifies with the Issuing CA's public key/);
  });
  it('13: name from the SAN (CN ignored), dates at the simulation clock, EKU Server Authentication, KU suitable', () => {
    expect(st('t-checks').explain.what).toMatch(/ignore the subject CN/);
    for (const id of ['name', 'dates', 'eku', 'ku']) expect(EV.healthy.checks.find((c) => c.id === id)).toMatchObject({ stage: 't-checks', status: 'pass', basis: 'Real fixture data' });
    expect(EV['wrong-dns'].firstFailure.id).toBe('name'); expect(EV.expired.firstFailure.id).toBe('dates'); expect(EV['wrong-eku'].firstFailure.id).toBe('eku');
  });
  it('14: revocation over HTTP (CDP) from PKIWEB01, CRL signed by the Issuing CA; browser behavior is configuration-dependent; OCSP out of scope', () => {
    const r = st('t-revocation'); expect(r.connector).toMatchObject({ to: 'PUB:cdp', channel: 'HTTP (CDP)' }); expect(r.explain.checked).toContain(CFG); expect(r.explain.checked).toMatch(/some do not perform online CRL checks/);
    expect(r.notes.join(' ')).toMatch(/OCSP.*not modelled/);
    expect(EV.healthy.checks.find((c) => c.id === 'revocation').detail).toMatch(/not listed/);
  });
  it('15: AIA and CDP stay distinct (URLs, connectors, evidence)', () => {
    expect(URLS.icaAia).not.toBe(URLS.icaCdp); expect(EV.healthy.aia.resolved).not.toBe(EV.healthy.cdp.resolved);
    expect(FAULTS.find((f) => f.id === 'missing-ica').connector['t-chain'].channel).toBe('HTTP (AIA)'); expect(st('t-revocation').connector.channel).toBe('HTTP (CDP)');
    expect(EV['missing-ica'].aia.ok).toBe(false); expect(EV['missing-ica'].cdp.ok).toBe(true); expect(EV['cdp-unavailable'].cdp.ok).toBe(false); expect(EV['cdp-unavailable'].aia.ok).toBe(true);
  });
  it('16: the certificate does not encrypt the traffic; session keys do', () => {
    expect(st('t-trusted').explain.what).toMatch(/session keys/); expect(st('t-trusted').purpose).toMatch(/session keys from the key exchange, not the certificate, encrypt the traffic/);
    for (const t of TLS_TEXT) expect(t, t).not.toMatch(/certificate (itself )?(encrypts|is encrypting) (the )?(traffic|connection|data)/i);
  });
  it('17: not autoenrolled; renew before 2027-10-30 in the final follow-up', () => {
    expect(st('t-followup').purpose).toMatch(/not autoenrolled.*renew before 2027-10-30/); expect(FOLLOWUP_ITEMS[0]).toMatch(/Renew before 2027-10-30/);
    expect(M.resolve('leaf', null).parsed.notAfter).toBe('2027-10-30T00:00:00Z');
  });
});

describe('wording', () => {
  it('no text says the CA signs the CSR; nothing claims the certificate encrypts the traffic', () => {
    for (const t of TLS_TEXT) expect(t, t).not.toMatch(/sign(s|ed|ing)? the CSR/i);
    const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    for (const f of walk(join(root, 'src')).filter((x) => /\.(js|html)$/.test(x))) { const s = readFileSync(f, 'utf8'); expect(s, f).not.toMatch(/sign(s|ed|ing)? the CSR/i); expect(s, f).not.toMatch(/certificate (itself )?encrypts (the )?(traffic|connection)/i); }
  });
  it('configuration-dependent statements carry the marker after a complete sentence', () => {
    const dependent = /\bports?\b(?!:? 443)|Group Policy|\bdefaults?\b|by default|replication|enforce|Exportable = TRUE|word this warning|TLS versions client|client revocation|permissions? (are|is) delegated/i;
    const offenders = TLS_TEXT.filter((t) => dependent.test(t) && !t.includes(CFG) && !/^Standard HTTPS port|^The standard HTTPS port/.test(t));
    expect(offenders).toEqual([]);
    for (const t of TLS_TEXT.filter((x) => x.includes(CFG))) expect(t, t).toMatch(new RegExp(`[.!?)"] ${CFG}: [a-z][^.]*\\.$`));
  });
  it('glossary defines the eleven terms in one line each', () => {
    expect(Object.keys(GLOSSARY)).toEqual(['TLS', 'SNI', 'CSR', 'SAN', 'EKU', 'KU', 'AIA', 'CDP', 'CRL', 'CertificateVerify', 'trust anchor']);
    for (const d of Object.values(GLOSSARY)) { expect(d).not.toContain('\n'); expect(d.length).toBeLessThan(140); }
  });
  it('every command explains every token and carries the never-executed banner; GUI paths explain every segment', () => {
    const cmds = S.stages.filter((s) => s.command).map((s) => s.command);
    expect(cmds.map((c) => c.text)).toEqual(['certreq -new -machine portal-request.inf portal.req', 'certutil -dump portal.req', `certreq -submit -config "${TLS.caConfig}" portal.req portal.cer`, 'certreq -accept -machine portal.cer', 'certutil -verifystore My <serial>']);
    for (const c of cmds) { expect(c.banner).toBe(NEVER_EXECUTED); expect(c.tokens.map((x) => x.t)).toEqual(tokenize(c.text)); for (const tk of c.tokens) expect(tk.meaning, tk.t).toBeTruthy(); }
    for (const g of S.stages.filter((s) => s.gui).map((s) => s.gui)) for (const tk of g.tokens) expect(tk.meaning, tk.t).toBeTruthy();
    const src = readdirSync(join(root, 'src/scenarios/tls')).map((n) => readFileSync(join(root, 'src/scenarios/tls', n), 'utf8')).join('\n'); expect(src).not.toMatch(/child_process|execFile|spawn\(/);
  });
  it('connectors use the fixed channel vocabulary; the private key is never the artifact of a moving step', () => {
    for (const s of S.stages.filter((x) => x.connector && !x.connector.association)) { expect(CHANNELS, s.id).toContain(s.connector.channel); expect(s.artifact, s.id).not.toBe('private-key'); }
    for (const f of FAULTS.filter((x) => x.connector)) for (const c of Object.values(f.connector)) expect(CHANNELS).toContain(c.channel);
  });
});

describe('faults', () => {
  const expected = { 'no-enroll-permission': ['t-policy', 'Simulated environment'], 'template-not-published': ['t-policy', 'Simulated environment'], 'user-context': ['t-accept', 'Real fixture data'],
    'no-private-key': ['t-bind', 'Derived conclusion'], 'wrong-binding': ['t-cert-msg', 'Real fixture data'], 'missing-ica': ['t-chain', 'Simulated environment'], 'untrusted-root': ['t-chain', 'Simulated environment'],
    'wrong-dns': ['t-checks', 'Real fixture data'], expired: ['t-checks', 'Real fixture data'], 'wrong-eku': ['t-checks', 'Real fixture data'], revoked: ['t-revocation', 'Real fixture data'], 'cdp-unavailable': ['t-revocation', 'Simulated environment'] };
  for (const [id, [stage, kind]] of Object.entries(expected)) {
    it(`${id} halts at ${stage} with symptom, evidence (${kind}), owner, remediation, stops and long term`, () => {
      const f = S.faults.find((x) => x.id === id);
      for (const k of ['symptom', 'evidence', 'owner', 'remediation', 'longTerm']) expect(f[k], k).toBeTruthy();
      expect(f.stops).toBe(true); expect(f.evidence.map((e) => e.kind)).toContain(kind);
      for (const e of f.evidence) expect(['Real fixture data', 'Simulated environment', 'Derived conclusion']).toContain(e.kind);
      expect(EV[id].failStage).toBe(stage); expect(EV[id].firstFailure.id).toBe(f.check); expect(EV[id].firstFailure.kind).toBe('User-selected fault');
      const w = E.worldAt(S, id, 99); expect(w.halted).toBe(true); expect(ids[w.stage]).toBe(stage); expect(w.trustDecision).toBe('rejected');
    });
  }
  it('fault effects change earlier steps honestly', () => {
    expect(at('t-new', 'user-context')).toMatchObject({ keyState: 'user-store', pendingRequest: 'user-store' }); expect(at('t-inf', 'user-context').infState).toBe('written-user');
    expect(at('t-accept', 'no-private-key')).toMatchObject({ leafState: 'unlinked', keyAssociation: 'missing', pendingRequest: 'present' });
    expect(at('t-bind', 'wrong-binding').iisBindingState).toBe('still-selfsigned'); expect(at('t-cert-msg', 'wrong-binding').handshakeChain).toBe('selfsigned');
    expect(at('t-cert-msg', 'missing-ica').handshakeChain).toBe('leaf-only'); expect(at('t-visit', 'missing-ica').trust.ica).toBe('missing');
    expect(at('t-visit', 'untrusted-root').clientTrust.root).toBe('missing');
  });
  it('elevation is not a template permission; never tell visitors to click through', () => {
    expect(FAULTS.find((f) => f.id === 'no-enroll-permission').remediation).toMatch(/elevation is not a template permission/);
    expect(FAULTS.find((f) => f.id === 'untrusted-root').remediation).toMatch(/Never tell visitors to click through/);
    expect(FAULTS.find((f) => f.id === 'missing-ica').longTerm).toMatch(/AIA URL reachable.*recover/);
  });
  it('healthy run passes every check and ends trusted', () => {
    expect(EV.healthy.firstFailure).toBeNull(); expect(E.worldAt(S, 'healthy', 99).trustDecision).toBe('trusted');
  });
});

describe('reverse evidence', () => {
  it('order and kinds', () => {
    const t = E.buildTrace(S, 'healthy');
    expect(t.map((e) => e.id)).toEqual(['trusted', 'checks', 'revocation', 'chain', 'proof', 'binding', 'key-link', 'issuance', 'pop', 'key-origin', 'origin']);
    expect(t.map((e) => e.evidenceKind)).toEqual(['Derived conclusion', 'Real fixture data', 'Real fixture data', 'Real fixture data + Simulated environment', 'Derived conclusion + Real fixture data', 'Simulated environment',
      'Real fixture data + Simulated environment', 'Real fixture data + Simulated environment', 'Real fixture data', 'Real fixture data + Simulated environment', 'Simulated environment']);
    expect(t.find((e) => e.id === 'issuance').claim).toMatch(/Request 1043, requester SIMSI2027\\Morgan, template SIMSI2027WebServer/);
    expect(t.at(-1).claim).toMatch(/self-signed/);
  });
  it('a selected fault labels the affected item as User-selected fault and starts from the verdict', () => {
    const t = E.buildTrace(S, 'revoked'); expect(t[0]).toMatchObject({ id: 'verdict', question: 'Why is the connection NOT trusted?' });
    expect(t.find((e) => e.id === 'revocation')).toMatchObject({ evidenceKind: 'User-selected fault', verdict: 'fail' });
    expect(E.buildTrace(S, 'wrong-binding').find((e) => e.id === 'binding').evidenceKind).toBe('User-selected fault');
  });
});
