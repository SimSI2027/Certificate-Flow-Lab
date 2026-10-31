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
