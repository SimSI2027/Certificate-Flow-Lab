// Shared vocabulary and geometry for story-zone lessons (Domain Controller and Website TLS). Pure data and small helpers only.
export const CFG = 'Depends on your configuration';
// A configuration-dependent statement: a complete sentence, then the marker naming what varies.
// cfg('A firewall blocks RPC/DCOM.', 'which ports are needed') -> 'A firewall blocks RPC/DCOM. Depends on your configuration: which ports are needed.'
export const cfg = (sentence, aspect) => `${sentence.trim().replace(/([^.!?])$/, '$1.')} ${CFG}: ${aspect}.`;
export const NEVER_EXECUTED = 'Shown for learning; never executed by this simulator.';
export const KIND = { REAL: 'Real fixture data', SIM: 'Simulated environment', DERIVED: 'Derived conclusion', FAULT: 'User-selected fault' };

// ---------- Zone geometry (story layout; coordinates in a 1600 x 720 viewBox). Six zones, same in every lesson. ----------
export const ZONE_GEOMETRY = { y: 120, h: 480, w: 244, xs: [24, 284, 544, 804, 1064, 1324] };
export const OFFLINE_TRUST = { id: 'OT', name: 'Offline trust', title: 'Offline trust · SIMSI2027-ROOTCA', x: 1324, y: 16, w: 244, h: 88 };
export const PUB = { id: 'PUB', name: 'PKIWEB01 (AIA, CDP)', title: 'PKIWEB01 · pki.simsi2027.test', x: 804, y: 640, w: 504, h: 64 };
export const placeZones = (zones) => zones.map((z, i) => ({ ...z, x: ZONE_GEOMETRY.xs[i], y: ZONE_GEOMETRY.y, w: ZONE_GEOMETRY.w, h: ZONE_GEOMETRY.h }));

// ---------- Commands: every token has a meaning; nothing is executed ----------
export function tokenize(text) { return text.match(/"[^"]*"|\S+/g) ?? []; }
// Returns a command builder bound to a token dictionary. A token without a meaning is a programming error.
export function makeCommand(dictionary) {
  return function command(text, extra = {}) {
    const tokens = tokenize(text).map((t) => ({ t, meaning: extra[t] ?? dictionary[t] ?? (/\.exe$/.test(t) ? dictionary[t.replace(/\.exe$/, '')] : null) }));
    const missing = tokens.filter((x) => !x.meaning).map((x) => x.t);
    if (missing.length) throw new Error(`Command token(s) without meaning: ${missing.join(', ')} in "${text}"`);
    return { text, tokens, banner: NEVER_EXECUTED };
  };
}
