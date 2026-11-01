# Future scenarios

These identifiers are reserved in `futureScenarios` and appear (disabled) in the scenario selector. **None are implemented in v0.1.0.**

| id | idea | reuses | would add |
|----|------|--------|-----------|
| `ndes-scep-device-enrollment` | A network device enrolls through NDES using SCEP and a one-time challenge | entities (CA, template gate), CSR inspector, faults framework | NDES/RA entity, challenge artifact, RA certificate, SCEP message flows |
| `cep-ces-enrollment` | Enrollment over HTTPS via Certificate Enrollment Policy/Web Services | policy gate, request flows | CEP/CES entities, policy download stage, auth methods |
| `autoenrollment` | Domain computer enrolls automatically via Group Policy | template, CA, install/bind stages | GPO/AD entities, trigger stage, renewal timeline |
| `aia-chain-retrieval` | Focus on chain building and a missing intermediate | `aia`, `chain` entities, AIA evidence | cache/repository variants, stale AIA |
| `cdp-crl-validation` | Focus on CRL freshness, delta CRLs, unreachable CDP | CRL inspector, `cdp` entity | CRL expiry/overlap faults, caching |
| `ocsp-validation` | Revocation via OCSP responder | revocation stage, inspectors | OCSP responder entity, response artifact + inspector, stapling |
| `smartcard-logon` | Smart-card/KDC logon | CA/template, chain validation | KDC, NTAuth store, smart-card artifact |
| `client-authentication` | mTLS client certificate | chain + validation engine | client EKU, mapping rules |
| `cross-forest-enrollment` | Enrollment across forests | policy gate, CA | second forest entities, trust and permissions |

## How to add one

1. Create `src/scenarios/<id>.js` exporting the shape documented in `SCENARIO_MODEL.md` (stages, flows, artifacts, faults, evidenceTrace, tour).
2. Register any new entity in `src/entities/entities.js` and give it a position in `src/views/scene.js` (`LAYOUT`) plus a status rule in `src/views/status.js`.
3. Add detail text in `src/ui/details.js` and, for new artifact types, a tab set in `src/inspectors/inspector.js`.
4. Generate any needed fixtures in `scripts/generate-fixtures/` and list them in the manifest with a `role` and optional `fault`.
5. Add the scenario to the selector (`App.buildStaticControls`) and write engine-level tests mirroring `tests/unit/engine.test.js`.

The engine itself (`src/engine/engine.js`) contains no stage names and should not need modification.

## Known expansion points in v0.1

- `scenario.futureScenarios` and the selector.
- `artifacts[].presence[].blockedBy` for fault-aware artifact movement.
- `faults[].fixtures` for variant fixture roles.
- `evaluate()` is the single place that turns fixtures into checks; OCSP would add checks there.
- The scene layout is a data table (`LAYOUT`).

## Expansion points added in v0.2.0
- Device and user certificate scenarios can add IDs to `native-ids.js` (CER only) and new film schedules next to `src/film/schedule.js`.
- Public deployment is automatic for every stable `main` update.

## v0.3.0 note
The scenario home shows only a quiet "Coming later" list (NDES / SCEP, CEP / CES, autoenrollment, AIA chain retrieval, CRL and OCSP validation); nothing future is rendered in the workspace. A new scenario needs a module with the shape in `SCENARIO_MODEL.md`, an entry in `src/scenarios/index.js`, and its entities in `src/entities/entities.js`. The Domain Controller follow-up step already points to `autoenrollment`.


## v0.4.0: extension points preserved
The DC story keeps every planned extension point open: **NDES, SCEP, CEP, CES, autoenrollment, AIA retrieval, CDP/CRL validation, OCSP, user and device certificates, smart-card certificates and cross-forest enrollment.** Concretely:
- A new story scenario adds a `paths` map and `layoutMode: 'story-zones'`; `pathOf` and the StoryScene need no changes for new paths that use the same six zones.
- Autoenrollment can reuse Path B (`b-followup` already points to `certutil -pulse` and Group Policy refresh) and the fault `rpc-blocked`.
- AIA retrieval: the PUB strip already draws a separate AIA endpoint ("not needed: ICA cert is local"); an AIA scenario can activate it with a `HTTP (AIA)` connector, which is already in the channel vocabulary.
- CDP/CRL and OCSP validation: `cdp-unreachable` shows the withheld-verdict pattern; OCSP would add an endpoint to the PUB strip and a check in `dc-evaluate.js`.
- CEP/CES and NDES/SCEP: zone 3 is relabelled per path (`zones.mmc` shows the mechanism), so a web-enrollment path can relabel it as a CEP/CES or NDES front end.
- Smart-card, user and device certificates: the Smart Card Logon EKU is already present, and store mapping (`STORE_MAP`) and the eight-question certificate card are data-driven.
- Cross-forest enrollment: the Offline Trust and store-source tags (`Enterprise (AD)`, `Group Policy`, `Local (manual)`) carry the trust-distribution story.
