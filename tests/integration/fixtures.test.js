import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadModel, manifest, root, readFileSync } from '../helpers/fixtures.js';
import { SERVER_AUTH } from '../../src/artifacts/model.js';
import { URLS } from '../../src/artifacts/synthetic.js';
import DCS from '../../src/scenarios/dc-manual-certificate-request.js';

let M, EV, S;
beforeAll(async () => { ({ model: M, evidence: EV, scenario: S } = await loadModel()); });
const leaf = () => M.resolve('leaf', null).parsed, ica = () => M.resolve('ica', null).parsed, rootc = () => M.resolve('root', null).parsed;

describe('artifact manifest consistency', () => {
  it('lists every fixture file and nothing else', () => {
    const listed = new Set(manifest.artifacts.flatMap((a) => [a.filename, a.pemFilename]));
    const onDisk = [];
    const walk = (d, rel) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, `${rel}${n}/`) : onDisk.push(`${rel}${n}`); } };
    walk(join(root, 'fixtures'), '');
    for (const f of onDisk.filter((f) => !f.startsWith('manifests/'))) expect(listed.has(f), f).toBe(true);
    for (const f of listed) expect(onDisk, f).toContain(f);
  });
  it('has the required manifest fields and demonstration markers', () => {
    for (const a of manifest.artifacts) {
      for (const k of ['filename', 'artifactType', 'subject', 'issuer', 'serialNumber', 'thumbprints', 'validity', 'san', 'eku', 'aia', 'cdp', 'relatedRequest', 'stage']) expect(a, `${a.filename}.${k}`).toHaveProperty(k);
      expect(a.demonstrationFixture).toBe(true);
      expect([...S.stages, ...DCS.stages].map((s) => s.id)).toContain(a.stage);
    }
  });
  it('manifest values match the parsed files', () => {
    for (const e of Object.values(M.byFilename)) {
      const { manifest: m, parsed: p } = e;
      if (m.artifactType === 'certificate') {
        expect(m.thumbprints.sha1).toBe(p.thumbprints.sha1);
        expect(m.thumbprints.sha256).toBe(p.thumbprints.sha256);
        expect(m.serialNumber).toBe(p.serialNumber);
        expect(m.subject).toBe(p.subject);
        expect(m.validity.notAfter).toBe(p.notAfter);
        expect(m.san).toEqual(p.san.map((n) => `${n.type}=${n.value}`));
      }
      if (m.artifactType === 'csr' || m.artifactType === 'crl') expect(m.thumbprints.sha256).toBe(p.thumbprints.sha256);
    }
  });
  it('DER and PEM versions describe the same object', () => {
    for (const m of manifest.artifacts.filter((a) => a.artifactType !== 'chain')) {
      const der = readFileSync(join(root, 'fixtures', m.filename));
      expect(m.thumbprints.sha256).toBe(require_sha256(der));
    }
  });
});
function require_sha256(buf) { return execFileSync(process.execPath, ['-e', "const c=require('crypto');process.stdout.write(c.createHash('sha256').update(require('fs').readFileSync(0)).digest('hex').toUpperCase())"], { input: buf }).toString(); }

describe('real certificate fixtures', () => {
  it('leaf SAN equals CSR SAN and is portal.simsi2027.test', () => {
    const csr = M.resolve('csr', null).parsed;
    expect(leaf().san).toEqual([{ type: 'DNS', value: 'portal.simsi2027.test' }]);
    expect(csr.san).toEqual(leaf().san);
    expect(csr.publicKey.spkiSha256).toBe(leaf().publicKey.spkiSha256);
    expect(csr.signatureValid).toBe(true);
  });
  it('leaf has Server Authentication EKU', () => { expect(leaf().eku.map((e) => e.oid)).toContain(SERVER_AUTH); });
  it('chain: leaf → Issuing CA → Root, signed correctly and terminating at the root', async () => {
    expect(leaf().issuer).toBe(ica().subject);
    expect(ica().issuer).toBe(rootc().subject);
    expect(rootc().selfSigned).toBe(true);
    expect(ica().selfSigned).toBe(false);
    expect(await leaf().x509.verify({ publicKey: ica().x509, signatureOnly: true })).toBe(true);
    expect(await leaf().x509.verify({ publicKey: rootc().x509, signatureOnly: true })).toBe(false); // root does not sign the leaf
    expect(await ica().x509.verify({ publicKey: rootc().x509, signatureOnly: true })).toBe(true);
    expect(rootc().basicConstraints).toMatchObject({ ca: true, pathLength: 1 });
    expect(ica().basicConstraints).toMatchObject({ ca: true, pathLength: 0 });
    expect(leaf().basicConstraints.ca).toBe(false);
    const chain = M.resolve('chain', null).parsed.certs;
    expect(chain.map((c) => c.subject)).toEqual([leaf().subject, ica().subject, rootc().subject]);
  });
  it('AIA and CDP are separate concepts with different URLs and methods', () => {
    expect(leaf().aia.map((a) => a.location)).toEqual([URLS.icaAia]);
    expect(leaf().cdp).toEqual([URLS.icaCdp]);
    expect(leaf().aia[0].location).toMatch(/\.crt$/);
    expect(leaf().cdp[0]).toMatch(/\.crl$/);
    expect(leaf().aia.map((a) => a.location)).not.toEqual(leaf().cdp);
    expect(leaf().aia[0].method).toMatch(/CA Issuers/);
    expect(leaf().aia[0].location).toContain('simsi2027.test');
  });
  it('template extension identifies WebServer', () => { expect(leaf().template).toMatchObject({ name: 'WebServer' }); });
  it('CRL is signed by the ICA, current, and lists only fault-revoked leaf + a synthetic serial', async () => {
    const crl = M.resolve('crl', null).parsed;
    expect(await crl.x509.verify({ publicKey: ica().x509 })).toBe(true);
    expect(crl.issuer).toBe(ica().subject);
    expect(crl.crlNumber).toBe(27);
    expect(crl.entries.map((e) => e.serialNumber)).toContain(M.resolve('leaf', 'revoked').parsed.serialNumber);
    expect(crl.entries.map((e) => e.serialNumber)).not.toContain(leaf().serialNumber);
  });
  it('uses only synthetic names', () => {
    for (const e of Object.values(M.byFilename)) { const p = e.parsed; for (const s of [p.subject, p.issuer].filter(Boolean)) expect(s).toMatch(/SIMSI2027|simsi2027/i); }
  });
});

describe('fault evidence derives from real fixtures and agrees with scenario branching', () => {
  it('healthy: all checks pass', () => {
    expect(EV.healthy.firstFailure).toBeNull();
    expect(EV.healthy.checks.every((c) => c.status === 'pass')).toBe(true);
  });
  for (const f of ['wrong-dns', 'expired', 'untrusted-root', 'wrong-eku', 'missing-ica', 'revoked', 'cdp-unavailable', 'no-private-key']) {
    it(`${f}: first real failure is the declared check at the declared stage`, () => {
      const fault = S.faults.find((x) => x.id === f);
      expect(EV[f].firstFailure?.id).toBe(fault.check);
      expect(EV[f].failStage).toBe(fault.failStage);
      expect(EV[f].checks.filter((c) => c.status === 'fail')).toHaveLength(f === 'cdp-unavailable' ? 2 : 1);
    });
  }
  it('AIA and CDP evidence expose raw value, resolved URL, expected object, result and timestamp separately', () => {
    for (const k of ['aia', 'cdp']) for (const f of ['raw', 'resolved', 'expected', 'result', 'timestamp']) expect(EV.healthy[k]).toHaveProperty(f);
    expect(EV.healthy.aia.resolved).not.toBe(EV.healthy.cdp.resolved);
    expect(EV['missing-ica'].aia.ok).toBe(false);
    expect(EV['missing-ica'].cdp.ok).toBe(true);
    expect(EV['cdp-unavailable'].cdp.ok).toBe(false);
    expect(EV['cdp-unavailable'].aia.ok).toBe(true);
  });
});

describe('no private keys committed', () => {
  it('no key/pfx files tracked and no private-key PEM markers in tracked files', () => {
    let files;
    try { files = execFileSync('git', ['ls-files'], { cwd: root }).toString().split('\n').filter(Boolean); } catch { files = []; }
    const all = files.length ? files : [];
    for (const f of all) {
      expect(f, f).not.toMatch(/\.(pfx|p12|key|pk8|jks)$/i);
      if (/\.(pem|csr|cer|crl|der|json|js|md|ps1|mjs)$/i.test(f) && !/^(tests|scripts)\//.test(f)) {
        const s = readFileSync(join(root, f)).toString('latin1');
        expect(s, f).not.toMatch(/-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/);
      }
    }
    const fx = readdirSync(join(root, 'fixtures/certificates')).concat(readdirSync(join(root, 'fixtures/requests')));
    expect(fx.some((n) => /\.(key|pfx|p12|pk8)$/i.test(n))).toBe(false);
  });
  it('fixture generator never writes key material', () => {
    const g = readFileSync(join(root, 'scripts/generate-fixtures/generate.mjs'), 'utf8');
    expect(g).not.toMatch(/exportKey|PRIVATE KEY-----|pkcs8/);
  });
});
