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

## v0.3.0: scenario-first presentation
- **Scenario registry** (`src/scenarios/index.js`): each scenario module exports stages (with `phase` milestone groups and plain-language `explain` content), flows (with `kind` and optional explicit orthogonal `route`), artifacts, faults, an evidence trace with `evidenceKind`, a `layout`, `zones` (one marked `offline`), `zoneOf`, `statusOf`, an optional `evaluate` for evidence, and `entityIds`. The engine is unchanged apart from `faultStagePatches` (a fault may alter an earlier stage's outcome).
- **Scene** (`src/views/scene.js`): flat icon cards, zone boxes, orthogonal connectors and an auto-fit transform. `visibleSets()` and `routeFor()` are pure and unit-tested. The default view shows the previous, current and next stage; the offline Root CA is added only when the stage `show`s or focuses it. Only artifacts of the current step move.
- **Teaching layer** (`src/ui/teach.js`, `details.js`, `details-dc.js`): Explain, Evidence, Troubleshoot and friendly artifact summaries are built from the canonical state, the evaluated evidence and the parsed fixtures.
- **Icons** (`src/views/icons.js`): one custom flat family; see `assets/icons/SOURCES.md`.
- **Film** (`film.html`, `src/film/`): the same app driven by `frameAt(time)`; captions are the app's own step info, so they cannot disagree with the state.


## v0.4.0 additions
- **Paths and conditions in the engine:** `pathOf(scenario, session)` turns a multi-path scenario (`paths`, `conditions`) into a cached, ordinary scenario view, so `worldAt`, `maxT`, `buildTrace` and the evaluators keep their signatures. `computeState` applies it, and TLS has no `paths`, so its behaviour is unchanged.
- **Evidence per path:** `main.js` and `film.js` evaluate `evidence["<scenario>"]` (Path A) and `evidence["<scenario>:<path>"]` for each path. `dc-evaluate.js` reads `scenario.pathId`; fixtures are resolved through `scenario.resolveFixture(model, artifactId, faultId)`.
- **Story view:** `src/views/story-layout.js` (pure disclosure, geometry, stores and connectors; shared by the renderer, unit tests and the visual review) and `src/views/story-scene.js` (SVG renderer, packet animation, focusable objects).
- **Story UI:** `src/ui/story-app.js` (`StoryController`: header, path, condition and fault selectors, START FLOW, rail, playback, panel state, final card, keyboard). `src/ui/story-panel.js` holds the pure panel builders: plain language, identity fields, CSR, certificate and store inspectors, template cards, command tokens, raw view, evidence and troubleshooting. `App` delegates to the controller when `scenario.layoutMode === 'story-zones'`. The classic TLS workspace and the `Scene` are untouched.
- **Markup:** `index.html` holds both workspaces (`.story-only` / `.classic-only`, toggled by `body[data-layout]`). `film.html` now imports `index.html` at startup instead of keeping a copy.
- **Fixture model:** `parseCsr` decodes request attributes (1.3.6.1.4.1.311.13.2.1 template name/value pair, 1.3.6.1.4.1.311.21.20 client information). `parseCertificate` resolves the template name from the 21.7 OID (`TEMPLATE_NAMES`). `parseP7b` reads PKCS #7 bundles.
- **Validation tooling:** `scripts/validation/visual-review.mjs` (`npm run review:visual`). Video names come from `package.json`, and partial renders write `-preview` files.


## v0.4.1 additions
- **StoryScene** (`src/views/story-scene.js`) takes `{ film }`. In film mode the travel token follows the stage progress (deterministic). Interactively it runs one 750 ms eased trip per step, and none under reduced motion. `opts.final` hides the plate headline while the final card occupies the top band. `whereText()` gives the artifact's current location.
- **story-layout.js:** `HEADLINE` band, history link along y 112, failed-accept association drawn `blocked`, vault visibility derived from `pendingRequest`, full topology reduced to de-duplicated hand-offs.
- **story-app.js:** URL sync (`history.replaceState`), the rail rewritten only when its state changes, copy buttons (copy only), token explanations on focus/hover, final-card open items.
- **Skip link and landmarks:** `index.html` has one visible `<main>` per screen (home, story, classic) and a skip link that follows it.
- **Quality gates:** `tests/e2e/a11y.spec.js` (axe), `tests/unit/theme-contrast.test.js` (token contrast), and `scripts/validation/visual-review.mjs`. The visual review covers 34 screens × 2 sizes × light/dark, checks the exact active-connector rule, and checks that no HTML overlay covers SVG text.


## v0.6.0: learning film
- **Separate composition.** `learning-film.html` + `src/film-learning/` is a second Vite entry (built for Pages next to `index.html`). It shares the fixtures, `model.js`, `synthetic.js` and the icon family, but not the app UI.
- **Layers.** `tokens.js` (motion and colour tokens, cubic-Bézier, spring, reading rule) → `timeline.js` (18 shots, captions, cues, camera keys) → `state.js` (`filmStateAt(t)`: the one canonical film state, world geometry, routes) → `facts.js` (display values from the parsed fixtures) → `render.js` (builds the 1920×1080 DOM once; `renderAt(t)` writes styles from the state only) → `main.js` (exposes `window.renderAt`, preview controls, reduced motion).
- **Camera.** A world of plates (CLIENT01, WEB01, ICA01, Offline Trust, PKIWEB01) inside a stage window. Sequential eased camera keys, with zoom interpolated in log space. Inspection plates (CSR, certificate, chain, reverse evidence) sit in stage space over a veil.
- **Export.** `scripts/video/lib.mjs` holds the shared pipeline: an in-process Vite server with HMR and watching off, headless Edge through Playwright, JPEG frames piped into FFmpeg, a contact sheet cut from the MP4, and ffprobe plus an MP4 atom check. `export-learning-film.mjs` uses it; `export-video.mjs` (the app film) is unchanged.

## v0.5.0: one story system, classic Scene removed
- **Removed:** `src/views/scene.js` (the classic Scene renderer), `src/views/status.js`, `src/entities/entities.js`, `src/ui/details.js`, `src/ui/teach.js`, `src/inspectors/inspector.js`, `src/scenarios/tls-presentation.js`, `src/scenarios/explain.js`, `scripts/validation/screenshots.mjs`, the classic markup in `index.html` and the classic CSS. Nothing used them once the TLS lesson moved to the story layout. The layers list above is historical for `entities/`, `inspectors/` and the classic `views/` modules.
- **Story descriptor:** a scenario may export `story` (zones, artifact vocabulary, labels, actor texts, store zone and stores, vault zone, CA zone, IIS and client-root cards, association labels, `whereText`). `storyOf(sc)` returns it or the built-in `DC_STORY`, so `story-layout.js` and `story-scene.js` serve both lessons with the DC output unchanged.
- **Panels per lesson:** `StoryController.P` picks `story-panel.js` (DC) or `tls-panel.js` (TLS); both expose the same builders (summary, plain, technical, command, raw, evidence, troubleshoot, final card, section order).
- **Evidence:** every scenario supplies `evaluate()`; `evaluateAll` no longer has a built-in default.
- **App:** `App` always runs the story controller. The guided tour drives the story session.
- **Film:** both film segments run the story layout (`src/film/schedule.js`: TLS 26 steps, then DC Path A).
