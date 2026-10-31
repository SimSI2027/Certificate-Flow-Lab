import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = '/Certificate-Flow-Lab/'; // GitHub Pages repository sub-path (production builds only)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'unknown'; }
}
const COMMIT = commit();

// Emits version.json so a deployment can be matched to the commit it was built from.
const versionFile = () => ({ name: 'cfl-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, commit: COMMIT }) + '\n' }); } });

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  define: { __CFL_VERSION__: JSON.stringify(pkg.version), __CFL_COMMIT__: JSON.stringify(COMMIT) },
  plugins: [versionFile()],
  server: { port: 5183, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5185, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'], define: { __CFL_VERSION__: '"test"', __CFL_COMMIT__: '"test"' } }
}));
