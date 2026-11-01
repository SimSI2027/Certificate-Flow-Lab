# Audit of the v0.5 Website TLS story (release v0.5.0)

## Release state at the start of the run
- Branch `main`, clean. Last commit `004de7d` (v0.4.1). `package.json` 0.4.1. Live `version.json`: `{"version":"0.4.1","commit":"004de7d8…"}`, equal to `origin/main`.
- `git ls-remote --tags origin "v0.5*"` returned nothing, so the **release target is v0.5.0**. `v0.4.0` and `v0.4.1` are published and were never touched.

## Baseline (before any change)
`npm ci` OK · `fixtures:validate` **102 PASS** · unit + integration **216/216** (12 files) · Playwright **60/60** (including 16 axe screens) · `review:visual` **136/136** screens without problems · build OK (JS 543.8 kB, gzip 156.7 kB) · Pages smoke all PASS.

## Skills used
| Skill | Availability | How it ran |
|---|---|---|
| `pki-accuracy-review` (project, committed) | Listed in the session | **Invoked as a skill.** The session loaded its pre-v0.5.0 text; the committed SKILL.md (updated in checkpoint 1 with the "Website TLS sweep") was followed for steps 2–8. |
| `frontend-design:frontend-design` (plugin) | Listed in the session | **Invoked as a skill** before the visual pass; constrained by docs/UX_LAYOUT.md and the existing tokens. |
| `web-design-guidelines` (third-party, git-ignored) | Listed in the session | **Invoked as a skill.** No WebFetch tool and no subagents in this run, so its rules file (`vercel-labs/web-interface-guidelines/main/command.md`) was downloaded with a plain HTTP GET and applied to `src/ui/tls-panel.js`, `src/ui/story-app.js`, `src/views/story-scene.js`, `src/ui/styles.css` and `index.html`. |

## Accuracy corrections made to the old TLS model
The classic v0.4 TLS lesson (19 stages) taught several things that the v0.5.0 rules correct:
1. **Policy before receipt.** The old order was `policy` (template gate) before `ca-receive`. The CA now receives request 1043 first (`t-submit`), then its policy module evaluates (`t-policy`).
2. **Key and CSR as separate steps.** `keygen` and `csr` were two steps. `certreq -new -machine` now creates both in one operation, in machine context, with the pending request kept in Certificate Enrollment Requests.
3. **Template.** The leaf carried the v1 name extension 20.2 "WebServer" together with a v2 OID. It is now the organization duplicate SIMSI2027WebServer (v2, template information 21.7 only), the CSR names it as attribute 13.2.1, and the built-in WebServer is explained (v1; Domain Admins / Enterprise Admins Enroll by default).
4. **Chain building.** The old lesson said WEB01 sends only the leaf and CLIENT01 always fetches the Issuing CA through AIA. WEB01 now sends leaf + Issuing CA, and AIA is used only when the intermediate is missing (fault `missing-ica`).
5. **Proof of key possession.** The old lesson had no CertificateVerify. The new handshake teaches ClientHello + SNI → Certificate (encrypted in TLS 1.3, Root not sent) → CertificateVerify → Finished, with TLS 1.2 differences.
6. **What encrypts the traffic.** Session keys from the key exchange do, not the certificate.
7. **Requests.** The CSR requested an EKU, and the TLS and DC lessons shared request ID 1042. The CSR now requests only SAN and Key Usage (the template sets the EKU), and TLS uses request 1043.
8. **Missing steps.** There was no binding detail and no renewal follow-up. Now: IIS binding fields (All Unassigned, 443, host, Require SNI), HTTP.sys using the key in place, and renewal before 2027-10-30 because the certificate is not autoenrolled.
9. **Revocation behaviour.** Revocation enforcement was stated as fact. It is now marked "Depends on your configuration: browser and client revocation policy", and OCSP is named as out of scope.

## Findings (before fixes)
Severity: **Critical** = teaches something false about PKI or leaks key material; **High** = a truth rule visibly violated or untested in a way that could regress silently; **Medium** = misleading or incomplete wording, or a missing guard test; **Low** = polish.

| id | audit | rule | severity | file:line | evidence | fix | commit |
|---|---|---|---|---|---|---|---|
| T1 | PKI | Text sweep: "the CSR becomes" | Medium | src/scenarios/tls/steps.js:88 | `t-inspect-csr` "Why": "A wrong name or key in the CSR becomes a wrong certificate." This suggests the CSR turns into the certificate. | Reword: "…in the CSR leads to a wrong certificate, because the CA copies the approved names and the public key." | 6635a99 |
| T2 | PKI | TLS rule 12 (delivery of the Root to CLIENT01 is configuration-dependent) | Medium | src/ui/tls-panel.js:83 | The CLIENT01 Trusted Root "About this store" text states "arrived through AD or Group Policy" without the marker. | Use `cfg(…, 'how trust anchors reach clients')`. | 6635a99 |
| T3 | PKI | Test sweep: marker rule | Medium | tests/unit/tls-story.test.js | The configuration-marker test covers scenario data only, not text the panel generates. T2 was not caught. | Add a test that renders the plain-language section for every step and selection and requires the marker on dependent sentences. | 6635a99 |
| W1 | Web | Typography: curly quotes | Low | src/scenarios/tls/shared.js:37,47,129,130; steps.js:33,53; evaluate.js:23 | Straight double quotes around the group name, the report text and the ticket title. | Use curly quotes in display text. Protocol literals (the CertificateVerify context string) and command arguments keep straight quotes. | 6635a99 |
| W2 | Web | Hover state on interactive elements | Low | src/ui/styles.css:286 | Glossary chips have focus and expanded states but no hover state. | Add a hover background. | 6635a99 |

No Critical or High findings. Fixture sweep (151 validator checks), identity sweep (Visitor, Subject, Operator and Requester separate in `identityRows`, the CSR and certificate inspectors, the request record and the trace), key and store sweep (key only in the Z2 vault and on the Z4 Personal leaf; CLIENT01 holds no key), flow sweep (receipt before policy; Root never an endpoint; AIA and CDP separate) and the DC full sweep (DC text unchanged; `dc-story.test.js` rule 11 still scans all of `src/`) found nothing further.

## After fixes (second pass)
- **pki-accuracy-review, run again** (text sweep, Website TLS sweep, fixture sweep with 151 validator checks): no findings. Searching `src/`, `README.md` and the INFs for "signs the CSR", "the CSR becomes" or "certificate encrypts" returns nothing.
- **web-design-guidelines, run again** on the same files: no findings.
- **Open Critical / High / Medium: none.** No Low items remain open.
- **Tests:** unit + integration 308 (was 216); Playwright 90, including 34 axe screens (was 60 and 16); visual review 252 screens (was 136); fixture validation 151 checks (was 102).

## Visual GAN review
See docs/VISUAL_REVIEW.md, section "v0.5.0 Website TLS story".

## Deviations
1. **Fixture byte-stability.** The specification asked to keep the Root, Issuing CA, CRL and DC fixtures byte-stable. The Issuing CA signing key is never persisted (keys live only in memory during generation), and the TLS leaf had to be re-signed (template information only, no 20.2). That forced regenerating the whole hierarchy, so the Root, Issuing CA, CRL and every DC certificate have new keys and thumbprints. Subjects, serials, SANs, EKUs, validity and the DC INFs are unchanged, and every check still passes. During the release gate, `npm run fixtures:generate` was run to prove the generator works, and the committed fixtures were restored afterwards.
2. **Single path "main".** It is expressed as `pathId: 'main'` without a `paths` map. That keeps the DC tests asserting that TLS has no paths unchanged.
3. **Key vault placement.** The transient Certificate Enrollment Requests card is drawn in Z2 ("WEB01 — key and request", where `certreq -new` creates it), not as a fourth card in Z4. Z4 holds three compact store cards plus the IIS site card, the most that fits at a readable size. Z2 and Z4 are both labelled "WEB01 (same computer)", the accept lane says "same computer (WEB01), never on the network", and the WEB01 store inspector lists all four stores.
4. **One active connector per moving step.** As in the DC lesson, steps where nothing moves (for example `t-owner`, `t-chain` when the Issuing CA came in the handshake) have no connector. The plain-language text then says "Nothing moves" or "Nothing leaves this computer".
5. **Wire lane.** Routes between CLIENT01 (Z1) and "On the wire" (Z5) run on a lane under the zones (y 612) and enter through the gaps between zones. On the middle lane they would cross the WEB01 store cards in Z4.
6. **Companion allowlist.** The allowlist accepts only CER files (an existing security test). The new public `fault-portal-selfsigned.cer` was added. The new PEM chain `portal-handshake-chain.pem` is downloadable in the browser inspector but not openable in the native viewer.
7. **Order of checkpoints.** The classic workspace removal (checkpoint 9) was brought forward to checkpoint 4. The classic code imported constants that the corrected model removed, so it could not run any more. The removal was committed together with the story rendering and the panel, because the same files (styles.css, index.html, app.js) carried both changes.
8. **Act labels.** The act labels sit on the bottom bar's hairline as small tabs, above the milestone chips. A separate label row pushed the 1366x768 plate below the 11 px text floor.
9. **Halt at the chain step.** When the final card occupies the plate's top band, the muted Root history link is not drawn, because the card would cover its label.
