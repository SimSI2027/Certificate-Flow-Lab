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

## Future expansion points to preserve
NDES, SCEP, CEP, CES, autoenrollment, AIA retrieval, CDP/CRL validation, OCSP, smart-card, device and user certificates, client authentication, cross-forest enrollment.
