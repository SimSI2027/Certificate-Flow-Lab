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

## v0.2.0: dual public/local architecture

| mode | served by | native viewer | notes |
|------|-----------|---------------|-------|
| Public | GitHub Pages, `/Certificate-Flow-Lab/` base path | never (no probing, no network) | static bundle; fixtures are embedded; downloads are generated in the browser |
| Local | Vite on `127.0.0.1:5183` + companion on `127.0.0.1:5184` | yes | started by `tools/windows/Launch-Demo.ps1` |
| Preview | `vite preview` on `127.0.0.1:5185/Certificate-Flow-Lab/` | yes | `Build-And-Preview.ps1` |

`vite.config.js` uses base `/` for dev and `/Certificate-Flow-Lab/` for builds, stamps version and commit, and emits `version.json`.

### Companion-service security model (`tools/companion/`)
- Binds `127.0.0.1` only. Accepts `POST /open-certificate {"artifactId": ...}`; any other field (for example `path`) is rejected.
- IDs must match `^[a-z0-9-]{1,40}$` and exist in the frozen allowlist `src/artifacts/native-ids.js` (root, issuing CA, website and fault CER fixtures). The ID maps to a fixed file name under `fixtures/certificates`; the canonical (realpath) result must stay inside that folder and end in `.cer`. CSR, CRL, PEM, keys and arbitrary files are unreachable.
- Requires header `X-CFL-Token` (random per launch, compared in constant time, passed to the page in the URL fragment, never persisted) and an `Origin` that is one of the local simulator origins. CORS headers are returned only for those origins.
- Opens the file via `explorer.exe <file>` (`execFile`, no shell). Errors never return filesystem paths. `GET /health` exposes only service name and IDs.
- Exits when the launcher exits (parent-PID watch) and runs unelevated.

### Video pipeline
`src/film/schedule.js` is a pure function from film time to session, selection, panel and camera. `film.html` applies it to the same `App`/`Scene`; captions and the state strip are derived from the canonical state. `scripts/video/export-video.mjs` starts Vite in-process, captures each timestamp with Playwright and pipes JPEG frames to FFmpeg (no temp frames), then builds the contact sheet from the encoded MP4. CSS animations are disabled in film mode.

### Process cleanup
`tools/windows/Common.ps1` holds shared helpers; the launcher keeps child process handles and stops their trees in `finally`.
