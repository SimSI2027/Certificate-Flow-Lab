# Limitations (v0.1.0)

- **Simulation, not enrollment.** Nothing contacts a CA, Active Directory, DNS or any network service. Protocol names on arrows (RPC/DCOM, HTTP, TLS) are *conceptual labels*; no packets are produced.
- **Synthetic identities and environment.** SIMSI2027 names, IPs, groups and template permissions are invented. Template settings (v100.4, 1-year validity, 6-week renewal, no approval) are plausible but not read from a real CA. The template OID is synthetic.
- **Real files, simulated checks around them.** Certificate, CSR and CRL contents and their signatures are real and verified in the browser. The evaluation clock, CLIENT01's trust store, AIA/CDP HTTP results, and WEB01's key store are simulated inputs.
- **Simplified validation.** The checks are SAN name match, validity dates, Server Authentication EKU, signature verification, trust-anchor membership and CRL lookup. It does not implement full RFC 5280 path validation (name constraints, policy mapping, key-usage enforcement along the path, CRL scope/delta CRLs, OCSP, certificate transparency, HSTS or browser-specific behavior).
- **Browser error strings are typical Chromium-style codes**; real wording and behavior vary by browser, version and policy (for example, some clients soft-fail revocation).
- **One scenario.** Only `tls-manual-enrollment` is implemented. Nine further scenario identifiers are reserved (see `FUTURE_SCENARIOS.md`).
- **Fault variants are single-fault.** Combined faults are not modeled. Stages after a halting fault are intentionally unreachable.
- **No private keys exist** in the project, so the "key held on WEB01" state is a modeled marker only.
- **No native Windows Certificate Viewer integration**, no certificate store access, no PowerShell enrollment commands.
- **Layout/accessibility.** The scene is an SVG; elements are keyboard-focusable and labeled, but the diagram as a whole is a visual tool and not fully screen-reader narrated. The Overview/Details/Evidence panels carry the same information as text.
- **Tested with Microsoft Edge (Chromium) via Playwright.** Other browsers are expected to work but are not part of the automated suite. Browser download events are cancelled in Edge headless mode in this environment, so the download test verifies the link, the file name and the served bytes rather than a saved file.
- **Launcher.** `Launch-Demo.ps1` stops the server it started on Ctrl+C. A hard kill of the launcher window leaves the server running; the next launch detects and reuses it.
- **Dev server only.** v0.1 is run locally; there is no hosted deployment.
