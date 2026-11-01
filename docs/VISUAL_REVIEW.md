# Visual review (v0.4.0 Domain Controller story)

`npm run review:visual` (scripts/validation/visual-review.mjs) starts its own Vite server and captures 20 screens at **1920x1080** and **1366x768** (40 screenshots, git-ignored in `screenshots/visual-review/` with `report.json`):

- every Path A milestone (10) and every Path B milestone (6), each at the last step of the milestone in its completed state;
- three faults: `rpc-blocked` (Path B), `root-thumbprint-mismatch` and `cdp-unreachable` (Path A);
- the expanded details panel (CSR selected at step 8).

The script fails on: horizontal page scroll, overlapping text bounding boxes (SVG text, and text inside the header, bottom bar, panel and final card), rendered text below 11 px, more than one active connector, and story elements or controls outside the scene or viewport.

Final automated result: **40 screens checked, 0 with problems.** Smallest rendered SVG text: 13.7 px at 1920x1080; 11.3 px at 1366x768 (11.0 px on the fault screen, where the fault banner takes one row).

The screenshots were then reviewed by eye in three passes: Generator (what works), Adversary (try to break clarity, accuracy, legibility and accessibility) and Normalizer (fix). The passes repeated until no material issue remained.

## Pass 1 — during the build (manual captures at 1920x1080 and 1366x768)
**Generator:** one active zone with an accent border; one spotlight artifact; the DC01 key vault stays visible from `a-new` to `a-accept`; stores are legible, with source tags; the association lane reads as "same computer".
**Adversary findings and Normalizer fixes:**
| Finding | Fix |
|---|---|
| Pressed path/direction buttons used the header's navy and disappeared | Pressed = gold background with dark text; unpressed = muted slate |
| Header wrapped to three rows at 1366 px, squeezing the scene | Fault select moved to row 2; condition labels shortened (note kept as a tooltip) |
| Offline Trust text ran past its box | Shortened to "SIMSI2027-ROOTCA" / "offline · not contacted" |
| Placeholder zones showed half of a two-line description ("Submission, policy,") | Placeholders show both lines |
| Personal store entry text ran past its card | "linked by -accept" (Path B: "installed by the wizard") |
| Clicking inside the expanded panel was misrouted (the panel's own `data-open` attribute matched the link delegation) | Panel state attribute renamed to `data-expanded`; delegation excludes the panel |
| Final card buttons were rebuilt every animation frame and could not be clicked reliably | Final card is rewritten only when its content changes |
| Escape returned focus to nothing when the scene had been redrawn | Focus returns to the same object by its selection identity |

## Pass 2 — first `review:visual` run (0 automated problems; manual review)
**Generator:** the rail, caption and final card make the position obvious; the CSR inspector puts plain language before the parsed fields; the drawer at 1366 px leaves the active zone visible.
**Adversary findings and Normalizer fixes:**
| Finding | Severity | Fix |
|---|---|---|
| `rpc-blocked`: the halted step still drew a normal blue route and showed the CSR at ICA01, implying the request arrived | Accuracy (material) | A route a fault stops is drawn red-dashed with a cross and "RPC/DCOM blocked"; the CSR stays in the wizard zone, captioned "not delivered: RPC/DCOM blocked" (unit-tested) |
| Path B showed the Path A condition "Trust certificates missing" in a disabled select | Clarity | Path B shows "Not applicable: CA certificates from AD (Enterprise store)" |
| The request record did not show who the CA recorded as Requester (golden rules 3–5) | Accuracy | The record card shows "Request 1042 · status" and "Requester: SIMSI2027\PKIOperator" |
| Remediation card said only "root cause still open" | Clarity | "root cause still open · open items in Details" |

## Pass 3 — after the fixes
**Adversary finding:** `cdp-unreachable` drew the CDP fetch as a normal blue HTTP route although the CDP is unreachable. **Fix:** the CDP route is drawn red-dashed with a cross and "HTTP (CDP) unreachable", and the CDP endpoint reads "unreachable: revocation offline" (unit-tested). The flow continues to the withheld verdict.

**Generator re-check:** all 40 screens pass; the three fault screens state where the flow stopped, why, and what to do next. No material issue remains.

## Known, accepted (non-material)
- At 1920x1080 the 1600x720 scene keeps its aspect ratio, which leaves white space above and below it.
- The plain-language section deliberately repeats "no private key" in the object summary and the step text.
- In **Show full topology**, thin finished connectors may cross each other. The focused view, which is the default, is crossing-free (unit-tested).
- The expanded drawer at widths below 1600 px covers zones 5–6 by design; Escape or Close restores the view.
