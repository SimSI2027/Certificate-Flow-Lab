// Local-only companion: opens allowlisted public CER fixtures in the Windows certificate viewer.
// Security model: binds 127.0.0.1 only; accepts artifact IDs (never paths); strict allowlist; canonical-path check;
// only .cer files under fixtures/certificates; per-session random token; CORS limited to the local simulator origins.
import http from 'node:http';
import { realpathSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { NATIVE_CERTIFICATES, COMPANION_ORIGINS, COMPANION_PORT } from '../../src/artifacts/native-ids.js';

export const COMPANION_NAME = 'certificate-flow-lab-companion';
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

// Default opener = the registered Windows handler for .cer (same as double-clicking in Explorer). No shell involved.
export function windowsOpener(file) {
  return new Promise((ok) => {
    execFile('explorer.exe', [file], { windowsHide: false }, () => ok()); // explorer reports exit code 1 even on success
  });
}

// Pure resolution: id -> canonical absolute path or throws {status, code}.
export function resolveArtifact(root, artifactId) {
  if (typeof artifactId !== 'string' || !ID_PATTERN.test(artifactId)) throw { status: 400, code: 'invalid-artifact-id' };
  if (!Object.hasOwn(NATIVE_CERTIFICATES, artifactId)) throw { status: 404, code: 'unknown-artifact-id' };
  const dir = resolve(root, 'fixtures', 'certificates');
  const file = resolve(dir, NATIVE_CERTIFICATES[artifactId]);
  if (extname(file).toLowerCase() !== '.cer') throw { status: 403, code: 'not-a-cer' };
  if (!existsSync(file)) throw { status: 404, code: 'fixture-missing' };
  const real = realpathSync(file), realDir = realpathSync(dir);
  if (!real.startsWith(realDir + sep)) throw { status: 403, code: 'outside-allowlist' };
  return real;
}

const safeEqual = (a, b) => { const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? '')); return x.length === y.length && timingSafeEqual(x, y); };

export function createCompanion({ root, token, opener = windowsOpener, origins = COMPANION_ORIGINS }) {
  if (!token || token.length < 16) throw new Error('A session token of at least 16 characters is required');
  const allowed = new Set(origins);
  const send = (res, status, body, origin) => {
    const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && allowed.has(origin)) { h['Access-Control-Allow-Origin'] = origin; }
    res.writeHead(status, h); res.end(JSON.stringify(body));
  };
  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      if (!origin || !allowed.has(origin)) return send(res, 403, { ok: false, error: 'origin-not-allowed' });
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-CFL-Token',
        'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '60', Vary: 'Origin' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      // No token needed: reveals only the service identity and which public fixture IDs exist (no paths).
      return send(res, 200, { ok: true, service: COMPANION_NAME, artifacts: Object.keys(NATIVE_CERTIFICATES) }, origin);
    }
    if (req.method === 'POST' && url.pathname === '/open-certificate') {
      if (!origin || !allowed.has(origin)) return send(res, 403, { ok: false, error: 'origin-not-allowed' });
      if (!safeEqual(req.headers['x-cfl-token'], token)) return send(res, 401, { ok: false, error: 'invalid-token' }, origin);
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > 1024) { req.destroy(); } else chunks.push(c); });
      req.on('end', async () => {
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { ok: false, error: 'invalid-json' }, origin); }
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => k !== 'artifactId')) return send(res, 400, { ok: false, error: 'only-artifactId-accepted' }, origin);
        try {
          const file = resolveArtifact(root, body.artifactId);
          await opener(file, body.artifactId);
          return send(res, 200, { ok: true, artifactId: body.artifactId }, origin);
        } catch (e) {
          if (e && e.status) return send(res, e.status, { ok: false, error: e.code }, origin);
          return send(res, 500, { ok: false, error: 'open-failed' }, origin);
        }
      });
      return undefined;
    }
    return send(res, 404, { ok: false, error: 'not-found' }, origin);
  });
}

export { COMPANION_PORT };
