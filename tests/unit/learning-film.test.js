// v0.6.0: learning film "From CSR to Trust" (src/film-learning). Determinism, timeline integrity, reading time, terminology,
// PKI invariants of the canonical film state, and fixture-backed facts.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SHOTS, CAPTIONS, DURATION, FPS, FRAME_COUNT, DEFINITIONS, DEMO_URL, captionAudit, contactBeats, boundaryFrames, shotAt, abs } from '../../src/film-learning/timeline.js';
import { filmStateAt, cameraAt, ROUTES, SPOTS, PLATES } from '../../src/film-learning/state.js';
import { minHold, spring, cubicBezier } from '../../src/film-learning/tokens.js';
import { filmFacts } from '../../src/film-learning/facts.js';
import { loadModel, root } from '../helpers/fixtures.js';

const sample = (step = 0.05) => { const out = []; for (let t = 0; t <= DURATION; t += step) out.push(+t.toFixed(4)); return out; };
const stripFns = (o) => JSON.parse(JSON.stringify(o));

describe('learning film: timeline', () => {
  it('runs 60 fps, 18 shots, a bounded duration and a matching frame count', () => {
    expect(FPS).toBe(60); expect(SHOTS).toHaveLength(18);
    expect(DURATION).toBeGreaterThan(150); expect(DURATION).toBeLessThan(260);
    expect(FRAME_COUNT).toBe(Math.round(DURATION * 60));
  });
  it('shots are ordered, contiguous and own their time exclusively', () => {
    expect(SHOTS[0].start).toBe(0);
    SHOTS.forEach((s, i) => { expect(s.n).toBe(i + 1); expect(s.end).toBeCloseTo(s.start + s.dur, 9); if (i) expect(s.start).toBeCloseTo(SHOTS[i - 1].end, 9); });
    for (const t of sample(0.1)) { const owners = SHOTS.filter((s) => t >= s.start && t < s.end); expect(owners.length).toBe(t >= DURATION ? 0 : 1); }
    expect(SHOTS.map((s) => s.id)).toEqual(['problem', 'report', 'private-key', 'csr', 'csr-inspect', 'submit', 'issue', 'cert-inspect', 'return', 'stores', 'bind', 'retry', 'chain', 'aia-cdp', 'handshake', 'success', 'reverse', 'end']);
  });
  it('every shot documents its objective, hero, camera, artifact and scenario state and handoff', () => {
    for (const s of SHOTS) for (const k of ['objective', 'hero', 'cameraNote', 'artifactState', 'scenarioState', 'handoff']) expect(s[k], `${s.id}.${k}`).toBeTruthy();
  });
  it('captions stay inside their shot, never overlap and meet the reading rule (0.3 s per word + 0.5 s)', () => {
    for (const s of SHOTS) for (const c of s.captions) { expect(c.at).toBeGreaterThanOrEqual(0); expect(c.until).toBeLessThanOrEqual(s.dur + 1e-9); }
    for (let i = 1; i < CAPTIONS.length; i++) expect(CAPTIONS[i].start).toBeGreaterThanOrEqual(CAPTIONS[i - 1].end - 1e-9);
    for (const a of captionAudit()) expect(a.window, a.head).toBeGreaterThanOrEqual(a.needed - 1e-9);
    expect(minHold('one two three')).toBeCloseTo(1.4);
  });
  it('callouts and chain/evidence beats are spaced for reading', () => {
    const co = SHOTS.find((s) => s.id === 'csr-inspect').callouts;
    for (let i = 1; i < co.length; i++) expect(co[i].at - co[i - 1].at).toBeGreaterThanOrEqual(minHold(co[i - 1].text) - 0.4);
    const g = SHOTS.find((s) => s.id === 'cert-inspect').groups; for (let i = 1; i < g.length; i++) expect(g[i].at - g[i - 1].at).toBeGreaterThanOrEqual(6);
  });
  it('every abbreviation is expanded the first time the film uses it', () => {
    const texts = [];
    for (const s of SHOTS) {
      for (const c of s.captions) texts.push({ t: s.start + c.at, text: `${c.head} ${c.body}` });
      for (const c of s.callouts ?? []) texts.push({ t: s.start + c.at, text: `${c.label} ${c.text}` });
    }
    texts.sort((a, b) => a.t - b.t);
    for (const [abbr, long] of Object.entries(DEFINITIONS)) {
      const first = texts.find((x) => new RegExp(`\\b${abbr}\\b`).test(x.text));
      expect(first, abbr).toBeTruthy(); expect(first.text, abbr).toContain(long);
    }
  });
  it('the end card names the live demo URL', () => {
    expect(DEMO_URL).toBe('simsi2027.github.io/Certificate-Flow-Lab/');
    expect(readFileSync(join(root, 'src/film-learning/render.js'), 'utf8')).toContain('DEMO_URL');
    expect(SHOTS.at(-1).overlay).toBe('final');
  });
  it('contact sheet has at least 18 beats inside the film; boundary audit covers every shot', () => {
    const b = contactBeats(); expect(b.length).toBeGreaterThanOrEqual(18);
    for (const [t] of b) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(DURATION); }
    const bf = boundaryFrames(); expect(bf).toHaveLength(18);
    for (const x of bf) { expect(x.hold).toBeGreaterThan(x.boundary); expect(x.after).toBe(x.boundary + 1); }
  });
});

describe('learning film: deterministic state', () => {
  it('the same timestamp always yields the same state', () => {
    for (let i = 0; i < FRAME_COUNT; i += 37) { const t = i / FPS; expect(stripFns(filmStateAt(t))).toEqual(stripFns(filmStateAt(t))); }
  });
  it('state is independent of evaluation order (no hidden memory)', () => {
    const ts = [200, 3, 120.5, 3, 60, 200];
    const a = ts.map((t) => stripFns(filmStateAt(t))); const b = [...ts].reverse().map((t) => stripFns(filmStateAt(t))).reverse();
    expect(a).toEqual(b);
  });
  it('the film path uses no clocks, timers or unseeded randomness', () => {
    const dir = join(root, 'src/film-learning');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'main.js')) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const bad of [/Date\.now/, /performance\.now/, /setInterval/, /setTimeout/, /Math\.random/, /requestAnimationFrame/]) expect(src, `${f} ${bad}`).not.toMatch(bad);
    }
    const main = readFileSync(join(dir, 'main.js'), 'utf8');
    for (const bad of [/Date\.now/, /performance\.now/, /setInterval/, /setTimeout/, /Math\.random/]) expect(main).not.toMatch(bad);
  });
  it('the caption shown always belongs to the shot that owns the time', () => {
    for (const t of sample(0.1)) { const S = filmStateAt(t); if (S.caption) expect(S.caption.shot).toBe(S.shotId); expect(S.shotIndex).toBe(shotAt(t)); }
  });
  it('the camera moves continuously (no jump larger than a camera move allows between frames)', () => {
    let prev = cameraAt(0);
    for (let i = 1; i < FRAME_COUNT; i++) {
      const c = cameraAt(i / FPS);
      expect(Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y), `frame ${i}`).toBeLessThan(120);
      expect(Math.abs(Math.log(c.z / prev.z)), `frame ${i}`).toBeLessThan(0.08);
      prev = c;
    }
  });
  it('easings and the spring are normalised', () => {
    const e = cubicBezier(0.16, 1, 0.3, 1); expect(e(0)).toBe(0); expect(e(1)).toBe(1); expect(spring(0)).toBe(0); expect(spring(1)).toBe(1);
    for (let u = 0; u <= 1; u += 0.01) expect(spring(u)).toBeLessThan(1.03);
  });
});

describe('learning film: PKI invariants of the canonical state', () => {
  const states = () => sample(0.05).map((t) => filmStateAt(t));
  it('the private key exists only on WEB01, never moves and is never on a route', () => {
    for (const S of states()) {
      expect(S.key.location).toBe('WEB01'); expect(S.key.pos).toEqual(SPOTS.key);
      const v = SPOTS.vault; expect(S.key.pos.x).toBeGreaterThan(v.x); expect(S.key.pos.x).toBeLessThan(v.x + v.w);
    }
    for (const r of Object.values(ROUTES)) for (const p of r.pts) expect(p).not.toEqual(SPOTS.key);
    expect(filmStateAt(abs('private-key', 0.5)).key.exists).toBe(false); expect(filmStateAt(abs('private-key', 3)).key.exists).toBe(true);
  });
  it('the CSR and the leaf stay distinct: the CSR remains an input after a separate new certificate is built and signed', () => {
    for (const S of states()) { expect(S.csr.containsPrivateKey).toBe(false); expect(S.leaf.containsPrivateKey).toBe(false); }
    const S = filmStateAt(abs('issue', 9));
    expect(S.csr.exists && S.newCert.exists).toBe(true); expect(S.csr.mode).toBe('input'); expect(S.newCert.signed).toBe(true); expect(S.newCert.signedBy).toBe('Issuing CA');
    expect(S.csr.pos).not.toEqual(SPOTS.benchLeaf);
    // copied rows come from the CSR; CA rows are added; the CSR is never relabelled as the certificate
    expect(S.newCert.rows.filter((r) => r.from === 'csr').map((r) => r.id)).toEqual(['subject', 'san', 'key']);
    expect(filmStateAt(abs('issue', 3)).newCert.signed).toBe(false);
  });
  it('the Root CA is never contacted and never a route endpoint; there is never more than one active route', () => {
    for (const S of states()) { expect(S.root.contacted).toBe(false); expect(S.routes.length).toBeLessThanOrEqual(1); }
    for (const r of Object.values(ROUTES)) { expect(r.from).not.toMatch(/ROOT/i); expect(r.to).not.toMatch(/ROOT/i); for (const p of r.pts) expect(p.x).toBeLessThan(PLATES.offline.x); }
  });
  it('AIA and CDP are separate routes that are never active together; AIA is marked as not needed', () => {
    expect(ROUTES.aia.pts).not.toEqual(ROUTES.cdp.pts);
    let aia = 0, cdp = 0;
    for (const S of states()) { if (S.aia.opacity > 0 && S.cdp.opacity > 0 && S.t > abs('aia-cdp', 6.5)) throw new Error('AIA and CDP shown together'); if (S.route === 'aia') aia++; if (S.route === 'cdp') cdp++; expect(S.aia.needed).toBe(false); }
    expect(aia).toBeGreaterThan(0); expect(cdp).toBeGreaterThan(0);
  });
  it('store placement: leaf in Personal with the key; Issuing CA in Intermediate and Root in Trusted Root without keys', () => {
    const S = filmStateAt(abs('stores', 5));
    expect(S.leaf.store).toBe('personal'); expect(S.stores.personal.leafKey).toBe(true); expect(S.keyOwners).toEqual({ leaf: true, ica: false, root: false });
    expect(S.stores.intermediate.ica).toBe(true); expect(S.stores.root.root).toBe(true);
    expect(filmStateAt(abs('return', 6)).leaf.store).toBe(null); // not in Personal before certreq -accept
  });
  it('order of events: received before policy; issued before return; bound before the retry; trusted at the end', () => {
    expect(filmStateAt(abs('submit', 4.5)).record.opacity).toBeGreaterThan(0); expect(filmStateAt(abs('submit', 4.5)).policy.opacity).toBe(0);
    expect(filmStateAt(abs('return', 0.5)).newCert.signed).toBe(true);
    expect(filmStateAt(abs('retry', 0.5)).iis.cert).toBe('leaf'); expect(filmStateAt(abs('bind', 0.5)).iis.cert).toBe('temp');
    expect(filmStateAt(abs('success', 3)).browser.mode).toBe('secure'); expect(filmStateAt(abs('problem', 8)).browser.mode).toBe('warning');
  });
  it('the CertificateVerify signature travels on the wire; the key does not; session keys come after the proof', () => {
    const S = filmStateAt(abs('handshake', 2)); expect(S.route).toBe('wire'); expect(S.key.location).toBe('WEB01');
    expect(filmStateAt(abs('handshake', 4)).wire.sessionKeys).toBe(0); expect(filmStateAt(abs('handshake', 9)).wire.sessionKeys).toBeGreaterThan(0);
  });
  it('no caption says the CA signs the CSR, the CSR becomes a certificate, or the certificate encrypts the traffic', () => {
    for (const c of CAPTIONS) {
      const s = `${c.head} ${c.body}`;
      expect(s).not.toMatch(/sign(s|ed|ing)? the CSR/i); expect(s).not.toMatch(/CSR (becomes|turns into)/i);
      expect(s).not.toMatch(/certificate (itself )?encrypts/i); expect(s).not.toMatch(/Root CA (issues|signs the (leaf|website))/i);
    }
    const all = readFileSync(join(root, 'src/film-learning/render.js'), 'utf8') + readFileSync(join(root, 'src/film-learning/timeline.js'), 'utf8');
    expect(all).not.toMatch(/CA signs the CSR/i);
  });
});

describe('learning film: fixture-backed facts', () => {
  let f, model;
  beforeAll(async () => { model = (await loadModel()).model; f = filmFacts(model); });
  it('every displayed certificate, CSR and CRL value matches the parsed fixtures', () => {
    const leaf = model.resolve('leaf', null).parsed, csr = model.resolve('csr', null).parsed, crl = model.resolve('crl', null).parsed;
    expect(f.leaf.subject).toBe(leaf.subject); expect(f.leaf.serial).toBe(leaf.serialNumber); expect(f.leaf.sha1).toBe(leaf.thumbprints.sha1);
    expect(f.leaf.notAfter).toBe(leaf.notAfter.slice(0, 10)); expect(f.leaf.eku).toEqual(['Server Authentication']); expect(f.leaf.aia).toEqual(leaf.aia.map((a) => a.location)); expect(f.leaf.cdp).toEqual(leaf.cdp);
    expect(f.leaf.aia[0]).not.toBe(f.leaf.cdp[0]);
    expect(f.csr.spki).toBe(csr.publicKey.spkiSha256); expect(f.leaf.spki).toBe(f.csr.spki); expect(f.csr.hasPrivateKey).toBe(false); expect(f.csr.signatureValid).toBe(true);
    expect(f.csr.template).toBe('SIMSI2027WebServer'); expect(f.csr.clientUser).toBe('SIMSI2027\\Morgan');
    expect(f.crl.number).toBe(crl.crlNumber); expect(f.crl.leafListed).toBe(false); expect(f.temp.selfSigned).toBe(true);
  });
  it('the chain order is leaf -> Issuing CA -> Root; the handshake sends leaf + Issuing CA only; the leaf is not signed by the Root', () => {
    expect(f.leaf.issuerCn).toBe(f.ica.subjectCn); expect(f.ica.issuerCn).toBe(f.root.subjectCn); expect(f.root.selfSigned).toBe(true);
    expect(f.handshakeChain).toEqual([f.leaf.subjectCn, f.ica.subjectCn]); expect(f.leaf.issuerCn).not.toBe(f.root.subjectCn);
  });
  it('roles stay separate: visitor Jordan, owner/requester Morgan, subject = the site name', () => {
    expect(f.visitor.account).toBe('SIMSI2027\\Jordan'); expect(f.owner.account).toBe('SIMSI2027\\Morgan'); expect(f.leaf.subjectCn).toBe('portal.simsi2027.test');
    for (const c of CAPTIONS) expect(`${c.head} ${c.body}`).not.toMatch(/Jordan (requests|creates|owns|submits)/i);
  });
  it('evidence labels render from the facts without placeholders', () => {
    for (const c of CAPTIONS) if (c.evidence) { const s = c.evidence(f); expect(s).not.toMatch(/undefined|null|NaN/); }
  });
});
