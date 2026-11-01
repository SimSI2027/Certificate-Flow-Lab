import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../helpers/fixtures.js';

const tracked = () => { try { return execFileSync('git', ['ls-files'], { cwd: root }).toString().split('\n').filter(Boolean); } catch { return []; } };

describe('repository hygiene', () => {
  it('ignores shortcuts, key material, caches and build output', () => {
    const gi = readFileSync(join(root, '.gitignore'), 'utf8');
    for (const p of ['*.lnk', '*.pfx', '*.key', 'node_modules/', 'dist/', 'test-results/']) expect(gi).toContain(p);
  });
  it('tracks no shortcuts, PFX/key files, caches or CMD wrappers', () => {
    for (const f of tracked()) {
      expect(f, f).not.toMatch(/\.(lnk|pfx|p12|key|pk8|cmd|bat)$/i);
      expect(f, f).not.toMatch(/^(node_modules|dist|test-results|playwright-report|screenshots)\//);
    }
  });
  it('v0.4.1 (audit E4): third-party skills and generated media stay untracked; the project skill is committed', () => {
    const gi = readFileSync(join(root, '.gitignore'), 'utf8');
    for (const p of ['.claude/skills/web-design-guidelines/', 'skills-lock.json', 'screenshots/', 'output/*']) expect(gi).toContain(p);
    const files = tracked(); if (!files.length) return;
    expect(files.filter((f) => f.startsWith('.claude/skills/web-design-guidelines/') || f === 'skills-lock.json' || /^output\/.+\.(mp4|jpg|png)$/i.test(f))).toEqual([]);
    expect(files).toContain('.claude/skills/pki-accuracy-review/SKILL.md');
  });
  it('has the launcher and shortcut installer and no CMD wrapper', () => {
    expect(existsSync(join(root, 'tools/windows/Launch-Demo.ps1'))).toBe(true);
    expect(existsSync(join(root, 'Install-Shortcuts.ps1'))).toBe(true);
    expect(existsSync(join(root, 'Launch-Demo.cmd'))).toBe(false);
  });
  it.skipIf(process.platform !== 'win32')('PowerShell scripts parse under Windows PowerShell', { timeout: 90000 }, () => {
    for (const s of ['tools/windows/Launch-Demo.ps1', 'tools/windows/Build-And-Preview.ps1', 'tools/windows/Export-Video.ps1', 'tools/windows/Common.ps1', 'Install-Shortcuts.ps1']) {
      const cmd = `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${join(root, s)}',[ref]$t,[ref]$e);if($e.Count){$e|%{$_.Message};exit 1}`;
      expect(() => execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { stdio: 'pipe' }), s).not.toThrow();
    }
  });
  it('launcher covers the required behaviors', () => {
    const l = ['Launch-Demo.ps1', 'Common.ps1'].map((f) => readFileSync(join(root, 'tools/windows', f), 'utf8')).join('\n');
    for (const w of ['Get-Command node', 'npm install', 'unrelated process', 'Get-NetTCPConnection', 'Press Ctrl+C', 'finally', 'taskkill', 'RNGCryptoServiceProvider', '5184']) expect(l).toContain(w);
    expect(l).not.toMatch(/RunAs|-Verb/i);
  });
  it('documentation set exists', () => {
    for (const f of ['README.md', 'docs/ARCHITECTURE.md', 'docs/SCENARIO_MODEL.md', 'docs/FIXTURES.md', 'docs/LIMITATIONS.md', 'docs/FUTURE_SCENARIOS.md', 'docs/AUDIT_v0.4.md', 'docs/AUDIT_v0.5.md', 'docs/AUDIT_v0.6.md', 'docs/FILM_LEARNING.md','docs/VISUAL_REVIEW.md', 'docs/UX_LAYOUT.md', 'CLAUDE.md', '.github/workflows/deploy-pages.yml']) expect(existsSync(join(root, f)), f).toBe(true);
  });
});
