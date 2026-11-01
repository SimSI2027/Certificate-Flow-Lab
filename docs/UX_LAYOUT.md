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


## v0.4.0 Domain Controller story layout (`layoutMode: 'story-zones'`)
The DC scenario uses `StoryScene` (src/views/story-scene.js), whose geometry and disclosure come from the pure module `src/views/story-layout.js`. TLS keeps the classic focused layout above.

**Rule: ONE ACTIVE ZONE • ONE ACTIVE ARTIFACT • ONE ACTIVE ROUTE.**

### Coordinates (SVG viewBox 0 0 1600 720, `preserveAspectRatio xMidYMid meet`)
- Zones: y 120, h 480, w 244, x = 24, 284, 544, 804, 1064, 1324. Z1 "DC01 — diagnose and key ownership", Z2 "Request package — INF and CSR", Z3 "Controlled transfer — PKI-TRANSFER01", Z4 "Issuing CA — submission, policy, approval, issuance", Z5 "Return package — leaf and public chain", Z6 "DC01 certificate stores". Path B relabels Z2 "Enrollment wizard", Z3 "Direct RPC/DCOM (no handoff)" and Z5 "Automatic response". Z1 and Z6 both carry "DC01 (same computer)".
- Offline trust: x 1324, y 16, 244 × 88. It is muted, and emphasised only in `a-chain` / `b-chain` or while a CA certificate is inspected.
- Station card per zone: x+12, y 136, 220 × 64. Actor badge: x+12, y 212, 160 × 32, on the acting zone only (in Z6 it is drawn inside the station card).
- Spotlight artifact card: x+16, y 290, 212 × 140, for the active artifact only. Transport lane: y 360.
- Z1 key vault: 40, 470, 212 × 104, from `a-new` to `a-accept`: "Certificate Enrollment Requests — pending request + private key".
- Z6 store cards: x 1340, y 216 / 344 / 472, 212 × 112 (Personal, Intermediate Certification Authorities, Trusted Root Certification Authorities).
- DC01 internal association lane: y 624, from the key vault to Personal, in `a-accept` and `a-key` only. It is dashed and labelled "certreq -accept links this certificate to the existing key — same computer, never on the network".
- PUB strip: x 804, y 640, w 504, h 64, in the verify milestones only. AIA and CDP are two separately labelled endpoints.
- Fonts: names 16/600, everything else at least 14. Rendered text is at least 11 px at 1366x768 (checked by `npm run review:visual`).

### Disclosure
- The active zone is drawn in full with an accent border. Its previous and next zones (`adjacent`) are drawn at 70% opacity. Other zones are placeholders: a dashed outline with name and number at 30%.
- Finished zones show clickable 28 px breadcrumb chips for their earlier artifacts. Future artifacts are not drawn. CA certificates are not drawn before they are installed (under `trust-present` they appear from `a-trust-check`).
- Before START FLOW only the six placeholders and the Offline Trust box are drawn, with no connectors.
- Show full topology makes every zone adjacent and draws finished routes thin, with the active route still dominant. It is never the default.
- Connectors are orthogonal, with a 12-unit corner radius, no diagonals, no crossings and no route through a card (unit-tested). Each carries one channel label from a fixed set: "local file", "approved file transfer", "RPC/DCOM", "CA approval (console)", "local store write", "HTTP (CDP)". A blocked route is red, dashed, crossed and labelled "RPC/DCOM blocked" or "HTTP (CDP) unreachable".
- The Root CA is never an endpoint. Only a grey dotted link "signed the Issuing CA certificate earlier (offline)" runs from Offline Trust to Z4. The Root certificate in Z5/Z6 is a "public copy". The private key never appears on a transport route.

### Header, rail and panel
- Header: Home · title · Path segmented control · Condition · Fault · START FLOW (replaced by "Step n of N · title") · Forward flow | Reverse evidence · Show full topology · Guided tour.
- Bottom bar: named milestone chips (the current chip shows step dots; a click jumps to the milestone's first step) · Previous · Play/Pause · Next · Restart · Speed (0.5x, 1x, 2x). The numbered stage boxes, scrubber and jump selector are hidden in story mode.
- Details panel: collapsed by default (a 320 px summary at 1600 px and wider, a 48 px "Details" tab below that). Expanded it is a 480 px column at 1600 px and wider, otherwise an overlay drawer. Sections, in order: 1 Plain language (open) · 2 Technical details · 3 Command explanation (clickable tokens; "Shown for learning; never executed by this simulator.") · 4 Raw artifact (PEM / ASN.1 on demand) · 5 Evidence · 6 Troubleshoot (moves to position 2 and opens when a fault halts). Escape closes the panel and returns focus to the trigger. Selecting never moves the timeline. Below 980 px the layout stacks.
- Final step card: "Suitable now; root cause still open", "Not confirmed suitable — revocation status unknown", or "Stopped: <fault>", with Restart and Reverse evidence buttons (and "Switch to Path A" for `rpc-blocked`).
- Accessibility: every zone, artifact, store, certificate, chip, endpoint and milestone is focusable and has an accessible name. Status is shown as text plus colour. Panel sections use ARIA disclosure. Space plays or pauses, ←/→ step. Focus is visible. `prefers-reduced-motion` hides the moving packet.
