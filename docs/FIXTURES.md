# Fixtures

All files under `fixtures/` are **demonstration fixtures** generated for this project by `scripts/generate-fixtures/generate.mjs` (`npm run fixtures:generate`). They are real X.509/PKCS#10/CRL objects (RSA-2048, SHA-256) but belong to a synthetic hierarchy and carry only synthetic names. They are not production or personal certificates.

**Private keys exist only in memory during generation and are never written to disk.** The generator contains no key export. `.gitignore` blocks `*.key`, `*.pfx`, `*.p12`, `*.pk8`; the test suite and `npm run fixtures:validate` check that no key/PFX file or private-key PEM marker exists.

Regenerating produces new keys and therefore new thumbprints; dates and serial numbers are fixed. Re-run the tests afterward (the manifest is regenerated together with the files).

## Hierarchy

```
CN=SIMSI2027 Root CA            (self-signed, pathLen 1, serial ...AA01)   offline root
 └─ CN=SIMSI2027 Issuing CA 01  (pathLen 0, serial ...BB02)                issuing CA
     └─ CN=portal.simsi2027.test (serverAuth, SAN DNS=portal.simsi2027.test, serial ...CC10)
```

The leaf carries:

- **AIA** (CA Issuers): `http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt` — where to fetch the issuing CA certificate.
- **CDP**: `http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl` — where to fetch the CRL.
- Microsoft-style template extensions: template name `WebServer` (1.3.6.1.4.1.311.20.2) and template information with a **synthetic** template OID (1.3.6.1.4.1.311.21.7).

## Files

| path | type | notes |
|------|------|-------|
| `certificates/simsi2027-rootca.{cer,pem}` | root certificate | |
| `certificates/simsi2027-ica01.{cer,pem}` | issuing CA certificate | AIA/CDP point at the root locations |
| `certificates/portal.simsi2027.test.{cer,pem}` | website certificate | healthy leaf |
| `certificates/portal.simsi2027.test-chain.pem` | chain file | leaf, issuing CA, root |
| `requests/portal.simsi2027.test.{der,csr}` | CSR | SAN identical to the leaf; same public key |
| `crl/SIMSI2027-ICA01.{crl,crl.pem}` | CRL #27 | thisUpdate 2026-10-31, nextUpdate 2026-11-07; lists the revoked fault leaf and one synthetic serial |
| `certificates/fault-wrong-dns.*`, `requests/fault-wrong-dns.*` | fault variant | SAN web01.simsi2027.test |
| `certificates/fault-expired.*` | fault variant | notAfter 2026-09-30 |
| `certificates/fault-wrong-eku.*` | fault variant | Client Authentication EKU, template WorkstationAuth |
| `certificates/fault-revoked.*` | fault variant | serial listed in the CRL |
| `manifests/manifest.json` | manifest | per artifact: filename, type, subject, issuer, serial, thumbprints, validity, SAN, EKU, AIA, CDP, related request, stage |

Fault scenarios that need no special file reuse the healthy files with simulated conditions: *untrusted root* (empty CLIENT01 trust store), *missing issuing CA certificate* (AIA returns 404), *CDP unavailable* (CRL fetch times out), *installed without matching private key* (WEB01 key store has no matching key).

## Simulation clock

All validation is evaluated at the fixed time `2026-10-31T14:05:00Z` so results are reproducible.

## Validation

`npm run fixtures:validate` checks the SAN, EKU, CSR signature and key match, the chain, signatures, CRL signature, the healthy and every fault evaluation, and key hygiene across the tree.

## Native viewer allowlist
Only the seven `.cer` files listed in `src/artifacts/native-ids.js` can be opened natively (local companion). CSR, CRL, PEM and chain files are never offered.

## Domain Controller fixtures (v0.3.0)
| path | notes |
|------|-------|
| `requests/dc01-request.inf` | teaching request policy (machine context, RSA 2048, template `KerberosAuthentication`); not a production recommendation |
| `requests/dc01-request.{req,der}` | CSR for `CN=DC01.simsi2027.test`, SAN DNS DC01.simsi2027.test, template-name attribute |
| `certificates/dc01-issued.{cer,pem}` | certificate signed by SIMSI2027-ICA01: Client, Server and KDC Authentication, Smart Card Logon; Key Usage digitalSignature + keyEncipherment; synthetic template OID `1.3.6.1.4.1.311.21.8.2027.1.2` v100.5 |
| `certificates/dc01-chain.pem` | certificate, issuing CA, root |
| `certificates/fault-dc-{wrong-eku,san-missing,key-mismatch,expired}.*` | fault variants (the key-mismatch certificate is issued for a different key pair) |
| `requests/fault-user-context.inf` | same policy with `MachineKeySet = FALSE` |

Faults without special files (template not published, no Enroll permission, CA unavailable, pending approval, missing AIA, CDP unavailable) use the healthy files with simulated conditions that the Evidence tab labels *Simulated environment* or *User-selected fault*. The generator keeps all private keys in memory only.


## v0.4.0 Domain Controller fixtures

All fixtures were regenerated for v0.4.0. The Issuing CA signing key exists only in memory during generation, so new DC leaves could not be signed by the old hierarchy; **every thumbprint changed** (documented deviation in `SCENARIO_MODEL.md`). Each run of `npm run fixtures:generate` creates fresh keys by design and changes every thumbprint. The committed set comes from one run and is checked by `npm run fixtures:validate`.

### Path A — manual CSR transfer (template DCOfflineKerberosAuth)
- `requests/dc01-request.inf`: Subject `CN=DC01.simsi2027.test`, KeyLength 2048, KeySpec 1, KeyUsage 0xA0, Exportable FALSE, MachineKeySet TRUE, UseExistingKeySet FALSE, ProviderName "Microsoft RSA SChannel Cryptographic Provider", ProviderType 12, RequestType PKCS10, HashAlgorithm SHA256, `[RequestAttributes] CertificateTemplate = DCOfflineKerberosAuth`, `[Extensions] 2.5.29.17 = "{text}"` with `_continue_ = "dns=DC01.simsi2027.test&dns=simsi2027.test&dns=SIMSI2027"`. `requests/fault-user-context.inf` is the same with MachineKeySet FALSE.
- `requests/dc01-request.req` / `.der` (PKCS #10): subject `CN=DC01.simsi2027.test`, RSA 2048, sha256WithRSAEncryption signed by the DC01 key. Attributes: extensionRequest (SAN with three dNSName; Key Usage critical digitalSignature + keyEncipherment); `1.3.6.1.4.1.311.13.2.1` enrollmentNameValuePair `CertificateTemplate` = `DCOfflineKerberosAuth` (two BMPStrings); `1.3.6.1.4.1.311.21.20` ClientInformation SEQUENCE { INTEGER 9, UTF8String "DC01.simsi2027.test", UTF8String "SIMSI2027\PKIOperator", UTF8String "certreq.exe" }. No `1.3.6.1.4.1.311.20.2`.
- `certificates/dc01-issued.cer` / `.pem`: issuer SIMSI2027 Issuing CA 01; subject `CN=DC01.simsi2027.test`; SAN three dNSName; EKU Client Authentication, Server Authentication, Smart Card Logon (1.3.6.1.4.1.311.20.2.2), KDC Authentication (1.3.6.1.5.2.3.5); Key Usage digitalSignature + keyEncipherment (critical); Basic Constraints CA:FALSE (critical); SKI/AKI; AIA caIssuers `http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt`; CDP `http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl`; template information `1.3.6.1.4.1.311.21.7` (DCOfflineKerberosAuth OID `1.3.6.1.4.1.311.21.8.2027.1.3`, version 100.1); no `1.3.6.1.4.1.311.20.2`; validity 2026-10-30 → 2027-10-30; serial `…DC01`; public key identical to the CSR.
- `certificates/dc01-return.p7b` (+ `.p7b.pem` for the browser): PKCS #7 certificates-only with exactly the leaf, the Issuing CA and the Root.
- `certificates/dc01-chain.pem`: leaf, Issuing CA, Root (concatenated PEM).

### Path B — Certificates MMC enrollment (template KerberosAuthentication)
- `requests/dc01-mmc-request.der` (+ `.req` PEM for the browser): a **new** key; empty subject; Key Usage only; template attribute `KerberosAuthentication`; ClientInformation process `mmc.exe`, user `SIMSI2027\DC01$`. Labelled "built in memory by the enrollment wizard; not saved as a file in real enrollment".
- `certificates/dc01-enrolled.cer` / `.pem`: **empty subject**; SAN **critical** with the same three dNSName; same EKU, KU, AIA and CDP; template information KerberosAuthentication 100.5; key = the Path B request key; serial `…DC06`.

### Fault fixtures
`fault-dc-wrong-eku` (Client Authentication only), `fault-dc-san-missing` (retained; SAN `simsi2027.test` only; no fault uses it now), `fault-dc-san-no-domain` (new; SAN `DC01.simsi2027.test` only), `fault-dc-key-mismatch` (different public key), `fault-dc-expired` (2026-02-01 → 2026-09-30), `fault-rootca-impostor` (new; self-signed, same subject DN as the real Root, different key; used only by `root-thumbprint-mismatch`). The certificate fault fixtures carry the Path A subject and key and are shared by both paths.

### Manifest
Every entry now also records `spkiSha256` (certificates and CSRs), `role` and `path` (`csr`, `mmc`, `shared`, `fault`, or `tls` for the unchanged website scenario).

| File | Role | Path | SHA-1 | SHA-256 (first 16) | SPKI SHA-256 (first 16) |
|---|---|---|---|---|---|
| `certificates/simsi2027-rootca.cer` | root | shared | `0929EB9D28F674000C68EF924B56E0568671B69B` | `B7B66B8E2C042929…` | `225F0D456C5377B4…` |
| `certificates/simsi2027-ica01.cer` | ica | shared | `0C2C59AEE2586AA49124DDE108ADDCD22DD46A26` | `796778883A821DFA…` | `217FF36C45C81E33…` |
| `crl/SIMSI2027-ICA01.crl` | crl | shared | `C1FF6446AC48A880BA1575357BFE30FE5F27491E` | `C26BE86A8B603008…` | — |
| `requests/dc01-request.inf` | dc-inf | csr | `B3B39173142CABF239FD7505CD534F0EA7A9935F` | `6D8F6A3EC94ED536…` | — |
| `requests/fault-user-context.inf` | dc-inf | fault | `AB96225807B3EC0A7AB818B10B9AC6282DF1D9F1` | `FFF7E0DB89D77BF8…` | — |
| `requests/dc01-request.der` | dc-csr | csr | `D5E6B02D5CEB7CAF2E9AA2DE70010002582166C9` | `9DD75A87D2FF1DE5…` | `D5B5B54495556090…` |
| `requests/dc01-mmc-request.der` | dc-mmc-csr | mmc | `DD50E9801B6BBEF9913541623090D357E0D55E11` | `45DC425315F30B66…` | `24119A2D56777ACC…` |
| `certificates/dc01-issued.cer` | dc-cert | csr | `BC5204B10EDA849751359CDA150365F46AFD7FBE` | `80B04A89790040CE…` | `D5B5B54495556090…` |
| `certificates/dc01-enrolled.cer` | dc-enrolled | mmc | `85443D742922398EC454CAD10F1844D0E43F6F70` | `3BC5BB6959BD91CD…` | `24119A2D56777ACC…` |
| `certificates/fault-dc-wrong-eku.cer` | dc-cert | fault | `2272AF1BFFBFB286AFDAD04057B6D87234A75638` | `5F1D6702975D342F…` | `D5B5B54495556090…` |
| `certificates/fault-dc-san-missing.cer` | dc-cert | fault | `0B856F207A82D7B4864C1C2736DB4ED8F97366C6` | `3A1EAC5FACD1764B…` | `D5B5B54495556090…` |
| `certificates/fault-dc-san-no-domain.cer` | dc-cert | fault | `E3D07272186494256F564D1497EF678A9476C621` | `CAA5BAC1EC9D0BB9…` | `D5B5B54495556090…` |
| `certificates/fault-dc-key-mismatch.cer` | dc-cert | fault | `44AC3EED85155E8343F272EAE99219D195CAE0FC` | `159D781131E3632A…` | `5BE3E868091F5D3E…` |
| `certificates/fault-dc-expired.cer` | dc-cert | fault | `F30ADA95792ED74B6B90885E81A0BADA7A863E4A` | `F3FE966AB94045A9…` | `D5B5B54495556090…` |
| `certificates/fault-rootca-impostor.cer` | dc-root-candidate | fault | `2859D5AF9ECBFD47A988DA77FCBCCF5288AC88C7` | `8C611FF9957DC9E4…` | `BF6C456606100200…` |
| `certificates/dc01-chain.pem` | dc-chain | csr | `91B1AAB08BAE3B2ECB556ECCA7278129AD251968` | `CB6593CDB16EEA75…` | — |
| `certificates/dc01-return.p7b` | dc-p7b | csr | `A5218D44EA881C435D67F8BB95174D0C13081718` | `1B139D5F3BD0C45A…` | — |

### What `fixtures:validate` asserts (v0.4.0 additions)
Both CSR signatures verify and contain no private-key material; leaf SPKI equals CSR SPKI on both paths; Path B uses a new key; the leaves are signed by the Issuing CA and not by the Root; the Issuing CA is signed by the Root; EKU, SAN, Key Usage, Basic Constraints and template-information expectations hold; `1.3.6.1.4.1.311.20.2` is absent; the p7b holds exactly the three certificates; the CRL is signed by the Issuing CA and lists neither DC leaf serial; the INF values are correct; the impostor Root has the same subject and a different key; every manifest entry has thumbprints, SPKI, role and path; per path, every fault first fails at its declared step; no file in the tree matches PRIVATE KEY markers and no `.pfx`, `.p12` or `.key` file exists.


## v0.4.1
No fixture changed. The committed v0.4.0 set is kept. `npm run fixtures:generate` was run in a scratch check: it completed and its output passed `fixtures:validate`. Because keys are never persisted, every thumbprint rotated, so the committed set was restored with `git checkout -- fixtures`. Thumbprints in the v0.4.0 table above remain current.


## v0.5.0 Website TLS fixtures
The TLS lesson's fixtures were regenerated to the v0.5.0 rules (CLAUDE.md "Website TLS truth rules"). Because the Issuing CA key is never persisted, the whole hierarchy was regenerated, so every thumbprint changed. Subjects, serials, SANs, validity and the DC INFs are unchanged (see docs/AUDIT_v0.5.md, Deviations).

| path | notes |
|------|-------|
| `requests/portal-request.inf` | **new.** Teaching request policy: Subject `CN=portal.simsi2027.test, O=SIMSI2027 Synthetic Demo`, KeyLength 2048, KeySpec 1, KeyUsage 0xA0, Exportable FALSE, MachineKeySet TRUE, Microsoft RSA SChannel Cryptographic Provider (type 12), PKCS10, SHA256, `CertificateTemplate = SIMSI2027WebServer`, SAN `dns=portal.simsi2027.test` |
| `requests/fault-portal-user-context.inf` | **new.** The same policy with `MachineKeySet = FALSE` (fault `user-context`) |
| `requests/portal.simsi2027.test.{csr,der}` | Template as name-value attribute 1.3.6.1.4.1.311.13.2.1 (`SIMSI2027WebServer`), client information 1.3.6.1.4.1.311.21.20 (`WEB01.simsi2027.test`, `SIMSI2027\Morgan`, `certreq.exe`), requested extensions SAN + Key Usage only. **Removed:** the template-name extension 1.3.6.1.4.1.311.20.2 and the requested EKU (the template sets the EKU). |
| `certificates/portal.simsi2027.test.{cer,pem}` | SAN dNSName portal.simsi2027.test, EKU Server Authentication, KU digitalSignature + keyEncipherment (critical), template information 1.3.6.1.4.1.311.21.7 (`1.3.6.1.4.1.311.21.8.2027.1.1` v100.4, resolved to SIMSI2027WebServer). **Removed:** 1.3.6.1.4.1.311.20.2. Public key = CSR public key. Serial …CC10, valid 2026-10-30 to 2027-10-30. |
| `certificates/portal-handshake-chain.pem` | **new.** The certificate list WEB01 sends in the TLS Certificate message: leaf + Issuing CA (the Root is not sent) |
| `certificates/portal.simsi2027.test-chain.pem` | The chain CLIENT01 builds: leaf, Issuing CA, Root |
| `certificates/fault-wrong-dns.*`, `requests/fault-wrong-dns.*` | SAN `www.portal.simsi2027.test` (was `web01.simsi2027.test`) |
| `certificates/fault-wrong-eku.*` | Client Authentication only, from the v2 template `SIMSI2027WorkstationAuth` ("SIMSI2027 Workstation Authentication", `…2027.1.7` v100.2) |
| `certificates/fault-expired.*`, `certificates/fault-revoked.*` | Unchanged rules (notAfter 2026-09-30; serial …CC14 listed in CRL #27) |
| `certificates/fault-portal-selfsigned.{cer,pem}` | **new.** The temporary self-signed certificate behind the initial warning (`CN=portal.simsi2027.test`, issuer = subject, its own key; public only) |

TLS manifest entries use request ID **1043** (the DC lesson keeps 1042), and their `stage` values are TLS step ids (`t-new`, `t-sign`, `t-cert-msg`, …).

### Thumbprints (v0.5.0 set, SHA-1 / SHA-256, first 16 hex digits)
| file | SHA-1 | SHA-256 |
|---|---|---|
| simsi2027-rootca.cer | 36FBC98923B18F53… | F31CC2E374424C46… |
| simsi2027-ica01.cer | 36324774114D0FAA… | D273D0D146253D29… |
| portal.simsi2027.test.cer | 26E39AC8572A507C… | 74A00A6C6FBE9E17… |
| fault-portal-selfsigned.cer | 27359EA894D62F92… | 2D28D6736A72ACB8… |
| portal.simsi2027.test.der (CSR) | 435E87103CA27324… | AFAABF8A0C93D9E2… |
| SIMSI2027-ICA01.crl | 7F81DBF6FE48FD0E… | 086D3A7C0FB45ADC… |

### Validation (151 checks)
`npm run fixtures:validate` now also checks: caConfig derived from the shared CA constants and equal to the Issuing CA CN; every portal CSR, INF and leaf field above; leaf SPKI = CSR SPKI; leaf signed by the Issuing CA and not the Root; the handshake chain is exactly leaf + Issuing CA; the CRL lists exactly the revoked fault leaf and the synthetic serial; every fault leaf is signed by the Issuing CA for the WEB01 key; the self-signed certificate; no 1.3.6.1.4.1.311.20.2 on any v2-template certificate; every TLS fault's first evidence failure at its declared step; and no private-key material anywhere in the tree (also `.inf` and `.req`).

### Native viewer allowlist
`fault-portal-selfsigned.cer` was added (16 CER files). PEM chains, CSRs, CRLs and INFs are never offered to the native viewer.
