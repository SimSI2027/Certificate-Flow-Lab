// Browser side of the optional local-only native certificate viewer. On the public site (any non-loopback host)
// this never makes a network request. The session token arrives in the URL fragment from the launcher and is kept in memory only.
import { COMPANION_PORT } from '../artifacts/native-ids.js';

export class Native {
  constructor(loc = globalThis.location) {
    this.local = ['127.0.0.1', 'localhost'].includes(loc?.hostname);
    this.available = false; this.ids = []; this.token = null; this.message = '';
    this.base = `http://127.0.0.1:${COMPANION_PORT}`;
  }

  async init(onChange) {
    if (!this.local) return;
    const m = /(?:^#|&)nt=([A-Za-z0-9_-]{16,128})/.exec(globalThis.location.hash);
    if (m) { this.token = m[1]; globalThis.history.replaceState(null, '', globalThis.location.pathname + globalThis.location.search); }
    try {
      const r = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(1200) });
      const j = await r.json();
      if (j.ok && j.service === 'certificate-flow-lab-companion') { this.available = true; this.ids = j.artifacts; }
    } catch { this.available = false; }
    onChange?.();
  }

  get ready() { return this.available && !!this.token; }

  async open(artifactId) {
    try {
      const r = await fetch(`${this.base}/open-certificate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CFL-Token': this.token }, body: JSON.stringify({ artifactId }) });
      const j = await r.json();
      this.message = j.ok ? 'Opened in the Windows certificate viewer.' : `Could not open: ${j.error}`;
      return j;
    } catch { this.message = 'The local companion is not reachable.'; return { ok: false }; }
  }

  // Text shown where the button would be.
  note() {
    if (!this.local) return 'Native Windows viewing is available when running Certificate Flow Lab locally.';
    if (!this.available) return 'Native Windows viewing needs the local companion. Start Certificate Flow Lab with Launch-Demo.ps1.';
    if (!this.token) return 'Companion found, but this page has no session token. Start with Launch-Demo.ps1.';
    return this.message;
  }
}
