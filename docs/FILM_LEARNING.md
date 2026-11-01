# Learning film v1: From CSR to Trust

**Objective.** In one silent, code-rendered film, teach how a website certificate request moves from a browser error to a trusted HTTPS connection: who reports the problem, who requests and owns the certificate, what the private key, public key and CSR are, how the Issuing CA evaluates the request and creates and signs a **new** certificate, where the certificate is installed and how it is paired with the key that never left WEB01, what Subject, SAN, EKU, Key Usage, AIA and CDP do, how chain and revocation checks work, and why session keys (not the certificate) encrypt the traffic.

- **Public preview:** `learning-film.html` (on GitHub Pages: https://simsi2027.github.io/Certificate-Flow-Lab/learning-film.html). It is linked from the home screen.
- **Length:** 18 shots, about 3 min 54 s. The 0.3 s per word + 0.5 s reading rule, applied to the required content, sets the length; it is longer than the 50–70 s first sketched.
- **Sound:** none in v1. Every point is in the on-screen captions.

## Story (18 shots, three acts)

| # | Shot | Teaching objective |
|---|------|--------------------|
| 1 | The problem | Jordan (visitor, CLIENT01) gets an untrusted connection: WEB01 offers only a temporary self-signed certificate. |
| 2 | Report and investigation | Jordan only reports the symptom; Morgan (application owner) checks WEB01. |
| 3 | The private key | `certreq -new -machine` creates a non-exportable private key that stays on WEB01. |
| 4 | Public key and CSR | The public key is safe to share; the CSR carries it and the requested name, signed with the private key. |
| 5 | Inside the CSR | Subject, SAN, public key, template, signature (proof of possession); no private key. |
| 6 | Submission and policy | The CA receives request 1043 first, then checks requester, template, name, key and purpose. |
| 7 | Certificate issuance | The CSR stays an input; a separate new certificate is filled (copied and CA-added fields) and signed by the Issuing CA. The offline Root is shown as not contacted. |
| 8 | Inside the certificate | Four groups in turn: identity, validity and identification (serial, thumbprint), purpose (EKU, Key Usage), locations (AIA, CDP). |
| 9 | Return and installation | The public leaf and Issuing CA certificate return; `certreq -accept -machine` pairs the leaf with the key that waited on WEB01. |
| 10 | Certificate stores | Personal (leaf + key), Intermediate (Issuing CA, no key), Trusted Root (Root, trust anchor, no key). |
| 11 | IIS binding | Installed is not in use until the https · 443 · host name binding points at the new certificate. |
| 12 | Client retry and checks | The handshake delivers leaf + Issuing CA (Root not sent); CLIENT01 checks name (SAN), dates and purpose. |
| 13 | The chain | Leaf → Issuing CA → Root; each signature verified with the issuer's public key; the Root is trusted because it is already in CLIENT01's store. |
| 14 | AIA and CDP | Two separate routes: AIA not needed (the intermediate already arrived); CDP delivers CRL #27, the leaf serial is not listed. |
| 15 | Proof and session keys | CertificateVerify proves WEB01 holds the key (signature only); both sides derive session keys that encrypt the data. |
| 16 | Trusted connection | SECURE CONNECTION ESTABLISHED; Morgan's follow-up: renew before 2027-10-30. |
| 17 | Reverse evidence | From the trusted connection back to the original problem, one evidence item at a time (causality, not a reversed animation). |
| 18 | End card | Certificate Flow Lab · From CSR to Trust · simsi2027.github.io/Certificate-Flow-Lab/ |

Names follow the project's Website TLS truth rules (CLAUDE.md): the visitor is **SIMSI2027\Jordan** and the application owner, operator and CA-recorded requester is **SIMSI2027\Morgan**. The CSR fixture's ClientInformation attribute records `SIMSI2027\Morgan`, so the film uses these names rather than generic placeholders, keeping one canonical story across the app and the film.

## Deterministic render contract

- `window.renderAt(t)` (seconds) renders the frame for film time `t`; every frame is a pure function of `t`.
- `src/film-learning/state.js` → `filmStateAt(t)` is the **one canonical film state**: shot, caption, camera, overlay, key, CSR, new certificate, leaf, stores, IIS, wire, checks, AIA/CDP, active route. `render.js` only maps that state onto a DOM built once.
- No `Date.now`, `performance.now`, timers, CSS animations/transitions or `Math.random` in the film path (unit-tested). The preview's play button paces `renderAt` with `requestAnimationFrame`; capture always sets the time explicitly.
- Timing lives in `src/film-learning/timeline.js` (shots, captions, cues, camera keys) and `src/film-learning/tokens.js` (motion tokens: durations, cubic-Bézier easings, a damped spring with a damping ratio of 0.82, the reading rule).
- Fixture values come from `src/film-learning/facts.js`, which reads the parsed fixture model (`src/artifacts/model.js`). Environment and policy values come from `src/artifacts/synthetic.js` and are labelled as simulated on screen.

## Preview, render, contact sheet

```powershell
npm run dev                     # then open http://127.0.0.1:5183/learning-film.html   (?t=95 opens at 95 s; ?capture shows the bare frame)
npm run video:learning:stills   # representative stills, shot-boundary frames (before/boundary/after/hold) and a draft contact sheet
                                #   -> screenshots/learning-film/ (git-ignored); fails on blank-looking frames
npm run video:learning          # full render + contact sheet + ffprobe summary
node scripts/video/export-learning-film.mjs --seconds 12   # quick preview render (separate -preview file)
```

Outputs (git-ignored):
- `output/certificate-flow-lab-learning-film-v1.mp4`: 1920×1080, 60 fps, H.264, yuv420p, faststart, no audio
- `output/certificate-flow-lab-learning-film-v1-contact-sheet.jpg`: 22 frames (one settled frame per shot plus four key moments)

The pipeline (`scripts/video/lib.mjs`) starts Vite in-process with HMR and file watching disabled, so an edit during a long render cannot reload the page. It drives headless Edge through Playwright, pipes JPEG frames straight into FFmpeg and cuts the contact sheet from the encoded MP4.

Preview controls: Play/Pause, Previous/Next shot, a position slider, a shot list and a Reduced motion option (it follows `prefers-reduced-motion` and shows each caption's settled frame instead of continuous motion). Keyboard: Space plays or pauses; ←/→ move between shots. Captions are announced in a polite live region.

## PKI accuracy rules for the film

See CLAUDE.md "Learning film rules (v0.6.0)". In short:
- the private key never moves and is never on a route;
- the CSR never becomes the certificate: a separate new structure is built and signed by the Issuing CA;
- the Root CA is never contacted and never a route endpoint;
- AIA and CDP are separate routes that are never active together;
- only the leaf has a key badge;
- session keys, not the certificate, encrypt the traffic;
- configuration-dependent statements carry "Depends on your configuration".
The audit is in [AUDIT_v0.6.md](AUDIT_v0.6.md).

## Future phases

- **Sound design:** a quiet score and UI foley, with captions still carrying the content.
- **Domain Controller film:** Path A (manual CSR transfer) with the subject, operator and requester as separate fields.
- **NDES / SCEP learning films**, and later CEP/CES, autoenrollment and OCSP, reusing `scripts/video/lib.mjs` and the timeline/state/render split.
