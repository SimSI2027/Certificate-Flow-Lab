# v0.6.0 audit: learning film "From CSR to Trust"

Scope: `src/film-learning/*`, `learning-film.html`, `scripts/video/lib.mjs`, `scripts/video/export-learning-film.mjs`, the home-screen film entry. The interactive TLS and Domain Controller lessons are unchanged; their existing tests all pass.

## 1. pki-accuracy-review (film sweep)

Procedure: the CLAUDE.md PKI model, Website TLS truth rules and the skill's text, identity, key/store, flow, fixture and test sweeps, applied to the film text, state and facts.

| id | rule | severity | file:line | evidence | fix |
|----|------|----------|-----------|----------|-----|
| F1 | Global wording guard: "signs the CSR" phrase banned | Medium | src/film-learning/state.js (comment) | The existing `tls-story.test.js` sweep flagged the comment "signing the CSR" (it described WEB01's own CSR signature, but the phrase is banned project-wide) | Reworded to "the CSR signature made by WEB01". Fixed. |
| F2 | Return-package contents are configuration-dependent (DC rule 24 analogue) | Medium | src/film-learning/timeline.js shot 9 | The caption said the leaf and the Issuing CA certificate return, without noting that the response format decides this | Added the evidence label "Response contents depend on its format (certificate or PKCS #7 chain) · Depends on your configuration". Fixed. |
| F3 | Offline Root wording | Low | src/film-learning/render.js offline plate | "Powered off between ceremonies" is an operational claim | Changed to "Used only to sign CA certificates and its own CRLs." Fixed. |
| F4 | Abbreviations before definition | Low | WEB01 store labels (shot 2) | Store entries name "SIMSI2027 Issuing CA 01" before the caption defines CA (shot 6). These are proper names inside real store contents. | Accepted. Captions and callouts define every abbreviation at first use (unit-tested). |
| F5 | Names differ from the run brief | Low (decision) | src/film-learning/facts.js | The brief used "User 1" and "SIMSI2027\AppOwner"; the project's TLS truth rules and the CSR fixture (ClientInformation = SIMSI2027\Morgan) use Jordan and Morgan | Kept Jordan and Morgan, so the film and the app tell one canonical story and every displayed value matches the fixtures. |

Verified with no finding:
- The private key is created on WEB01 and stays at one position in the vault. It is never on a route or on the wire; only its signatures travel.
- The CSR holds the public key, name, template and signature, and no private key (`hasPrivateKeyMaterial = false`). Its signature verifies.
- The CA receives the request before the policy checks.
- The CSR stays an input while a separate certificate structure is filled (fields marked "from CSR" or "by CA"), and the Issuing CA signs that new certificate. No CSR morph.
- The Root CA is never contacted and is never a route endpoint. Its plate is muted and labelled "Not contacted for this request".
- Stores: the leaf with its key is in Personal; the Issuing CA is in Intermediate and the Root in Trusted Root, both without keys and both "from AD".
- The handshake sends the leaf and the Issuing CA certificate; the Root is not sent. CertificateVerify is checked with the leaf's public key, and session keys encrypt the data.
- AIA and CDP use separate URLs, routes and moments; AIA is shown as not needed. The CRL lists other serials, not the leaf.
- Configuration markers are present for template policy, AD and Group Policy distribution and revocation checking.
- Every certificate, CSR and CRL value comes from `filmFacts(model)` (unit-tested against the parsed fixtures).

## 2. GAN self-review (single internal pass, no agents)

**PKI adversary.**
- Visitor vs requester: Jordan only reports; the "never requests or owns" caption and a unit test guard it.
- Application owner vs WEB01: Morgan is a badge on the WEB01 plate; WEB01 does the key work.
- Private key travel: the key never moves (unit test samples every 50 ms); the "Private key stays here" pin is shown during both trips.
- CSR becoming the certificate: it stays visible as an input card ("input · request 1043").
- Root active: the Root plate is muted and never connected.
- AIA/CDP: separate.
- TLS encryption: corrected to session keys.
No open finding beyond F1–F5.

**Learning adversary.**
- Too much at once in shot 8: fixed by collapsing earlier field groups to their titles.
- Captions too short in shots 8d and 12a (7.0/7.1 s and 5.8/5.9 s): fixed by lengthening both windows; all captions now meet the rule (unit-tested).
- Abbreviations defined at first use (unit-tested): CSR, CA, SAN, EKU, AIA, CDP, CRL, TLS.

**Motion adversary.**
| frame / time | finding | fix |
|--------------|---------|-----|
| f5490 (91.5 s), shot 8 start | Instant camera cut behind a veil that was still fading in | 0.9 s camera move; continuity unit test (no per-frame jump > 120 world px or zoom step > 8 %) |
| shots 2, 9 (store and accept) | The link label covered the Trusted Root heading; the link line crossed the vault text | Short vault-to-leaf link line; label removed (the vault states "Linked to the leaf in Personal") |
| shot 2 | The report ticket landed on the WEB01 title | It now lands in the empty request area |
| shots 7, 8 | The new certificate and the certificate plate overflowed | Tighter rows, middle-truncated serial, collapsed past groups |
| shots 2, 9, 10 | Store entries overflowed their cards | Shorter entry text, overflow clipped |
| shots 12, 14 | Messages lingered over the checks panel | They fade after arrival |
| shots 12, 14, 15 | Pull-backs were too small to read | Zoom raised to 0.54 / 0.74; travelling chips counter-scaled to stay legible |
| all frames (stills run 3) | The cap on preview height also limited the capture frame, shifting it 133 px | Capture overrides restored; an e2e test asserts the frame box is 0,0,1920,1080 |
| full render 1 | Vite HMR reloaded the page when a source file changed mid-render (render aborted at about frame 1800) | Export server runs with HMR and watching off; the unhandled rejection is fixed |

## 3. web-design-guidelines (film page)

- Controls are native buttons, a range input and a checkbox with accessible names. There is a visible 3 px focus ring. Space and arrow-key shortcuts don't take over focused form controls.
- Captions are announced in a polite live region. The frame has `role="img"` with a label that points to them.
- Reduced motion follows `prefers-reduced-motion` and has its own toggle. There is no flashing (at most one 0.3–0.5 s fade per element; no strobe).
- Contrast: the caption ink (#16243A, #3C4A5E) and muted (#5B6577) text on the #EEEDE8 paper are at least 4.5:1. Meaning never rests on colour alone: every artifact has a text label and every check has a glyph and a word.
- Responsive: there is no horizontal scroll at 390 px. The player keeps 16:9 and is capped to the viewport height on desktop.
- axe reports zero serious or critical violations (`tests/e2e/learning-film.spec.js`).
- Remaining (Low): film text is small when the player is phone-sized. That is inherent to a 1920×1080 composition; the shot list and live-region captions carry the content.
