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


## v0.4.1 review (audit, fixes and the "technical plate" design pass)
`review:visual` now captures 34 screens at 1920x1080 and 1366x768 in **light and dark** (136 screenshots): home; DC before START FLOW; every milestone of both paths; faults rpc-blocked, wrong-template-handoff, accepted-on-wrong-machine, root-thumbprint-mismatch and cdp-unreachable; the panel on the CSR, the leaf, the Root, each store and the key vault; reverse evidence; full topology; TLS start and end. New automatic checks: the exact active-connector count for the step (1 when it moves something, else 0), and no HTML overlay (final card, tour bar) covering SVG text.

### Iteration 1 — audit (before fixes)
| Finding | Fix |
|---|---|
| accepted-on-wrong-machine: DC01's vault said "consumed … key now linked" and the association lane was drawn as completed (PKI error) | Fault state corrected; lane drawn blocked "certreq -accept ran on PKI-TRANSFER01, not DC01: nothing linked" |
| Full topology drew the finished blocked route with its cross, and finished routes overlapped | Finished routes are de-duplicated zone hand-offs only |
| The final card covered zone titles and the association-lane label | Compact card docked in the plate's free top band; new overlay check |
| Native-viewer button and note overlapped in the panel | Stacked |
| TLS classic rail labels rendered at 10 px | 11 px |
| No dark theme ("dark" screenshots were light) | Token system with a dark theme |

### Iteration 2 — after the design pass
| Finding | Fix |
|---|---|
| The new artifact-card footer rendered at 10.5 px at 1366x768 | Footer at the 14-unit scene minimum |
| At 1920 px the milestone rail wrapped its last chip (done ticks widened the chips) | Tighter chip padding and gap |

### Iteration 3 — accuracy re-review of the new text
| Finding | Fix |
|---|---|
| The card footer placed the return package and the Root/Issuing CA copies "on PKI-TRANSFER01" after they had reached DC01 | Step-aware wording ("on DC01, in the return package", "from the return package on DC01"); unit test |

**Final result:** 136/136 screens pass in light and dark; axe reports 0 violations; the token contrast test passes for both themes. Accepted, non-material: the 1600x720 plate keeps its aspect ratio, which leaves space above and below at 1920x1080; the TLS classic workspace stays light in dark mode by design.


## v0.5.0 Website TLS story
`review:visual` now captures 63 screens at 1920x1080 and 1366x768 in light and dark: **252 screenshots**. That is the DC set plus, for TLS, before START FLOW, the completed last step of all 10 milestones, four faults (no-enroll-permission, wrong-binding, missing-ica, wrong-dns), 14 inspector views (INF, CSR, request record, leaf, WEB01 stores, Issuing CA, IIS binding, handshake, CLIENT01 Trusted Root, Root, CRL, temporary certificate, private key, an open glossary chip), reverse evidence and full topology. The old classic-layout shots (L1, L2) were retired with the classic workspace. The active-route check now counts fault-specific routes (the blocked AIA download in missing-ica) and applies the same rule in reverse evidence.

Every screenshot was looked at, then reviewed in three roles. The **Generator** asked whether the picture shows the step. The **Adversary** asked whether a learner would understand *why* the step happens, and what is cluttered, sparse, misleading or low-contrast. The **Normalizer** decided what to change and what to accept.

### Iteration 1 — first TLS screens
| Finding (Adversary) | Decision (Normalizer) |
|---|---|
| A CLIENT01 ↔ "On the wire" route on the middle lane would cross the WEB01 store cards while zone 4 is shown during the handshake | New "wire" lane under the zones, entering through the gaps between zones. Indigo, so Act 2's messages read as network traffic. |
| "Temporary certificate" ran into the card edge; the vault line "stays on WEB01 · non-exportable" touched its edge; "signs the handshake here" overflowed the store entry | "Temporary cert" with the tag "self-signed by WEB01 · the browser warns"; "never leaves WEB01"; "signs here, in place" |
| With step dots on the current milestone, Act 2 wrapped onto a new row and the plate jumped between steps | Each act lays out its chips as a two-row grid; the rail height never changes |

### Iteration 2 — automatic checks at 1366x768
| Finding | Fix |
|---|---|
| The separate act-label row made the bar taller; the TLS plate dropped to scale 0.769 (text 10.8 px) and 0.755 in fault states (banner shown) | The act label is a small tab on the bar's top hairline (still a label above the rail, no row of its own). Act chips use 1 px vertical padding with a 24 px minimum height. Scale 0.805, or 0.794 with the fault banner. |
| Open glossary definitions were inline and overlapped the wrapped sentence | The definition follows the text as its own line |
| The "Simulated environment" pill overlapped wrapped text in the binding, record and key cards | The pill gets its own line |
| At the missing-ica halt the final card covered the Root history label | The muted history link is not drawn while the final card occupies the top band |
| Reverse evidence at "Why is the connection trusted?" draws the static route of `t-trusted`, but the check expected none | The check applies the same rule in both directions |

### Iteration 3 — accuracy and clarity by eye
| Finding | Fix |
|---|---|
| The CLIENT01 badge said "checks" while CLIENT01 was *sending* ClientHello | "CLIENT01 acts" |
| A learner might read the accept lane under the Issuing CA zone as "through the CA" | The lane label says "same computer (WEB01), never on the network"; both WEB01 zones are labelled "WEB01 (same computer)" |

**Final result:** 252/252 screens pass in light and dark; axe reports zero serious or critical violations on 17 screens × 2 themes. Accepted, non-material: the plate keeps its 1600x720 aspect ratio (space above and below at 1920x1080); the expanded drawer below 1600 px covers zones 5–6 until it is closed; Z3 breadcrumbs keep the DC row gap between the third and fourth chip.
