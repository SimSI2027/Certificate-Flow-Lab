# Certificate Flow Lab

*Interactive certificate issuance, deployment and trust visualization.*

**Live demo: https://simsi2027.github.io/Certificate-Flow-Lab/** · Repository: https://github.com/SimSI2027/Certificate-Flow-Lab

The public demo is a synthetic simulation and is redeployed automatically by GitHub Actions on every stable update to `main`.

> **This is synthetic simulation data.**
> - It is **not connected to any production PKI**, AD CS, Active Directory, DNS or IIS.
> - Every name, identity, IP address and event (SIMSI2027, Jordan, Morgan, PKIOperator, CLIENT01, WEB01, DC01, ...) is invented. `.test` is a reserved TLD and does not resolve.
> - All certificate, CSR, CRL and request-policy fixtures were **generated for this project** by `scripts/generate-fixtures/generate.mjs`. They are real, parseable files that chain only to the synthetic SIMSI2027 root.
> - **No private keys are distributed.** Keys exist only in memory while fixtures are generated.

## v0.3.0: scenario-first interface

Open the app and pick a scenario. Each runs in a calm, left-to-right **focused flow**: only the previous, current and next steps are drawn, one artifact moves at a time, and the offline Root CA lives in a separate **Offline trust** zone at the far right (shown only when the chain is being explained). **Show full topology** reveals everything, with inactive connections faded.

| Scenario | Story |
|----------|-------|
| **Website TLS Certificate** | A visitor reports a browser warning. The application owner (not the visitor) requests a certificate; WEB01 keeps its private key, the Issuing CA signs, IIS binds it and CLIENT01 validates name, dates, EKU, signatures, root trust and revocation. |
| **Domain Controller Manual Enrollment** | DC01 is not receiving its Domain Controller certificate automatically. An operator inspects DC01 and the template, writes a request policy (INF), generates the key on DC01 in machine context, creates and inspects the CSR, submits it with a `certreq`-style flow, accepts the issued certificate against the existing private key and verifies purposes, SAN, chain (AIA) and revocation (CDP). |

Manual enrollment here is **educational**: even when it works it does not replace investigating why autoenrollment failed. The final step says so. The simulated commands (`certreq.exe -new`, `-submit`, `-accept`) are never executed against a real CA.

### The details drawer
**Explain** (what, why, who, where, what moves next, what stays private, what can go wrong, in plain language) · **Technical details** · **Artifact** (the real parser-backed inspector with a friendly summary first, downloads and, locally, the Windows Certificate Viewer) · **Evidence** (each item labelled *Real fixture data*, *Simulated environment*, *Derived conclusion* or *User-selected fault*) · **Troubleshoot** (expected vs. current, causes, owner, checks, remediation; a collapsed *Developer state*). Pause at any step and click any object or artifact; nothing resets.

### Forward lifecycle and reverse evidence
Forward walks the stages (named milestone rail, Previous / Next / Play / Pause, 0.25x to 2x). **Reverse evidence is not a reversed animation**: the finished world stays put while the trace answers *why is this trusted / suitable?* back to the request and requester, citing evidence for every step. In a failure it starts from *why is it not trusted?*.

### Failures
TLS: wrong DNS name, expired, untrusted root, wrong EKU, missing issuing CA certificate, revoked, CDP unavailable, certificate installed without its private key. Domain Controller: template not published, no Enroll permission, request in user context, CA unavailable, pending approval, wrong EKU, missing SAN, certificate/private-key mismatch, issuing CA certificate unavailable, CDP unavailable, expired. Each halts at the correct step with evidence, the owning role and remediation.

### Real fixtures
`fixtures/` holds the synthetic Root CA, Issuing CA, website certificate, Domain Controller certificate, CSRs, CRL #27, chain files, the teaching INF and fault variants, described by `fixtures/manifests/manifest.json`. Every displayed certificate field is parsed from these files in the browser (see `docs/FIXTURES.md`).

### Two ways to view a certificate
- **Browser inspector (everywhere, including GitHub Pages):** general, details, path, SAN, EKU, key usage, basic constraints, AIA, CDP, thumbprints, PEM, raw ASN.1, issuance history and matching CSR; CER/PEM/chain downloads.
- **Windows Certificate Viewer (local only):** when started with the launcher an **Open in Windows Certificate Viewer** button appears for the allowlisted CER fixtures. It talks to a loopback-only companion that accepts only artifact IDs plus a per-session token. On the public site the control explains it is local-only and makes no request.

### Icons
All icons are a custom flat family drawn for this project. They are **not official Microsoft icons** and are never presented as such; no official Microsoft icon is used because none accurately represents these on-premises PKI concepts. Sources and policy: `assets/icons/SOURCES.md`; legend in the app under *About the simulator*.

## Install and run

Requirements: Windows with Node.js 18+ and npm (no Administrator rights). Edge or Chrome.

```powershell
npm install
```

**Fastest Windows setup:** run `Install-Shortcuts.ps1` once, then double-click **Certificate Flow Lab.lnk** (also creates *Build and Preview Certificate Flow Lab.lnk* and *Export Certificate Flow Lab Video.lnk*; all git-ignored).

```powershell
.\tools\windows\Launch-Demo.ps1           # simulator :5183 + native-viewer companion :5184 (-StopStale replaces leftovers)
.\tools\windows\Build-And-Preview.ps1     # tests, production build, preview at http://127.0.0.1:5185/Certificate-Flow-Lab/
.\tools\windows\Export-Video.ps1          # deterministic MP4 + contact sheet in output/ (needs FFmpeg + ffprobe)
```
`Ctrl+C` stops both child processes and their trees. npm: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run fixtures:validate`, `npm run test:pages`, `npm run video`.

### Video
`npm run video` renders `output/certificate-flow-lab-v0.3.0.mp4` (1920x1080, 60 fps, H.264, yuv420p, faststart, silent) and `output/certificate-flow-lab-v0.3.0-contact-sheet.jpg` by driving the canonical scenario state frame by frame (no screen recording). Output is git-ignored.

### Deployment
Every push to `main` runs tests, fixture validation, the production build and a base-path smoke test, then deploys GitHub Pages. The footer on the home screen shows the version and commit; `version.json` on the site records the deployed commit.

## Tests
```powershell
npm test                    # unit + integration (Vitest)
npm run test:e2e            # Playwright against installed Microsoft Edge
npm run fixtures:validate   # validates the real certificate/CSR/CRL/chain fixtures
npm run fixtures:generate   # regenerates fixtures (new keys, new thumbprints)
```

## Limitations and roadmap
See [docs/LIMITATIONS.md](docs/LIMITATIONS.md). Planned: NDES / SCEP device enrollment, CEP / CES enrollment, autoenrollment, AIA and CDP diagnostics, OCSP, smart-card, device and user certificates, client authentication and cross-forest enrollment ([docs/FUTURE_SCENARIOS.md](docs/FUTURE_SCENARIOS.md)). They appear only as a quiet "Coming later" list on the home screen.

## Documentation
[UX layout](docs/UX_LAYOUT.md) · [Architecture](docs/ARCHITECTURE.md) · [Scenario model](docs/SCENARIO_MODEL.md) · [Fixtures](docs/FIXTURES.md) · [Limitations](docs/LIMITATIONS.md) · [Future scenarios](docs/FUTURE_SCENARIOS.md) · [Icon sources](assets/icons/SOURCES.md)
