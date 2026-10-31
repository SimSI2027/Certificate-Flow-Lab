// Starts the loopback-only companion. Token comes from the CFL_TOKEN environment variable set by the launcher (never written to disk).
// Usage: node tools/companion/server.mjs [--port 5184] [--parent <pid>]
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompanion, COMPANION_PORT } from './companion.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const port = Number(arg('--port') ?? COMPANION_PORT);
const parent = Number(arg('--parent') ?? 0);
const token = process.env.CFL_TOKEN;
if (!token) { console.error('CFL_TOKEN is required (the launcher generates it).'); process.exit(2); }

const server = createCompanion({ root, token });
server.on('error', (e) => { console.error(`companion error: ${e.code ?? e.message}`); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`companion listening on 127.0.0.1:${port}`));

// Exit when the launcher that started us is gone (covers closing the launcher window).
if (parent) setInterval(() => { try { process.kill(parent, 0); } catch { process.exit(0); } }, 2000);
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
