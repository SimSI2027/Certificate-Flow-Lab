# Limitations (v0.1.0)

- **Simulation, not enrollment.** Nothing contacts a CA, Active Directory, DNS or any network service. Protocol names on arrows (RPC/DCOM, HTTP, TLS) are *conceptual labels*; no packets are produced.
- **Synthetic identities and environment.** SIMSI2027 names, IPs, groups and template permissions are invented. Template settings (v100.4, 1-year validity, 6-week renewal, no approval) are plausible but not read from a real CA. The template OID is synthetic.
- **Real files, simulated checks around them.** Certificate, CSR and CRL contents and their signatures are real and verified in the browser. The evaluation clock, CLIENT01's trust store, AIA/CDP HTTP results, and WEB01's key store are simulated inputs.
- **Simplified validation.** The checks are SAN name match, validity dates, Server Authentication EKU, signature verification, trust-anchor membership and CRL lookup. It does not implement full RFC 5280 path validation (name constraints, policy mapping, key-usage enforcement along the path, CRL scope/delta CRLs, OCSP, certificate transparency, HSTS or browser-specific behavior).
- **Browser error strings are typical Chromium-style codes**; real wording and behavior vary by browser, version and policy (for example, some clients soft-fail revocation).
- **One scenario.** Only `tls-manual-enrollment` is implemented. Nine further scenario identifiers are reserved (see `FUTURE_SCENARIOS.md`).
- **Fault variants are single-fault.** Combined faults are not modeled. Stages after a halting fault are intentionally unreachable.
- **No private keys exist** in the project, so the "key held on WEB01" state is a modeled marker only.
- **Native Windows certificate viewing is local-only and CER-only** (allowlisted fixtures via the loopback companion). There is no certificate store access and no enrollment commands.
- **Layout/accessibility.** The scene is an SVG; elements are keyboard-focusable and labeled, but the diagram as a whole is a visual tool and not fully screen-reader narrated. The Overview/Details/Evidence panels carry the same information as text.
- **Tested with Microsoft Edge (Chromium) via Playwright.** Other browsers are expected to work but are not part of the automated suite. Browser download events are cancelled in Edge headless mode in this environment, so the download test verifies the link, the file name and the served bytes rather than a saved file.
- **Launcher cleanup.** Ctrl+C and normal exit stop Vite and the companion (process trees via taskkill, in try/finally). The companion also exits by itself if its launcher disappears. Terminating the launcher externally with extreme force (or a crash of the console host) can bypass cleanup and leave Vite running; the next launch reuses it, or `-StopStale` stops it.
- **Public demo is static.** GitHub Pages serves the production bundle; the native Windows viewer, FFmpeg video export and companion exist only locally. The film is rendered with headless Edge/Chromium, so pixel output can differ slightly across machines even though timing/state are deterministic.
- **Native viewer** opens the CER via Explorer's registered handler, so the exact dialog depends on the Windows installation.

## v0.3.0 additions
- **Domain Controller scenario is educational.** The KerberosAuthentication template, its purposes, permissions and the INF are synthetic and plausible, not read from a CA. Real Domain Controller templates usually build subject and SAN from Active Directory; the simulation lets the request supply them and says so. Exact settings depend on your AD CS configuration.
- **Manual enrollment does not replace investigating autoenrollment.** The simulation ends on that point.
- **Icons are custom** (no official Microsoft icons); they are not a Microsoft product representation.
- **Auto-fit zoom and layout** are tuned for the two shipped scenarios; very long names are compressed with SVG text-length adjustment.
- **Video** renders with headless Edge/Chromium; pixel output may differ slightly across machines.


## v0.4.0 Domain Controller story
- **Nothing is executed.** Every `certreq`, `certutil`, `Get-FileHash` and console path is shown for learning only ("Shown for learning; never executed by this simulator."). No real CA, Active Directory, store or DNS is contacted.
- **Configuration-dependent behaviour** is marked "Depends on your configuration": RPC/DCOM port ranges and firewall rules, template permissions and their defaults, Enterprise (AD) and Group Policy distribution of CA certificates, event IDs and event details, autoenrollment service pickup timing, and whether relying parties enforce revocation.
- **certreq behaviour is simplified.** The exact `certreq -accept` outcome depends on the response format (CER or PKCS #7), on what the stores already hold and on Windows configuration. The simulator never claims that `-accept` or importing a `.p7b` makes a Root trusted.
- **Approvals, permissions, publication, request records, the change ticket and the PKI-TRANSFER01 transfer are simulated** and labelled "Simulated environment". The Root thumbprint check compares a real computed thumbprint with a simulated change record.
- **DCOfflineKerberosAuth is a simulated, organization-specific template.** The ESC1 discussion is simplified: it names the risk and the four controls; it is not a complete AD CS hardening guide.
- **DomainControllerAuthentication** appears only as a comparison card, measured against this lesson's strict-KDC expectation; it is not judged in general.
- **Path B request file:** the wizard builds its request in memory. `dc01-mmc-request.der` exists only so it can be inspected.
- **Fault certificates are shared by both paths** and carry the Path A subject and key (see SCENARIO_MODEL.md, v0.4.0 deviations).
- **Fixture regeneration changes every thumbprint**, because keys are never persisted.


## v0.4.1
- **Dark mode covers the home screen and the DC story.** The TLS classic workspace stays light in both schemes, so its layout and tests are unchanged.
- **Copy buttons use the browser clipboard API.** Where clipboard access is blocked, the button says "Copy failed" and the text can be selected by hand. Nothing is ever executed.
- **The artifact travel animation is decorative.** It plays once per step (750 ms) and never changes state; reduced-motion users see instant state changes.
- **Regenerating fixtures rotates every key.** Signing keys are never persisted, so `npm run fixtures:generate` changes every thumbprint. The release keeps the committed v0.4.0 fixture set; regeneration was verified in a scratch run and then reverted.
