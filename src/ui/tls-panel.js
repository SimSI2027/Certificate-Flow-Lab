// Details panel for the v0.5.0 Website TLS story. Ordered sections: Plain language · Technical details · Command or GUI path ·
// Raw artifact · Evidence · Troubleshoot (moves to position 2 and opens when a fault halts). Every certificate field comes from the
// parsed fixtures; simulated values are labelled. Pure HTML builders: no DOM access.
import { TLS, URLS } from '../artifacts/synthetic.js';
import { ARTIFACTS, TEMPLATE_CARDS, STORES, PENDING_STORE, CLIENT_ROOT, FAULTS, GLOSSARY, KIND, CFG, cfg, artifactLabel, SITE, MORGAN, JORDAN, REQ } from '../scenarios/tls/shared.js';
import { FOLLOWUP_ITEMS } from '../scenarios/tls/steps.js';
import { NEVER_EXECUTED } from '../scenarios/story-common.js';
import { buildTrace, getFault } from '../engine/engine.js';
import { colonHex } from '../artifacts/model.js';
import { esc, kv, H, mono, monoCopy, pill, kindBadge, copyBtn } from './story-panel.js';

const SIMV = '<span class="pill pill-idle">Simulated environment</span>';
export { esc };
export const SECTION_IDS = ['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot'];
export const SECTION_TITLES = { plain: 'Plain language', technical: 'Technical details', command: 'Command or GUI path', raw: 'Raw artifact', evidence: 'Evidence', troubleshoot: 'Troubleshoot' };
export const sectionTitle = (id) => SECTION_TITLES[id];
export function faultHere(ctx) {
  const { state: s, scenario: sc } = ctx; if (s.activeFault === 'healthy') return false;
  const f = getFault(sc, s.activeFault); return s.halted || (s.direction === 'forward' && sc.stages[s.stage]?.id === f.stage && s.stageProgress >= 1);
}
// Troubleshoot moves to position 2 when a fault halts the flow at this step.
export function sectionOrder(ctx) { return faultHere(ctx) ? ['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence'] : SECTION_IDS; }
const step = (ctx) => ctx.scenario.stages[ctx.state.stage];
const fixture = (ctx, id) => ctx.scenario.resolveFixture?.(ctx.model, id, ctx.state.activeFault) ?? null;
const fault = (ctx) => FAULTS.find((f) => f.id === ctx.state.activeFault) ?? null;

// ---------- Glossary chips: the first use of a term in a section opens a one-line definition (a button, so it is focusable) ----------
const TERMS = Object.keys(GLOSSARY);
export function glossarize(text, seen, open = new Set()) {
  let out = esc(text); const marks = []; const defs = [];
  for (const term of TERMS) {
    if (seen.has(term)) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9-])(${term.replace(/ /g, '\\s')})(?![A-Za-z0-9])`);
    const m = re.exec(out); if (!m) continue;
    seen.add(term); const on = open.has(term);
    marks.push(`<button type="button" class="gloss" data-gloss="${esc(term)}" aria-expanded="${on}" title="What is ${esc(term)}?">${esc(m[2])}</button>`);
    if (on) defs.push(`<span class="gloss-def" role="note"><strong>${esc(term)}.</strong> ${esc(GLOSSARY[term])}</span>`);
    out = `${out.slice(0, m.index)}${m[1]}\u0000${marks.length - 1}\u0000${out.slice(m.index + m[0].length)}`;
  }
  // Opened definitions follow the text as one line each, so the sentence itself is never split.
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => marks[Number(i)]) + defs.join('');
}

// ---------- Identity: Visitor, Subject, Operator and Requester are separate labelled fields (rule 1) ----------
export function identityRows(ctx) {
  const req = ctx.state.requester;
  return [['Visitor (reports only)', `${JORDAN} on CLIENT01 (10.20.10.45)`], ['Subject (certificate identity)', SITE], ['Operator (human)', `${MORGAN} (application owner)`],
    ['Requester (CA record)', req ? `${req} — submission authenticated as Morgan from WEB01` : 'Not recorded yet (no submission)']];
}

// ---------- Collapsed summary ----------
export function summaryHtml(ctx) {
  const st = step(ctx); const s = ctx.state;
  if (!ctx.started) return '<h2>Website TLS Certificate</h2><p>Press <strong>START FLOW</strong>.</p><p class="muted">Act 1 gets a trusted certificate onto WEB01. Act 2 follows the TLS handshake and the checks CLIENT01 makes.</p>';
  if (s.direction === 'reverse') { const t = buildTrace(ctx.scenario, s.activeFault)[s.evidenceIndex]; return `<h2>${esc(t.question)}</h2><p>${esc(t.claim)}</p><p>${kindBadge(t.evidenceKind)}</p>`; }
  const x = st.explain;
  return `<h2>${esc(st.title)}</h2><dl class="sum"><dt>What happens</dt><dd>${esc(st.purpose)}</dd><dt>Why it is needed</dt><dd>${esc(x.why)}</dd><dt>Who acts</dt><dd>${esc(x.who)}</dd><dt>What moves</dt><dd>${esc(x.moves)}</dd></dl>`;
}

// ---------- 1. Plain language ----------
const ABOUT = {
  selfsigned: 'The temporary certificate IIS presented before the lesson. WEB01 signed it for itself, so no authority CLIENT01 trusts vouches for it.',
  report: 'Jordan\'s problem report. It carries no keys or certificates, only the address and the warning text.',
  requirements: 'What the certificate must contain: the name visitors type, the Server Authentication purpose, an RSA 2048 key and the template.',
  inf: 'A small text policy that tells certreq which key and name to request. It contains no secret.',
  'private-key': 'The private key was created on WEB01 by certreq -new and never leaves it. It is not a file in this project and is never shown or transmitted.',
  csr: 'A Certificate Signing Request: WEB01\'s public key, the requested name and the template, signed with WEB01\'s private key. It is not a certificate and contains no private key.',
  record: `The CA's database row for request ${REQ}: who submitted it (Requester), for which template, and its disposition.`,
  leaf: 'The new certificate the Issuing CA created for portal.simsi2027.test and signed with its own key. It is public.',
  accepted: 'The certificate in WEB01\'s Personal store, linked to the private key that WEB01 created at the start.',
  binding: 'The IIS https binding of the portal site: which certificate HTTP.sys presents for portal.simsi2027.test.',
  hello: 'The first TLS message from CLIENT01: supported versions and ciphers, a key share and the site name (SNI).',
  handshake: 'The TLS Certificate message: the certificates WEB01 sends, public data only.',
  certverify: 'The signature WEB01 makes over the handshake with its private key, proving it holds the key without sending it.',
  chain: 'The path leaf → Issuing CA → Root that CLIENT01 builds; the Root is already in CLIENT01\'s Trusted Root store.',
  crl: 'The Certificate Revocation List published by the Issuing CA at the CDP on PKIWEB01.',
  ica: 'The public certificate of SIMSI2027 Issuing CA 01. Its private key lives only on the CA.',
  root: 'A public copy of the SIMSI2027 Root CA certificate: the trust anchor. Its private key stays offline.',
  padlock: 'The finished, trusted connection. Session keys from the key exchange, not the certificate, encrypt the traffic.',
  followup: 'What remains after the fix: renewal before 2027-10-30, the runbook entry and the clean-up.'
};
const STORE_ABOUT = { personal: 'Holds certificates WEB01 itself uses, with their private keys.', intermediate: 'Holds CA certificates that link a leaf to a root. No private keys.',
  root: 'Holds trust anchors. A certificate here is trusted as the end of a chain. No private keys.', 'client-root': 'CLIENT01\'s trust anchors. The SIMSI2027 Root arrived through AD or Group Policy; CLIENT01 has no private key for this site.' };
const ZONE_ABOUT = { Z1: 'CLIENT01, where Jordan browses. The same computer as zone 6.', Z2: 'WEB01, where Morgan creates the key and the request. The same computer as zone 4.',
  Z3: 'ICA01, the online Issuing CA: it receives, checks and issues.', Z4: 'WEB01, where the certificate is installed with its key and bound in IIS.',
  Z5: 'The network between CLIENT01 and WEB01, where the TLS handshake messages travel.', Z6: 'CLIENT01 again: chain building, checks and its Trusted Root store.' };
function aboutCard(ctx) {
  const sel = ctx.selection; if (!sel) return '';
  if (sel.type === 'artifact' && ARTIFACTS[sel.id]) return `<div class="card about"><h4>About this object: ${esc(artifactLabel(sel.id))}</h4><p>${esc(ABOUT[sel.id] ?? '')}</p></div>`;
  if (sel.type === 'store') return `<div class="card about"><h4>About this store</h4><p>${esc(sel.id === 'client-root' ? CLIENT_ROOT.full : `${STORES.find((q) => q.id === sel.id)?.full} on WEB01`)}. ${esc(STORE_ABOUT[sel.id] ?? '')}</p></div>`;
  if (sel.type === 'entity' && sel.id === 'rootca') return '<div class="card about"><h4>About the offline Root CA</h4><p>SIMSI2027-ROOTCA signed the Issuing CA certificate earlier, offline. It is not contacted in this lesson and never signs the website certificate.</p></div>';
  if (sel.type === 'zone') { const z = ctx.scenario.zones.find((q) => q.id === sel.id); return `<div class="card about"><h4>About zone ${z?.n}: ${esc(z?.name)}</h4><p>${esc(ZONE_ABOUT[sel.id] ?? '')}</p></div>`; }
  if (sel.type === 'pub') return `<div class="card about"><h4>${sel.id === 'aia' ? 'AIA: where to download the issuer certificate' : 'CDP: where to download the CRL'}</h4><p>${sel.id === 'aia' ? 'Authority Information Access points to the Issuing CA certificate. CLIENT01 needs it only when WEB01 does not send that certificate in the handshake.' : 'The CRL Distribution Point is where CLIENT01 downloads the Certificate Revocation List. It is a different URL from the AIA.'}</p></div>`;
  return '';
}
export function plainHtml(ctx) {
  const st = step(ctx); const s = ctx.state; const x = st.explain; const seen = new Set(); const g = (t) => glossarize(t, seen, ctx.gloss);
  const head = aboutCard(ctx);
  if (s.direction === 'reverse') { const t = buildTrace(ctx.scenario, s.activeFault)[s.evidenceIndex]; return `${head}<p class="lead"><strong>${esc(t.question)}</strong> ${g(t.claim)}</p><p>${kindBadge(t.evidenceKind)}</p><p class="muted">Reverse evidence walks from the result back to its causes; it is not a reversed animation.</p>`; }
  const f = fault(ctx); const fnote = f?.notes?.[st.id] && s.stage <= ctx.scenario.stages.findIndex((q) => q.id === f.at) ? `<p class="warn" role="note"><strong>In the selected fault:</strong> ${esc(f.notes[st.id])}</p>` : '';
  const rows = [['What is happening', x.what], ['Why', x.why], ['Who', x.who], ['Where', x.where], ['What moves', x.moves], ['What stays private', x.staysPrivate], ['What is checked', x.checked], ['What could go wrong', x.canGoWrong]];
  return `${head}<p class="lead">${g(st.purpose)}</p>${fnote}<dl class="qa">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${g(v)}</dd>`).join('')}</dl>
    ${st.result ? `<p><strong>Result:</strong> ${esc(st.result)}</p>` : ''}${st.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
    ${st.id === 't-followup' ? `<h4>Follow-up</h4><ul class="tight">${FOLLOWUP_ITEMS.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
}

// ---------- 2. Technical details ----------
export function technicalHtml(ctx) {
  const sel = ctx.selection; const s = ctx.state;
  if (sel?.type === 'artifact') {
    if (['hello', 'handshake', 'certverify', 'padlock'].includes(sel.id)) return handshakeInspector(ctx) + (sel.id === 'handshake' ? artifactInspector(ctx, 'handshake') : '');
    if (ARTIFACTS[sel.id]?.role) return artifactInspector(ctx, sel.id);
    if (sel.id === 'private-key') return privateKeyCard(ctx);
    if (sel.id === 'binding') return bindingCard(ctx);
    if (sel.id === 'record') return recordCard(ctx);
    if (sel.id === 'requirements') return templateCards();
  }
  if (sel?.type === 'store') return storeInspector(ctx, sel.id);
  const st = step(ctx);
  let h = `<h4>Identity</h4>${kv(identityRows(ctx))}`;
  h += kv([['Step', `${ctx.scenario.stages.indexOf(st) + 1} of ${ctx.scenario.stages.length} · Act ${st.act === 'act1' ? 1 : 2} · ${st.milestone}`], ['Zone', ctx.scenario.zones.find((z) => z.id === st.zone)?.name],
    ['Actor', ctx.scenario.story.actorFull[st.actor]], ['Channel', st.connector ? (st.connector.association ? 'WEB01 internal association (never on the network)' : st.connector.channel) : 'None: nothing leaves this computer'],
    ['Result', st.result ?? '—'], ['CA configuration', TLS.caConfig], ['Request ID', s.requestRecord === 'none' ? 'not assigned yet' : String(REQ)]]);
  if (st.technical.length) h += `<h4>Details</h4><ul class="tight">${st.technical.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  if (['t-requirements', 't-policy'].includes(st.id)) h += templateCards();
  if (['t-hello', 't-cert-msg', 't-proof', 't-trusted'].includes(st.id)) h += handshakeInspector(ctx);
  if (st.artifact && ARTIFACTS[st.artifact]?.role) h += `<p><button class="linkbtn" data-open="artifact:${st.artifact}">Inspect the ${esc(artifactLabel(st.artifact))}</button></p>`;
  return h;
}
export function templateCards() {
  return TEMPLATE_CARDS.map((t) => `<div class="card tpl ${t.comparison ? 'cmp' : 'this'}"><h4>${esc(t.display)} <span class="mono small">${esc(t.name)}</span>${t.comparison ? ' · comparison only' : ' · used in this lesson'}</h4>
    ${t.oid ? `<p class="muted mono">${esc(t.oid)} v${esc(t.version)}${t.simulated ? ' · simulated, organization-specific' : ''}</p>` : ''}${kv(t.rows)}${t.note ? `<p class="muted">${esc(t.note)}</p>` : ''}</div>`).join('');
}
function privateKeyCard(ctx) {
  const inf = fixture(ctx, 'inf')?.parsed;
  return kv([['Location', `${PENDING_STORE.full} on WEB01 (pending request), then linked to the certificate in Personal`], ['Created by', 'certreq -new -machine on WEB01'], ['Exportable', `${inf?.fields['NewRequest.Exportable'] ?? 'FALSE'} (INF Exportable)`],
    ['Machine key set', `${inf?.fields['NewRequest.MachineKeySet'] ?? 'TRUE'} (INF MachineKeySet)`], ['Used by', 'HTTP.sys on WEB01, in place, to sign CertificateVerify'], ['Travels on the network', 'Never'], ['In this project', 'Never: no private key file exists']])
    + `<p>${SIMV}</p><p class="muted">The key location is simulated; the INF values are parsed from the fixture.</p>`;
}
function bindingCard(ctx) {
  const s = ctx.state; const state = { 'temporary-selfsigned': 'Temporary self-signed certificate (the cause of the warning)', binding: 'Being switched', bound: 'New certificate portal.simsi2027.test (serial …CC10)', 'still-selfsigned': 'Still the temporary self-signed certificate (fault)', 'failed-no-key': 'Not saved: the certificate has no private key (fault)' }[s.iisBindingState];
  return kv([['Site', 'portal (IIS)'], ['Type', 'https'], ['IP address', 'All Unassigned'], ['Port', '443'], ['Host name', SITE], ['Require Server Name Indication', 'Yes'], ['SSL certificate', state ?? s.iisBindingState], ['Stored as', 'Certificate thumbprint + store name (My); the key stays in WEB01\'s machine key store']])
    + `<p>${SIMV}</p><p class="muted">IIS configuration is simulated. Check it with <span class="mono">netsh http show sslcert</span> (read-only).</p>`;
}
function recordCard(ctx) {
  const s = ctx.state; const disp = { received: 'Received', evaluating: 'Being evaluated', allowed: 'Allowed by policy', issued: 'Issued', denied: 'Denied by policy' }[s.requestRecord] ?? '—';
  return kv([['Request ID', String(REQ)], ['Requester (CA record)', s.requester ?? '—'], ['Template', `${TLS.template.name} (${TLS.template.display})`], ['Supplied subject / SAN', `CN=${SITE} / dNSName ${SITE}`], ['Disposition', disp], ['CA', TLS.caConfig]])
    + `<p>${SIMV}</p><p class="muted">The CA database row is simulated; the request content is parsed from the CSR fixture.</p>`;
}

// ---------- Inspectors ----------
export function artifactInspector(ctx, id) {
  const fx = fixture(ctx, id); if (!fx) return '<p class="muted">No fixture for this artifact.</p>';
  const p = fx.parsed;
  const src = `<p class="syn">Parsed from <span class="mono">${esc(fx.manifest.filename)}</span> (synthetic demonstration fixture).</p>`;
  const dl = (ctx.downloads?.(fx) ?? '') + (ctx.nativeBlock?.(fx) ?? '');
  if (p.kind === 'csr') return src + csrInspector(ctx, p) + dl;
  if (p.kind === 'certificate') return src + certInspector(ctx, p, id) + dl;
  if (p.kind === 'inf') return src + kv([['Subject', p.fields['NewRequest.Subject']], ['MachineKeySet', p.fields['NewRequest.MachineKeySet']], ['Exportable', p.fields['NewRequest.Exportable']], ['KeyLength', p.fields['NewRequest.KeyLength']], ['KeySpec', p.fields['NewRequest.KeySpec']], ['KeyUsage', p.fields['NewRequest.KeyUsage']], ['ProviderName', p.fields['NewRequest.ProviderName']], ['ProviderType', p.fields['NewRequest.ProviderType']], ['RequestType', p.fields['NewRequest.RequestType']], ['HashAlgorithm', p.fields['NewRequest.HashAlgorithm']], ['CertificateTemplate', p.template], ['SAN text', p.fields['Extensions._continue_']]]) + dl;
  if (p.kind === 'crl') return src + kv([['Issuer', p.issuer], ['CRL number', String(p.crlNumber)], ['This update', p.thisUpdate], ['Next update', p.nextUpdate], ['Entries', p.entries.map((e) => `${e.serialNumber} (${e.reason})`).join(', ')], ['Signature algorithm', p.signatureAlgorithm], ['Published at (CDP)', mono(p.distribution)]]) + dl;
  if (p.kind === 'chain') {
    const names = id === 'handshake' ? ['Leaf (sent by WEB01)', 'Issuing CA (sent by WEB01)'] : ['Leaf', 'Issuing CA', 'Root (trust anchor in CLIENT01\'s store)'];
    return src + `<ol class="tight">${p.certs.map((c, i) => `<li>${esc(names[i] ?? '')}: ${esc(c.subject)} <span class="mono small">SHA-1 ${esc(c.thumbprints.sha1)}</span></li>`).join('')}</ol>${id === 'handshake' ? '<p class="note">The Root is normally not sent: a client never trusts a root because the server sent it.</p>' : ''}` + dl;
  }
  return src + dl;
}
export function csrInspector(ctx, r) {
  const inf = fixture(ctx, 'inf')?.parsed;
  const plain = `<div class="card plainhdr"><h4>In plain language</h4><ul class="tight">
    <li>A <strong>CSR</strong> (Certificate Signing Request) asks a CA for a certificate.</li>
    <li>WEB01 creates it because only WEB01 holds the matching private key.</li>
    <li>It contains the <strong>public key</strong>, the requested name, extensions and attributes.</li>
    <li>It does <strong>not</strong> contain the private key or any issuer signature, and it is not a certificate.</li>
    <li>Its signature is made with WEB01's private key: <strong>proof of possession</strong>.</li>
    <li>The key stays on WEB01 so that only WEB01 can use the future certificate.</li>
    <li>Common failures: a typo in the SAN, user context instead of machine, the wrong template attribute.</li>
    <li>Next: certreq -submit sends it to SIMSI2027 Issuing CA 01 over RPC/DCOM, authenticated as Morgan.</li></ul></div>`;
  return plain + kv([
    ['Subject', r.subject], ['Requested SANs', r.san.map((n) => `${n.type}=${n.value}`).join(', ') || 'none'],
    ['Public key', `${r.publicKey.algorithm}, ${r.publicKey.bits} bits, exponent ${r.publicKey.exponent ?? '—'}`], ['SPKI SHA-256', mono(r.publicKey.spkiSha256)],
    ['Signature algorithm', r.signatureAlgorithm], ['Signature verification (live)', H(`${pill(r.signatureValid ? 'verifies with its own public key' : 'INVALID', r.signatureValid ? 'ok' : 'fail')} proof of possession`)],
    ['Requested Key Usage', `${r.requestedKeyUsage.join(', ') || '—'}${r.requestedKeyUsageCritical ? ' (critical)' : ''}`],
    ['Requested extensions', r.requestedExtensions.map((e) => ({ '2.5.29.17': 'Subject Alternative Name', '2.5.29.15': 'Key Usage' }[e.oid] ?? e.oid)).join(', ') + ' (no EKU: the template sets it)'],
    ['Template attribute (1.3.6.1.4.1.311.13.2.1)', r.templateAttribute ?? '—'],
    ['Client information (1.3.6.1.4.1.311.21.20)', r.clientInfo ? `machine ${r.clientInfo.machine}; user ${r.clientInfo.user}; process ${r.clientInfo.process}` : '—'],
    ['Machine context', H(`INF MachineKeySet = ${esc(inf?.fields['NewRequest.MachineKeySet'])}, Exportable = ${esc(inf?.fields['NewRequest.Exportable'])}; pending request ${esc(ctx.state.pendingRequest)} ${SIMV}`)],
    ...identityRows(ctx)
  ]) + '<p class="note">The CA records the authenticated submitter as Requester. The user named in the client information is only what certreq reported.</p>' + `<h4>ASN.1 summary</h4><pre class="pem small" tabindex="0">${esc(r.asn1.split('\n').slice(0, 24).join('\n'))}</pre>`;
}
// Certification path with a live signature check per link (from ctx.sigs, computed once from the parsed fixtures).
function pathRows(ctx, c, id) {
  const ica = ctx.model.resolve('ica', null).parsed, root = ctx.model.resolve('root', null).parsed; const sg = ctx.sigs ?? {};
  const rootLink = { name: 'SIMSI2027 Root CA (trust anchor, self-signed)', ok: !!sg[root.thumbprints.sha256]?.self, text: 'self-signature verifies; trusted because it is in the store' };
  const icaLink = { name: 'SIMSI2027 Issuing CA 01', ok: !!sg[ica.thumbprints.sha256]?.byRoot, text: 'signed by the Root CA (verified)' };
  if (id === 'selfsigned') return [{ name: `${c.subject} (self-signed)`, ok: false, text: '' }];
  if (id === 'root') return [rootLink];
  if (id === 'ica') return [rootLink, icaLink];
  return [rootLink, icaLink, { name: `${c.subject.split(',')[0].replace('CN=', '')} (leaf)`, ok: !!sg[c.thumbprints.sha256]?.byIca, text: 'signed by the Issuing CA (verified)' }];
}
export function privateKeyText(ctx, id) {
  const s = ctx.state;
  if (id === 'selfsigned') return 'Its own key on WEB01 (not part of this lesson); no file of it exists in this project.';
  if (!['leaf', 'accepted'].includes(id)) return 'No. That private key lives only on the CA.';
  if (s.pendingRequest === 'user-store') return 'No: the key was created in Morgan\'s user store, so certreq -accept -machine found no machine request to link.';
  if (s.leafState === 'unlinked') return 'No: this copy was imported from portal.cer, so no key is linked; the key still waits in the pending request on WEB01.';
  if (['linked', 'matched'].includes(s.keyAssociation)) return 'Yes: linked on WEB01 to the key created by certreq -new (it never travelled).';
  return 'Not yet: the key waits in the pending request on WEB01 until certreq -accept links it.';
}
export function certInspector(ctx, c, id) {
  const now = ctx.model.now; const valid = new Date(c.notBefore) <= now && now <= new Date(c.notAfter); const isLeaf = ['leaf', 'accepted'].includes(id);
  const intro = id === 'selfsigned' ? 'The temporary certificate IIS presented before the lesson. It is self-signed: its issuer is itself, so it cannot chain to a root CLIENT01 trusts.'
    : isLeaf ? 'The website certificate. The Issuing CA created and signed it with its own key; it carries WEB01\'s public key from the CSR. The name browsers check is in the SAN.'
      : id === 'ica' ? 'The public Issuing CA certificate. WEB01 sends it in the handshake so CLIENT01 can link the leaf to the Root. Its private key lives only on the CA.'
        : 'A public copy of the Root CA certificate: the trust anchor in CLIENT01\'s and WEB01\'s Trusted Root stores. Its private key stays offline.';
  const tpl = c.template ? `${c.template.name ?? '?'} (${c.template.oid} v${c.template.version}; ${c.template.resolvedFromOid ? 'name resolved from the OID' : 'name from extension'})` : 'none';
  const path = pathRows(ctx, c, id);
  const store = isLeaf ? 'Local Computer\\Personal on WEB01 (with its private key)' : id === 'ica' ? 'Local Computer\\Intermediate Certification Authorities (WEB01; sent to CLIENT01 in the handshake)' : id === 'root' ? 'Local Computer\\Trusted Root Certification Authorities (WEB01 and CLIENT01)' : 'None: it was only bound in IIS temporarily';
  return `<div class="card plainhdr"><h4>In plain language</h4><p>${esc(intro)}</p></div>` + kv([
    ['Subject', c.subject], ['Issuer', c.issuer], ['SAN', c.san.length ? c.san.map((n) => `${n.type}=${n.value}`).join(', ') : 'none'],
    ['EKU', c.eku.length ? H(c.eku.map((e) => `${esc(e.name)} <span class="mono small">${esc(e.oid)}</span>`).join('<br>')) : 'not restricted'], ['Key Usage', `${c.keyUsage.join(', ')}${c.keyUsageCritical ? ' (critical)' : ''}`],
    ['Basic Constraints', c.basicConstraints ? `CA:${String(c.basicConstraints.ca).toUpperCase()}${c.basicConstraints.pathLength !== null ? `, pathlen ${c.basicConstraints.pathLength}` : ''}${c.basicConstraints.critical ? ' (critical)' : ''}` : '—'],
    ['Template information (1.3.6.1.4.1.311.21.7)', tpl], ['Validity', H(`${esc(c.notBefore)} → ${esc(c.notAfter)} ${pill(valid ? 'valid at the simulation clock' : 'outside validity at the simulation clock', valid ? 'ok' : 'fail')}`)],
    ['Serial number', mono(c.serialNumber)], ['Thumbprint (SHA-1, as Windows shows it)', monoCopy(colonHex(c.thumbprints.sha1), 'SHA-1 thumbprint')], ['SHA-256', monoCopy(colonHex(c.thumbprints.sha256), 'SHA-256 thumbprint')],
    ['AIA (issuer certificate location)', c.aia.length ? mono(c.aia[0].location) : 'none'], ['CDP (CRL location)', c.cdp.length ? mono(c.cdp[0]) : 'none'],
    ['Certification path', H(`<ol class="tight">${path.map((l) => `<li>${esc(l.name)} ${pill(l.ok ? l.text : id === 'selfsigned' ? 'no chain to a trusted root' : 'signature does not verify', l.ok ? 'ok' : 'fail')}</li>`).join('')}</ol>`)],
    ['Expected store', store], ['Private key on WEB01', privateKeyText(ctx, id)], ['Private key on CLIENT01', 'Never: CLIENT01 has only public certificates'],
    ...(isLeaf ? identityRows(ctx) : [])
  ]);
}
// Store inspector: WEB01 (four cards) or CLIENT01's Trusted Root store.
export function storeInspector(ctx, storeId) {
  const s = ctx.state;
  if (storeId === 'client-root') {
    const present = s.clientTrust?.root === 'present';
    return `<div class="card store-card"><h4>${esc(CLIENT_ROOT.full)}</h4>${present ? certCard(ctx, 'root', 'CLIENT01') : '<p class="muted">No SIMSI2027 Root CA: not distributed to CLIENT01 (selected fault).</p>'}</div><p class="note">CLIENT01 holds no private key for portal.simsi2027.test; it only needs the Root as a trust anchor.</p>`;
  }
  const card = (st, items) => `<div class="card store-card"><h4>${esc(st.full)} (WEB01)</h4>${items || '<p class="muted">Empty.</p>'}</div>`;
  const leaf = ['accepted', 'unlinked'].includes(s.leafState) ? certCard(ctx, 'accepted', 'WEB01') : '';
  const ica = s.trust?.ica === 'present' ? certCard(ctx, 'ica', 'WEB01') : '<p class="muted">Missing (selected fault): WEB01 cannot send the Issuing CA certificate.</p>';
  const root = s.trust?.root === 'present' ? certCard(ctx, 'root', 'WEB01') : '';
  const pend = `<div class="card store-card"><h4>${esc(PENDING_STORE.full)} (WEB01) <span class="muted">(transient)</span></h4><p>${s.pendingRequest === 'present' ? `Pending request ${REQ} with its private key (non-exportable).` : s.pendingRequest === 'consumed' ? 'Empty: certreq -accept consumed the pending request.' : s.pendingRequest === 'user-store' ? 'Empty: the request was created in Morgan\'s user store (selected fault).' : 'Empty: certreq -new has not run yet.'}</p></div>`;
  const cards = { personal: card(STORES[0], leaf), intermediate: card(STORES[1], ica), root: card(STORES[2], root), requests: pend };
  const order = [storeId, ...Object.keys(cards).filter((k) => k !== storeId)].filter((k) => cards[k]);
  return order.map((k) => cards[k]).join('');
}
export function certCard(ctx, id, host) {
  const fx = fixture(ctx, id); const c = fx?.parsed; if (!c) return '';
  const s = ctx.state; const leaf = id === 'accepted';
  const source = leaf ? (s.leafState === 'unlinked' ? 'Imported from portal.cer (no key linked)' : 'certreq -accept -machine on WEB01') : id === 'ica' ? s.trust.icaSource : host === 'CLIENT01' ? (s.clientTrust?.source ?? 'Enterprise (AD) / Group Policy') : s.trust.rootSource;
  const rows = [
    ['What is it?', leaf ? 'The portal.simsi2027.test website certificate (public)' : id === 'ica' ? 'The Issuing CA certificate (public copy)' : 'The Root CA certificate (public copy)'],
    ['Who issued it?', c.issuer],
    ['Why this store?', leaf ? 'Personal holds certificates WEB01 uses with its own private key' : id === 'ica' ? 'Intermediate CAs hold certificates that link a leaf to the root' : 'Trusted Root CAs hold trust anchors'],
    [`Private key on ${host}?`, host === 'CLIENT01' ? 'No.' : privateKeyText(ctx, id)],
    ['Role in chain building', leaf ? 'End of the chain (leaf)' : id === 'ica' ? 'Middle link: signed the leaf; signed by the Root' : 'Chain end: self-signed trust anchor'],
    ['Identifies portal.simsi2027.test?', leaf ? `Yes (SAN: ${c.san.map((n) => n.value).join(', ')})` : 'No'],
    ['Trust anchor?', id === 'root' ? 'Yes' : 'No'],
    ['How did it get here?', H(`${esc(source ?? '—')} ${pill(source ?? '—', 'idle')}`)]
  ];
  return `<div class="certcard"><h5>${esc(c.subject)}</h5>${kv(rows)}<p><button class="linkbtn" data-open="artifact:${id === 'accepted' ? 'accepted' : id}">Open the certificate inspector</button></p></div>`;
}
// Handshake inspector: what each message carries, what is encrypted and what never travels. Protocol choices are labelled simulated.
export function handshakeInspector(ctx) {
  const s = ctx.state; const leaf = fixture(ctx, 'leaf')?.parsed; const ica = ctx.model.resolve('ica', null).parsed; const temp = ctx.model.resolve('selfsigned', null).parsed;
  const sent = s.handshakeChain === 'selfsigned' ? [`${temp.subject} (self-signed temporary certificate)`] : s.handshakeChain === 'leaf-only' ? [`${leaf.subject} (leaf only: the Issuing CA certificate is missing)`] : [`${leaf.subject} (leaf, serial ${leaf.serialNumber})`, `${ica.subject.split(',')[0]} (Issuing CA)`];
  return `<div class="card hs"><h4>Handshake inspector (TLS 1.3)</h4>${kv([
    ['ClientHello SNI', SITE], ['Versions offered', H(`TLS 1.3, TLS 1.2 ${SIMV}`)], ['Version chosen', H(`${esc(cfg('TLS 1.3 in this lesson.', 'which TLS versions client and server allow'))} ${SIMV}`)],
    ['Cipher suite', H(`TLS_AES_256_GCM_SHA384 with key exchange group x25519 ${SIMV}`)],
    ['Certificate list sent', H(`<ol class="tight">${sent.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>Root not sent (normally); a sent Root would not be trusted because it was sent.`)],
    ['CertificateVerify', 'WEB01 signs the transcript hash with its private key (RSA-PSS for an RSA key); CLIENT01 verifies with the leaf public key. Proves WEB01 holds the key.'],
    ['What is encrypted', 'Everything after ServerHello (including the Certificate message) with handshake keys; then the application data with session keys.'],
    ['What never travels', 'WEB01\'s private key, the session keys and CLIENT01\'s key-share secret.'],
    ['Encrypts the traffic', 'Session keys from the key exchange; the certificate only proves identity and authenticates the exchange.']
  ])}</div>`;
}

// ---------- 3. Command or GUI path ----------
export function commandHtml(ctx, activeToken = null) {
  const st = step(ctx); const c = st.command ?? st.gui;
  if (!c) return '<p class="muted">No command or GUI path in this step.</p>';
  const isGui = !st.command;
  return `<p class="banner" role="note">${esc(NEVER_EXECUTED)}</p>${isGui ? '<h4>GUI path (IIS Manager)</h4>' : ''}<pre class="cmd" translate="no"><code>${esc(c.text)}</code></pre><p class="copyrow">${copyBtn(c.text, isGui ? 'GUI path' : 'Command')}</p>
    <div class="tokens" role="group" aria-label="${isGui ? 'GUI path segments' : 'Command tokens'}: hover, focus or select one to see what it means">${c.tokens.map((t, i) => `<button type="button" class="token ${activeToken === i ? 'on' : ''}" translate="no" data-token="${i}" aria-pressed="${activeToken === i}" title="${esc(t.meaning)}">${esc(t.t)}</button>`).join('')}</div>
    <p class="token-meaning" aria-live="polite">${activeToken !== null && c.tokens[activeToken] ? `<strong>${esc(c.tokens[activeToken].t)}</strong>: ${esc(c.tokens[activeToken].meaning)}` : 'Hover over, focus or select a token to see what it means.'}</p>
    <dl class="kv small">${c.tokens.map((t) => `<dt class="mono">${esc(t.t)}</dt><dd>${esc(t.meaning)}</dd>`).join('')}</dl>`;
}

// ---------- 4. Raw artifact (on demand) ----------
export function rawHtml(ctx, mode) {
  const id = ctx.selection?.type === 'artifact' ? ctx.selection.id : step(ctx).artifact;
  const fx = id && fixture(ctx, id);
  if (!fx) return '<p class="muted">Select a CSR, certificate, CRL, chain or INF to view its raw form.</p>';
  const p = fx.parsed;
  const btns = `<p><button class="btn small" data-raw="pem" aria-pressed="${mode === 'pem'}">Show PEM</button> <button class="btn small" data-raw="asn1" aria-pressed="${mode === 'asn1'}" ${p.asn1 ? '' : 'disabled'}>Show ASN.1</button></p>`;
  const pemText = p.pem ?? p.text ?? '';
  const body = mode === 'pem' ? `<p class="copyrow">${copyBtn(pemText, 'PEM')}</p><pre class="pem" tabindex="0" translate="no" aria-label="PEM text">${esc(pemText)}</pre>`
    : mode === 'asn1' && p.asn1 ? `<pre class="pem" tabindex="0" translate="no" aria-label="ASN.1 summary">${esc(p.asn1)}</pre>` : '<p class="muted">Shown on demand.</p>';
  return `<p class="muted">${esc(artifactLabel(id))} · <span class="mono">${esc(fx.manifest.filename)}</span></p>${btns}${body}`;
}

// ---------- 5. Evidence ----------
export function evidenceHtml(ctx) {
  const { state: s, scenario: sc } = ctx; const st = step(ctx); const ev = ctx.ev;
  const checks = ev.checks.filter((c) => c.stage === st.id);
  const list = checks.map((c) => `<li class="ev-${c.status}">${kindBadge(c.kind)} <strong>${esc(c.label)}</strong> ${pill(c.status, c.status === 'pass' ? 'ok' : 'fail')}<p>${esc(c.detail)}</p></li>`).join('');
  const trace = buildTrace(sc, s.activeFault); const rev = s.direction === 'reverse';
  const tr = trace.map((e, i) => `<li class="${rev && i === s.evidenceIndex ? 'current' : ''} ${e.verdict === 'fail' ? 'fail' : ''}"><button class="trace-btn" data-evidence="${i}"><span class="q">${esc(e.question)}</span><span class="a">${esc(e.claim)}</span><span class="k">${kindBadge(e.evidenceKind ?? KIND.DERIVED)}</span></button></li>`).join('');
  return `${checks.length ? `<ul class="ev-list">${list}</ul>` : '<p class="muted">No checks at this step.</p>'}<h4>Reverse evidence trace</h4><ol class="trace">${tr}</ol>`;
}

// ---------- 6. Troubleshoot ----------
export function troubleshootHtml(ctx) {
  const { state: s, scenario: sc } = ctx; const st = step(ctx);
  if (s.activeFault === 'healthy') return `<p>No fault selected. Expected here: ${esc(st.result ?? st.purpose)}</p><p class="muted">What could go wrong: ${esc(st.explain.canGoWrong)}</p><p class="muted">Pick a fault in the header to see a worked example.</p>`;
  const f = FAULTS.find((x) => x.id === s.activeFault); const here = faultHere(ctx);
  return `<div class="card fault"><h4>${esc(f.label)} ${here ? pill('stops the flow here', 'fail') : pill(`manifests at "${sc.stages.find((q) => q.id === f.at)?.title}"`, 'idle')}</h4>
    ${kv([['Symptom', f.symptom], ['Evidence', H(f.evidence.map((e) => `${kindBadge(e.kind)} ${esc(e.text)}`).join('<br>'))], ['Owner', f.owner], ['Remediation', f.remediation], ['Stops the flow?', f.stops ? 'Yes' : 'No'], ['Long term', f.longTerm]])}</div>
    <p class="muted">Fix the cause, then step through again. Never ask visitors to click through a certificate warning.</p>`;
}

// ---------- Final step card ----------
export function finalCardHtml(ctx) {
  const s = ctx.state; const sc = ctx.scenario;
  if (s.halted) { const f = FAULTS.find((x) => x.id === s.activeFault) ?? getFault(sc, s.activeFault); return { title: `Stopped: ${f.label}`, text: f.symptom, kind: 'fail', openLabel: 'Fix and long term', openItems: [`Fix: ${f.remediation}`, `Long term: ${f.longTerm}`] }; }
  return { title: `Trusted connection: ${SITE} is who it says it is`, text: 'CLIENT01 checked the name, the chain to its trusted Root, the dates, the purpose and revocation, and WEB01 proved it holds the private key. Session keys encrypt the traffic.', kind: 'ok', openLabel: 'Follow-up', openItems: FOLLOWUP_ITEMS };
}
void URLS; void CFG;
