# UX layout specification (v0.3.0)

Result of one internal Generator / Adversary / Normalizer design review of the v0.2.0 screen.

## Review summary
**Generator proposal:** scenario home first; one focused left-to-right flow; details on demand in a drawer; offline trust isolated at the far right; one animated artifact at a time.

**Adversary findings on v0.2.0** (all addressed below): 16 nodes always visible; long diagonal lines crossing the scene; labels on top of lines and 3D blocks; Root CA near the centre and visually "live"; a debug-style *canonical state* panel; technical text before plain-language text; controls competing with the diagram; unexplained abbreviations (CSR, AIA, CDP, EKU, SAN); colour-only distinctions; many indistinguishable timeline segments; narrow screens shrinking the whole diagram.

**Normalizer decisions:** flat cards (icon + name + role) instead of pseudo-3D blocks; orthogonal connectors in lanes; progressive disclosure (previous / current / next stage only); named milestone rail; five educational tabs; Root CA only in the Offline Trust zone and only when the chain is being explained.

## Screens
### Scenario home
Title, subtitle, a one-line synthetic notice. Large cards for the two available scenarios (purpose, requester, destination, method, step count, **Start scenario**). A quiet "Coming later" strip (NDES/SCEP, CEP/CES, autoenrollment, AIA chain retrieval, CRL/OCSP) that is never rendered in the workspace. Links: *Continue last scenario* (in-memory only), *View full PKI topology*, *About / icon legend*. The guided tour never starts here.

### Focused flow workspace
Scene (left, ~70 %), details drawer (right, five tabs), stage rail + controls (bottom).

**Zones, left to right:** Request origin, Server and key generation, Enrollment and policy, Online Issuing CA, Installation and use, Validation / outcome, Publication (AIA, CDP), **Offline trust (far right edge)**.

**Active-path rules**
1. Default view shows the entities touched by the previous, current and next stage plus the stage focus; later destinations of the next stage are dimmed; everything else is hidden.
2. Exactly one flow is emphasised; only the artifact belonging to the current step moves. Finished flows are thin and faded; idle flows are not drawn.
3. Connectors are orthogonal with fixed ports and lanes (return paths use a lower lane; remote services use top/bottom corridors).
4. Encodings (colour **plus** icon/pattern/label): request/CSR blue solid with envelope tag; policy purple dashed with shield tag; certificate gold double line with ribbon tag; install/binding teal with plug tag; validation query cyan dotted with magnifier tag; trusted green with check; failure red with cross; historical trust gray dotted.
5. The Root CA is never an endpoint of an active flow. It is drawn only inside the Offline trust zone, muted, with the note *Previously signed the Issuing CA certificate; not contacted for this request*, and a gray "historical trust" link to the Issuing CA.

### Stage rail
Named milestone groups (the stage `phase`), each containing its steps; current step number / total, step title, one-sentence purpose and progress within the step. Scrubber is available but visually secondary.

### Details drawer
Tabs: **Explain** (what, why, who, where, what moves next, what stays local, what can go wrong; abbreviations defined), **Technical details**, **Artifact** (real parser-backed inspector, friendly summary first, downloads, local native viewer), **Evidence** (each item labelled *Real fixture data*, *Simulated environment*, *Derived conclusion* or *User-selected fault*), **Troubleshoot** (expected vs current, causes, owner, checks, remediation, plus a collapsed Developer state). Selecting an entity or artifact never changes the scenario position; the drawer keeps working while paused.

### Full-topology view
Toggle *Show full topology* reveals all entities of the scenario in the same zones, inactive connections at low opacity, active connection dominant. Offline trust stays at the far right.

### Forward lifecycle / reverse evidence
Forward walks stages. Reverse keeps the finished world and moves through an evidence trace (question, claim, evidence kind, artifacts). Mode buttons state the difference in their tooltip and the Evidence tab.

### Responsive behaviour
Below 980 px the drawer moves under the scene, the scene keeps a readable minimum width and scrolls horizontally inside its frame, controls wrap, cards stay tappable (>= 44 px targets in the rail).

### Icon policy
A single custom flat icon family (see `assets/icons/SOURCES.md`); names always accompany icons. No official Microsoft product icon is used unless it is stored locally with source and terms recorded; custom icons are never presented as official.

### Accessibility
Every node, chip and rail milestone is a focusable control with an accessible name; status is conveyed by text pills as well as colour; `prefers-reduced-motion` disables pulsing; tabs follow ARIA tab semantics; focus is visible; contrast >= 4.5:1 for text.
