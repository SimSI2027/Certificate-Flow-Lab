# Audit of the v0.4 Domain Controller story (release v0.4.1)

## Release state at the start of the audit
- Branch `main`, clean apart from the untracked third-party skill (`.claude/skills/web-design-guidelines/`, `skills-lock.json`).
- `v0.4.0` exists locally and on origin (tag object `18b21b6e…` → commit `7bd668f`). `package.json` is 0.4.0. Deployed `version.json`: `{"version":"0.4.0","commit":"7bd668fb…"}`.
- **Release target rule:** `v0.4.0` is published on origin, so this run releases **v0.4.1**. `v0.4.0` is never moved or recreated.

## Baseline (before any fix)
`npm ci` OK · `fixtures:validate` all pass · unit + integration **203/203** · Playwright **41/41** · build OK (JS 541.3 kB, gzip 155.5 kB; v0.3.0 was 476.9 kB) · Pages smoke **9 PASS** · `review:visual` (v0.4.0 script) **40/40**.

## How each audit ran
| Audit | Skill | How it ran |
|---|---|---|
| A. PKI accuracy | `pki-accuracy-review` (project-owned, `.claude/skills/pki-accuracy-review/SKILL.md`, created this run) | Created at the start of the run. It became available in the session's skill list mid-run and was **invoked as a skill**; its eight steps were followed. |
| B. Spec conformance | — | Manual, against CLAUDE.md, `docs/SCENARIO_MODEL.md` and `docs/UX_LAYOUT.md` (no `docs/DC_ENROLLMENT_SPEC.md` exists). |
| C. Web interface guidelines | `web-design-guidelines` (third-party, git-ignored) | **Invoked as a skill.** The skill fetches its rules from `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`. No WebFetch tool was available and subagents are not allowed in this run, so the public file was downloaded with a plain HTTP GET (8,055 bytes) and applied as written. |
| D. Visual GAN review | — | `npm run review:visual`, extended to the full screen set (home, before START FLOW, every milestone of both paths, five faults, panel on CSR / leaf / Root / each store / key vault, reverse evidence, full topology, TLS start and end) at 1920x1080 and 1366x768, in light and dark. 168 screens; reviewed by eye. |
| E. Accessibility | — | `@axe-core/playwright` (new devDependency), `tests/e2e/a11y.spec.js`: 8 screens × light/dark, WCAG 2.0/2.1 A/AA + best-practice. |
| F. Engineering hygiene | — | Manual, using git and grep. |
| Design pass (section 4) | `frontend-design:frontend-design` (plugin) | Invoked as a skill in the modernization phase (see below). |

## Findings (sorted by severity)
Severity: **Critical** = teaches something false about PKI or leaks key material; **High** = a golden rule visibly violated, a release requirement unmet, or untested in a way that could regress silently; **Medium** = misleading, incomplete or inaccessible; **Low** = polish.

| id | audit | rule | severity | file:line | evidence | fix | status |
|---|---|---|---|---|---|---|---|
| P1 | A | Golden rules 7, 8, 22 (key stays in the pending request until a *successful* accept on DC01) | Critical | src/scenarios/dc/shared.js:163-167; src/views/story-scene.js:77 | `user-context` halted at `a-accept`: DC01's key vault reads "empty: request consumed by certreq -accept (key now linked)", `keyState` = associated and a keyless leaf is installed in Personal. In reality the key is in the operator's user store, and `-accept -machine` finds no machine request and installs nothing. | Fault patch keeps `pendingRequest`/`keyState` = user-store and the leaf not installed; vault text derives from the state; consistency test. | open |
| P2 | A | Golden rules 22, 23 | Critical | src/scenarios/dc/shared.js:168-172; src/views/story-layout.js (association connector) | `accepted-on-wrong-machine`: DC01's vault says "consumed … key now linked", and the DC01 association lane is drawn as if the link happened, although `-accept` ran on PKI-TRANSFER01. | The DC01 pending request stays present; the association lane is not drawn as a completed link (blocked: "not run on DC01"); test. | open |
| P3 | A | Golden rule 22 | High | src/scenarios/dc/shared.js:173-176 | `pending-request-lost`: a successful accept installs a keyless leaf in Personal. Without a matching pending request, `-accept` fails and installs nothing. | Leaf not installed; vault "request lost"; test. | open |
| P4 | A | Golden rules 10, 11, 22 | High | src/scenarios/dc/shared.js:193-195 | `key-mismatch`: `a-accept` shows a successful link (vault consumed, `keyState` associated); then `a-key` reports a mismatch. `-accept` links by public key, so a certificate whose key matches no pending request cannot be linked. | `a-accept` effect: the wrong certificate sits in Personal unlinked, the pending request remains, and `a-key` confirms the mismatch (halt step per spec kept); test. | open |
| T1 | A (test sweep) | Rules 7, 8, 20-22 | High | tests/unit/story-scene.test.js | No test checks key / vault / Personal consistency at fault halts; P1-P4 slipped through. | Consistency test over every fault of both paths. | open |
| A1 | E | WCAG 2.5.3 Label in Name | High (axe "serious") | src/views/story-scene.js (aria-label strings) | `label-content-name-mismatch` on 114 nodes in 14/16 screens: accessible names do not start with the visible text (e.g. Offline Trust, zone stations, spotlight cards). | Accessible names begin with the visible text; extra context follows. | open |
| D1 | D / brief §4 | Light + dark themes | High | src/ui/styles.css | No design tokens or dark theme: the "dark" screenshots render light. | Token system with `prefers-color-scheme` light/dark; AA contrast. | open |
| P5 | A | Golden rule 4 (Path B mechanism) | Medium | src/ui/story-panel.js:194 | Path B certificate card: "How did it get here? certreq -accept on DC01" (Path B has no accept step). | Path-specific source text: "Installed automatically by the enrollment wizard". | open |
| P6 | A | Path B accuracy | Medium | src/scenarios/dc/shared.js (ARTIFACTS.accepted); story-scene.js | Path B labels the leaf "Accepted leaf" although nothing is accepted. | Path B label "Installed leaf". | open |
| P7 | A | Golden rule 27 (marker readable) | Medium | src/scenarios/dc/shared.js:6; path-csr.js:23,27,86,155; path-mmc.js:27,61 | `cfg()` appends the marker to fragments: "…; which ports are needed (Depends on your configuration.)", "…0x800706BA. The exact event details (Depends…)", "…How trust and autoenrollment are distributed (Depends…)". | `cfg(text, aspect)` renders "text — aspect: Depends on your configuration."; rewrite fragments; the marker test also requires a complete sentence. | open |
| P8 | B | Condition long-term fix (spec §6) | Medium | src/scenarios/dc/shared.js:124 | `trust-missing` has no long-term remediation in data or UI. | `longTerm` on the condition, shown in `a-trust-check` / `a-root` and Troubleshoot. | open |
| S1 | D | Disclosure clarity | Medium | src/views/story-layout.js (full branch) | Full topology draws the finished `a-why` blocked route with its red cross, and finished routes overlap into loops (T1-full-topology). | Finished routes are drawn without crosses and labels; blocked finished routes are drawn as muted dashes. | open |
| S2 | D | One active route stays visible | Medium | src/ui/styles.css (`.final-card`) | At a fault halt on `a-accept` the final card covers the association-lane label. | Final card docked in the bottom band; lane not drawn for failed accepts (P2). | open |
| S3 | D (auto) | Overlapping text | Medium | src/ui/story-panel.js (`artifactInspector`), styles.css `.native` | "Open in Windows Certificate Viewer" overlaps its note in the panel (P2/P3 screens). | Stack button and note. | open |
| A2 | E | Landmarks | Medium (axe "moderate") | index.html:12 | `landmark-one-main` on the home screen (no `<main>`). | Home content inside `<main>`; only the visible workspace exposes a main landmark. | open |
| W1 | C | Skip link | Medium | index.html | No skip link to the main content. | "Skip to the lesson" link. | open |
| W2 | C | URL reflects state | Medium | src/ui/story-app.js | Path, condition, fault and step are read from the URL but never written back; a refresh loses the position. | `history.replaceState` with `path`, `condition`, `fault`, `t`. | open |
| W3 | C | Performance (batch DOM writes) | Medium | src/ui/story-app.js (render) | Rail step dots are rewritten via `innerHTML` on every animation frame. | Render the rail only when its key changes. | open |
| E1 | F | Dead code / duplicated constants | Medium | src/ui/details-dc.js; src/scenarios/explain.js:57-94 (DC_EXPLAIN, hand-typed `"SIMSI2027-ICA01\SIMSI2027 Issuing CA"` at :77); src/ui/teach.js `isDc`; src/inspectors/inspector.js `isDc`; src/entities/entities.js:16,23-26; src/ui/app.js:242 | The classic-DC code is unreachable since v0.4.0 and still carries the old, wrong CA config string. | Remove; move the remaining assertions to the story suites. | open |
| E2 | D (auto) | Text ≥ 11 px | Medium | src/ui/styles.css:111 (`.gl` 10 px) | The TLS classic rail group labels render at 10 px (shared shell). | 11 px minimum for shared shell text; TLS layout and behaviour unchanged. | open |
| W4 | C | Tabular numerals | Low | src/ui/styles.css (`.mono`) | Thumbprints and serials lack `tabular-nums`. | Monospace stack + `tabular-nums`. | open |
| W5 | C | Theming details | Low | index.html; styles.css | No `theme-color` meta; native `<select>` colours not explicit (Windows dark mode); drawer lacks `overscroll-behavior: contain`; headings lack `text-wrap: balance`; identifiers lack `translate="no"`. | Add each. | open |
| W6 | C | Title Case for headings/buttons | Low | index.html, story-app.js | The project uses sentence case consistently ("Show full topology", "Open details"). | **Not changed (justified):** sentence case is the project's established style and matches Windows UI conventions for the commands being taught. | justified |
| P9 | A | Wording precision | Low | src/scenarios/dc/path-mmc.js:42 | "builds and signs the request" (correct: signed with DC01's new key, not by the CA). | "…and signs it with the new DC01 private key". | open |
| S4 | D | Sparse layout | Low | story-scene.js spotlight card | Spotlight cards have an empty lower half; wide whitespace at 1920 px. | Design pass. | open |
| S5 | D | Reverse evidence context | Low | story-scene.js | In reverse mode the scene does not show which evidence question is being discussed. | Evidence caption ribbon inside the scene. | open |
| E3 | F | Bundle size | Low | dist | JS 541 kB vs 477 kB in v0.3.0 (+13%). | Expected growth (story modules); dead-code removal offsets part of it. | open |
| E4 | F | Third-party skill untracked | Low | .gitignore | `.claude/skills/web-design-guidelines/` and `skills-lock.json` were untracked but not ignored. | Ignored (checked with `git check-ignore`). | open |

### Audit B (spec conformance) summary
Checked exactly against the brief:
- Path A has 10 milestones and 24 step ids, in order. Path B has 6 milestones and 11 step ids.
- Conditions: label, note, default, and "Already present — skipped".
- All 14 faults carry symptom, evidence kind, owner, remediation, stops, longTerm and halt step.
- Reverse evidence: 10 items on Path A plus the Path B substitutions, all with kind labels.
- The CSR, certificate and store inspectors show every field.
- Command tokens and the banner.
- The panel is collapsed by default, its section order is correct, and Escape closes it.
- Selection keeps the timeline position.
- In story mode the scrubber, jump selector and stage boxes are absent; START FLOW, the path switch, and full topology off by default all work.

All conform, except **P8** (the condition's long-term fix is missing). The v0.4.0 deviations stay as documented in `docs/SCENARIO_MODEL.md`.

### Audit F summary
No forbidden file is tracked (keys, pfx/p12, .lnk, dist, screenshots, output media, node_modules). There are no console errors on any captured screen. Video and contact-sheet names derive from `package.json`. TLS tests and behaviour are unchanged.

## Fix status (v0.4.1)
| Commit | Findings fixed |
|---|---|
| 3cf55b1 fix(pki) | P1, P2 (Critical); P3, P4, T1 (High); P5, P6, P7, P8 (Medium); P9 (Low) |
| 05224a9 fix(hygiene) | E1, E2, W2, W3 (Medium); E4 (Low) |
| b898fde fix(a11y) | A1 (High); A2, W1 (Medium) |
| cb5a300 fix(layout) | S1, S2, S3 (Medium) |
| e99792f design | D1 (High); W4, W5, S4, S5 (Low) |
| (this commit) | R1, R2 from the second PKI review |
W6 is justified (not fixed). E3: the bundle shrank 541.3 -> 536.8 kB after dead-code removal and grew again with the design pass; accepted.

## Second review passes (release gate)
- **pki-accuracy-review (invoked as a skill, second time).** Text sweep clean: the only matches are correct negations (LIMITATIONS.md:29, path-csr.js:130). Identity, key/store, flow, fixture (fixtures:validate) and test sweeps are green. New findings in the design-pass text:

| id | rule | severity | file:line | evidence | fix | status |
|---|---|---|---|---|---|---|
| R1 | Artifact location accuracy | Medium | src/views/story-scene.js (whereText) | The card footer placed the return package and the Root/Issuing CA copies "on PKI-TRANSFER01" after a-return-move had moved them to DC01. | Step-aware wording; unit test "artifact location wording". | Fixed |
| R2 | Template location | Low | src/views/story-scene.js (whereText) | The Path A template card said "on DC01". | "chosen for the change record". | Fixed |

- **web-design-guidelines (invoked as a skill, second time).** Rules re-fetched over plain HTTP (identical to the first fetch, 8,055 bytes). The changed UI files have no transition: all, no zoom blocking and no paste blocking. They have tabular numerals, balanced headings, theme-color, overscroll containment, a skip link, translate=no on identifiers, reduced-motion variants and aria-live status. The only remaining item is W6 (Title Case), justified above.
- **axe:** 0 violations of any impact (16 screens, light and dark). **review:visual:** 136/136 screens pass, light and dark.

## Deviations (v0.4.1)
- No WebFetch tool and no subagents in this run: the web-design-guidelines rules were fetched with a plain HTTP GET and applied as written.
- In dark mode the TLS classic workspace intentionally stays light, which keeps its layout and screenshots unchanged.
- `key-mismatch` still halts at a-key, as specified. The a-accept step now shows the certificate unlinked in Personal and the pending request still present, because certreq -accept cannot link a key by a mismatched public key.