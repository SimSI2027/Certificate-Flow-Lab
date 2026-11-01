import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createCompanion, resolveArtifact } from '../../tools/companion/companion.js';
import { NATIVE_CERTIFICATES, COMPANION_ORIGINS } from '../../src/artifacts/native-ids.js';
import { Native } from '../../src/ui/native.js';
import { root } from '../helpers/fixtures.js';
// v0.5.0: the classic tabbed inspector was removed; the browser inspector is the story panel's certificate inspector.
import { certInspector } from '../../src/ui/tls-panel.js';
import scenario from '../../src/scenarios/tls-manual-enrollment.js';
import { loadModel } from '../helpers/fixtures.js';

const TOKEN = 'unit-test-token-0123456789abcdef';
const ORIGIN = COMPANION_ORIGINS[0];
let server, base; const opened = [];

beforeAll(async () => {
  server = createCompanion({ root, token: TOKEN, opener: async (file, id) => { opened.push({ file, id }); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const post = (body, { token = TOKEN, origin = ORIGIN, raw } = {}) => fetch(`${base}/open-certificate`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { 'X-CFL-Token': token } : {}), ...(origin ? { Origin: origin } : {}) }, body: raw ?? JSON.stringify(body) });

describe('companion allowlist', () => {
  it('binds loopback only', () => { expect(server.address().address).toBe('127.0.0.1'); });
  it('opens every allowlisted ID and only allowlisted .cer files under fixtures/certificates', async () => {
    for (const id of Object.keys(NATIVE_CERTIFICATES)) {
      opened.length = 0;
      const r = await post({ artifactId: id });
      expect(r.status, id).toBe(200);
      expect(opened).toHaveLength(1);
      expect(opened[0].file.toLowerCase().endsWith('.cer')).toBe(true);
      expect(opened[0].file.replace(/\\/g, '/')).toContain('/fixtures/certificates/');
    }
  });
  it('allowlist contains only CER certificates (no CSR/CRL/PEM/PFX/keys)', () => {
    for (const f of Object.values(NATIVE_CERTIFICATES)) expect(f).toMatch(/^[a-z0-9.-]+\.cer$/);
  });
  it('rejects unknown IDs', async () => { opened.length = 0; const r = await post({ artifactId: 'not-real' }); expect(r.status).toBe(404); expect(opened).toHaveLength(0); });
  it.each(['../package.json', '..\\..\\x', '%2e%2e%2fpackage.json', 'C:\\Windows\\System32\\calc.exe', '/etc/passwd', 'portal-leaf/../root-ca', 'portal-leaf.cer', 'x'.repeat(200), ''])
    ('rejects traversal / absolute / malformed ID %j', async (id) => {
      opened.length = 0; const r = await post({ artifactId: id });
      expect([400, 404]).toContain(r.status); expect(opened).toHaveLength(0);
    });
  it('rejects path payloads and extra fields, non-string IDs, and bad JSON', async () => {
    opened.length = 0;
    expect((await post({ path: 'fixtures/certificates/simsi2027-rootca.cer' })).status).toBe(400);
    expect((await post({ artifactId: 'root-ca', path: 'C:\\x.exe' })).status).toBe(400);
    expect((await post({ artifactId: ['root-ca'] })).status).toBe(400);
    expect((await post(null, { raw: '{nope' })).status).toBe(400);
    expect(opened).toHaveLength(0);
  });
  it('resolveArtifact never leaves fixtures/certificates and refuses non-CER mappings', () => {
    expect(resolveArtifact(root, 'root-ca').toLowerCase().endsWith('simsi2027-rootca.cer')).toBe(true);
    expect(() => resolveArtifact(root, 'csr')).toThrow();
    expect(() => resolveArtifact(root, '__proto__')).toThrow();
    expect(() => resolveArtifact(root, 'constructor')).toThrow();
  });
});

describe('companion authentication and origin', () => {
  it('rejects missing and wrong tokens', async () => {
    opened.length = 0;
    expect((await post({ artifactId: 'root-ca' }, { token: null })).status).toBe(401);
    expect((await post({ artifactId: 'root-ca' }, { token: 'wrong-token-0123456789abcdef' })).status).toBe(401);
    expect(opened).toHaveLength(0);
  });
  it('permits the local simulator origins and echoes CORS only for them', async () => {
    for (const o of COMPANION_ORIGINS) { const r = await post({ artifactId: 'root-ca' }, { origin: o }); expect(r.status).toBe(200); expect(r.headers.get('access-control-allow-origin')).toBe(o); }
  });
  it('rejects unrelated and missing origins, even with a valid token', async () => {
    opened.length = 0;
    for (const o of ['https://simsi2027.github.io', 'http://evil.example', 'http://127.0.0.1:9999', 'null', null]) {
      const r = await post({ artifactId: 'root-ca' }, { origin: o }); expect(r.status, String(o)).toBe(403);
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
    }
    expect(opened).toHaveLength(0);
  });
  it('preflight is only granted to allowed origins', async () => {
    const ok = await fetch(`${base}/open-certificate`, { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    expect(ok.status).toBe(204);
    const bad = await fetch(`${base}/open-certificate`, { method: 'OPTIONS', headers: { Origin: 'https://simsi2027.github.io' } });
    expect(bad.status).toBe(403);
  });
  it('health reveals identity and IDs but no filesystem paths; unknown routes 404; no file enumeration', async () => {
    const j = await (await fetch(`${base}/health`, { headers: { Origin: ORIGIN } })).json();
    expect(j.service).toBe('certificate-flow-lab-companion');
    expect(JSON.stringify(j)).not.toMatch(/[A-Za-z]:\\|\.cer|fixtures/);
    expect((await fetch(`${base}/fixtures/certificates/simsi2027-rootca.cer`)).status).toBe(404);
    expect((await fetch(`${base}/list`)).status).toBe(404);
  });
  it('refuses to start without a real token', () => { expect(() => createCompanion({ root, token: 'short' })).toThrow(); });
});

describe('public mode and browser fallback', () => {
  it('on the public Pages host the native client makes no network request and explains local-only availability', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const n = new Native({ hostname: 'simsi2027.github.io' });
    await n.init();
    expect(spy).not.toHaveBeenCalled();
    expect(n.ready).toBe(false);
    expect(n.note()).toBe('Native Windows viewing is available when running Certificate Flow Lab locally.');
    spy.mockRestore();
  });
  it('the browser certificate inspector works with no companion at all', async () => {
    const { model } = await loadModel();
    const leaf = model.resolve('leaf', null).parsed;
    const ctx = { scenario, model, state: { activeFault: 'healthy', keyAssociation: 'matched', leafState: 'accepted', requester: 'SIMSI2027\\Morgan' }, sigs: {} };
    const h = certInspector(ctx, leaf, 'leaf');
    for (const w of ['portal.simsi2027.test', 'Thumbprint (SHA-1, as Windows shows it)', 'Certification path', 'Expected store']) expect(h).toContain(w);
    expect(h).not.toContain('data-native'); // no native viewer block without the companion
  });
});
