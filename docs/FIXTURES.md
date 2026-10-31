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
