# Architecture

Vite + vanilla JavaScript (ES modules). Runtime dependencies: `@peculiar/x509` (X.509 parsing/verification via WebCrypto), `asn1js`, `reflect-metadata`. Dev: Vite, Vitest, Playwright.

## Layers

```
src/
  scenarios/   Scenario data only (stages, flows, artifacts, faults, evidence trace, tour).
  engine/      Pure, deterministic functions: position -> canonical state; derived scene facts.
  entities/    Entity definitions (id, label, kind) shared by scenarios.
  artifacts/   Synthetic constants, fixture parsing (cert/CSR/CRL), validation evidence derived from the real files.
  inspectors/  Tabbed artifact inspector (pure HTML builders over parsed fixtures).
  views/       2.5D SVG scene (build once, patch from state) and status derivation.
  ui/          App controller, detail panels, styles.
  tour/        Guided tour controller (drives the same public API as a user).
fixtures/      Public synthetic artifacts + manifest.
scripts/       Fixture generator and validators.
tests/         unit/, integration/, e2e/ (Playwright).
tools/windows/ Launch-Demo.ps1.
```

## Single source of truth

The only mutable simulation input is the **session** `{ faultId, direction, t, tReverse, selected*, playbackSpeed }`. `computeState(scenario, session)` returns the **canonical state**. Everything else is derived:

- `Scene.update(state)` sets node status colors (`views/status.js`), flow draw progress/phase (`flowStatus`), and artifact positions (`artifactLocation`). The scene DOM is built once; frames only patch attributes, so clicks are never lost to re-rendering.
- Panels (Overview, Details, Inspector, Evidence) re-render only when the canonical state (excluding fine progress) or selection changes.
- The timeline marker, jump menu and progress bar read the same position.
- The tour never animates anything itself: it calls `seek/select/play` like a user, so it cannot disagree with the model.

There are no independent animation timelines. Packet positions are a pure function of `stageProgress`.

## Real evidence

`artifacts/model.js` parses the PEM fixtures and `evaluate()` computes validation checks from them (SAN match, validity windows, EKU, signature verification through WebCrypto, trust store membership, CRL signature/freshness/revocation lookup). Fault definitions in the scenario declare *where* a fault halts; tests assert that the real evidence's first failure matches that declaration, so the branching cannot silently drift from the fixtures.

Simulated (not real) inputs: the evaluation clock (`2026-10-31T14:05:00Z`), CLIENT01's trust store contents, HTTP retrieval results for AIA/CDP, and WEB01's key store.

## Extending

Add a scenario file exporting the same shape (see `SCENARIO_MODEL.md`), register entities in `entities/`, add layout coordinates in `views/scene.js`, and add detail text in `ui/details.js`. The engine does not mention any scenario-specific stage.

## Security posture

No network calls beyond serving static files. Downloads are generated client-side from public fixture bytes. The generator keeps private keys in memory only; tests assert no key/PFX files are tracked and no private-key PEM markers exist.
