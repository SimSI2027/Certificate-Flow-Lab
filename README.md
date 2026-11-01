# Certificate Flow Lab

*Interactive certificate issuance, deployment and trust visualization.*

**Live demo: https://simsi2027.github.io/Certificate-Flow-Lab/** · Repository: https://github.com/SimSI2027/Certificate-Flow-Lab

The public demo is a synthetic simulation and is redeployed automatically by GitHub Actions on every stable update to `main`.

> **This is synthetic simulation data.**
> - It is **not connected to any production PKI**, AD CS, Active Directory, DNS or IIS.
> - Every name, identity, IP address and event (SIMSI2027, Jordan, Morgan, PKIOperator, CLIENT01, WEB01, DC01, ...) is invented. `.test` is a reserved TLD and does not resolve.
> - All certificate, CSR, CRL and request-policy fixtures were **generated for this project** by `scripts/generate-fixtures/generate.mjs`. They are real, parseable files that chain only to the synthetic SIMSI2027 root.
> - **No private keys are distributed.** Keys exist only in memory while fixtures are generated.

## Release notes

**v0.5.0: the Website TLS Certificate lesson, redesigned as a story**
- **One story system.** The TLS lesson now uses the same story zones as the Domain Controller lesson: one active zone, one active artifact and one active route, the calm technical plate in light and dark, a collapsed details panel and plain language first. The classic TLS workspace (dashed lanes, five tabs, scrubber, jump menu, legend, Labels and Reset camera) and its renderer were removed.
- **Two acts, 10 milestones, 26 steps.** Act 1 "Get the certificate" (see the problem → plan → key and CSR → submit and issue → install → bind in IIS). Act 2 "Use the certificate" (TLS handshake → build the chain → check the certificate → trusted connection).
- **Accuracy.** Corrections to the old TLS model:
  - The CA receives request 1043 before its policy module evaluates it.
  - `certreq -new -machine` creates the key and the CSR together.
  - The template is the v2 duplicate SIMSI2027WebServer (no v1 name extension), and the built-in WebServer is explained.
  - WEB01 sends the leaf and the Issuing CA certificate; AIA is used only when the intermediate is missing.
  - CertificateVerify proves possession of the key.
  - Session keys, not the certificate, encrypt the traffic.
  - Revocation behaviour is marked configuration-dependent, and renewal before 2027-10-30 is the follow-up.
  Details are in [docs/AUDIT_v0.5.md](docs/AUDIT_v0.5.md).
- **Faults.** Twelve faults: the eight existing ones on their new steps, plus no Enroll permission, template not published, request in user context and the HTTPS binding still on the temporary certificate. Each has its symptom, evidence with its kind, owner, remediation and long-term fix.
- **Learning aids.** Glossary chips for TLS, SNI, CSR, SAN, EKU, KU, AIA, CDP, CRL, CertificateVerify and trust anchor. Parser-backed CSR, certificate, store (WEB01 and CLIENT01) and handshake inspectors. IIS Manager GUI paths explained segment by segment. Reverse evidence in 11 items.
- **Fixtures** were regenerated to the new rules (all thumbprints changed; see [docs/FIXTURES.md](docs/FIXTURES.md)).

**v0.4.1: audited and modernized Domain Controller story**
- **PKI accuracy.** A failed `certreq -accept` no longer looks like a success. With user context, the wrong machine, a lost pending request or a mismatched certificate, the scene shows exactly where DC01's key and pending request are, draws the DC01 link as blocked and gives the reason. Path B says the wizard installs the certificate (there is no accept step). Configuration-dependent statements read as full sentences ending "Depends on your configuration: …". The full audit is in [docs/AUDIT_v0.4.md](docs/AUDIT_v0.4.md).
- **Accessibility.** axe reports zero violations on the home screen and the DC workspace, in light and dark. Every focusable object's accessible name starts with its visible text. There is one main landmark per screen and a skip link.
- **Design.** A calm "technical plate": light and dark themes from one token set (WCAG AA, tested). Each step has a headline on the plate, and the artifact travels its route once per step (none with reduced motion). Copy buttons for commands, thumbprints and PEM copy text only and never run anything. The final card lists the open items, and the home screen has a path picker.
- **Usability.** The URL keeps your place, so a refresh or a shared link reopens the same step. The full topology view is uncluttered.

**v0.4.0:** the Domain Controller story redesign (two paths, conditions, 14 faults, story layout).

### What the Website TLS lesson teaches
- Who is who: **Jordan** (visitor on CLIENT01) only reports the warning; **Morgan** (application owner) runs every command on WEB01 and is the **requester** the CA records; the certificate **subject** is the site name portal.simsi2027.test.
- How WEB01 gets a certificate: `certreq -new -machine` creates the key and a CSR signed with it; the CSR goes to SIMSI2027 Issuing CA 01 over RPC/DCOM; the CA receives it, checks it against SIMSI2027WebServer and creates and signs a **new** certificate with the CSR's public key; `certreq -accept -machine` links it to the key on WEB01; IIS binds it (https · 443 · host name · Require SNI).
- How CLIENT01 comes to trust the site: ClientHello with SNI → the Certificate message (leaf + Issuing CA, never the Root) → CertificateVerify (WEB01 proves it holds the key, which never travels) → chain to the Root already in CLIENT01's store → name, dates, purpose and revocation → Finished. Session keys encrypt the traffic.
- The certificate is not autoenrolled: renew before 2027-10-30.

### What the Domain Controller lesson teaches
- How a Domain Controller gets a KDC-capable certificate when autoenrollment cannot reach the CA, and why that manual route is an exception, not a repair.
- Who is who: the certificate **subject** (DC01.simsi2027.test), the human **operator** (SIMSI2027\PKIOperator) and the **requester** the CA records (PKIOperator on Path A, DC01$ on Path B).
- Where the private key lives: created by `certreq -new -machine` on DC01, waiting in Certificate Enrollment Requests, and linked by `certreq -accept` on the same computer. It never travels.
- That the Issuing CA creates and signs a **new** certificate, which carries the CSR's public key. The offline Root CA is never contacted.
- How each certificate maps to its store: leaf with key in Personal, Issuing CA in Intermediate, Root in Trusted Root. AIA and CDP are separate.

### Run it locally
```powershell
npm install
npm run dev                         # http://127.0.0.1:5183/  (or .\tools\windows\Launch-Demo.ps1 with the native viewer companion)
```
Open **Website TLS Certificate** (or **Domain Controller Manual Enrollment** and pick **Path A** or **Path B**) and press **START FLOW**. Space plays or pauses, ←/→ step, the milestone chips jump, and Escape closes the details panel. Deep links work, for example `?scenario=tls-manual-enrollment&t=19` or `?scenario=dc-manual-certificate-request&path=csr&t=8`.

### Project skills
- `.claude/skills/pki-accuracy-review/` (project-owned, committed): the PKI truth review that runs before every release.
- `frontend-design` (plugin) guided the visual pass, constrained by [docs/UX_LAYOUT.md](docs/UX_LAYOUT.md).
- `web-design-guidelines` (third-party, git-ignored) checked the UI against the Web Interface Guidelines.

## v0.4.0: Domain Controller Manual Enrollment, redesigned as a story

Open the app and pick a scenario.

| Scenario | Story |
|----------|-------|
| **Website TLS Certificate** (v0.5.0 story) | Jordan sees a certificate warning (a temporary self-signed certificate) and reports it. Morgan, the application owner, creates the key and CSR on WEB01, submits to the Issuing CA, accepts the new certificate and binds it in IIS; then CLIENT01 follows the TLS handshake, builds the chain to its trusted Root and checks name, dates, purpose and revocation. Two acts, 10 milestones, 26 steps, 12 faults. Zones: CLIENT01 · WEB01 key and request · Issuing CA · WEB01 install and IIS · On the wire · CLIENT01 validation and trust store. |
| **Domain Controller Manual Enrollment** | DC01 has no certificate with KDC Authentication because autoenrollment could not reach the Issuing CA. Choose a path. **Path A, Manual CSR transfer** (24 steps, 10 milestones): `certreq -new -machine` creates the key and the signed CSR on DC01; the CSR alone travels through PKI-TRANSFER01; PKIOperator submits it for the controlled template DCOfflineKerberosAuth; a certificate manager approves; ICA01 creates and signs a new certificate; the public return package comes back; the Root is verified by thumbprint; the Root and Issuing CA certificates are installed; and `certreq -accept` runs on the original DC01. **Path B, Certificates MMC enrollment** (11 steps, 6 milestones): DC01 can reach ICA01, so the Certificates (Local Computer) wizard enrolls as SIMSI2027\DC01$ for KerberosAuthentication. |

The DC story is drawn as six fixed zones: DC01, request package, controlled transfer, Issuing CA, return package, and the DC01 certificate stores. An Offline Trust box and a PKIWEB01 strip complete the picture. The rule is **one active zone, one active artifact, one active route**. The private key stays in a DC01 key vault ("Certificate Enrollment Requests") until `certreq -accept` links it across a "same computer, never on the network" lane. The Root CA only ever appears as a muted "signed the Issuing CA certificate earlier (offline)" link.

**Conditions** (Path A): *Trust certificates missing on DC01* (default, an exceptional condition for this lesson) or *Trust certificates present via AD (Enterprise store)*, which skips the two installation steps ("Already present — skipped").
**Faults** (separate selector): RPC/DCOM blocked, wrong template for the handoff, no Enroll permission, template not published, pending with no approver, user context, accepted on the wrong machine, pending request lost, Root thumbprint mismatch, CDP unreachable (verdict withheld), KDC Authentication EKU missing, SAN without the domain name, key mismatch and expired. Each one shows its symptom, the evidence with its kind, the owner, the remediation, whether the flow stops, and the long-term fix.

**Controls:** the header holds Home, the path switch (Manual CSR transfer | Certificates MMC enrollment), Condition, Fault, START FLOW (replaced by "Step n of N · title"), Forward flow | Reverse evidence, Show full topology and the guided tour (8 stops). The bottom bar holds named milestone chips, Previous, Play/Pause, Next, Restart and the speed. Keyboard: Space plays or pauses, ←/→ step, Escape closes the details panel.

**Details panel** (collapsed by default): Plain language · Technical details (parser-backed CSR, certificate and store inspectors, with Subject, Operator and Requester as three separate fields) · Command explanation (every token explained; "Shown for learning; never executed by this simulator.") · Raw artifact on demand · Evidence · Troubleshoot (moves up and opens when a fault stops the flow).

**What the screens look like (described in words).** Before START FLOW: six dashed placeholder zones and the Offline Trust box. While stepping: one zone outlined in blue with a dark actor badge ("Operator acts", "Cert manager acts", "System acts") and a single coloured artifact card, for example a blue CSR envelope reading "public key + names · signed by DC01 key". Finished zones keep small clickable chips of their earlier artifacts. At the accept step an amber dashed lane runs from the DC01 key vault to the Personal store. In the store cards the leaf shows "private key on DC01 ✓", while the Issuing CA and Root show "no private key here" and their source tags. A failure draws the route red, dashed and crossed. The last step shows a card: "Suitable now; root cause still open".

Manual enrollment is an **exception, not a repair**: the last step lists the open items (the RPC/DCOM firewall rule, autoenrollment Group Policy and permissions, trust distribution, CDP/AIA reachability, replacing and revoking the manual certificate, unpublishing the temporary template).

### The Website TLS lesson on screen (v0.5.0)
**Header:** Home · title · START FLOW (replaced by "Step n of 26 · title") · Forward flow | Reverse evidence · Fault · Show full topology · Guided tour (10 stops). **Bottom bar:** the milestone chips grouped under "Act 1: Get the certificate" and "Act 2: Use the certificate", then Previous · Play/Pause · Next · Restart · Speed.
**Details panel** (collapsed by default: what happens, why it is needed, who acts, what moves): 1 Plain language (eight questions, with glossary chips) · 2 Technical details (Visitor, Subject, Operator and Requester as separate fields; CSR, certificate, WEB01 and CLIENT01 store and handshake inspectors) · 3 Command or GUI path (every token or IIS Manager segment explained; "Shown for learning; never executed by this simulator."; copy only) · 4 Raw artifact · 5 Evidence · 6 Troubleshoot (moves up when a fault stops the flow). Pause at any step and click any object; nothing resets.
**What you see:** the key vault on WEB01 from `certreq -new` to `-accept`; the WEB01 stores and the IIS site card in zone 4; the TLS messages in indigo on the wire lane under the zones; CLIENT01's Trusted Root store in zone 6; the PKIWEB01 strip (AIA and CDP, separate) only while the chain and revocation are checked.

### Forward lifecycle and reverse evidence
Forward walks the steps (named milestone rail, Previous / Next / Play / Pause, 0.5x to 2x). **Reverse evidence is not a reversed animation**: the finished world stays put while the trace answers *why is this trusted / suitable?* back to the request and requester, citing evidence for every step. In a failure it starts from *why is it not trusted?*.

### Failures
TLS (in lesson order): no Enroll permission, template not published, request in user context, certificate installed without its private key, HTTPS binding still on the temporary certificate, Issuing CA certificate missing (with an unreachable AIA), Root not trusted on CLIENT01, wrong name, expired, wrong purpose (Client Authentication only), revoked, CRL not reachable. Each halts at its step with evidence, the owning role and remediation. Domain Controller faults are listed above.

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
`npm run video` renders `output/certificate-flow-lab-v<version>.mp4` (v0.5.0: `certificate-flow-lab-v0.5.0.mp4`; 1920x1080, 60 fps, H.264, yuv420p, faststart, silent) and the matching `-contact-sheet.jpg`. It drives the canonical scenario state frame by frame, with no screen recording: title, home, the TLS story (26 steps, both acts), the DC Path A story, reverse evidence, full topology and the outro. Output is git-ignored.

### Deployment
Every push to `main` runs tests, fixture validation, the production build and a base-path smoke test, then deploys GitHub Pages. The footer on the home screen shows the version and commit; `version.json` on the site records the deployed commit.

## Tests
```powershell
npm test                    # unit + integration (Vitest)
npm run test:e2e            # Playwright against installed Microsoft Edge
npm run fixtures:validate   # validates the real certificate/CSR/CRL/chain fixtures
npm run fixtures:generate   # regenerates fixtures (new keys, new thumbprints)
npm run review:visual       # 252 screenshots (1920x1080, 1366x768, light + dark) + layout checks into screenshots/visual-review/
                            # npm run test:e2e also runs the axe accessibility gate (tests/e2e/a11y.spec.js)
```

## Limitations and roadmap
See [docs/LIMITATIONS.md](docs/LIMITATIONS.md). Planned: NDES / SCEP device enrollment, CEP / CES enrollment, autoenrollment, AIA and CDP diagnostics, OCSP, smart-card, device and user certificates, client authentication and cross-forest enrollment ([docs/FUTURE_SCENARIOS.md](docs/FUTURE_SCENARIOS.md)). They appear only as a quiet "Coming later" list on the home screen.

## Documentation
[UX layout](docs/UX_LAYOUT.md) · [Visual review](docs/VISUAL_REVIEW.md) · [v0.5 audit](docs/AUDIT_v0.5.md) · [v0.4 audit](docs/AUDIT_v0.4.md) · [Architecture](docs/ARCHITECTURE.md) · [Scenario model](docs/SCENARIO_MODEL.md) · [Fixtures](docs/FIXTURES.md) · [Limitations](docs/LIMITATIONS.md) · [Future scenarios](docs/FUTURE_SCENARIOS.md) · [Icon sources](assets/icons/SOURCES.md)
