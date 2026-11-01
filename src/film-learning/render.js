// Learning film renderer: builds the 1920x1080 composition once, then renderAt(t) maps the canonical film state
// (state.js) onto it. Every style written here is a pure function of t; nothing is animated by CSS or by a clock.
import { filmStateAt, PLATES, SPOTS, ROUTES } from './state.js';
import { SHOTS, ACTS, DURATION, TITLE, DEMO_URL, shotById } from './timeline.js';
import { ICONS } from '../views/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (name, size = 40, cls = '') => `<svg class="lf-ic ${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name].svg}</svg>`;
const STAGE = { x: 700, y: 118, w: 1124, h: 842 };
const plateStyle = (p) => `left:${PLATES[p].x}px;top:${PLATES[p].y}px;width:${PLATES[p].w}px;height:${PLATES[p].h}px`;
const box = (x, y, w, h) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
const chk = (k, label, value) => `<div class="lf-chk" data-k="chk-${k}"><span class="lf-st" aria-hidden="true"></span><b>${esc(label)}</b><span class="lf-v">${esc(value)}</span></div>`;

function markup(f) {
  const groupsDoc = [
    ['identity', [['Subject', f.leaf.subject, 'the named identity', 'csr'], ['SAN', f.leaf.san, 'names it is valid for', 'csr'], ['Issuer', `CN=${f.leaf.issuerCn}, …`, 'the CA that signed it', 'ca'], ['Public key', `${f.leaf.keyAlg} · SPKI SHA-256 ${f.leaf.spkiShort}…`, 'WEB01\'s public key', 'csr']]],
    ['validity', [['Valid', `${f.leaf.notBefore} to ${f.leaf.notAfter}`, 'checked against the clock', 'ca'], ['Serial', f.leaf.serial, 'unique per issuing CA', 'ca'], ['Thumbprint', `SHA-1 ${f.leaf.sha1Short}…`, 'a hash; not secret, not a key', 'calc']]],
    ['purpose', [['EKU', `${f.leaf.eku.join(', ')} (${f.leaf.ekuOids.join(', ')})`, 'allowed application purpose', 'ca'], ['Key Usage', `${f.leaf.ku.join(', ')}${f.leaf.kuCritical ? ' (critical)' : ''}`, 'allowed key operations', 'ca'], ['Basic Constraints', f.leaf.isCa === false ? 'Not a CA' : 'CA', 'cannot issue certificates', 'ca']]],
    ['locations', [['AIA', f.leaf.aia[0], 'issuer certificate', 'ca'], ['CDP', f.leaf.cdp[0], 'revocation list', 'ca']]]
  ];
  const origin = { csr: 'from the CSR', ca: 'added by the CA', calc: 'calculated' };
  const certDoc = groupsDoc.map(([id, rows]) => `<section class="lf-grp" data-k="grp-${id}"><h4>${esc(shotById['cert-inspect'].groups.find((g) => g.id === id).title)}</h4>${rows.map(([l, v, gloss, o]) => `<div class="lf-frow"><div class="lf-fl"><b>${esc(l)}</b><small>${esc(gloss)}</small></div><div class="lf-fv">${esc(v)}</div><span class="lf-org lf-org-${o}">${origin[o]}</span></div>`).join('')}</section>`).join('');
  const csrRows = [
    ['subject', 'Subject', f.csr.subject], ['san', 'SAN', f.csr.san], ['key', 'Public key', `${f.csr.keyAlg} · SPKI SHA-256 ${f.csr.spkiShort}…`],
    ['template', 'Template', `${f.csr.template} (request attribute)`], ['signature', 'Signature', `${f.csr.sigAlg} · ${f.csr.signatureValid ? 'verifies with the CSR\'s own public key ✓' : 'does not verify'}`],
    ['absent', 'Private key', f.csr.hasPrivateKey ? 'PRESENT (fixture error)' : 'not in the file']
  ];
  const benchRows = {
    subject: ['Subject', `CN=${f.leaf.subjectCn}`], san: ['SAN', f.leaf.san], key: ['Public key', `${f.leaf.keyAlg} · ${f.leaf.spkiShort}…`],
    issuer: ['Issuer', f.leaf.issuerCn], serial: ['Serial', `${f.leaf.serial.slice(0, 6)}…${f.leaf.serial.slice(-8)}`], validity: ['Valid', `${f.leaf.notBefore} → ${f.leaf.notAfter}`],
    purpose: ['Purpose', f.leaf.eku.join(', ')], keyuse: ['Key use', f.leaf.ku.join(', ')], aia: ['Issuer location', f.leaf.aia[0].replace('http://', '')], cdp: ['Revocation location', f.leaf.cdp[0].replace('http://', '')]
  };
  const evidenceNodes = [
    ['Trusted connection', 'CertificateVerify checked · session keys agreed', 'wire'],
    ['Valid server identity', `SAN ${f.leaf.sanDns[0]} · valid to ${f.leaf.notAfter} · ${f.leaf.eku[0]}`, 'validate'],
    ['Acceptable revocation status', `Serial ${f.leaf.serialShort} not on CRL #${f.crl.number}${f.crl.leafListed ? ' (LISTED: fixture error)' : ''}`, 'validate'],
    ['Trusted chain', `${f.root.subjectCn} in CLIENT01 Trusted Root`, 'root'],
    ['Issuing CA signature', `Leaf signature verifies with the ${f.ica.subjectCn} public key`, 'ica'],
    ['Issued certificate', `Serial ${f.leaf.serial} · template ${f.leaf.template} ${f.leaf.templateVersion}`, 'leaf'],
    ['Approved CSR', `Request ${f.requestId} · requester ${f.owner.account}`, 'csr'],
    ['Private key retained on WEB01', `Leaf public key = CSR public key (SPKI ${f.csr.spkiShort}…)${f.leaf.spki === f.csr.spki ? '' : ' MISMATCH'}`, 'key'],
    ['The original problem', `${f.visitor.name}'s certificate warning on ${f.visitor.host}`, 'fail']
  ];
  const rail = SHOTS.map((s) => `<div class="lf-seg" data-k="seg-${s.n}" style="flex:${s.dur} 1 0"><i data-k="segfill-${s.n}"></i></div>`).join('');
  const actMarks = ACTS.map((a) => { const first = SHOTS.find((s) => s.act === a.n); return `<span class="lf-actmark" style="left:${(first.start / DURATION) * 100}%">Act ${a.n} · ${esc(a.title)}</span>`; }).join('');

  return `
<div class="lf-top"><div class="lf-brand"><span class="lf-mark" aria-hidden="true"></span><b>Certificate Flow Lab</b><span>Learning film · ${esc(TITLE)}</span></div>
  <div class="lf-where"><span data-k="act"></span><b data-k="shot"></b></div></div>
<div class="lf-cap" data-k="cap"><h2 data-k="cap-head"></h2><p data-k="cap-body"></p><div class="lf-ev" data-k="cap-ev"></div></div>
<p class="lf-synth">Synthetic simulation. SIMSI2027 names, addresses and events are invented; certificate values are parsed from the project's generated fixtures. No private keys are distributed.</p>
<div class="lf-stage" style="${box(STAGE.x, STAGE.y, STAGE.w, STAGE.h)}">
 <div class="lf-world" data-k="world">
  <!-- CLIENT01 -->
  <section class="lf-plate" style="${plateStyle('client')}">
   <header class="lf-ph">${icon('client', 46)}<div><h3>CLIENT01</h3><p>Visitor's computer · ${esc(f.visitor.ip)}</p></div></header>
   <div class="lf-badge lf-person" style="right:40px;top:30px">${icon('user', 26)}<span><b>${esc(f.visitor.name)}</b> · Visitor</span></div>
   <div class="lf-browser" style="${box(40, 108, 920, 392)}">
    <div class="lf-bbar"><i></i><i></i><i></i><div class="lf-addr"><span class="lf-addr-st" data-k="addr-st"></span><span class="lf-url" data-k="url"></span></div></div>
    <div class="lf-bview lf-bload" data-k="b-load"><span></span><span></span><span></span></div>
    <div class="lf-bview lf-bwarn" data-k="b-warn"><div class="lf-tri" aria-hidden="true">!</div><div><h4>This connection is not trusted</h4><p>The site presented a certificate that no trusted authority issued.</p>
      <code>Presented: CN=${esc(f.temp.subjectCn)} · issuer = subject (self-signed)</code></div></div>
    <div class="lf-bview lf-bcheck" data-k="b-check"><h4>Connecting securely…</h4><p>Checking the certificate WEB01 presents before trusting it.</p></div>
    <div class="lf-bview lf-bsecure" data-k="b-secure"><div class="lf-okbar">${icon('a-padlock', 34)}<b>SECURE CONNECTION ESTABLISHED</b></div>
      <p class="lf-okmeta">Certificate for ${esc(f.leaf.sanDns[0])} · issued by ${esc(f.leaf.issuerCn)} · chains to ${esc(f.root.subjectCn)}</p>
      <div class="lf-portal"><h5>SIMSI2027 Portal</h5><span></span><span></span><span></span></div></div>
   </div>
   <div class="lf-checks" data-k="checks" style="${box(40, 514, 920, 232)}"><h4>CLIENT01 checks the certificate</h4><div class="lf-chkgrid">
     ${chk('name', 'Name', `SAN ${f.leaf.sanDns[0]} = typed host`)}${chk('chain', 'Chain and trust', `to ${f.root.subjectCn}`)}
     ${chk('validity', 'Dates', `${f.leaf.notBefore} to ${f.leaf.notAfter} · now ${f.now}`)}${chk('revocation', 'Revocation', `${f.leaf.serialShort} not on CRL #${f.crl.number}`)}
     ${chk('purpose', 'Purpose', `EKU ${f.leaf.eku.join(', ')}; ${f.leaf.ku.join(', ')}`)}${chk('proof', 'Key proof', 'CertificateVerify verified')}
   </div></div>
  </section>
  <!-- WEB01 -->
  <section class="lf-plate" style="${plateStyle('web')}">
   <header class="lf-ph">${icon('server', 46)}<div><h3>${esc(f.web.fqdn)}</h3><p>Web server · IIS · ${esc(f.web.ip)}</p></div></header>
   <div class="lf-badge lf-person lf-owner" data-k="morgan" style="right:40px;top:30px">${icon('user', 26)}<span><b>${esc(f.owner.name)}</b> · Application owner</span></div>
   <p class="lf-colhead" style="left:40px;top:96px">Local Computer certificate stores</p>
   <div class="lf-store" data-k="st-personal" style="${box(40, 124, 450, 112)}"><h5>${icon('store', 22)}Personal</h5>
     <div class="lf-entry lf-e-alarm" data-k="st-alarm" style="top:42px">No trusted certificate for ${esc(f.site)}</div>
     <div class="lf-entry lf-e-temp" data-k="st-temp" style="top:76px"><span class="lf-sw lf-sw-fail"></span>${esc(f.temp.subjectCn)} · temporary<em data-k="st-temp-tag"></em></div></div>
   <div class="lf-store" data-k="st-intermediate" style="${box(40, 246, 450, 112)}"><h5>${icon('store', 22)}Intermediate Certification Authorities</h5>
     <div class="lf-entry" style="top:52px"><span class="lf-sw lf-sw-ica"></span>${esc(f.ica.subjectCn)} · no private key<em class="lf-src">from AD</em></div>
     <div class="lf-match" data-k="st-match">returned copy matches ✓</div></div>
   <div class="lf-store" data-k="st-root" style="${box(40, 368, 450, 112)}"><h5>${icon('store', 22)}Trusted Root Certification Authorities</h5>
     <div class="lf-entry" style="top:52px"><span class="lf-sw lf-sw-root"></span>${esc(f.root.subjectCn)} · anchor · no private key<em class="lf-src">from AD</em></div></div>
   <div class="lf-iis" data-k="iis" style="${box(40, 494, 450, 246)}"><h5>${icon('a-iis', 24)}IIS · site “portal” · HTTPS binding</h5>
     <dl><dt>Type</dt><dd>https</dd><dt>IP address</dt><dd>All Unassigned</dd><dt>Port</dt><dd>443</dd><dt>Host name</dt><dd>${esc(f.site)}</dd><dt>SNI</dt><dd>Require Server Name Indication ✓</dd>
     <dt>SSL certificate</dt><dd class="lf-sslcert"><span data-k="iis-temp" class="lf-iis-temp">${esc(f.temp.subjectCn)} (temporary, self-signed)</span><span data-k="iis-leaf" class="lf-iis-leaf">${esc(f.leaf.subjectCn)} · issued by ${esc(f.leaf.issuerCn)}</span></dd></dl></div>
   <div class="lf-vault" data-k="vault" style="${box(530, 110, 430, 270)}">
     <h5><span class="lf-lockic" aria-hidden="true"><i data-k="shackle"></i></span>Private key <small>secret · non-exportable</small></h5>
     <div class="lf-keyglyph" data-k="keyglyph">${icon('a-key', 96)}<span class="lf-ring" data-k="keyring"></span></div>
     <p class="lf-vnote">Stays on WEB01 · ${esc(f.csr.keyAlg)}</p>
     <p class="lf-vstore" data-k="vstore"></p></div>
   <div class="lf-cmd" data-k="cmd" style="${box(530, 590, 430, 150)}"><code data-k="cmd-text"></code><small data-k="cmd-note"></small></div>
  </section>
  <!-- ICA01 -->
  <section class="lf-plate" style="${plateStyle('ica')}">
   <header class="lf-ph">${icon('ca', 46)}<div><h3>${esc(f.ca.name)}</h3><p>${esc(f.ca.host)} · Enterprise Issuing CA · online</p></div></header>
   <p class="lf-colhead" style="left:40px;top:96px">Received requests</p>
   <div class="lf-record" data-k="record" style="${box(40, 222, 440, 44)}">${icon('a-ledger', 26)}<span>Request <b>${f.requestId}</b> · received · requester ${esc(f.owner.account)}</span></div>
   <div class="lf-policy" data-k="policy" style="${box(40, 280, 440, 344)}"><h5>${icon('policy', 24)}Policy check · ${esc(f.template.name)}</h5>
     ${shotById.submit.checks.map((c, i) => `<div class="lf-prow" data-k="pol-${i}"><span class="lf-st" aria-hidden="true"></span><div><b>${esc(c.label)}</b><small>${esc(c.value(f))}</small></div></div>`).join('')}
     <p class="lf-cfg">Simulated template policy · Depends on your configuration</p></div>
   <div class="lf-cakey" data-k="cakey" style="${box(40, 640, 440, 100)}">${icon('a-key', 34)}<div><b>Issuing CA private key</b><small>Signs certificates and CRLs · stays on ICA01</small></div><span class="lf-ring lf-ring-ca" data-k="caring"></span></div>
   <p class="lf-colhead" style="left:520px;top:96px">Issuance</p>
   <div class="lf-newcert" data-k="newcert" style="${box(520, 286, 440, 456)}"><h5 data-k="nc-title">New certificate · being built</h5>
     ${Object.entries(benchRows).map(([id, [l, v]]) => `<div class="lf-ncrow" data-k="nc-${id}"><b>${esc(l)}</b><span>${esc(v)}</span><em class="lf-org lf-org-${['subject', 'san', 'key'].includes(id) ? 'csr' : 'ca'}">${['subject', 'san', 'key'].includes(id) ? 'from CSR' : 'by CA'}</em></div>`).join('')}
     <div class="lf-seal" data-k="nc-seal">${icon('cert', 30)}<span>Signed by ${esc(f.leaf.issuerCn)}<small>${esc(f.leaf.sigAlg)}</small></span></div>
     <p class="lf-ncrec" data-k="nc-rec">Issued · the CA keeps a copy in its database</p></div>
  </section>
  <!-- Offline trust -->
  <section class="lf-plate lf-offline" style="${plateStyle('offline')}">
   <header class="lf-ph">${icon('root', 46)}<div><h3>${esc(f.root.subjectCn)}</h3><p>Offline Trust</p></div></header>
   <div class="lf-offbody"><p><b>Offline.</b> Used only to sign CA certificates and its own CRLs.</p><p>Signed the Issuing CA certificate earlier (offline).</p>
     <p class="lf-notc" data-k="root-note">Not contacted for this request. It never signs website certificates.</p></div>
  </section>
  <!-- PKIWEB01 -->
  <section class="lf-plate lf-pki" data-k="pki" style="${plateStyle('pki')}">
   <header class="lf-ph">${icon('repo', 40)}<div><h3>PKIWEB01</h3><p>pki.simsi2027.test · publication server (HTTP)</p></div></header>
   <div class="lf-shelf lf-shelf-aia" style="${box(40, 92, 440, 214)}"><h5>${icon('aia', 26)}AIA · issuer certificate</h5><code>/aia/SIMSI2027-ICA01.crt</code><p>${esc(f.ica.subjectCn)} certificate</p></div>
   <div class="lf-shelf lf-shelf-cdp" style="${box(520, 92, 440, 214)}"><h5>${icon('cdp', 26)}CDP · revocation list</h5><code>/cdp/${esc(f.crl.file)}</code>
     <p>CRL #${f.crl.number} · signed by ${esc(f.crl.issuerCn)} · next update ${esc(f.crl.nextUpdate)}</p>
     <ul data-k="crl-list">${f.crl.entries.map((e) => `<li>${esc(e.serialShort)} revoked · ${esc(e.reason)}</li>`).join('')}<li class="lf-notlisted">${esc(f.leaf.serialShort)} (our leaf) not listed ✓</li></ul></div>
  </section>
  <!-- wire lane -->
  <div class="lf-lane" data-k="lane" style="${box(SPOTS.wireClient.x - 80, SPOTS.wireClient.y - 34, SPOTS.wireWeb.x - SPOTS.wireClient.x + 160, 68)}"><span>On the wire</span><div class="lf-channel" data-k="channel"><b data-k="channel-text">Application data · encrypted with the session keys</b></div></div>
  <svg class="lf-routes" data-k="routes" width="4400" height="1400" viewBox="0 -100 4400 1400" style="top:-100px">
    ${Object.entries(ROUTES).map(([id, r]) => `<polyline data-k="route-${id}" class="lf-route lf-r-${r.color}${r.optional ? ' lf-r-optional' : ''}" points="${r.pts.map((p) => `${p.x},${p.y}`).join(' ')}"/>`).join('')}
    <line data-k="link" class="lf-link" x1="${SPOTS.keyLinkFrom.x}" y1="${SPOTS.keyLinkFrom.y}" x2="${SPOTS.personalEnd.x}" y2="${SPOTS.personalEnd.y}"/>
  </svg>
  <div class="lf-tag lf-aia-tag" data-k="aia-tag" style="left:${SPOTS.aiaTo.x + 18}px;top:${SPOTS.aiaTo.y + 40}px">AIA · not needed: the Issuing CA certificate already arrived</div>
  <!-- moving artifacts -->
  <div class="lf-art lf-ticket" data-k="ticket">${icon('a-ticket', 30)}<span><b>Problem report</b>from ${esc(f.visitor.name)}: “certificate warning on the portal”</span></div>
  <div class="lf-art lf-pub" data-k="pub">${icon('a-key', 30, 'lf-pubic')}<span><b>Public key</b>safe to share</span></div>
  <div class="lf-art lf-csr" data-k="csr"><div class="lf-csrhead">${icon('a-envelope', 30)}<b>CSR</b><span data-k="csr-mode">request · not a certificate</span></div>
    <div class="lf-csrrows"><div><i>Name</i><span data-k="csr-name"></span></div><div><i>Public key</i><span>${esc(f.csr.keyAlg)} · ${esc(f.csr.spkiShort)}…</span></div><div class="lf-csrin"><i>Template</i><span>${esc(f.csr.template)}</span></div></div>
    <div class="lf-csrseal" data-k="csr-seal">signed by WEB01's private key</div></div>
  <div class="lf-art lf-leafchip" data-k="leaf"><div class="lf-lc-full">${icon('a-ribbon', 30)}<span><b>Issued certificate</b>${esc(f.leaf.subjectCn)} · public · no private key</span></div>
    <div class="lf-lc-stored"><span class="lf-sw lf-sw-leaf"></span>${esc(f.leaf.subjectCn)} · new, CA-issued<em class="lf-keybadge" data-k="keybadge">${icon('a-key', 18)}private key ✓</em></div></div>
  <div class="lf-art lf-icachip" data-k="icaret">${icon('a-cert-ca', 30)}<span><b>Issuing CA certificate</b>public · no private key</span></div>
  <div class="lf-art lf-pin" data-k="pin" style="left:${SPOTS.key.x}px;top:${SPOTS.vault.y - 6}px"><b>Private key stays here</b></div>
  <div class="lf-art lf-msg" data-k="hello">${icon('a-handshake', 26)}<span><b>ClientHello</b>asks for ${esc(f.site)}</span></div>
  <div class="lf-art lf-msg" data-k="certmsg">${icon('a-chain', 26)}<span><b>Certificate message</b><i class="lf-mini lf-mini-leaf">leaf</i><i class="lf-mini lf-mini-ica">Issuing CA</i> Root not sent</span></div>
  <div class="lf-art lf-msg" data-k="verify">${icon('a-handshake', 26)}<span><b>CertificateVerify</b>signature made with WEB01's key · the key stays on WEB01</span></div>
  <div class="lf-art lf-verified" data-k="verified" style="left:${SPOTS.wireClient.x}px;top:${SPOTS.wireClient.y + 52}px">verified with the leaf's public key ✓</div>
  <div class="lf-art lf-skey" data-k="skey-c" style="left:${SPOTS.wireClient.x}px;top:${SPOTS.wireClient.y + 70}px">${icon('a-key', 22)}<span>session key · derived on CLIENT01</span></div>
  <div class="lf-art lf-skey" data-k="skey-w" style="left:${SPOTS.wireWeb.x}px;top:${SPOTS.wireWeb.y + 70}px">${icon('a-key', 22)}<span>session key · derived on WEB01</span></div>
  <div class="lf-art lf-crlchip" data-k="crl">${icon('a-doc', 26)}<span><b>CRL #${f.crl.number}</b>signed by the Issuing CA</span></div>
 </div>
 <div class="lf-veil" data-k="veil"></div>
 <!-- inspection plates -->
 <div class="lf-ov lf-ov-csr" data-k="ov-csr">
  <div class="lf-doc lf-doc-csr"><header>${icon('a-envelope', 34)}<div><b>CSR · Certificate Signing Request</b><small>fixtures/requests/${esc(f.csr.file)}</small></div></header>
   ${csrRows.map(([k, l, v]) => `<div class="lf-drow" data-k="cr-${k}"><b>${esc(l)}</b><span>${esc(v)}</span></div>`).join('')}
   <p class="lf-dfoot">Client information attribute: ${esc(f.csr.clientMachine)} · ${esc(f.csr.clientUser)} · ${esc(f.csr.clientProcess)}</p></div>
  <div class="lf-callouts">${shotById['csr-inspect'].callouts.map((c) => `<div class="lf-co" data-k="co-${c.field}"><b>${esc(c.label)}</b><span>${esc(c.text)}</span></div>`).join('')}</div>
 </div>
 <div class="lf-ov lf-ov-cert" data-k="ov-cert">
  <div class="lf-doc lf-doc-cert"><header>${icon('a-ribbon', 34)}<div><b>Certificate · ${esc(f.leaf.subjectCn)}</b><small>fixtures/certificates/${esc(f.leaf.file)}</small></div></header>${certDoc}
   <p class="lf-dfoot">Public certificate: it holds WEB01's public key, never its private key.</p></div>
  <aside class="lf-side"><h4>Same key pair, proven</h4><div class="lf-spki"><span>CSR public key</span><code>${esc(f.csr.spkiShort)}…</code><span>Certificate public key</span><code>${esc(f.leaf.spkiShort)}…</code>
   <b>${f.leaf.spki === f.csr.spki ? 'Identical: the CA copied it into a new certificate ✓' : 'Different (fixture error)'}</b></div>
   <h4>Field origin</h4><p><span class="lf-org lf-org-csr">from the CSR</span> requested by WEB01</p><p><span class="lf-org lf-org-ca">added by the CA</span> from the template and the CA</p><p><span class="lf-org lf-org-calc">calculated</span> a hash of the whole file</p></aside>
 </div>
 <div class="lf-ov lf-ov-chain" data-k="ov-chain">
  <div class="lf-chainstack">
   <div class="lf-ccard lf-cc-root" data-k="cc-root">${icon('a-cert-anchor', 40)}<div><b>${esc(f.root.subjectCn)}</b><span>Root · trust anchor · ${f.root.selfSigned ? 'self-signed' : 'not self-signed'}</span><small>Source: already in CLIENT01 Trusted Root store · no private key on CLIENT01</small></div></div>
   <div class="lf-carrow" data-k="ca-2"><span>Issuing CA signature verified with the Root public key ✓</span></div>
   <div class="lf-ccard lf-cc-ica" data-k="cc-ica">${icon('a-cert-ca', 40)}<div><b>${esc(f.ica.subjectCn)}</b><span>Intermediate · signs website certificates</span><small>Source: sent in the handshake · no private key on CLIENT01</small></div></div>
   <div class="lf-carrow" data-k="ca-1"><span>Leaf signature verified with the Issuing CA public key ✓</span></div>
   <div class="lf-ccard lf-cc-leaf" data-k="cc-leaf">${icon('a-ribbon', 40)}<div><b>${esc(f.leaf.subjectCn)}</b><span>Leaf · identifies the site</span><small>Source: sent in the handshake</small></div></div>
  </div>
  <aside class="lf-side lf-chainside"><div class="lf-anchor" data-k="cc-anchor"><h4>${icon('store', 26)}CLIENT01 · Trusted Root Certification Authorities</h4><p><span class="lf-sw lf-sw-root"></span>${esc(f.root.subjectCn)}</p><small>Trusted because it is here, delivered by Group Policy (depends on your configuration). A Root sent by a server is not trusted for that reason.</small></div>
   <p class="lf-history" data-k="cc-history">History: ${esc(f.root.subjectCn)} signed the Issuing CA certificate earlier, offline. It was not contacted for this website certificate.</p></aside>
 </div>
 <div class="lf-ov lf-ov-rev" data-k="ov-rev"><h4>Evidence, from the result back to the cause</h4><ol class="lf-rev">
  ${evidenceNodes.map(([h, e, c], i) => `<li class="lf-rn lf-rn-${c}" data-k="rn-${i}"><i></i><b>${esc(h)}</b><span>${esc(e)}</span></li>`).join('')}</ol></div>
</div>
<div class="lf-railwrap"><div class="lf-acts">${actMarks}</div><div class="lf-rail">${rail}</div></div>
<div class="lf-final" data-k="final"><div class="lf-finalin"><span class="lf-mark lf-mark-big" aria-hidden="true"></span><h1>Certificate Flow Lab</h1><p class="lf-ftitle">${esc(TITLE)}</p>
  <p class="lf-flabel">Live interactive demo</p><p class="lf-furl">${esc(DEMO_URL)}</p>
  <p class="lf-fnote">Synthetic simulation. SIMSI2027 names are invented; certificates, CSR and CRL are generated demonstration fixtures. No private keys are distributed.</p></div></div>`;
}

export function createRenderer(root, facts) {
  root.innerHTML = markup(facts);
  const els = {}; root.querySelectorAll('[data-k]').forEach((e) => { els[e.dataset.k] = e; });
  const cache = new Map();
  // Write a style/attr/text only when it changed (keeps capture fast; output is identical either way).
  const put = (k, prop, val) => { const key = `${k}|${prop}`; if (cache.get(key) === val) return; cache.set(key, val); const e = els[k]; if (!e) return;
    if (prop === 'text') e.textContent = val; else if (prop === 'class') e.className = val; else if (prop.startsWith('attr:')) e.setAttribute(prop.slice(5), val); else e.style.setProperty(prop, val); };
  const op = (k, v) => { const o = Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000; put(k, 'opacity', String(o)); put(k, 'visibility', o > 0 ? 'visible' : 'hidden'); };
  const at = (k, p, scale = 1, extra = '') => put(k, 'transform', `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) translate(-50%, -50%) scale(${scale.toFixed(4)})${extra}`);
  const baseClass = {}; for (const [k, e] of Object.entries(els)) baseClass[k] = e.className.baseVal ?? e.className;
  const cls = (k, extra) => { const b = typeof baseClass[k] === 'string' ? baseClass[k] : ''; const v = extra ? `${b} ${extra}` : b; if (els[k] instanceof SVGElement) put(k, 'attr:class', v); else put(k, 'class', v); };
  const routeLen = {}; for (const id of Object.keys(ROUTES)) { try { routeLen[id] = els[`route-${id}`].getTotalLength?.() || 0; } catch { routeLen[id] = 0; } }

  function renderAt(time) {
    const S = filmStateAt(time); const f = facts;
    // ---- frame chrome ----
    const act = ACTS.find((a) => a.n === S.act);
    put('act', 'text', `Act ${act.n} · ${act.title}`); put('shot', 'text', `${String(S.shotN).padStart(2, '0')} / ${SHOTS.length} · ${S.shotTitle}`);
    for (const s of SHOTS) { const fill = Math.max(0, Math.min(1, (S.t - s.start) / s.dur)); put(`segfill-${s.n}`, 'transform', `scaleX(${fill.toFixed(4)})`); cls(`seg-${s.n}`, s.n === S.shotN ? 'lf-cur' : ''); }
    if (S.caption) { put('cap-head', 'text', S.caption.head); put('cap-body', 'text', S.caption.body); put('cap-ev', 'text', S.caption.evidence ? S.caption.evidence(f) : ''); op('cap-ev', S.caption.evidence ? 1 : 0); }
    op('cap', S.caption ? S.caption.opacity : 0);

    // ---- camera ----
    const c = S.camera; const tx = STAGE.w / 2 - c.x * c.z, ty = STAGE.h / 2 - c.y * c.z;
    put('world', 'transform', `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${c.z.toFixed(4)})`);
    const chipScale = Math.max(1, 1.0 / c.z); // travelling artifacts stay legible during pull-backs

    // ---- CLIENT01 ----
    put('url', 'text', S.browser.url.slice(0, S.browser.typed));
    const m = S.browser.mode;
    op('b-load', m === 'loading' ? 1 : 0); op('b-warn', m === 'warning' ? S.browser.enter : 0); op('b-check', m === 'checking' ? S.browser.enter : 0); op('b-secure', m === 'secure' ? S.browser.enter : 0);
    put('b-warn', 'transform', `scale(${(0.97 + 0.03 * S.browser.enter).toFixed(4)})`); put('b-secure', 'transform', `scale(${(0.97 + 0.03 * S.browser.enter).toFixed(4)})`);
    put('addr-st', 'text', m === 'warning' ? 'Not trusted' : m === 'secure' ? 'Secure' : m === 'checking' ? 'Checking' : '');
    cls('addr-st', m === 'warning' ? 'lf-bad' : m === 'secure' ? 'lf-good' : m === 'checking' ? 'lf-pend' : '');
    op('checks', S.checks.opacity);
    for (const [k, v] of Object.entries(S.checks.rows)) cls(`chk-${k}`, v > 0 ? 'lf-ok' : 'lf-next');

    // ---- report ----
    op('ticket', S.report.visible ? S.report.opacity : 0); at('ticket', S.report.pos, S.report.moving ? chipScale : 1);
    op('morgan', S.morgan.opacity);
    op('st-alarm', S.investigate.opacity); cls('st-personal', [S.stores.alarm > 0.5 ? 'lf-alarm' : '', S.stores.personal.hl > 0.3 ? 'lf-hl' : ''].join(' ').trim());
    cls('st-temp', S.iis.cert === 'leaf' ? 'lf-muted' : (S.stores.alarm > 0.5 ? 'lf-alarm' : ''));
    put('st-temp-tag', 'text', S.iis.cert === 'leaf' ? 'unbound' : S.stores.alarm > 0 ? 'self-signed, untrusted' : 'self-signed, bound');

    // ---- key vault (fixed on WEB01) ----
    op('vault', S.vault.opacity); op('keyglyph', S.key.appear); put('keyglyph', 'transform', `scale(${(0.6 + 0.4 * S.key.appear).toFixed(4)})`);
    put('shackle', 'transform', `translateY(${(-7 * (1 - S.key.lock)).toFixed(2)}px)`);
    op('keyring', S.key.ring); put('keyring', 'transform', `scale(${(1 + 0.25 * S.key.ring).toFixed(3)})`);
    put('vstore', 'text', S.key.store === 'linked' ? 'Linked to the leaf in Personal' : 'Certificate Enrollment Requests · pending');
    op('pin', S.key.pin); put('pin', 'transform', `translate(-50%, -100%) scale(${chipScale.toFixed(4)})`); put('pin', 'transform-origin', '50% 100%');
    op('cmd', S.command.opacity); put('cmd-text', 'text', S.command.text); put('cmd-note', 'text', S.command.note);

    // ---- public key + CSR ----
    op('pub', S.pubkey.visible ? S.pubkey.opacity : 0); at('pub', S.pubkey.pos);
    op('csr', S.csr.exists ? S.csr.opacity : 0); at('csr', S.csr.pos, S.csr.moving ? chipScale : 1);
    cls('csr', S.csr.mode === 'input' ? 'lf-csr-input' : '');
    put('csr-name', 'text', S.csr.nameText.slice(0, S.csr.nameTyped)); put('csr-mode', 'text', S.csr.mode === 'input' ? 'input · request ' + f.requestId : 'request · not a certificate');
    op('csr-seal', S.csr.seal); put('csr-seal', 'transform', `scale(${(1.25 - 0.25 * S.csr.seal).toFixed(4)})`);
    op('record', S.record.opacity); op('policy', S.policy.opacity);
    S.policy.checks.forEach((p, i) => cls(`pol-${i}`, p > 0 ? 'lf-ok' : ''));

    // ---- issuance ----
    op('newcert', S.newCert.exists ? S.newCert.opacity : 0);
    for (const r of S.newCert.rows) { op(`nc-${r.id}`, r.p); cls(`nc-${r.id}`, r.line > 0.05 ? 'lf-copying' : ''); }
    op('nc-seal', S.newCert.seal); put('nc-seal', 'transform', `scale(${(1.3 - 0.3 * S.newCert.seal).toFixed(4)})`);
    cls('newcert', S.newCert.signed ? 'lf-signed' : ''); put('nc-title', 'text', S.newCert.signed ? 'Issued certificate · signed by the Issuing CA' : 'New certificate · being built');
    op('nc-rec', S.newCert.record ? 1 : 0);
    op('caring', S.caKey.ring); op('root-note', 0.35 + 0.65 * S.root.note); cls('root-note', S.root.note > 0.5 ? 'lf-notc lf-on' : 'lf-notc');

    // ---- return + stores ----
    op('leaf', S.leaf.mode === 'hidden' ? 0 : S.leaf.opacity); at('leaf', S.leaf.pos, S.leaf.mode === 'chip' && S.leaf.location === 'transit' ? chipScale : 1);
    cls('leaf', S.leaf.mode === 'stored' ? 'lf-stored' : ''); op('keybadge', S.leaf.keyBadge);
    op('icaret', S.icaReturn.visible ? S.icaReturn.opacity : 0); at('icaret', S.icaReturn.pos, S.icaReturn.moving ? chipScale : 1);
    op('st-match', S.stores.intermediate.matched);
    cls('st-intermediate', S.stores.intermediate.hl > 0.3 ? 'lf-hl' : ''); cls('st-root', S.stores.root.hl > 0.3 ? 'lf-hl lf-hl-root' : '');
    if (S.stores.personal.hl > 0.3) cls('st-personal', 'lf-hl');
    put('link', 'stroke-dasharray', '10 8'); put('link', 'opacity', String(S.t < shotById.stores.start ? Math.round(S.leaf.link * 1000) / 1000 : 0));

    // ---- IIS ----
    cls('iis', [S.iis.alarm > 0.5 ? 'lf-alarm' : '', S.iis.hl > 0.3 ? 'lf-hl' : ''].join(' ').trim());
    op('iis-temp', 1 - S.iis.swap); op('iis-leaf', S.iis.swap); put('iis-temp', 'text-decoration', S.iis.swap > 0.2 ? 'line-through' : 'none');

    // ---- wire ----
    op('lane', S.wire.opacity); put('channel', 'transform', `scaleX(${S.wire.channel.toFixed(4)})`); op('channel', S.wire.channel > 0 ? 1 : 0); op('channel-text', S.wire.channelText);
    op('hello', S.wire.hello.opacity); at('hello', S.wire.hello.pos, chipScale);
    op('certmsg', S.wire.certMsg.opacity); at('certmsg', S.wire.certMsg.pos, chipScale);
    op('verify', S.wire.verify.opacity); at('verify', S.wire.verify.pos, chipScale);
    op('verified', S.wire.verify.opacity > 0 ? S.wire.verify.verified : 0); put('verified', 'transform', `translate(-50%, 0) scale(${chipScale.toFixed(4)})`); put('verified', 'transform-origin', '50% 0');
    for (const k of ['skey-c', 'skey-w']) { op(k, S.wire.opacity > 0 ? S.wire.sessionKeys : 0); put(k, 'transform', `translate(-50%, 0) scale(${chipScale.toFixed(4)})`); put(k, 'transform-origin', '50% 0'); }

    // ---- AIA / CDP ----
    op('pki', Math.max(0.0, S.pki.hl)); op('aia-tag', S.aia.opacity); put('aia-tag', 'transform', `scale(${chipScale.toFixed(3)})`); put('aia-tag', 'transform-origin', '0 0');
    op('crl', S.cdp.crl.opacity); at('crl', S.cdp.crl.pos, chipScale); op('crl-list', 0.25 + 0.75 * S.cdp.list);

    // ---- routes: only the active one is drawn ----
    for (const id of Object.keys(ROUTES)) {
      const on = S.route === id;
      put(`route-${id}`, 'opacity', String(on ? Math.round(S.routeOpacity * 1000) / 1000 : 0));
      put(`route-${id}`, 'stroke-dashoffset', on ? String((-(S.t * 36) % 1000).toFixed(1)) : '0');
      put(`route-${id}`, 'stroke-width', String((4 / Math.max(0.5, S.camera.z)).toFixed(2)));
    }

    // ---- overlays ----
    op('veil', S.veil);
    const ov = S.overlay?.id;
    op('ov-csr', ov === 'csr' ? S.overlay.opacity : 0); op('ov-cert', ov === 'cert' ? S.overlay.opacity : 0); op('ov-chain', ov === 'chain' ? S.overlay.opacity : 0); op('ov-rev', ov === 'reverse' ? S.overlay.opacity : 0);
    if (ov === 'csr') for (const co of S.overlay.callouts) { op(`co-${co.field}`, co.active ? co.opacity : co.opacity * 0.5); cls(`co-${co.field}`, co.active ? 'lf-on' : ''); cls(`cr-${co.field}`, co.active ? 'lf-on' : co.opacity > 0 ? 'lf-seen' : ''); }
    if (ov === 'cert') for (const g of S.overlay.groups) { op(`grp-${g.id}`, g.shown ? (g.active ? g.opacity : 0.55) : 0); cls(`grp-${g.id}`, g.active ? 'lf-on' : g.shown ? 'lf-past' : 'lf-future'); }
    if (ov === 'chain') { const p = S.overlay.parts; op('cc-leaf', p.leaf); op('ca-1', p.ica); op('cc-ica', p.ica); op('ca-2', p.root); op('cc-root', p.root); op('cc-anchor', p.root); cls('cc-anchor', p.anchor > 0.5 ? 'lf-anchor lf-on' : 'lf-anchor'); cls('cc-root', p.anchor > 0.5 ? 'lf-ccard lf-cc-root lf-on' : 'lf-ccard lf-cc-root'); op('cc-history', p.history); }
    if (ov === 'reverse') S.overlay.nodes.forEach((v, i) => op(`rn-${i}`, v));
    op('final', S.final);
    return S;
  }
  return { renderAt, els };
}
