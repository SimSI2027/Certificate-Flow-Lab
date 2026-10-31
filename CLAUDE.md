# Certificate Flow Lab — permanent project instructions

## Project boundary
- Work only inside `E:\ClaudeCode\Projects\Certificate-Flow-Lab`.
- Never access unrelated repositories, browser profiles, credentials, personal files or secrets.
- Never require Administrator privileges. Never use `--dangerously-skip-permissions`.
- Normal installed runtimes and caches may be used, but project outputs stay in the project.

## Truth rules
- Synthetic simulation data only. Never imply SIMSI2027 names, IPs, identities or services describe a real organization.
- Never connect to production Active Directory, AD CS, DNS, IIS or certificate stores without a separate explicit future instruction.
- Never commit private keys, PFX/P12 files, credentials or secrets. Public certificate, CSR and CRL fixtures must remain reproducible.
- Every displayed certificate field must come from actual parsed fixture data where a fixture exists. Placeholder policy/environment values stay labelled as simulation values.

## PKI model rules
- The visitor reports the TLS problem but does not enroll for the web-server certificate.
- WEB01 generates and retains the private key. The issuing CA signs the website certificate.
- The Root CA signs the issuing CA certificate and is the trust anchor; it never directly issues the website certificate.
- AIA (issuer certificate location) and CDP (CRL location) are separate concepts; never conflate them.
- Source IP is context, not sole enrollment authority.
- Forward mode = lifecycle progression. Reverse mode = evidence and causality, not reversed animation.
- One canonical scenario state drives all visuals, arrows, artifacts, panels, timelines, tours and film frames.

## Engineering rules
- Preserve cumulative tests; never delete a test merely because it fails.
- Keep source, tests, scripts, tools, fixtures and docs organized. No CMD wrappers. Windows scripts must be Windows PowerShell 5.1 compatible.
- Do not modify source with fragile search-and-replace commands.
- Keep generated media, build output, caches and machine-specific shortcuts out of Git.
- Use Git checkpoints and annotated semver tags. Never force push or move a published tag.
- Do not use agents or /ultrareview unless explicitly requested.

## Public demo rules
- The GitHub repository stays public. GitHub Pages is the canonical public demo.
- Every stable user-visible release is pushed to `main`; the Pages workflow must succeed.
- Before reporting a release complete, verify the live Pages deployment matches the newest `main` commit. Never leave the public demo behind stable `main`.
- The native Windows certificate viewer is local-only (loopback companion with allowlist + token); never expose it publicly.

## Future expansion points to preserve
NDES, SCEP, CEP, CES, autoenrollment, AIA retrieval, CDP/CRL validation, OCSP, smart-card, device and user certificates, client authentication, cross-forest enrollment.
