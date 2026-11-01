# Scenario model

## Timeline position

A scalar `t` from `0` to `N` (N = number of stages, or *failing stage index + 1* when a fault halts the run).

| t | meaning |
|---|---------|
| 0 | nothing has happened |
| 0 < t ≤ 1 | stage 0 in progress (`stageProgress = t`), complete at 1 |
| k < t ≤ k+1 | stage k, `stageProgress = t - k` |

`stage = max(0, ceil(t) - 1)`. An integer `t = k` therefore means *stage k-1 is complete*. **Step forward** goes to the next integer; **step backward** goes to the previous integer. Partial positions apply a stage's `during` patch; completed positions apply its `done` patch (or the fault's patch if the fault halts there).

## Canonical state

`scenarioId, direction, stage, stageProgress, selectedEntity, selectedArtifact, playbackSpeed, visitorState, requestState, keyState, csrState, templateDecision, issuanceState, certificateState, installationState, iisBindingState, connectionState, chainState, aiaState, revocationState, trustDecision, activeFault`

Additional fields: `validation {name, dates, eku, signatures, root}`, `evidenceIndex` (reverse mode), `halted`, `failure`, `selectedFlow`.

All values are strings (enumerations), booleans, null or finite numbers; tests sweep every fault across the timeline to assert this.

## Scenario file shape (`src/scenarios/<id>.js`)

| field | purpose |
|-------|---------|
| `id`, `title`, `version` | identity |
| `initialState` | starting values for the state fields |
| `stages[]` | `{id, phase, title, narrative, flows[], focus{entity,artifact}, during{}, done{}}` |
| `flows[]` | arrows: `{id, stage, from, to, protocol, payload, identity, result, durationMs, evidence, artifact, window, local}` |
| `artifacts[]` | `{id, label, color, inspectable, fixtureRole, presence[]}`; presence entries `{arrive, at, via, from, blockedBy[]}` say where an artifact lives over time |
| `faults[]` | `{id, label, failStage, check, fixtures{role:faultId}, owner, remediation}` |
| `faultPatches` | state patch applied when the faulted stage completes |
| `evidenceTrace[]` | reverse-mode evidence items `{id, stage, question, claim, entity, artifact}` |
| `tour[]` | guided tour steps |
| `futureScenarios[]` | reserved identifiers |

## Forward mode

Need → Request → Policy → Issue → Install → Bind → Connect → Validate → Trust. 19 stages in v0.1: visit, browser-error, report, owner-review, keygen, csr, policy, ca-receive, ca-evaluate, issue, return, install, bind, retry, chain-build, validate, root-trust, revocation, trust.

## Reverse evidence mode

`direction: 'reverse'` keeps the world at its end state (`worldAt(maxT)`) and moves `evidenceIndex` along `buildTrace()`. The trace is `evidenceTrace` filtered to the stages reached; in a fault run it is prefixed with a `verdict` item (*Why is the site NOT trusted?*) and the failing item is flagged. Each trace item cites the forward stage that produced the evidence plus the real check results and artifacts. Nothing is replayed backwards.

## Faults

A fault halts at `failStage`: `maxT` becomes that stage + 1, step forward cannot pass it, and the fault patch is applied at completion. Variant fixtures (`fixtures: {leaf: 'wrong-eku'}`) substitute real certificates generated for the fault. Artifact presence entries may declare `blockedBy` (for example the issuing CA certificate never arrives from the AIA in `missing-ica`).

## Derived scene facts

- `flowStatus(scenario, state, flow)` → `{phase: idle|active|done, progress, failed}`.
- `artifactLocation(scenario, state, artifact)` → where the artifact chip is or whether it is moving along a flow.
- `views/status.js` → node colors.

## Film time (v0.2.0)
Film time is a second, pure mapping on top of the model: `frameAt(seconds)` returns a session (`t` or `tReverse`, selections) that is fed to `computeState`. Nothing in the film owns state; captions are read from `computeState` output.

## v0.3.0 additions
| field | purpose |
|-------|---------|
| `subtitle`, `home` | card content for the scenario home (purpose, requester, destination, method) |
| `stages[].explain` | `{what, why, who, where, next, local, wrong[], checks[], owner}` plain-language content |
| `stages[].show` | extra entities to reveal at that step (for example the offline Root CA) |
| `flows[].kind` / `route` / `lane` | line encoding (request, policy, cert, install, validate, trust) and orthogonal routing |
| `layout`, `zones`, `zoneOf` | placement; exactly one zone has `offline: true` and sits at the far right |
| `statusOf(id, state)` | node status derived from canonical state |
| `faultStagePatches` | `{fault: {stageId: patch}}` for faults that change an earlier stage's outcome |
| `evaluate(model, faultId, scenario)` | evidence checks (`kind`: Real fixture data / Simulated environment / User-selected fault) |
| `evidenceTrace[].evidenceKind` | classification of each reverse-mode item |

### Domain Controller scenario (`dc-manual-certificate-request`)
18 stages in 10 milestone groups: Problem, Identity, Key, CSR, Submission, Policy, Issuance, Retrieval, Acceptance, Verification. Extra state fields: `dcCertState, identityState, templatePublished, permissionState, contextState, keyAssociation, purposeState, followupState`. Eleven faults halt at: choose-template, verify-permission, evaluate-policy (user context, pending), submit, key-match, inspect-purposes (EKU, SAN, expired) and verify-chain (AIA, CDP).


## v0.4.0 Domain Controller story model

### Files
`src/scenarios/dc/shared.js` (zones, stores, artifact vocabulary, command tokens, conditions, faults, initial state, step builder) · `dc/path-csr.js` (Path A) · `dc/path-mmc.js` (Path B) · `dc-manual-certificate-request.js` (thin default export: id unchanged, title "Domain Controller Manual Enrollment", `layoutMode: 'story-zones'`, `paths: { csr, mmc }`, `defaultPath: 'csr'`, `conditions`, `defaultCondition: 'trust-missing'`, `tour`, `resolveFixture`, `evaluate`). The default export spreads Path A, so code that reads `scenario.stages` sees Path A.

### Step schema
`id, milestone, title, purpose, zone, adjacent[], actor ('OP'|'MGR'|'SYS'), artifact, command {text, tokens:[{t, meaning}], banner} | null, gui (console path) | null, connector ({from, to, channel, blocked?, blockedBy?} | {from, store, channel} | {from, to, association:true} | {from, to, channel, local:true} | null), conditional ('trust-missing'), result, notes[], show[], explain {what, who, moves, staysLocal, canGoWrong}, during, done`, plus flags `vault`, `stores`, `pub`, `rootHistory`. The engine fields `phase`, `narrative`, `focus` and `flows` are derived, so the existing engine logic is reused unchanged.

### Paths
- **Path A — Manual CSR transfer:** 10 milestones (Diagnose · Define request · Create key and CSR · Transfer CSR · Submit and approve · Issue and retrieve · Return package · Install CA certificates · Accept leaf · Verify and follow up) and 24 steps (`a-detect` … `a-followup`).
- **Path B — Certificates MMC enrollment:** 6 milestones (Diagnose · Check prerequisites · Open Local Computer store · Enroll · Verify · Follow up) and 11 steps (`b-detect` … `b-followup`).

### Engine additions (`src/engine/engine.js`)
`pathOf(scenario, session)` returns a cached view with that path's stages, flows, faults, fault patches and trace. Under `trust-present` the conditional steps are marked `skipped` (result "Already present — skipped", no state change, no connector) and `a-trust-check` reports Enterprise (AD) certificates. `computeState(scenario, session)` applies `pathOf` itself and adds `pathId`, `conditionId` and `skipped` to the state. `nextStepT` and `prevStepT` jump over skipped steps. `buildTrace` labels a trace item `User-selected fault` when its `faults` list names the selected fault, and uses `scenario.verdictQuestion`. URL parameters: `?path=csr|mmc&condition=trust-missing|trust-present` (also `fault`, `t`, `dir`, `start=1`, `panel=open`). Scenarios without `paths` (TLS) are returned unchanged.

### Conditions
`trust-missing` (default; "Exceptional condition for this lesson"): Root and Issuing CA certificates are installed manually in `a-root` and `a-ica` before the leaf is accepted. Long term: repair AD publication, replication or Group Policy so they arrive in the Enterprise store. `trust-present`: both steps are skipped. Path B has no conditional steps; its CA certificates arrive from AD.

### Faults (separate selector from the condition)
| Fault | Paths | Manifests at | Stops? | Evidence kind |
|---|---|---|---|---|
| rpc-blocked | B | b-enroll | yes (offers a switch to Path A) | Simulated environment |
| wrong-template-handoff | A | a-policy | yes | Simulated environment + Real fixture data |
| no-enroll-permission | A, B | a-policy / b-permission | yes | Simulated environment |
| template-not-published | A, B | a-policy / b-template | yes | Simulated environment |
| pending-no-approver | A | a-approve | yes | Simulated environment |
| user-context | A | a-accept (effects at a-inf, a-new) | yes | Real fixture data + Simulated environment |
| accepted-on-wrong-machine | A | a-accept | yes | Derived conclusion + Real fixture data |
| pending-request-lost | A | a-accept | yes | Simulated environment |
| root-thumbprint-mismatch | A | a-return-move | yes | Real fixture data vs Simulated environment |
| cdp-unreachable | A, B | a-chain / b-chain | no: continues, verdict withheld | Simulated environment |
| wrong-eku | A, B | a-purposes / b-verify | yes | Real fixture data |
| san-no-domain | A, B | a-purposes / b-verify | yes | Real fixture data |
| key-mismatch | A | a-key | yes | Real fixture data |
| expired | A, B | a-purposes / b-verify | yes | Real fixture data |

Each fault has `symptom`, `evidence[] {text, kind}`, `owner`, `remediation`, `stops` and `longTerm`.

**Retired:** `ca-unavailable` → `rpc-blocked` (the real failure is the blocked RPC/DCOM path, not a CA outage). `ica-cert-unavailable` → condition `trust-missing` (installing the Issuing CA certificate locally is part of the controlled workflow; AIA is not needed when the Intermediate store has it). `san-missing` is retained only as a fixture.

### Reverse evidence
Path A, in order: Suitable? · Purposes and names · Private-key association · Trusted chain · Revocation · Root authenticity · Approval and issuance · CSR proof of possession · Key generated on DC01 · Original failure. Path B replaces items 6–7 with "CA certificates from AD (Enterprise store)" and "Requester DC01$, subject built from AD", and item 10 with "Autoenrollment had not yet produced a certificate; enrollment triggered manually".

## v0.4.0 deviations
Where the release specification was impossible or ambiguous, the closest faithful alternative was implemented:
1. **Fixture byte-stability.** The Issuing CA signing key is never persisted, so the new DC leaves required regenerating the whole hierarchy; Root, Issuing CA, TLS and CRL thumbprints changed. Every `fixtures:generate` run creates fresh keys and changes every thumbprint; that is a property of not persisting keys. The release ran it once and committed that output.
2. **Shared fault certificates.** Fault certificate fixtures carry the Path A subject and key and are used by both paths. In Path B, the key-match check compares a fault certificate with the request it was issued for, and the evidence says so.
3. **Extra browser-loadable copies.** The Path B CSR is also written as `dc01-mmc-request.req` (PEM), and the PKCS #7 bundle as `dc01-return.p7b.pem`, because the browser loads PEM text fixtures.
4. **Manifest `path` value `tls`** marks the unchanged website fixtures (the specification listed csr, mmc, shared and fault).
5. **Zone 6 layout.** The store cards occupy the spotlight position in zone 6. An artifact moving into zone 6 is spotlighted in its source zone. An artifact at rest in zone 6 is highlighted inside its store card. Zone 6's actor badge is drawn inside its station card, because there is no room between the station card and the store cards.
6. **One active connector** applies to steps that move something. Steps where nothing moves (for example confirming the identity) have none.
7. **Finished connectors** are drawn only in Show full topology. The focused view draws only the active route and the muted Root history link.
8. **Connector labels** sit in the free end zone (or under the source spotlight) instead of on the lane, so text never covers a card.
9. **Collapsed panel width.** The 48 px tab applies at every width below 1600 px, not only at 1366x768. At 1600 px and wider the collapsed panel is the 320 px summary.
10. **START FLOW** begins playback at step 1. Next, Previous and the rail pause it.
11. **The condition selector** shows "Not applicable" on Path B.
12. **`cdp-unreachable`** is a continuing fault: the chain step records revocation as offline, the final verdict is withheld, and both are applied through `faultStagePatches`.
13. **Skipped steps stay in the step list** so they can say "Already present — skipped". Navigation and playback jump over them.
14. **The film includes a TLS segment.** The v0.3.0 film had none, so "keep the TLS segment" was read as "include one".
15. **The `a-approve` route** is a short in-zone route from the certificate manager badge to the request record, labelled "CA approval (console)".


## v0.4.1 model corrections (audit)
- **Failed accepts are modelled honestly.** `certreq -accept` links a key only on DC01, and only to a pending request with the same public key. The fault states are now:
  - `user-context`: key and request stay in the operator's user store; nothing is installed in machine Personal.
  - `accepted-on-wrong-machine`: DC01's pending request and key are untouched; a keyless copy exists on PKI-TRANSFER01.
  - `pending-request-lost`: nothing is installed.
  - `key-mismatch`: `-accept` cannot link the certificate. It sits in Personal as `leafState: 'unlinked'`, request 1042 is still pending, and the flow halts at `a-key` as specified.
  The DC01 association lane is drawn blocked, with the reason. An invariant test over every fault and step of both paths checks that a request is "consumed" only when the key is linked, and that the Personal key badge appears exactly when the key is linked.
- **Configuration markers** use `cfg(sentence, aspect)`: "A complete sentence. Depends on your configuration: what varies." A test rejects fragments.
- **Condition long-term fix:** `trust-missing.longTerm` is shown at the trust check and the installation steps.
- **Path B wording:** the leaf is "Installed leaf" (there is no accept step), and its certificate card says "Installed automatically by the enrollment wizard on DC01".
- **Removed:** the unreachable classic-DC code (`src/ui/details-dc.js`, `DC_EXPLAIN`, `isDc` branches, DC entities).


## v0.5.0 Website TLS story model
### Files
`src/scenarios/story-common.js` (configuration marker, never-executed banner, evidence kinds, zone geometry, command builder; `dc/shared.js` re-exports it) · `tls/shared.js` (zones, stores, template cards, artifact vocabulary, glossary, command tokens, IIS GUI path, actors, initial state, 12 faults, step builder) · `tls/steps.js` (acts, 10 milestones, 26 steps, follow-up, reverse evidence, tour) · `tls/evaluate.js` (parser-backed evidence) · `tls-manual-enrollment.js` (thin default export: id unchanged, `layoutMode: 'story-zones'`, `pathId: 'main'` without a `paths` map, `story` descriptor, `resolveFixture`, `evaluate`).

### Acts, milestones and steps
Act 1 "Get the certificate": **See the problem** (t-visit, t-warning, t-report) · **Plan the certificate** (t-owner, t-requirements, t-inf) · **Create key and CSR** (t-new, t-inspect-csr) · **Submit and issue** (t-submit, t-policy, t-sign, t-return) · **Install** (t-accept, t-stores) · **Bind in IIS** (t-bind, t-ready).
Act 2 "Use the certificate": **Connect (TLS handshake)** (t-retry, t-hello, t-cert-msg, t-proof) · **Build the chain** (t-chain, t-signatures) · **Check the certificate** (t-checks, t-revocation) · **Trusted connection** (t-trusted, t-followup).

### Step schema (additions to the v0.4.0 schema)
`act`, `actorZone` (the badge zone), `explain {what, why, who, where, moves, staysPrivate, checked, canGoWrong}`, `technical[]`, `gui {text, tokens}` (IIS Manager path, every segment explained), `storeTargets[]`, `keyUse`, and `connector.wire` / `connector.bind`. Actors: VIS (Jordan), OWN (Morgan), CA, CLI (CLIENT01), WEB (WEB01).

### State (additions)
`dnsState, iisBindingState, serverReady, handshake, handshakeChain, proofState, clientTrust {root, source}`. WEB01's `trust` starts as present from Enterprise (AD).

### Faults (each: symptom, evidence with kind, owner, remediation, stops, long term)
| Fault | Halts at | Evidence kind | Effects on earlier steps |
|---|---|---|---|
| no-enroll-permission | t-policy | Simulated environment | — |
| template-not-published | t-policy | Simulated environment | — |
| user-context | t-accept | Real fixture data (fault INF) + Simulated | t-inf, t-new: key and request in Morgan's user store |
| no-private-key | t-bind | Derived conclusion + Real | t-accept: imported, not accepted (unlinked); request still pending |
| wrong-binding | t-cert-msg | Real (self-signed fixture) + Simulated | t-bind: binding still self-signed |
| missing-ica | t-chain | Simulated environment | WEB01 Intermediate empty; t-cert-msg sends only the leaf; blocked AIA route |
| untrusted-root | t-chain | Simulated environment | CLIENT01 Trusted Root empty |
| wrong-dns / expired / wrong-eku | t-checks | Real fixture data | — |
| revoked | t-revocation | Real fixture data | — |
| cdp-unavailable | t-revocation | Simulated environment (hard-fail in this client) | — |

`faults[].connector` adds a fault-specific route to a step. `faults[].notes` explain on a step how the fault changed it ("In the selected fault: …").

### Reverse evidence (11 items)
Why trusted? (Derived) · Right name, dates, purpose? (Real) · Not revoked? (Real) · Chain reaches a trusted Root on CLIENT01? (Real + Simulated) · Server proved key possession? (Derived + Real) · Correct certificate bound with SNI? (Simulated) · Leaf linked to WEB01's key? (Real + Simulated) · Who issued it, for whom, under which template? (Real + Simulated) · CSR proof of possession? (Real) · Key generated on WEB01 in machine context? (Real + Simulated) · Why the work started (Simulated). A fault run starts with "Why is the connection NOT trusted?".

### Retired
The classic 19-stage model (`visit` … `trust`), `tls-presentation.js`, `explain.js`, the classic `evaluate()` in `model.js`, and the `ENV.template` / `TEMPLATE` ("WebServer" with a v2 OID) constants.
