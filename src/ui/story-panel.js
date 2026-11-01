// Details panel for the v0.4.0 Domain Controller story. Ordered sections: Plain language · Technical details · Command explanation ·
// Raw artifact · Evidence · Troubleshoot (moves to position 2 and opens when a fault halts). Every field comes from parsed fixtures
// or is labelled as a simulated value. Pure HTML builders: no DOM access.
import { DC, ENV } from '../artifacts/synthetic.js';
import { ARTIFACTS, TEMPLATE_CARDS, STORES, PENDING_STORE, NEVER_EXECUTED, CFG, KIND, FAULTS, CONDITIONS, artifactLabel } from '../scenarios/dc/shared.js';
import { FOLLOWUP_ITEMS } from '../scenarios/dc/path-csr.js';
import { buildTrace, getFault } from '../engine/engine.js';
import { colonHex } from '../artifacts/model.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v?.html ?? esc(v ?? '—')}</dd>`).join('')}</dl>`;
const H = (html) => ({ html });
const mono = (s) => H(`<span class="mono">${esc(s)}</span>`);
const pill = (text, kind) => `<span class="pill pill-${kind}">${esc(text)}</span>`;
const KIND_PILL = { [KIND.REAL]: 'ok', [KIND.SIM]: 'idle', [KIND.DERIVED]: 'policy', [KIND.FAULT]: 'fail' };
export const kindBadge = (k) => String(k).split(' + ').map((x) => pill(x, KIND_PILL[x] ?? 'idle')).join(' ');
const SIMV = '<span class="pill pill-idle">Simulated environment</span>';

export const SECTION_IDS = ['plain', 'technical', 'command', 'raw', 'evidence', 'troubleshoot'];
export const SECTION_TITLES = { plain: 'Plain language', technical: 'Technical details', command: 'Command explanation', raw: 'Raw artifact', evidence: 'Evidence', troubleshoot: 'Troubleshoot' };
// Section order: Troubleshoot moves to position 2 when a fault halts the flow (or a continuing fault manifests at this step).
export function sectionOrder(ctx) { return faultHere(ctx) ? ['plain', 'troubleshoot', 'technical', 'command', 'raw', 'evidence'] : SECTION_IDS; }
export function faultHere(ctx) {
  const { state: s, scenario: sc } = ctx; if (s.activeFault === 'healthy') return false;
  const f = getFault(sc, s.activeFault); return s.halted || (s.direction === 'forward' && sc.stages[s.stage]?.id === f.stage && s.stageProgress >= 1);
}

const fixture = (ctx, artifactId) => ctx.scenario.resolveFixture?.(ctx.model, artifactId, ctx.state.activeFault) ?? null;
const step = (ctx) => ctx.scenario.stages[ctx.state.stage];

// ---------- Collapsed summary (320 px column / 48 px tab) ----------
export function summaryHtml(ctx) {
  const st = step(ctx); const s = ctx.state;
  if (!ctx.started) return `<h2>Domain Controller Manual Enrollment</h2><p>Choose a path, then press <strong>START FLOW</strong>.</p><p class="muted">Path A carries a CSR through a controlled transfer host. Path B enrolls directly from the Certificates (Local Computer) console.</p>`;
  if (s.direction === 'reverse') { const t = buildTrace(ctx.scenario, s.activeFault)[s.evidenceIndex]; return `<h2>${esc(t.question)}</h2><p>${esc(t.claim)}</p><p>${kindBadge(t.evidenceKind)}</p>`; }
  const x = st.explain;
  return `<h2>${esc(st.title)}</h2>${st.skipped ? `<p class="note">${esc(st.result)}</p>` : ''}<dl class="sum"><dt>What happens</dt><dd>${esc(st.purpose)}</dd><dt>Who acts</dt><dd>${esc(x.who)}</dd><dt>What moves</dt><dd>${esc(x.moves)}</dd></dl>`;
}

// ---------- 1. Plain language ----------
export function plainHtml(ctx) {
  const st = step(ctx); const s = ctx.state; const x = st.explain; const sel = ctx.selection;
  let head = '';
  if (sel?.type === 'artifact' && ARTIFACTS[sel.id]) head = `<div class="card about"><h4>About this object: ${esc(artifactLabel(sel.id, ctx.scenario.pathId))}</h4><p>${esc(plainArtifact(sel.id, ctx))}</p></div>`;
  else if (sel?.type === 'store') { const so = STORES.find((q) => q.id === sel.id); head = `<div class="card about"><h4>About this store</h4><p>${esc(so?.full)} on DC01. ${esc(storePlain(sel.id))}</p></div>`; }
  else if (sel?.type === 'entity' && sel.id === 'rootca') head = '<div class="card about"><h4>About the offline Root CA</h4><p>SIMSI2027-ROOTCA signed the Issuing CA certificate earlier, offline. It is not contacted for this request and never signs the DC01 certificate.</p></div>';
  else if (sel?.type === 'zone') { const z = ctx.scenario.zones.find((q) => q.id === sel.id); head = `<div class="card about"><h4>About zone ${z?.n}: ${esc(z?.name)}</h4><p>${esc(zonePlain(sel.id, ctx))}</p></div>`; }
  else if (sel?.type === 'pub') head = `<div class="card about"><h4>${sel.id === 'aia' ? 'AIA: where to download the issuer certificate' : 'CDP: where to download the CRL'}</h4><p>${sel.id === 'aia' ? 'Authority Information Access points to the Issuing CA certificate. DC01 needs it only if the Intermediate store does not already hold that certificate.' : 'The CRL Distribution Point is where DC01 downloads the Certificate Revocation List to check that the certificate was not revoked. It is a different URL from the AIA.'}</p></div>`;
  if (s.direction === 'reverse') { const t = buildTrace(ctx.scenario, s.activeFault)[s.evidenceIndex]; return `${head}<p class="lead"><strong>${esc(t.question)}</strong> ${esc(t.claim)}</p><p>${kindBadge(t.evidenceKind)}</p><p class="muted">Reverse evidence walks from the result back to its causes; it is not a reversed animation.</p>`; }
  if (st.skipped) return `${head}<p class="lead">${esc(st.title)}: <strong>${esc(st.result)}</strong></p><p>The Root and Issuing CA certificates already arrived from Active Directory (Enterprise store), so this installation step is not needed.</p>`;
  return `${head}<p class="lead">${esc(st.purpose)}</p><dl class="qa"><dt>What happens</dt><dd>${esc(x.what)}</dd><dt>Who acts</dt><dd>${esc(x.who)}</dd><dt>What moves</dt><dd>${esc(x.moves)}</dd><dt>What stays on DC01</dt><dd>${esc(x.staysLocal)}</dd><dt>What can go wrong</dt><dd>${esc(x.canGoWrong)}</dd></dl>
    ${st.result ? `<p><strong>Result:</strong> ${esc(st.result)}</p>` : ''}${st.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}${conditionNote(ctx)}${st.id === 'a-followup' ? `<h4>Open items</h4><ul class="tight">${FOLLOWUP_ITEMS.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
}
// The lesson condition and its long-term fix, shown where the condition matters (trust check and the installation steps).
export function conditionNote(ctx) {
  const st = step(ctx); const c = CONDITIONS.find((x) => x.id === ctx.scenario.conditionId);
  if (!c?.longTerm || !(st.id === 'a-trust-check' || st.conditional === c.id)) return '';
  return `<p class="note"><strong>Condition: ${esc(c.label)}</strong> (${esc(c.note)}). Long term: ${esc(c.longTerm)}</p>`;
}
function plainArtifact(id, ctx) {
  const B = ctx.scenario.pathId === 'mmc';
  return {
    'private-key': 'The private key was created on DC01 and never leaves it. It is not a file in this project and is never shown or transmitted.',
    inf: 'A small text policy that tells certreq what key and names to request. It contains no secret.',
    csr: B ? 'The request the wizard built in memory: DC01\'s new public key and the requested template, signed with DC01\'s new private key. It is not a certificate and contains no private key.' : 'A Certificate Signing Request: DC01\'s public key, the names it asks for and the template, signed with DC01\'s private key. It is not a certificate and contains no private key.',
    package: 'Only the CSR and its SHA-256 hash travel. Nothing in it is secret.',
    record: `The CA's database row for request ${DC.requestId}: who submitted it (Requester), for which template, and its disposition.`,
    leaf: 'The new certificate the Issuing CA created for DC01 and signed with its own key. It is public.',
    accepted: 'The DC01 certificate in Personal, linked to the private key that DC01 created at the start.',
    ica: 'The public certificate of SIMSI2027 Issuing CA 01. Its private key lives only on the CA.',
    root: 'A public copy of the SIMSI2027 Root CA certificate: the trust anchor. Its private key stays offline.',
    chain: 'The path leaf → Issuing CA → Root, each signed by the next.',
    return: 'The public return package: leaf, PKCS #7 chain, Issuing CA and Root certificates, and a SHA-256 manifest. No private key.',
    crl: 'The Certificate Revocation List published by the Issuing CA at the CDP.',
    error: 'The error DC01 recorded when it could not reach ICA01 over RPC/DCOM.',
    identity: 'The names the certificate must carry: DC01.simsi2027.test, simsi2027.test and SIMSI2027.',
    template: B ? 'KerberosAuthentication builds the identity from Active Directory.' : 'DCOfflineKerberosAuth lets the request supply the names, under tight controls.',
    wizard: 'The Certificates console wizard that enrolls the computer directly.',
    remediation: 'What is still open after the manual fix.'
  }[id] ?? '';
}
const storePlain = (id) => ({ personal: 'Holds certificates DC01 itself uses, with their private keys.', intermediate: 'Holds CA certificates that link a leaf to a root. No private keys.', root: 'Holds trust anchors. A certificate here is trusted as a chain end. No private keys.', requests: 'Holds pending requests and their private keys until certreq -accept links a certificate.' }[id] ?? '');
function zonePlain(id, ctx) {
  const B = ctx.scenario.pathId === 'mmc';
  return { Z1: 'DC01 itself: where the problem is diagnosed and where the private key is created and kept.', Z2: B ? 'The enrollment wizard on DC01 builds the request in memory.' : 'The request policy (INF) and the CSR, created on DC01.', Z3: B ? 'No handoff: DC01 talks to ICA01 directly over RPC/DCOM.' : 'PKI-TRANSFER01: a controlled admin host used to carry public files to and from the CA.', Z4: 'ICA01, the online Issuing CA: submission, policy, approval and issuance.', Z5: B ? 'The wizard receives and installs the response automatically.' : 'The public return package: leaf and chain certificates, never a private key.', Z6: 'DC01\'s Local Computer certificate stores (same computer as zone 1).' }[id];
}

// ---------- Identity (golden rule 5): three separate labelled fields ----------
export function identityRows(ctx) {
  const B = ctx.scenario.pathId === 'mmc'; const req = ctx.state.requester;
  return [['Subject (certificate identity)', B ? 'Built from AD: DC01.simsi2027.test (SAN; the subject field is empty)' : DC.fqdn], ['Operator (human)', DC.operator],
    ['Requester (CA record)', req ? `${req}${B ? ' — direct machine enrollment' : ` — submission authenticated from ${DC.transferHost}`}` : 'Not recorded yet (no submission)']];
}

// ---------- 2. Technical details ----------
export function technicalHtml(ctx) {
  const sel = ctx.selection;
  if (sel?.type === 'artifact' && ARTIFACTS[sel.id]?.role) return artifactInspector(ctx, sel.id);
  if (sel?.type === 'artifact' && sel.id === 'private-key') return kv([['Location', `${PENDING_STORE.full} on DC01 (pending request), then linked in Personal`], ['Exportable', 'FALSE (INF Exportable = FALSE)'], ['Machine key set', 'TRUE (INF MachineKeySet = TRUE)'], ['In this project', 'Never: no private key file exists']]) + `<p>${SIMV} The key location is simulated; the INF values are parsed from the fixture.</p>`;
  if (sel?.type === 'store') return storeInspector(ctx, sel.id);
  if (sel?.type === 'artifact' && sel.id === 'template') return templateCards(ctx);
  const st = step(ctx); const s = ctx.state;
  let h = `<h4>Identity</h4>${kv(identityRows(ctx))}`;
  h += kv([['Step', `${ctx.scenario.stages.indexOf(st) + 1} of ${ctx.scenario.stages.length} · ${st.milestone}`], ['Zone', ctx.scenario.zones.find((z) => z.id === st.zone)?.name], ['Actor', { OP: DC.operator, MGR: DC.certManager, SYS: 'System' }[st.actor]],
    ['Channel', st.connector ? (st.connector.association ? 'DC01 internal association (never on the network)' : st.connector.channel ?? 'local store write') : 'None (no movement)'], ['Result', st.result ?? '—'],
    ['CA configuration', DC.caConfig], ['Request ID', ['none'].includes(s.requestRecord) ? 'not assigned yet' : String(DC.requestId)]]);
  if (['a-template', 'b-template', 'b-permission', 'b-wizard', 'a-policy'].includes(st.id)) h += templateCards(ctx);
  if (st.artifact && ARTIFACTS[st.artifact]?.role && !st.skipped) h += `<p><button class="linkbtn" data-open="artifact:${st.artifact}">Inspect the ${esc(artifactLabel(st.artifact, ctx.scenario.pathId))}</button></p>`;
  return h;
}

export function templateCards(ctx) {
  const B = ctx.scenario.pathId === 'mmc';
  return TEMPLATE_CARDS.map((t) => `<div class="card tpl ${t.comparison ? 'cmp' : ''} ${(B ? t.path === 'mmc' : t.path === 'csr') ? 'this' : ''}"><h4>${esc(t.display)} <span class="mono small">${esc(t.name)}</span>${t.comparison ? ' · comparison only' : (B ? t.path === 'mmc' : t.path === 'csr') ? ' · used on this path' : ''}</h4>
    ${t.oid ? `<p class="muted mono">${esc(t.oid)} v${esc(t.version)}${t.simulated ? ' · simulated, organization-specific' : ''}</p>` : ''}${kv(t.rows)}${t.warning ? `<p class="warn" role="note"><strong>Warning:</strong> ${esc(t.warning)}</p>` : ''}${t.why ? `<p class="note">${esc(t.why)}</p>` : ''}${t.note ? `<p class="muted">${esc(t.note)}</p>` : ''}</div>`).join('');
}

// ---------- Inspectors ----------
export function artifactInspector(ctx, id) {
  const fx = fixture(ctx, id); if (!fx) return '<p class="muted">No fixture for this artifact.</p>';
  const p = fx.parsed;
  const src = `<p class="syn">Parsed from <span class="mono">${esc(fx.manifest.filename)}</span> (synthetic demonstration fixture).</p>`;
  const dl = (ctx.downloads?.(fx) ?? '') + (ctx.nativeBlock?.(fx) ?? '');
  if (p.kind === 'csr') return src + csrInspector(ctx, p) + dl;
  if (p.kind === 'certificate') return src + certInspector(ctx, p, id) + dl;
  if (p.kind === 'inf') return src + kv([['Subject', p.fields['NewRequest.Subject']], ['MachineKeySet', p.fields['NewRequest.MachineKeySet']], ['Exportable', p.fields['NewRequest.Exportable']], ['KeyLength', p.fields['NewRequest.KeyLength']], ['KeySpec', p.fields['NewRequest.KeySpec']], ['KeyUsage', p.fields['NewRequest.KeyUsage']], ['ProviderName', p.fields['NewRequest.ProviderName']], ['RequestType', p.fields['NewRequest.RequestType']], ['HashAlgorithm', p.fields['NewRequest.HashAlgorithm']], ['CertificateTemplate', p.template], ['SAN text', p.fields['Extensions._continue_']]]) + dl;
  if (p.kind === 'p7b') return src + `<p>PKCS #7 (a container format that carries several certificates) with ${p.certs.length} public certificates and no private key:</p><ol class="tight">${p.certs.map((c) => `<li>${esc(c.subject || '(empty subject)')} <span class="mono small">SHA-1 ${esc(c.thumbprints.sha1)}</span></li>`).join('')}</ol>` + dl;
  if (p.kind === 'crl') return src + kv([['Issuer', p.issuer], ['CRL number', String(p.crlNumber)], ['This update', p.thisUpdate], ['Next update', p.nextUpdate], ['Entries', String(p.entries.length)], ['Signature algorithm', p.signatureAlgorithm], ['Published at (CDP)', mono(p.distribution)]]) + dl;
  if (p.kind === 'chain') return src + `<ol class="tight">${p.certs.map((c, i) => `<li>${['Leaf', 'Issuing CA', 'Root'][i]}: ${esc(c.subject)}</li>`).join('')}</ol>` + dl;
  return src + dl;
}

export function csrInspector(ctx, r) {
  const B = ctx.scenario.pathId === 'mmc'; const inf = ctx.model.resolve('dc-inf', ctx.state.activeFault === 'user-context' ? 'user-context' : null).parsed;
  const plain = `<div class="card plainhdr"><h4>In plain language</h4><ul class="tight">
    <li>A <strong>CSR</strong> (Certificate Signing Request) asks a CA for a certificate.</li>
    <li>DC01 creates it because only DC01 holds the matching private key.</li>
    <li>It contains the <strong>public key</strong>, the requested identity, extensions and attributes.</li>
    <li>It does <strong>not</strong> contain the private key, any issuer signature, and it is not a certificate.</li>
    <li>Its signature is made with DC01's private key: <strong>proof of possession</strong>.</li>
    <li>The key stays on DC01 so that only DC01 can use the future certificate.</li>
    <li>Common failures: user context instead of machine, wrong template, missing domain SAN, accepting elsewhere.</li>
    <li>Next: ${B ? 'the wizard sends it to ICA01 over RPC/DCOM as DC01$' : 'it is hashed, carried to PKI-TRANSFER01 and submitted to ICA01 by PKIOperator'}.</li></ul></div>`;
  return plain + kv([
    ['Subject', r.subject || '(empty: the CA builds the identity from AD)'], ['Requested SANs', r.san.length ? r.san.map((n) => `${n.type}=${n.value}`).join(', ') : 'None (built from AD by the CA)'],
    ['Public key', `${r.publicKey.algorithm}, ${r.publicKey.bits} bits, exponent ${r.publicKey.exponent ?? '—'}`], ['SPKI SHA-256', mono(r.publicKey.spkiSha256)],
    ['Signature algorithm', r.signatureAlgorithm], ['Signature verification (live)', H(`${pill(r.signatureValid ? 'verifies with its own public key' : 'INVALID', r.signatureValid ? 'ok' : 'fail')} proof of possession`)],
    ['Requested Key Usage', `${r.requestedKeyUsage.join(', ') || '—'}${r.requestedKeyUsageCritical ? ' (critical)' : ''}`],
    ['Template attribute (1.3.6.1.4.1.311.13.2.1)', r.templateAttribute ?? '—'],
    ['Machine context', H(`${B ? 'Wizard in the Local Computer store' : `INF MachineKeySet = ${esc(inf.fields['NewRequest.MachineKeySet'])}, Exportable = ${esc(inf.fields['NewRequest.Exportable'])}`}; pending request ${B ? 'not shown (transient)' : esc(ctx.state.pendingRequest)} ${SIMV}`)],
    ['Client information (1.3.6.1.4.1.311.21.20)', r.clientInfo ? `machine ${r.clientInfo.machine}; user ${r.clientInfo.user}; process ${r.clientInfo.process}` : '—'],
    ...identityRows(ctx)
  ]) + '<p class="note">The CA records the authenticated submitter as Requester. The user named in the client information is only what the requesting tool reported.</p>' + `<h4>ASN.1 summary</h4><pre class="pem small" tabindex="0">${esc(r.asn1.split('\n').slice(0, 24).join('\n'))}</pre>`;
}

export function certInspector(ctx, c, id) {
  const s = ctx.state; const isLeaf = ['leaf', 'accepted'].includes(id); const B = ctx.scenario.pathId === 'mmc';
  const now = ctx.model.now; const valid = new Date(c.notBefore) <= now && now <= new Date(c.notAfter);
  const sig = ctx.sigs?.[c.thumbprints.sha256];
  const plain = `<div class="card plainhdr"><h4>In plain language</h4><p>${isLeaf ? `The DC01 certificate. ${c.subject ? '' : 'Its subject field is empty because KerberosAuthentication puts the identity in the SAN, built from AD. '}The Issuing CA created and signed it with its own key; it carries DC01's public key from the request.` : id === 'ica' ? 'The public Issuing CA certificate. It links DC01\'s certificate to the Root. Its private key lives only on the CA.' : `A public copy of the Root CA certificate: the trust anchor. ${c.selfSigned ? 'It is self-signed.' : ''} Its private key stays offline.`}</p></div>`;
  const tpl = c.template ? `${c.template.name ?? '?'} (${c.template.oid} v${c.template.version}; ${c.template.resolvedFromOid ? 'name resolved from the OID' : 'name from extension'})` : 'none (CA certificate)';
  const path = ctx.chainOf?.(c, id) ?? [];
  return plain + kv([
    ['Subject', c.subject || '(empty — identity is in the SAN)'], ['Issuer', c.issuer], ['SAN', c.san.length ? `${c.san.map((n) => `${n.type}=${n.value}`).join(', ')}${c.sanCritical ? ' (critical)' : ''}` : 'none'],
    ['EKU', c.eku.length ? H(c.eku.map((e) => `${esc(e.name)} <span class="mono small">${esc(e.oid)}</span>`).join('<br>')) : 'not restricted'], ['Key Usage', `${c.keyUsage.join(', ')}${c.keyUsageCritical ? ' (critical)' : ''}`],
    ['Basic Constraints', c.basicConstraints ? `CA:${String(c.basicConstraints.ca).toUpperCase()}${c.basicConstraints.pathLength !== null ? `, pathlen ${c.basicConstraints.pathLength}` : ''}${c.basicConstraints.critical ? ' (critical)' : ''}` : '—'],
    ['Template information (1.3.6.1.4.1.311.21.7)', tpl], ['Validity', H(`${esc(c.notBefore)} → ${esc(c.notAfter)} ${pill(valid ? 'valid at the simulation clock' : 'outside validity at the simulation clock', valid ? 'ok' : 'fail')}`)],
    ['Serial number', mono(c.serialNumber)], ['Thumbprint (SHA-1, as Windows shows it)', mono(colonHex(c.thumbprints.sha1))], ['SHA-256', mono(colonHex(c.thumbprints.sha256))],
    ['AIA (issuer certificate location)', c.aia.length ? mono(c.aia[0].location) : 'none'], ['CDP (CRL location)', c.cdp.length ? mono(c.cdp[0]) : 'none'],
    ['Certification path', H(path.length ? `<ol class="tight">${path.map((l) => `<li>${esc(l.name)} ${pill(l.ok ? l.text : 'signature does not verify', l.ok ? 'ok' : 'fail')}</li>`).join('')}</ol>` : esc(sig ?? '—'))],
    ['Expected store', isLeaf ? 'Local Computer\\Personal' : id === 'ica' ? 'Local Computer\\Intermediate Certification Authorities' : 'Local Computer\\Trusted Root Certification Authorities'],
    ['Private key on DC01', privateKeyText(ctx, id)],
    ...(isLeaf ? identityRows(ctx) : [])
  ]) + (B && isLeaf ? '' : '');
}
export function privateKeyText(ctx, id) {
  const s = ctx.state;
  if (!['leaf', 'accepted'].includes(id)) return 'No. That private key lives only on the CA.';
  if (s.activeFault === 'accepted-on-wrong-machine' && s.halted) return 'No: this copy on PKI-TRANSFER01 has no private key. Copying a CER neither copies nor recreates the key.';
  if (s.keyAssociation === 'mismatch' || s.leafState === 'unlinked') return 'No: its public key matches no pending request on DC01, so certreq -accept could not link a key. Request 1042 and its key are still waiting.';
  if (s.pendingRequest === 'user-store') return 'No: the key was created in the operator\'s user store, so certreq -accept -machine found no machine request to link.';
  if (s.pendingRequest === 'lost') return 'No: the pending request that held the key is gone, so nothing can be linked. Create a new request on DC01.';
  if (['linked', 'matched'].includes(s.keyAssociation)) return 'Yes: linked on DC01 to the key created at the start (it never travelled).';
  return 'Not yet: the key waits in the pending request on DC01 until certreq -accept links it.';
}

export function storeInspector(ctx, storeId) {
  const s = ctx.state; const B = ctx.scenario.pathId === 'mmc';
  const card = (st, items) => `<div class="card store-card"><h4>${esc(st.full)}</h4>${items || '<p class="muted">Empty.</p>'}</div>`;
  const leaf = s.leafState === 'accepted' ? certCard(ctx, 'accepted') : '';
  const ica = s.trust?.ica === 'present' ? certCard(ctx, 'ica') : '';
  const root = s.trust?.root === 'present' ? certCard(ctx, 'root') : '';
  const pend = !B ? `<div class="card store-card"><h4>${esc(PENDING_STORE.full)} <span class="muted">(transient, Path A only)</span></h4><p>${s.pendingRequest === 'present' ? `Pending request ${DC.requestId} with its private key (non-exportable).` : s.pendingRequest === 'consumed' ? 'Empty: certreq -accept consumed the pending request.' : 'Empty.'}</p></div>` : '';
  const cards = { personal: card(STORES[0], leaf), intermediate: card(STORES[1], ica), root: card(STORES[2], root) };
  const order = [storeId, ...Object.keys(cards).filter((k) => k !== storeId)].filter((k) => cards[k]);
  return order.map((k) => cards[k]).join('') + pend;
}
// The eight-question card for a certificate in a store.
export function certCard(ctx, id) {
  const fx = fixture(ctx, id === 'accepted' ? 'accepted' : id); const c = fx?.parsed; if (!c) return '';
  const s = ctx.state; const leaf = id === 'accepted';
  const source = leaf ? (ctx.scenario.pathId === 'mmc' ? 'Installed automatically by the enrollment wizard on DC01' : 'certreq -accept on DC01') : id === 'ica' ? s.trust.icaSource : s.trust.rootSource;
  const rows = [
    ['What is it?', leaf ? 'The DC01 Domain Controller certificate (public)' : id === 'ica' ? 'The Issuing CA certificate (public copy)' : 'The Root CA certificate (public copy)'],
    ['Who issued it?', c.issuer],
    ['Why this store?', leaf ? 'Personal holds certificates DC01 uses with its own private key' : id === 'ica' ? 'Intermediate CAs hold certificates that link a leaf to the root' : 'Trusted Root CAs hold trust anchors'],
    ['Private key on DC01?', privateKeyText(ctx, id)],
    ['Role in chain building', leaf ? 'End of the chain (leaf)' : id === 'ica' ? 'Middle link: signed the leaf; signed by the Root' : 'Chain end: self-signed trust anchor'],
    ['Identifies DC01?', leaf ? 'Yes (SAN: ' + c.san.map((n) => n.value).join(', ') + ')' : 'No'],
    ['Trust anchor?', id === 'root' ? 'Yes' : 'No'],
    ['How did it get here?', H(`${esc(source ?? '—')} ${pill(source ?? '—', 'idle')}`)]
  ];
  return `<div class="certcard"><h5>${esc(c.subject || 'DC01 certificate (empty subject)')}</h5>${kv(rows)}<p><button class="linkbtn" data-open="artifact:${id}">Open the certificate inspector</button></p></div>`;
}

// ---------- 3. Command explanation ----------
export function commandHtml(ctx, activeToken = null) {
  const st = step(ctx);
  if (!st.command && !st.gui) return '<p class="muted">No command in this step.</p>';
  let h = '';
  if (st.command) {
    h += `<p class="banner" role="note">${esc(NEVER_EXECUTED)}</p><pre class="cmd"><code>${esc(st.command.text)}</code></pre>
      <div class="tokens" role="list" aria-label="Command tokens">${st.command.tokens.map((t, i) => `<button class="token ${activeToken === i ? 'on' : ''}" role="listitem" data-token="${i}" aria-pressed="${activeToken === i}">${esc(t.t)}</button>`).join('')}</div>
      <p class="token-meaning" aria-live="polite">${activeToken !== null && st.command.tokens[activeToken] ? `<strong>${esc(st.command.tokens[activeToken].t)}</strong>: ${esc(st.command.tokens[activeToken].meaning)}` : 'Select a token to see what it means.'}</p>
      <dl class="kv small">${st.command.tokens.map((t) => `<dt class="mono">${esc(t.t)}</dt><dd>${esc(t.meaning)}</dd>`).join('')}</dl>`;
  }
  if (st.gui) h += `${st.command ? '' : `<p class="banner" role="note">${esc(NEVER_EXECUTED)}</p>`}<h4>Console path</h4><p>${esc(st.gui)}</p>`;
  return h;
}

// ---------- 4. Raw artifact (on demand) ----------
export function rawHtml(ctx, mode) {
  const id = ctx.selection?.type === 'artifact' ? ctx.selection.id : step(ctx).artifact;
  const fx = id && fixture(ctx, id);
  if (!fx) return '<p class="muted">Select a CSR, certificate, CRL or package to view its raw form.</p>';
  const p = fx.parsed;
  const btns = `<p><button class="btn small" data-raw="pem" aria-pressed="${mode === 'pem'}">Show PEM</button> <button class="btn small" data-raw="asn1" aria-pressed="${mode === 'asn1'}" ${p.asn1 ? '' : 'disabled'}>Show ASN.1</button></p>`;
  const body = mode === 'pem' ? `<pre class="pem" tabindex="0">${esc(p.pem ?? p.text ?? '')}</pre>` : mode === 'asn1' && p.asn1 ? `<pre class="pem" tabindex="0">${esc(p.asn1)}</pre>` : '<p class="muted">Shown on demand.</p>';
  return `<p class="muted">${esc(artifactLabel(id, ctx.scenario.pathId))} ·<span class="mono">${esc(fx.manifest.filename)}</span></p>${btns}${body}`;
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
  if (s.activeFault === 'healthy') return `<p>No fault selected. Expected here: ${esc(st.result ?? st.purpose)}</p><p class="muted">What can go wrong: ${esc(st.explain.canGoWrong)}</p><p class="muted">Pick a fault in the header to see a worked example.</p>`;
  const f = FAULTS.find((x) => x.id === s.activeFault); const here = faultHere(ctx);
  return `<div class="card fault"><h4>${esc(f.label)} ${here ? pill(f.stops ? 'stops the flow here' : 'continues; verdict withheld', 'fail') : pill(`manifests at "${sc.stages.find((q) => q.id === getFault(sc, s.activeFault).stage)?.title}"`, 'idle')}</h4>
    ${kv([['Symptom', f.symptom], ['Evidence', H(f.evidence.map((e) => `${kindBadge(e.kind)} ${esc(e.text)}`).join('<br>'))], ['Owner', f.owner], ['Remediation', f.remediation], ['Stops the flow?', f.stops ? 'Yes' : 'No: the chain builds, but the verdict is withheld'], ['Long term', f.longTerm]])}
    ${f.switchPath ? `<p><button class="btn small" data-switch-path="${f.switchPath}">Switch to Path A (approved exception)</button></p>` : ''}</div>
    <p class="muted">Manual enrollment, even when it works, does not explain why autoenrollment did not.</p>`;
}

// ---------- Final step card ----------
export function finalCardHtml(ctx) {
  const s = ctx.state; const sc = ctx.scenario;
  if (s.halted) { const f = getFault(sc, s.activeFault); return { title: `Stopped: ${f.label}`, text: f.symptom, kind: 'fail' }; }
  if (s.trustDecision === 'withheld') return { title: 'Not confirmed suitable — revocation status unknown', text: 'The chain builds, but the CRL could not be fetched from the CDP. Fix CDP reachability, then verify again.', kind: 'warn' };
  return { title: 'Suitable now; root cause still open', text: sc.pathId === 'mmc' ? 'DC01 has a suitable certificate. Confirm that autoenrollment renews it.' : 'DC01 has a suitable certificate. Fix RPC/DCOM, autoenrollment and trust distribution; this manual certificate will not renew itself.', kind: 'ok' };
}
void ENV; void CFG;
