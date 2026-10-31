# Certificate Flow Lab

*Interactive certificate issuance, deployment and trust visualization.*

Version 0.1.0 — one complete Microsoft-style enterprise TLS enrollment flow, from a visitor's browser warning to a trusted HTTPS connection.

> **This is synthetic simulation data.**
> - It is **not connected to any production PKI** or any real Active Directory.
> - Every name, identity, IP address and event (SIMSI2027, Jordan, Morgan, CLIENT01, WEB01, …) is invented. `.test` is a reserved TLD and does not resolve.
> - All certificate, CSR and CRL fixtures were **generated for this project** by `scripts/generate-fixtures/generate.mjs`. They are real, parseable X.509 files, but they chain only to the synthetic SIMSI2027 root.
> - **No private keys are distributed.** Keys exist only in memory while fixtures are generated and are never written to disk.

## The story

1. Jordan (a normal visitor, `SIMSI2027\Jordan` on CLIENT01) opens `https://portal.simsi2027.test`; the browser reports a certificate problem; Jordan reports it.
2. Morgan (`SIMSI2027\Morgan`, the application owner) starts the lifecycle. **The visitor never enrolls.**
3. WEB01 generates a private key locally, builds a CSR, and the request passes the **WebServer** template policy gate.
4. **SIMSI2027-ICA01** (the issuing CA) evaluates and signs the certificate. The offline **SIMSI2027-ROOTCA** does not issue it.
5. The certificate returns to WEB01, is installed against its existing private key, and bound in IIS (`portal.simsi2027.test:443`).
6. CLIENT01 retries, builds the chain (AIA), checks name, dates, EKU, signatures, root trust and revocation (CDP/CRL), and trusts the connection.

## Install

Requirements: Windows with Node.js 18+ and npm (no Administrator rights needed). A browser such as Edge or Chrome.

```powershell
npm install
```

## Run

Easiest (Windows PowerShell 5.1+):

```powershell
.\tools\windows\Launch-Demo.ps1
```

The launcher verifies Node/npm, installs dependencies if missing, starts (or reuses) the server at `http://127.0.0.1:5183/`, opens your browser and stays open until **Ctrl+C**. It refuses to run if an unrelated program is using the port.

Optional desktop-style shortcut (machine-specific, ignored by Git):

```powershell
.\Install-Shortcuts.ps1          # creates "Certificate Flow Lab.lnk" in the project folder
.\Install-Shortcuts.ps1 -Desktop # also copies it to your Desktop
```

Or with npm: `npm run dev`. Production build: `npm run build` then `npm run preview`.

## Using it

- **Play / Pause / Step / Restart**, the **timeline scrubber**, **Jump to** and speeds **0.25x–2x** all drive one scenario position. Everything on screen is derived from the canonical state shown in the *Overview* panel.
- **Forward lifecycle** plays Need → Request → Policy → Issue → Install → Bind → Connect → Validate → Trust.
- **Reverse evidence** is *not* a rewound animation. The world stays in its final state and the *Evidence* panel walks a trace: *Why is the site trusted? → leaf passed policy → issuing CA signature validated → chain reached the root → revocation acceptable → … → visitor reported the problem.* Each step cites real check results and artifacts. In a failure scenario the trace starts from *why is it NOT trusted*.
- **Failure** selector: wrong DNS name, expired certificate, untrusted root, wrong EKU, missing issuing CA certificate, revoked certificate, CDP unavailable, certificate installed without matching private key. Progression halts at the stage where the real evidence fails; the Overview explains what failed, the evidence, what stays healthy, remediation and the owning role.
- **Click anything**: people, computers, the template gate, CAs, PKIWEB01, arrows (flows) and moving artifacts show details. The source IP is shown as context only — never as enrollment authority.
- **Guided tour**: a 17-step tour. Any interaction pauses it; it resumes after 25 seconds of inactivity, and ends by returning control to the visitor.
- **Labels** toggle, **Reset camera** (drag to pan, wheel to zoom).

### Inspecting artifacts

Click a gold/blue chip (CSR, CERT, ICA CERT, ROOT CERT, CRL) or a card in the chain. The *Inspector* panel parses the real fixture file in the browser and shows the certificate tabs (General, Details, Certification Path, SAN, EKU, Key Usage, Basic Constraints, AIA, CDP, Thumbprints, PEM, Raw ASN.1 summary, Issuance history, Matching CSR), CSR tabs or CRL tabs. Public files (CER/DER, PEM, CSR, CRL, chain) can be downloaded. AIA (where to get the issuing CA certificate) and CDP (where to get the CRL) are kept separate everywhere.

## Tests

```powershell
npm test                    # unit + integration (Vitest)
npm run test:e2e            # Playwright (uses installed Microsoft Edge; no download)
npm run fixtures:validate   # validates the real certificate/CSR/CRL/chain fixtures
npm run fixtures:generate   # regenerates fixtures (new keys, new thumbprints)
```

## Current limitations

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md). In short: simulation only, one scenario, simplified policy/CA behavior, no native Windows certificate viewer, no live Active Directory or CA connectivity, and revocation is CRL-only.

## Planned expansion

NDES / SCEP device enrollment, CEP/CES enrollment, autoenrollment, AIA chain retrieval, CDP/CRL validation, OCSP validation, smart-card logon, client authentication and cross-forest enrollment. The engine, entities, flows, faults and inspectors are scenario-driven so these can be added as new scenario files. See [docs/FUTURE_SCENARIOS.md](docs/FUTURE_SCENARIOS.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Scenario model](docs/SCENARIO_MODEL.md)
- [Fixtures](docs/FIXTURES.md)
- [Limitations](docs/LIMITATIONS.md)
- [Future scenarios](docs/FUTURE_SCENARIOS.md)
