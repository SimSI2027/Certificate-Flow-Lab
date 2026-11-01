---
name: pki-accuracy-review
description: Audit Certificate Flow Lab scenario code, text, fixtures and tests against the project's PKI truth rules; use before any release and whenever a certificate scenario changes.
---

# PKI accuracy review (Certificate Flow Lab)

Project-owned skill. A review step only: **never edit code while reviewing.** Findings go into a table appended to the release audit (`docs/AUDIT_v0.5.md` from v0.5.0); fixes happen afterwards in separate commits. Run the full sweep (steps 2–7) and, whenever the website TLS lesson changed, the Website TLS sweep (step 8).

## Procedure

1. **Load the rules.** Read `CLAUDE.md` sections "PKI model rules", "Domain Controller truth rules (v0.4.0)" and "DC story presentation rules (v0.4.0)". Scenario sources: `src/scenarios/dc/shared.js`, `src/scenarios/dc/path-csr.js`, `src/scenarios/dc/path-mmc.js`, `src/scenarios/dc-manual-certificate-request.js`, `src/scenarios/dc-evaluate.js`; UI: `src/ui/story-panel.js`, `src/ui/story-app.js`, `src/views/story-layout.js`, `src/views/story-scene.js`; fixtures: `scripts/generate-fixtures/generate.mjs`, `fixtures/`.

2. **Text sweep** across `src/`, `docs/`, `README.md` and `fixtures/requests/*.inf`. Flag any wording that says or implies:
   - the CA signs the CSR or turns the CSR into a certificate (`/sign(s|ed|ing)? the CSR/i`, "converts the CSR", "the CSR becomes");
   - the CSR contains a private key;
   - the Root CA issues, signs or is contacted for a leaf;
   - `certreq -accept` or a PKCS #7 import makes a root trusted;
   - copying a CER copies or recreates a key;
   - manual enrollment repairs the root cause;
   - DomainControllerAuthentication is universally wrong or right;
   - a configuration-dependent fact (ports, event IDs, default permissions, Group Policy / Enterprise distribution, service pickup timing, revocation enforcement) stated without "Depends on your configuration".
   Suggested commands: `rg -n -i "sign(s|ed|ing)? the csr|csr becomes|turns? the csr" src docs README.md`, `rg -n -i "private key" src/scenarios`, `rg -n -i "port|event id|group policy|default|enforc|pickup" src/scenarios src/ui`.

3. **Identity sweep.** Every place that shows identity keeps three separate labelled fields: Subject (`DC01.simsi2027.test`), Operator (`SIMSI2027\PKIOperator`), Requester (Path A `SIMSI2027\PKIOperator`; Path B `SIMSI2027\DC01$`). Check `identityRows` in `story-panel.js`, the CSR and certificate inspectors, the request-record card in `story-scene.js`, and the trace texts.

4. **Key and store sweep.** The private key appears only in the Z1 key vault and on the Z6 Personal leaf, never on a transport connector. Store mapping:
   - leaf only in Personal, with a key badge;
   - Issuing CA only in Intermediate Certification Authorities, without a key;
   - Root only in Trusted Root Certification Authorities, without a key, as the trust anchor;
   - Certificate Enrollment Requests is transient (Path A, `a-new` to `a-accept`).
   CA certificates carry a source tag. Check `storyModel`/`storeEntries` in `story-layout.js` and `storeInspector`/`certCard` in `story-panel.js`.

5. **Flow sweep.**
   - `certreq -new` creates the key and the CSR together in machine context.
   - Path A submits from PKI-TRANSFER01 with DCOfflineKerberosAuth and manager approval.
   - Root and Issuing CA are installed before `certreq -accept`, and `-accept` runs only on DC01.
   - The Root CA is never a connector endpoint (only the muted historical link).
   - AIA and CDP stay separate.
   - The final step is "Suitable now; root cause still open".

6. **Fixture sweep** (parse the files, never trust comments). Use `buildFixtureModel` from `src/artifacts/model.js`, as in `scripts/validation/validate-fixtures.mjs`. Check:
   - the CSR signature verifies, and the CSR holds no private material;
   - CSR attribute 1.3.6.1.4.1.311.13.2.1 = DCOfflineKerberosAuth, and client information 1.3.6.1.4.1.311.21.20 parses;
   - no 1.3.6.1.4.1.311.20.2 in the CSR or the DC leaves;
   - the leaf SAN is DC01.simsi2027.test, simsi2027.test and SIMSI2027, and the EKU includes 1.3.6.1.5.2.3.5;
   - template info 1.3.6.1.4.1.311.21.7 is present;
   - leaf SPKI = CSR SPKI on both paths, and the chain signatures verify;
   - the p7b holds exactly leaf + Issuing CA + Root;
   - the CRL is signed by the Issuing CA and omits the leaf serial;
   - the CA configuration string is `ICA01.simsi2027.test\` + the Issuing CA CN.

7. **Test sweep.** Every rule above needs at least one test that would FAIL if the rule were broken. A tautology that compares a constant with itself does not count. List the rules without such a test (`tests/unit/dc-story.test.js`, `story-scene.test.js`, `story-panel.test.js`, `tests/integration/fixtures.test.js`, `tests/e2e/dc-story.spec.js`, `scripts/validation/validate-fixtures.mjs`).

8. **Website TLS sweep** (v0.5.0). Load "Website TLS truth rules (v0.5.0)" from `CLAUDE.md`. Sources: `src/scenarios/tls/*.js`, `src/scenarios/tls-manual-enrollment.js`, `src/ui/tls-panel.js`, the TLS branches of `src/views/story-layout.js` / `story-scene.js`, the TLS part of `scripts/generate-fixtures/generate.mjs`. Check:
   - **Roles:** Visitor SIMSI2027\Jordan (CLIENT01, 10.20.10.45) never requests a certificate; Operator SIMSI2027\Morgan; Requester (CA record) SIMSI2027\Morgan; Subject portal.simsi2027.test. Every identity view shows Subject, Operator and Requester (and Visitor) as separate labelled fields.
   - **Template:** SIMSI2027WebServer ("SIMSI2027 Web Server", v2, 1.3.6.1.4.1.311.21.8.2027.1.1, 100.4), Supply in the request, Server Authentication only, KU Digital Signature + Key Encipherment, RSA 2048, Enroll for "Web Server Certificate Requesters". Built-in WebServer described as v1 with Domain Admins / Enterprise Admins Enroll by default. Permissions and approval carry "Depends on your configuration".
   - **Key and CSR:** `certreq -new -machine` makes key + CSR together; MachineKeySet TRUE, Exportable FALSE (web-farm note marked configuration-dependent); pending request in Certificate Enrollment Requests until `-accept`; the CSR never holds the private key; WEB01's key signs the CSR.
   - **Order:** `t-submit` (received, Request 1043, Requester Morgan) comes before `t-policy`. Nothing shows policy before receipt.
   - **Issuance:** no text says the CA signs the CSR (`/sign(s|ed|ing)? the CSR/i`); the Root is never contacted, never signs the leaf, never a connector endpoint.
   - **Stores:** WEB01 Personal (leaf + key), Intermediate (Issuing CA, Enterprise (AD)), Trusted Root (Root, Enterprise (AD)), Certificate Enrollment Requests transient; CLIENT01 Trusted Root holds the Root and no private key for this site.
   - **Binding and handshake:** https · All Unassigned · 443 · host portal.simsi2027.test · Require SNI; the key is used in place by HTTP.sys; the Certificate message carries leaf + Issuing CA (Root normally not sent; a sent Root is not trusted because it was sent); CertificateVerify is signed by WEB01 and verified with the leaf public key; TLS 1.3 encrypts the Certificate message; the private key never appears on a route or in the "On the wire" zone.
   - **Validation:** SAN (not CN) name match; dates at the simulation clock; EKU Server Authentication; KU; chain to CLIENT01's Trusted Root; AIA only when the intermediate is missing; CDP/CRL with "Depends on your configuration" for browser revocation behavior; OCSP named out of scope.
   - **Traffic:** no text claims the certificate encrypts the traffic (`/certificate (itself )?encrypts/i`); session keys do.
   - **Renewal:** not autoenrolled; renew before 2027-10-30 in the final follow-up.
   - **Fixtures:** portal CSR has 13.2.1 = SIMSI2027WebServer, 21.20 = WEB01.simsi2027.test / SIMSI2027\Morgan / certreq.exe, SAN + KU requested, no 20.2 and no requested EKU; leaf has 21.7 SIMSI2027WebServer 100.4, no 20.2, SPKI = CSR SPKI; handshake chain = leaf + Issuing CA; wrong-eku fault is Client Authentication only from SIMSI2027WorkstationAuth; the temporary self-signed fixture exists and is public only.

9. **Output.** Append a findings table to the current release audit (`docs/AUDIT_v0.5.md` from v0.5.0; `docs/AUDIT_v0.4.md` for v0.4.x):

   | id | rule | severity (Critical/High/Medium/Low) | file:line | evidence | fix |

   Severity guide: **Critical** = teaches something false about PKI or leaks key material; **High** = a golden rule visibly violated or untested in a way that could regress silently; **Medium** = misleading or incomplete wording, or a missing guard test; **Low** = polish.
