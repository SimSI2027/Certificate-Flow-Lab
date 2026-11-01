// Learning film: the ONE canonical film state. filmStateAt(t) is a pure function of film time t (seconds).
// Every visual (positions, routes, artifacts, captions, panels, overlays, camera) is derived from it by render.js.
// No clocks, no randomness, no DOM.
import { SHOTS, CAPTIONS, CAM, DURATION, shotAt, shotById } from './timeline.js';
import { MOTION, EASE, spring, prog, lerp, clamp01, fade } from './tokens.js';

// ---------- World geometry (world px; plates are drawn at these rectangles) ----------
export const PLATES = {
  client: { x: 0, y: 0, w: 1000, h: 760 },
  web: { x: 1200, y: 0, w: 1000, h: 760 },
  ica: { x: 2400, y: 0, w: 1000, h: 760 },
  offline: { x: 3600, y: 0, w: 700, h: 760 },
  pki: { x: 0, y: 900, w: 1000, h: 330 }
};
const W = (plate, x, y) => ({ x: PLATES[plate].x + x, y: PLATES[plate].y + y });
export const SPOTS = {
  ticketStart: W('client', 600, 56), ticketEnd: W('web', 745, 470),
  key: W('web', 745, 245), keyLinkFrom: W('web', 530, 200), personalEnd: W('web', 474, 180), vault: { ...W('web', 530, 110), w: 430, h: 270 },
  pubStart: W('web', 745, 330), csrSpot: W('web', 745, 480),
  personal: W('web', 265, 180), intermediate: W('web', 265, 316), root: W('web', 265, 436),
  inbox: W('ica', 260, 160), benchCsr: W('ica', 740, 190), benchLeaf: W('ica', 740, 515), leafDepart: W('ica', 740, 740),
  wireClient: W('client', 500, 830), wireWeb: W('web', 500, 830),
  aiaFrom: W('pki', 260, 0), aiaTo: W('client', 260, 745), cdpFrom: W('pki', 740, 0), cdpTo: W('client', 740, 745)
};
// Routes. Exactly one is active at a time; the private key is never on any of them; the Root CA is never an endpoint.
export const ROUTES = {
  report: { from: 'CLIENT01', to: 'WEB01', pts: [SPOTS.ticketStart, { x: 600, y: -44 }, { x: 2300, y: -44 }, { x: 2300, y: 470 }, SPOTS.ticketEnd], color: 'slate' },
  submit: { from: 'WEB01', to: 'ICA01', pts: [SPOTS.csrSpot, { x: 2300, y: 480 }, { x: 2300, y: 160 }, SPOTS.inbox], color: 'csr' },
  return: { from: 'ICA01', to: 'WEB01', pts: [SPOTS.leafDepart, { x: 3140, y: 830 }, { x: 2300, y: 830 }, { x: 2300, y: 480 }, SPOTS.csrSpot], color: 'leaf' },
  wire: { from: 'CLIENT01', to: 'WEB01', pts: [SPOTS.wireClient, SPOTS.wireWeb], color: 'wire' },
  aia: { from: 'PKIWEB01', to: 'CLIENT01', pts: [SPOTS.aiaFrom, SPOTS.aiaTo], color: 'ica', optional: true },
  cdp: { from: 'PKIWEB01', to: 'CLIENT01', pts: [SPOTS.cdpFrom, SPOTS.cdpTo], color: 'validate' }
};

// Point at fraction u along a polyline (by length).
export function along(pts, u) {
  const segs = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); total += l; }
  let d = clamp01(u) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) { const k = segs[i] ? Math.min(1, d / segs[i]) : 1; return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) }; }
    d -= segs[i];
  }
  return { ...pts.at(-1) };
}
const mix = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });

// ---------- Camera (sequential keys across all shots; ease-in-out; zoom interpolated in log space) ----------
const CAMERA_KEYS = SHOTS.flatMap((s) => s.camera.map((k) => ({ t: s.start + k.at, dur: k.dur, ...CAM[k.target], target: k.target })));
export function cameraAt(t) {
  let cur = { x: CAMERA_KEYS[0].x, y: CAMERA_KEYS[0].y, z: CAMERA_KEYS[0].z };
  for (const k of CAMERA_KEYS) {
    if (t < k.t) break;
    const u = k.dur > 0 ? EASE.camera(clamp01((t - k.t) / k.dur)) : 1;
    cur = { x: lerp(cur.x, k.x, u), y: lerp(cur.y, k.y, u), z: Math.exp(lerp(Math.log(cur.z), Math.log(k.z), u)) };
    if (u < 1) break; // a move in progress is the last one that applies
  }
  return cur;
}

// ---------- Helpers ----------
const T = (id, local) => shotById[id].start + local;
const cue = (id, name) => T(id, shotById[id].cues[name]);
const between = (t, a, b) => t >= a && t < b;
// Travel along a route with a damped-spring settle; returns { pos, u, moving }.
function travel(t, route, t0, dur) { const u = spring(prog(t, t0, dur)); return { pos: along(ROUTES[route].pts, u), u, moving: t >= t0 && t < t0 + dur }; }
// A short local move between two spots (hero move, spring settle).
function move(t, a, b, t0, dur = MOTION.heroMove) { const u = spring(prog(t, t0, dur)); return mix(a, b, u); }

// ---------- The state ----------
export function filmStateAt(time) {
  const t = Math.min(Math.max(Number(time) || 0, 0), DURATION);
  const si = shotAt(t); const shot = SHOTS[si]; const local = t - shot.start;
  const S = {
    t, shotIndex: si, shotId: shot.id, shotN: shot.n, shotTitle: shot.title, act: shot.act, local, progress: t / DURATION,
    camera: cameraAt(t)
  };

  // Caption: the one whose window holds t (fade in on entry, fade out just before the next one).
  const cap = CAPTIONS.find((c) => t >= c.start && t < c.end) ?? null;
  S.caption = cap ? { shot: cap.shot, index: cap.index, head: cap.head, body: cap.body, evidence: cap.evidence, opacity: fade(t, cap.start, cap.end, MOTION.captionIn, MOTION.captionOut), start: cap.start, end: cap.end } : null;

  // Overlay (screen-space inspection plates).
  const ovShot = shot.overlay ? shot : null;
  S.overlay = ovShot ? { id: ovShot.overlay, opacity: fade(t, ovShot.start, ovShot.overlay === 'final' || ovShot.overlay === 'reverse' ? Infinity : ovShot.end, MOTION.overlayIn, MOTION.overlayOut), local } : null;
  if (S.overlay?.id === 'csr') S.overlay.callouts = shot.callouts.map((c) => ({ ...c, opacity: fade(t, shot.start + c.at), active: local >= c.at && !shot.callouts.some((d) => d.at > c.at && local >= d.at) }));
  if (S.overlay?.id === 'cert') S.overlay.groups = shot.groups.map((g, i) => ({ ...g, shown: local >= g.at, active: local >= g.at && !(shot.groups[i + 1] && local >= shot.groups[i + 1].at), opacity: fade(t, shot.start + g.at) }));
  if (S.overlay?.id === 'chain') { const c = shot.cues; S.overlay.parts = { leaf: fade(t, shot.start + c.leaf), ica: fade(t, shot.start + c.ica), root: fade(t, shot.start + c.root), anchor: fade(t, shot.start + c.anchor), history: fade(t, shot.start + c.history) }; }
  if (S.overlay?.id === 'reverse') S.overlay.nodes = Array.from({ length: 9 }, (_, i) => fade(t, shot.start + shot.cues.first + i * shot.cues.step, Infinity, 0.45));
  // Veil over the world while an inspection plate is open.
  S.veil = S.overlay ? S.overlay.opacity * (S.overlay.id === 'reverse' ? 0.82 : 0.95) : 0;

  // ---- CLIENT01 browser ----
  const url = 'https://portal.simsi2027.test';
  const typed = Math.floor(clamp01((t - cue('problem', 'type')) / (MOTION.typePerChar * url.length)) * url.length);
  let mode = 'blank', modeAt = 0;
  if (t >= cue('problem', 'type')) { mode = 'typing'; modeAt = cue('problem', 'type'); }
  if (t >= cue('problem', 'load')) { mode = 'loading'; modeAt = cue('problem', 'load'); }
  if (t >= cue('problem', 'warn')) { mode = 'warning'; modeAt = cue('problem', 'warn'); }
  if (t >= T('retry', 0.4)) { mode = 'checking'; modeAt = T('retry', 0.4); }
  if (t >= cue('success', 'secure')) { mode = 'secure'; modeAt = cue('success', 'secure'); }
  S.browser = { url, typed: mode === 'blank' ? 0 : typed, mode, enter: prog(t, modeAt, MOTION.heroMove, EASE.enter) };
  S.jordan = { visible: true };

  // ---- Report ticket (CLIENT01 -> WEB01) ----
  const tk = travel(t, 'report', cue('report', 'travel'), shotById.report.cues.travelDur);
  S.report = { visible: between(t, cue('report', 'ticket'), T('private-key', 0.6)), opacity: fade(t, cue('report', 'ticket'), T('private-key', 0.6)), pos: tk.pos, moving: tk.moving };
  S.morgan = { opacity: fade(t, cue('report', 'morgan')) };
  S.investigate = { opacity: between(t, cue('report', 'inspect'), T('private-key', 0)) ? fade(t, cue('report', 'inspect'), T('private-key', 0)) : 0 };

  // ---- Private key: created on WEB01, never moves, never on a route ----
  const keyAt = cue('private-key', 'keyIn');
  const linkAt = cue('return', 'link');
  S.key = {
    exists: t >= keyAt, location: 'WEB01', pos: { ...SPOTS.key }, appear: prog(t, keyAt, MOTION.heroMove, EASE.enter),
    lock: prog(t, cue('private-key', 'lock'), MOTION.smallMove + 0.2, EASE.move),
    store: t >= linkAt ? 'linked' : 'pending',
    // Highlight rings when the key is used in place (the CSR signature made by WEB01, the accept link, CertificateVerify).
    ring: Math.max(pulse(t, cue('csr', 'seal'), 1.0), pulse(t, linkAt, 1.1), pulse(t, cue('handshake', 'verify'), 1.2)),
    pin: Math.max(windowFade(t, cue('submit', 'travel') - 0.4, cue('submit', 'travel') + shotById.submit.cues.travelDur + 0.6), windowFade(t, cue('return', 'travel') - 0.4, cue('return', 'travel') + shotById.return.cues.travelDur + 0.6))
  };
  S.vault = { opacity: fade(t, T('private-key', 0.9), Infinity, 0.5) };
  S.command = commandAt(t);

  // ---- Public key token and CSR ----
  const pubAt = cue('csr', 'pub');
  S.pubkey = { visible: t >= pubAt && t < cue('csr', 'envelope') + 0.6, opacity: fade(t, pubAt, cue('csr', 'envelope') + 0.6, 0.35, 0.3), pos: move(t, SPOTS.pubStart, SPOTS.csrSpot, pubAt + 0.15, 1.0) };
  const envAt = cue('csr', 'envelope');
  const sub = travel(t, 'submit', cue('submit', 'travel'), shotById.submit.cues.travelDur);
  let csrPos = { ...SPOTS.csrSpot }; let csrLoc = 'WEB01';
  if (t >= cue('submit', 'travel')) { csrPos = sub.pos; csrLoc = sub.moving ? 'transit' : 'ICA01'; }
  if (t >= cue('issue', 'bench')) csrPos = move(t, SPOTS.inbox, SPOTS.benchCsr, cue('issue', 'bench'), 0.75);
  const nameText = 'portal.simsi2027.test';
  S.csr = {
    exists: t >= envAt, opacity: fade(t, envAt, Infinity, 0.45), pos: csrPos, location: csrLoc, moving: sub.moving,
    nameTyped: Math.floor(clamp01((t - cue('csr', 'name')) / (MOTION.typePerChar * nameText.length)) * nameText.length), nameText,
    seal: prog(t, cue('csr', 'seal'), MOTION.stamp, EASE.enter), signed: t >= cue('csr', 'seal'),
    mode: t >= cue('issue', 'bench') ? 'input' : 'envelope', containsPrivateKey: false
  };
  S.record = { opacity: fade(t, cue('submit', 'record')) };
  const ck = shotById.submit.cues;
  S.policy = { opacity: fade(t, T('submit', 5.6)), checks: shotById.submit.checks.map((_, i) => prog(t, T('submit', ck.checks + i * ck.checkStep), MOTION.callout, EASE.enter)) };

  // ---- Issuance: a NEW certificate structure beside the CSR (never a CSR transformation) ----
  const ic = shotById.issue.cues;
  const copyRows = ['subject', 'san', 'key'].map((id, i) => ({ id, from: 'csr', p: prog(t, T('issue', ic.copy + i * ic.copyStep), MOTION.callout, EASE.enter), line: windowFade(t, T('issue', ic.copy + i * ic.copyStep), T('issue', ic.copy + i * ic.copyStep + 1.1)) }));
  const addRows = ['issuer', 'serial', 'validity', 'purpose', 'keyuse', 'aia', 'cdp'].map((id, i) => ({ id, from: 'ca', p: prog(t, T('issue', ic.add + i * ic.addStep), MOTION.callout, EASE.enter) }));
  S.newCert = {
    exists: t >= T('issue', ic.bench), opacity: fade(t, T('issue', ic.bench), Infinity, 0.45), rows: [...copyRows, ...addRows],
    seal: prog(t, T('issue', ic.sign), MOTION.stamp, EASE.enter), signed: t >= T('issue', ic.sign), signedBy: 'Issuing CA',
    // After the leaf leaves for WEB01 the bench keeps the CA's own record of the issued certificate.
    record: t >= cue('return', 'travel')
  };
  S.caKey = { ring: pulse(t, T('issue', ic.sign), 1.2), location: 'ICA01' };
  S.root = { contacted: false, note: fade(t, T('issue', ic.rootNote)) };

  // ---- Return: public leaf + Issuing CA certificate travel back; the key waited on WEB01 ----
  const rc = shotById.return.cues;
  const lt = travel(t, 'return', T('return', rc.travel), rc.travelDur);
  const it = travel(t, 'return', T('return', rc.travel + rc.icaLag), rc.travelDur);
  let leafPos = lt.pos, leafLoc = lt.moving ? 'transit' : (t >= T('return', rc.travel) ? 'WEB01' : 'ICA01');
  let leafMode = t >= T('return', rc.travel) ? 'chip' : 'hidden';
  if (t >= T('return', rc.leafIn)) { leafPos = move(t, SPOTS.csrSpot, SPOTS.personal, T('return', rc.leafIn), 1.0); leafLoc = 'WEB01'; }
  if (t >= T('return', rc.leafIn) + 0.9) leafMode = 'stored';
  S.leaf = { mode: leafMode, pos: leafPos, location: leafLoc, store: t >= T('return', rc.leafIn) + 0.9 ? 'personal' : null, opacity: fade(t, T('return', rc.travel) - 0.2, Infinity, 0.3), containsPrivateKey: false,
    keyBadge: prog(t, T('return', rc.link) + 0.7, MOTION.callout, EASE.enter), link: prog(t, T('return', rc.link), 0.8, EASE.move), linkLabel: fade(t, T('return', rc.link) + 0.4) };
  let icaPos = it.pos; if (t >= T('return', rc.icaIn)) icaPos = move(t, SPOTS.csrSpot, SPOTS.intermediate, T('return', rc.icaIn), 0.8);
  S.icaReturn = { visible: between(t, T('return', rc.travel + rc.icaLag) - 0.2, T('return', rc.icaIn) + 1.1), opacity: fade(t, T('return', rc.travel + rc.icaLag) - 0.2, T('return', rc.icaIn) + 1.1, 0.3, 0.35), pos: icaPos, moving: it.moving };

  // ---- WEB01 stores (Local Computer) ----
  const sc = shotById.stores.cues;
  S.stores = {
    personal: { temp: true, leaf: S.leaf.store === 'personal', leafKey: S.leaf.keyBadge > 0, hl: hl(t, T('stores', sc.personal), T('stores', sc.intermediate)) },
    intermediate: { ica: true, matched: fade(t, T('return', rc.icaIn) + 0.8), hl: hl(t, T('stores', sc.intermediate), T('stores', sc.root)) },
    root: { root: true, hl: hl(t, T('stores', sc.root), T('bind', 0)) },
    alarm: S.investigate.opacity
  };
  S.keyOwners = { leaf: true, ica: false, root: false };

  // ---- IIS binding ----
  const bc = shotById.bind.cues;
  S.iis = { cert: t >= T('bind', bc.swap) + 0.35 ? 'leaf' : 'temp', swap: prog(t, T('bind', bc.swap), 0.7, EASE.move), rows: fade(t, T('bind', bc.rows)), hl: windowFade(t, T('bind', 0.4), T('retry', 0)), alarm: S.investigate.opacity };

  // ---- Wire: TLS messages (the private key never appears here) ----
  const rr = shotById.retry.cues; const hs = shotById.handshake.cues;
  const hello = travel(t, 'wire', T('retry', rr.hello), rr.helloDur);
  const certMsg = travel(t, 'wire', T('retry', rr.certMsg), rr.certDur);
  const verify = travel(t, 'wire', T('handshake', hs.verify), hs.verifyDur);
  S.wire = {
    opacity: Math.max(windowFade(t, T('retry', 0.6), T('chain', 0)), windowFade(t, T('handshake', 0.2), T('success', 0.4))),
    hello: { opacity: windowFade(t, T('retry', rr.hello) - 0.1, T('retry', rr.hello + rr.helloDur + 0.5)), pos: hello.pos },
    certMsg: { opacity: windowFade(t, T('retry', rr.certMsg) - 0.1, T('retry', rr.certMsg + rr.certDur + 1.4)), pos: { ...along(ROUTES.wire.pts, 1 - certMsg.u) }, chain: ['leaf', 'ica'] },
    verify: { opacity: windowFade(t, T('handshake', hs.verify) - 0.1, T('success', 0.3)), pos: { ...along(ROUTES.wire.pts, 1 - verify.u) }, verified: fade(t, T('handshake', hs.verified)) },
    sessionKeys: fade(t, T('handshake', hs.sessKeys)), channel: prog(t, T('handshake', hs.channel), 1.0, EASE.move), channelText: fade(t, T('handshake', hs.channel) + 0.7)
  };

  // ---- CLIENT01 checks ----
  const ac = shotById['aia-cdp'].cues;
  const tick = (a) => prog(t, a, MOTION.callout, EASE.enter);
  S.checks = {
    opacity: fade(t, T('retry', 6.2)),
    rows: {
      name: tick(T('retry', rr.check0)), validity: tick(T('retry', rr.check0 + rr.checkStep)), purpose: tick(T('retry', rr.check0 + 2 * rr.checkStep)),
      chain: tick(T('chain', shotById.chain.cues.root + 0.6)), revocation: tick(T('aia-cdp', ac.tick)), proof: tick(T('handshake', hs.verified))
    }
  };
  // ---- AIA and CDP: separate routes, never active together ----
  S.aia = { opacity: windowFade(t, T('aia-cdp', ac.aia), T('aia-cdp', 6.4)), needed: false };
  const crl = travel(t, 'cdp', T('aia-cdp', ac.crlTravel), ac.crlDur);
  S.cdp = { opacity: windowFade(t, T('aia-cdp', ac.cdp), T('handshake', 0)), crl: { opacity: windowFade(t, T('aia-cdp', ac.crlTravel) - 0.1, T('aia-cdp', ac.crlTravel + ac.crlDur + 1.0)), pos: crl.pos }, list: fade(t, T('aia-cdp', ac.list)) };
  S.pki = { hl: windowFade(t, T('aia-cdp', 0.6), T('handshake', 0)) };

  // ---- Active route (exactly zero or one) ----
  const active = [];
  if (S.report.visible && between(t, cue('report', 'travel') - 0.3, cue('report', 'travel') + shotById.report.cues.travelDur + 0.5)) active.push('report');
  if (between(t, cue('submit', 'travel') - 0.3, cue('submit', 'travel') + shotById.submit.cues.travelDur + 0.4)) active.push('submit');
  if (between(t, T('return', rc.travel) - 0.3, T('return', rc.travel + rc.icaLag + rc.travelDur + 0.4))) active.push('return');
  if (S.wire.opacity > 0) active.push('wire');
  if (S.aia.opacity > 0) active.push('aia');
  if (S.cdp.opacity > 0 && t >= T('aia-cdp', 6.4)) active.push('cdp');
  S.route = active[0] ?? null; S.routes = active;
  S.routeOpacity = S.route === 'wire' ? S.wire.opacity : S.route === 'aia' ? S.aia.opacity : S.route === 'cdp' ? S.cdp.opacity : routeFade(t, S.route);

  S.final = S.overlay?.id === 'final' ? S.overlay.opacity : 0;
  return S;
}

// Fade in at a, out at b (b may be Infinity).
function windowFade(t, a, b) { return t < a || t >= b ? 0 : fade(t, a, b, 0.3, 0.25); }
function pulse(t, a, d) { if (t < a || t > a + d) return 0; const u = (t - a) / d; return Math.sin(Math.PI * u); }
function hl(t, a, b) { return windowFade(t, a, b); }
function routeFade(t, r) {
  if (!r) return 0;
  const win = { report: [cue('report', 'travel') - 0.3, cue('report', 'travel') + shotById.report.cues.travelDur + 0.5], submit: [cue('submit', 'travel') - 0.3, cue('submit', 'travel') + shotById.submit.cues.travelDur + 0.4],
    return: [T('return', shotById.return.cues.travel) - 0.3, T('return', shotById.return.cues.travel + shotById.return.cues.icaLag + shotById.return.cues.travelDur + 0.4)] }[r];
  return win ? windowFade(t, win[0], win[1]) : 1;
}
// The command chip on WEB01 (commands are shown for learning only; never executed).
function commandAt(t) {
  const list = [
    { at: cue('private-key', 'command'), until: T('submit', 0.2), text: 'certreq -new -machine portal-request.inf portal.csr' },
    { at: T('submit', 0.2), until: T('return', shotById.return.cues.command), text: 'certreq -submit -config "ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01" portal.csr portal.cer' },
    { at: T('return', shotById.return.cues.command), until: T('stores', 0.8), text: 'certreq -accept -machine portal.cer' }
  ];
  const c = list.find((x) => t >= x.at && t < x.until);
  return c ? { text: c.text, opacity: fade(t, c.at, c.until, 0.35, 0.2), note: 'Shown for learning; never executed by this simulator.' } : { text: '', opacity: 0, note: '' };
}
