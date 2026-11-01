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

## Presentation rules (v0.3.0)
- Default to the scenario-first focused flow; full topology is optional, never the initial view.
- The offline Root CA belongs in the far-right Offline Trust zone and must never appear in the leaf (or Domain Controller) issuance path.
- Every stage needs a plain-language explanation before technical details.
- Paused artifacts stay clickable and inspectable; selecting never resets the scenario position.
- Official icons must follow their source terms and be recorded in assets/icons/SOURCES.md; custom icons must never be represented as official Microsoft icons.
- Stable releases must update main and the GitHub Pages demo.

## Release discipline (restated v0.4.0)
- Never commit private keys, PFX/P12, credentials, secrets, caches, generated video, screenshots, dist, node_modules or .lnk files; keep .gitignore covering them.
- Fixture generation stays reproducible from scripts/generate-fixtures/generate.mjs; signing keys exist only in memory during generation.
- When an old assertion encodes a superseded model, update it deliberately in the same commit and say why in the commit message.
- The TLS scenario (tls-manual-enrollment) and the local companion must keep working unchanged.
- Annotated tags only; never move a published tag; never force push. Completion is reported only after the live Pages version.json commit equals newest origin/main.
- No root clutter. Do not use /ultrareview or additional agents/subagents unless explicitly requested.

## Domain Controller truth rules (v0.4.0)
1. Certificate subject: DC01.simsi2027.test.
2. Human operator: SIMSI2027\PKIOperator.
3. Path A CA requester record: SIMSI2027\PKIOperator (submission authenticated from PKI-TRANSFER01).
4. Path B CA requester record: SIMSI2027\DC01$ (direct machine enrollment uses the computer identity).
5. Subject, Operator and Requester are three separate labelled fields wherever identity appears.
6. `certreq -new` on DC01 creates the machine key pair and the signed CSR in ONE operation.
7. MachineKeySet = TRUE; Exportable = FALSE; the private key remains on DC01.
8. The pending request (holding the private key) lives in Local Computer\Certificate Enrollment Requests until accepted.
9. The CSR contains the public key and requested identity/extensions/attributes, never the private key.
10. DC01's new private key signs the CSR (proof of possession).
11. The Issuing CA does not sign the CSR. It creates and signs a NEW certificate containing the approved identity and the CSR public key. Never write that the CA signs the CSR in UI text.
12. The offline Root CA is never contacted for leaf issuance and never signs the leaf.
13. Path A template DCOfflineKerberosAuth (display "SIMSI2027 DC Offline Kerberos Authentication", organization-specific, simulated): Subject Name = Supply in the request; Enroll only for the "PKI Operators" group; CA certificate manager approval; no Autoenroll; published on ICA01 only for the duration of the change.
14. The UI warns: a Supply-in-the-request template with an authentication EKU lets an enrollee name any identity and is a privilege-escalation path (commonly catalogued as "ESC1") unless enrollment rights are tightly restricted, manager approval is required, publication is temporary and issuance is audited.
15. Path B uses KerberosAuthentication: identity built from AD; depends on DC01→ICA01 RPC/DCOM connectivity and DC01$ Read+Enroll.
16. DomainControllerAuthentication appears only as a comparison card: a different valid profile (Client Auth, Server Auth, Smart Card Logon; SAN with DC DNS name and DC object GUID) that lacks the KDC Authentication EKU and the domain-name SAN this lesson's strict-KDC check expects. Not presented as universally wrong or right.
17. Root and Issuing CA certificates are pre-existing public chain certificates, never created by the leaf request.
18. Root → Local Computer\Trusted Root Certification Authorities.
19. Issuing CA → Local Computer\Intermediate Certification Authorities.
20. DC01 leaf → Local Computer\Personal, with matching private key.
21. Only the leaf shows a private-key association on DC01.
22. `certreq -accept` runs only on the original DC01 and links the leaf to the existing pending private key.
23. Copying a CER to another machine neither copies nor recreates the private key.
24. In this controlled workflow, verify/install required Root and Issuing CA certificates BEFORE accepting the leaf. Exact certreq behavior may depend on response format, existing stores and Windows configuration (mark as configuration-dependent; never claim -accept or a .p7b import trusts a root).
25. AIA (issuer certificate location) and CDP (CRL location) remain distinct concepts, URLs, connectors and evidence items.
26. Manual enrollment is an exception, not a permanent repair for firewall, autoenrollment, trust distribution, replication, template or publication problems.
27. Configuration-dependent claims are marked "Depends on your configuration": RPC/DCOM ports, template permissions and defaults, Enterprise/Group Policy distribution, event IDs, service pickup timing, revocation enforcement.

## DC story presentation rules (v0.4.0)
- ONE ACTIVE ZONE • ONE ACTIVE ARTIFACT • ONE ACTIVE ROUTE.
- The Root CA is never an active-flow endpoint (only a muted "signed the Issuing CA certificate earlier (offline)" history link).
- The operator is a badge on the acting zone, not a lane.
- The private key is never on a transport route.
- Plain language before technical detail.
- Selection never moves the timeline.
- Every command shows "Shown for learning; never executed by this simulator."
- Configuration-dependent claims carry the marker "Depends on your configuration".

## Release process and project skills (v0.4.1)
- Run the project skill `pki-accuracy-review` (`.claude/skills/pki-accuracy-review/SKILL.md`, committed) before every release and whenever a certificate scenario changes; record findings in the release's audit document and fix every Critical/High/Medium before tagging.
- The `frontend-design` plugin may guide visual work, but it is always constrained by docs/UX_LAYOUT.md (zone geometry, disclosure rules, one active zone/artifact/route, Root CA never an endpoint, private key never on a route) and by the design tokens in src/ui/styles.css (light and dark must stay WCAG AA; tests/unit/theme-contrast.test.js).
- `web-design-guidelines` is a third-party skill installed locally (`.claude/skills/web-design-guidelines/`, `skills-lock.json`); both are git-ignored and never committed.
- Release target rule: if the planned tag already exists on origin, release the next patch version instead. Never edit, move, delete or recreate a published tag.
- Release gate: fixtures:validate, npm test, npm run test:e2e (includes the axe gate: zero serious/critical violations), npm run review:visual (light and dark), build, pages-smoke, npm run video, PowerShell 5.1 parse checks; then push main, tag, and verify that the live version.json commit equals origin/main.

## Website TLS truth rules (v0.5.0)
1. Roles are separate labelled concepts. Visitor = SIMSI2027\Jordan on CLIENT01 (10.20.10.45): reports the problem, never requests a certificate. Application owner / Operator = SIMSI2027\Morgan: runs the commands on WEB01. Requester recorded by the CA = SIMSI2027\Morgan (submission authenticated as Morgan). Certificate subject = portal.simsi2027.test (the website name), not WEB01 and not Morgan.
2. Web server = WEB01 (10.20.20.30) running IIS; the site name portal.simsi2027.test resolves in DNS to 10.20.20.30.
3. Template: organization duplicate "SIMSI2027 Web Server" (template name SIMSI2027WebServer, v2, synthetic OID 1.3.6.1.4.1.311.21.8.2027.1.1, version 100.4): Subject Name = Supply in the request; EKU Server Authentication only; Key Usage Digital Signature + Key Encipherment; RSA 2048 minimum; Enroll for the group "Web Server Certificate Requesters" (Morgan is a member); issued without manager approval in this lab. The built-in WebServer template is version 1, grants Enroll only to Domain Admins and Enterprise Admins by default, and organizations commonly duplicate it. Permissions and approval are marked "Depends on your configuration".
4. `certreq -new -machine` on WEB01 creates the key pair AND the signed CSR together in machine context (MachineKeySet = TRUE). Exportable = FALSE in this lab; web farms sometimes need exportable keys (depends on your configuration). The pending request (with the private key) sits in Local Computer\Certificate Enrollment Requests until accepted.
5. The CSR contains the public key, the requested names (SAN dNSName portal.simsi2027.test) and the requested extensions; never the private key. WEB01's new private key signs the CSR (proof of possession).
6. Submission: `certreq -submit -config "ICA01.simsi2027.test\SIMSI2027 Issuing CA 01"` from WEB01 over RPC/DCOM, authenticated as Morgan. The CA receives the request FIRST, then its policy module evaluates template publication, Enroll permission, supplied names and key size. Policy evaluation is never shown before the CA has received the request.
7. The Issuing CA never signs the CSR. It creates a NEW certificate with the approved names and the CSR public key and signs it with the Issuing CA private key. SIMSI2027-ROOTCA is offline, never contacted, never signs the leaf and is never an active-flow endpoint.
8. `certreq -accept -machine` on WEB01 links the certificate to the existing private key and places it in Local Computer\Personal. IIS Manager "Create Certificate Request / Complete Certificate Request" is the GUI equivalent (mentioned in the panel only).
9. WEB01 already holds the Issuing CA certificate (Intermediate Certification Authorities) and the Root (Trusted Root Certification Authorities) through AD distribution (Enterprise store). The leaf in Personal is the only certificate with a private key on WEB01.
10. IIS binding: site → Bindings → Add/Edit: Type https, IP All Unassigned, Port 443, Host name portal.simsi2027.test, Require Server Name Indication, SSL certificate = the new certificate. It replaces the temporary self-signed certificate that caused the warning. The private key never leaves WEB01; IIS (HTTP.sys) uses it in place.
11. Handshake (TLS 1.3 taught; TLS 1.2 differences in Technical details): ClientHello with SNI portal.simsi2027.test → ServerHello → server Certificate message with the leaf and the Issuing CA certificate (the Root is normally not sent; a sent Root is not trusted because it was sent) → CertificateVerify: WEB01 signs the handshake transcript with the private key; CLIENT01 verifies it with the leaf public key (proof that WEB01 holds the key) → Finished. In TLS 1.3 the Certificate message is encrypted. The private key is never transmitted.
12. Chain building on CLIENT01: leaf → Issuing CA (from the handshake; AIA caIssuers fetch from PKIWEB01 only when the intermediate is missing) → Root in CLIENT01's Trusted Root store (delivered by AD/Group Policy to the domain-joined CLIENT01; depends on your configuration). Each signature is verified with the issuer's public key.
13. Certificate checks: the SAN dNSName must match the host the visitor typed (modern browsers ignore the subject CN for name matching); validity dates at the simulation clock; EKU Server Authentication; Key Usage suitable.
14. Revocation: CDP over HTTP to PKIWEB01, CRL signed by the Issuing CA, serial not listed. Revocation behavior differs by browser and client policy (some browsers do not perform online CRL checks for most certificates); the simulated client follows Windows chain-engine behavior with revocation checking enabled. Marked "Depends on your configuration". OCSP is out of scope for this lesson (future extension).
15. AIA and CDP stay distinct (separate URLs, connectors and evidence items).
16. The certificate does not encrypt the website traffic by itself: it proves the server's identity and authenticates the key exchange; session keys from the key exchange encrypt the traffic.
17. Renewal: this certificate is not autoenrolled; Morgan must renew before 2027-10-30. The final step lists that follow-up.

## Website TLS story presentation (v0.5.0)
- The TLS lesson (id `tls-manual-enrollment`) uses the same story-zone system as the DC lesson: ONE ACTIVE ZONE • ONE ACTIVE ARTIFACT • ONE ACTIVE ROUTE, calm technical plate, collapsed details panel, plain language first.
- Two acts above the rail: Act 1 "Get the certificate" (milestones 1–6), Act 2 "Use the certificate" (milestones 7–10).
- The private key is never on a route and never in the "On the wire" zone. The Root CA is never an endpoint.
- The classic TLS workspace (dashed lanes, five tabs, scrubber, jump select, legend bar, Labels / Reset camera) and the classic Scene renderer were removed in v0.5.0.

## Future expansion points to preserve
NDES, SCEP, CEP, CES, autoenrollment, AIA retrieval, CDP/CRL validation, OCSP, smart-card, device and user certificates, client authentication, cross-forest enrollment.

## Learning film rules (v0.6.0)
- The learning film (`learning-film.html`, `src/film-learning/`) is separate from the interactive app and from the app film (`film.html`, `src/film/`). It reuses the fixtures, the parser, the synthetic constants and the icon family, and never imports app UI state.
- `window.renderAt(t)` must stay a pure function of `t`. `filmStateAt(t)` in `state.js` is the one canonical film state, and `render.js` only maps it onto the DOM. No `Date.now`, `performance.now`, timers, CSS animations/transitions or `Math.random` in the film path. The preview may pace `renderAt` with `requestAnimationFrame`; capture always sets the time.
- Timing lives only in `timeline.js` (shots, captions, cues, camera keys) and `tokens.js` (motion tokens). Every caption window meets the 0.3 s per word + 0.5 s rule, and every abbreviation (CSR, CA, SAN, EKU, AIA, CDP, CRL, TLS) is expanded at first use. Both are unit-tested.
- Film PKI invariants: the private key never moves and is never on a route; the CSR stays an input next to a separate new certificate that the Issuing CA signs (no morph); the Root CA is never contacted and never a route endpoint; at most one route is active; AIA and CDP never appear together; only the leaf carries a key badge; session keys, not the certificate, encrypt the traffic.
- Every certificate, CSR and CRL value shown in the film comes from `filmFacts(model)`. Simulated policy and environment values are labelled as such, and configuration-dependent statements carry "Depends on your configuration".
- Film names follow the Website TLS truth rules (Jordan = visitor; Morgan = owner, operator and requester).
- Never edit source files while a render runs. The export server disables HMR and watching, but a fresh render after the last edit is the release artifact.
- Generated films, contact sheets and stills stay git-ignored (`output/*`, `screenshots/`). Before a film release, run `npm run video:learning:stills` and review the draft contact sheet and the boundary frames; then run the full render and check it with ffprobe (H.264, 1920x1080, 60 fps, yuv420p, no audio, moov before mdat).
