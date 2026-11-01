# Certificate Flow Lab

*Interactive certificate issuance, deployment and trust visualization.*

**Live demo: https://simsi2027.github.io/Certificate-Flow-Lab/** · Repository: https://github.com/SimSI2027/Certificate-Flow-Lab

The public demo is a synthetic simulation and is redeployed automatically by GitHub Actions on every stable update to `main`.

> **This is synthetic simulation data.**
> - It is **not connected to any production PKI**, AD CS, Active Directory, DNS or IIS.
> - Every name, identity, IP address and event (SIMSI2027, Jordan, Morgan, PKIOperator, CLIENT01, WEB01, DC01, ...) is invented. `.test` is a reserved TLD and does not resolve.
> - All certificate, CSR, CRL and request-policy fixtures were **generated for this project** by `scripts/generate-fixtures/generate.mjs`. They are real, parseable files that chain only to the synthetic SIMSI2027 root.
> - **No private keys are distributed.** Keys exist only in memory while fixtures are generated.

## v0.4.0: Domain Controller Manual Enrollment, redesigned as a story

Open the app and pick a scenario.

| Scenario | Story |
|----------|-------|
| **Website TLS Certificate** (unchanged) | A visitor reports a browser warning. The application owner (not the visitor) requests a certificate; WEB01 keeps its private key, the Issuing CA signs, IIS binds it and CLIENT01 validates name, dates, EKU, signatures, root trust and revocation. Classic focused layout. |
| **Domain Controller Manual Enrollment** | DC01 has no certificate with KDC Authentication because autoenrollment could not reach the Issuing CA. Choose a path. **Path A, Manual CSR transfer** (24 steps, 10 milestones): `certreq -new -machine` creates the key and the signed CSR on DC01; the CSR alone travels through PKI-TRANSFER01; PKIOperator submits it for the controlled template DCOfflineKerberosAuth; a certificate manager approves; ICA01 creates and signs a new certificate; the public return package comes back; the Root is verified by thumbprint; the Root and Issuing CA certificates are installed; and `certreq -accept` runs on the original DC01. **Path B, Certificates MMC enrollment** (11 steps, 6 milestones): DC01 can reach ICA01, so the Certificates (Local Computer) wizard enrolls as SIMSI2027\DC01$ for KerberosAuthentication. |

The DC story is drawn as six fixed zones: DC01, request package, controlled transfer, Issuing CA, return package, and the DC01 certificate stores. An Offline Trust box and a PKIWEB01 strip complete the picture. The rule is **one active zone, one active artifact, one active route**. The private key stays in a DC01 key vault ("Certificate Enrollment Requests") until `certreq -accept` links it across a "same computer, never on the network" lane. The Root CA only ever appears as a muted "signed the Issuing CA certificate earlier (offline)" link.

**Conditions** (Path A): *Trust certificates missing on DC01* (default, an exceptional condition for this lesson) or *Trust certificates present via AD (Enterprise store)*, which skips the two installation steps ("Already present — skipped").
**Faults** (separate selector): RPC/DCOM blocked, wrong template for the handoff, no Enroll permission, template not published, pending with no approver, user context, accepted on the wrong machine, pending request lost, Root thumbprint mismatch, CDP unreachable (verdict withheld), KDC Authentication EKU missing, SAN without the domain name, key mismatch and expired. Each one shows its symptom, the evidence with its kind, the owner, the remediation, whether the flow stops, and the long-term fix.

**Controls:** the header holds Home, the path switch (Manual CSR transfer | Certificates MMC enrollment), Condition, Fault, START FLOW (replaced by "Step n of N · title"), Forward flow | Reverse evidence, Show full topology and the guided tour (8 stops). The bottom bar holds named milestone chips, Previous, Play/Pause, Next, Restart and the speed. Keyboard: Space plays or pauses, ←/→ step, Escape closes the details panel.

**Details panel** (collapsed by default): Plain language · Technical details (parser-backed CSR, certificate and store inspectors, with Subject, Operator and Requester as three separate fields) · Command explanation (every token explained; "Shown for learning; never executed by this simulator.") · Raw artifact on demand · Evidence · Troubleshoot (moves up and opens when a fault stops the flow).

**What the screens look like (described in words).** Before START FLOW: six dashed placeholder zones and the Offline Trust box. While stepping: one zone outlined in blue with a dark actor badge ("Operator acts", "Cert manager acts", "System acts") and a single coloured artifact card, for example a blue CSR envelope reading "public key + names · signed by DC01 key". Finished zones keep small clickable chips of their earlier artifacts. At the accept step an amber dashed lane runs from the DC01 key vault to the Personal store. In the store cards the leaf shows "private key on DC01 ✓", while the Issuing CA and Root show "no private key here" and their source tags. A failure draws the route red, dashed and crossed. The last step shows a card: "Suitable now; root cause still open".

Manual enrollment is an **exception, not a repair**: the last step lists the open items (the RPC/DCOM firewall rule, autoenrollment Group Policy and permissions, trust distribution, CDP/AIA reachability, replacing and revoking the manual certificate, unpublishing the temporary template).

### The details drawer (TLS, classic layout)
**Explain** (what, why, who, where, what moves next, what stays private, what can go wrong, in plain language) · **Technical details** · **Artifact** (the real parser-backed inspector with a friendly summary first, downloads and, locally, the Windows Certificate Viewer) · **Evidence** (each item labelled *Real fixture data*, *Simulated environment*, *Derived conclusion* or *User-selected fault*) · **Troubleshoot** (expected vs. current, causes, owner, checks, remediation; a collapsed *Developer state*). Pause at any step and click any object or artifact; nothing resets.

### Forward lifecycle and reverse evidence
Forward walks the stages (named milestone rail, Previous / Next / Play / Pause, 0.25x to 2x). **Reverse evidence is not a reversed animation**: the finished world stays put while the trace answers *why is this trusted / suitable?* back to the request and requester, citing evidence for every step. In a failure it starts from *why is it not trusted?*.

### Failures
TLS: wrong DNS name, expired, untrusted root, wrong EKU, missing issuing CA certificate, revoked, CDP unavailable, certificate installed without its private key. Each halts at the correct step with evidence, the owning role and remediation. Domain Controller faults are listed above.

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
`npm run video` renders `output/certificate-flow-lab-v<version>.mp4` (v0.4.0: `certificate-flow-lab-v0.4.0.mp4`; 1920x1080, 60 fps, H.264, yuv420p, faststart, silent) and the matching `-contact-sheet.jpg`. It drives the canonical scenario state frame by frame, with no screen recording: title, home, a TLS segment, the DC Path A story, reverse evidence, full topology and the outro. Output is git-ignored.

### Deployment
Every push to `main` runs tests, fixture validation, the production build and a base-path smoke test, then deploys GitHub Pages. The footer on the home screen shows the version and commit; `version.json` on the site records the deployed commit.

## Tests
```powershell
npm test                    # unit + integration (Vitest)
npm run test:e2e            # Playwright against installed Microsoft Edge
npm run fixtures:validate   # validates the real certificate/CSR/CRL/chain fixtures
npm run fixtures:generate   # regenerates fixtures (new keys, new thumbprints)
npm run review:visual       # 40 screenshots (1920x1080, 1366x768) + layout checks into screenshots/visual-review/
```

## Limitations and roadmap
See [docs/LIMITATIONS.md](docs/LIMITATIONS.md). Planned: NDES / SCEP device enrollment, CEP / CES enrollment, autoenrollment, AIA and CDP diagnostics, OCSP, smart-card, device and user certificates, client authentication and cross-forest enrollment ([docs/FUTURE_SCENARIOS.md](docs/FUTURE_SCENARIOS.md)). They appear only as a quiet "Coming later" list on the home screen.

## Documentation
[UX layout](docs/UX_LAYOUT.md) · [Visual review](docs/VISUAL_REVIEW.md) · [Architecture](docs/ARCHITECTURE.md) · [Scenario model](docs/SCENARIO_MODEL.md) · [Fixtures](docs/FIXTURES.md) · [Limitations](docs/LIMITATIONS.md) · [Future scenarios](docs/FUTURE_SCENARIOS.md) · [Icon sources](assets/icons/SOURCES.md)
