// Educational panel builders: Explain, Evidence, Troubleshoot and friendly artifact summaries.
// Classic layout (TLS). The Domain Controller story uses src/ui/story-panel.js.
import { ENV } from '../artifacts/synthetic.js';
import { entityById } from '../entities/entities.js';
import { getFault, buildTrace, stageIndex } from '../engine/engine.js';
import { esc, kv, H, sec, badge, faultExplanation } from './details.js';
export const fixtureFor = (ctx, artifactId) => {
  const a = ctx.scenario.artifacts.find((x) => x.id === artifactId);
  return a?.fixtureRole ? ctx.model.resolve(a.fixtureRole, ctx.state.activeFault) : null;
};
const KIND_PILL = { 'Real fixture data': 'ok', 'Simulated environment': 'idle', 'Derived conclusion': 'policy', 'User-selected fault': 'fail' };
const kindBadge = (k) => badge(k, KIND_PILL[k] ?? 'idle');

export function currentStage(ctx) { return ctx.scenario.stages[ctx.state.stage]; }

// ---------- Explain ----------
export function explainHtml(ctx, sel = {}) {
  const { scenario, state: s } = ctx; const st = currentStage(ctx); const x = st.explain;
  const rev = s.direction === 'reverse';
  let head = '';
  if (sel.entity) {
    const e = { ...entityById[sel.entity], ...(scenario.overrides?.[sel.entity] ?? {}) };
    const extra = sel.entity === 'rootca' ? '<p class="note">Previously signed the Issuing CA certificate; <strong>not contacted</strong> for this request. It never signs the end-entity certificate.</p>'
      : sel.entity === 'client01' ? '<p class="note">The client IP address is contextual information (logging, firewalls). It is <strong>not</strong> the enrollment authority.</p>'
        : sel.entity === 'operator' ? '<p class="note">The operator starts the procedure. The certificate belongs to the computer DC01, not to the operator.</p>'
          : sel.entity === 'dc01' ? '<p class="note">DC01 generates and keeps its private key. Its synthetic IP is context only.</p>' : '';
    head = `<section class="card entity"><h3>About this object</h3><h2>${esc(e.label)}</h2><p>${esc(e.blurb)}</p>${extra}<p class="muted">See the Technical details tab for fields.</p></section>`;
  } else if (sel.flow) {
    const f = scenario.flows.find((q) => q.id === sel.flow);
    head = `<section class="card entity"><h3>About this arrow</h3><p><strong>${esc(f.protocol)}</strong> carries <em>${esc(f.payload)}</em>.</p><p class="muted">See Technical details for source, destination, identity and evidence.</p></section>`;
  }
  const qa = x ? [['What is happening?', x.what], ['Why is this necessary?', x.why], ['Who performs this action?', x.who], ['Where does it happen?', x.where], ['What moves to the next step?', x.next], ['What remains private or local?', x.local], ['What could commonly go wrong?', (x.wrong ?? []).join('; ')]] : [];
  const fault = s.halted ? `<section class="card fault"><h3>Stopped</h3><p>${esc(getFault(scenario, s.activeFault).label)} stops the flow here. Open the Troubleshoot tab for the evidence, owner and fix.</p></section>` : '';
  const revNote = rev ? '<p class="muted">Reverse evidence mode: the finished world is shown while the Evidence tab walks the trace of why the result holds.</p>' : '';
  return `${head}<section class="card step"><div class="phase-chip">${esc(st.phase)}</div><h2>${s.stage + 1}. ${esc(st.title)}</h2><p class="lead">${esc(st.narrative)}</p>${revNote}
    ${qa.map(([q, a]) => `<h4>${esc(q)}</h4><p>${esc(a)}</p>`).join('')}</section>${fault}`;
}

// ---------- Evidence ----------
export function evidenceItems(ctx) {
  const { scenario, state: s, ev } = ctx; const st = currentStage(ctx); const items = [];
  for (const c of ev.checks.filter((k) => k.stage === st.id)) items.push({ kind: c.kind, label: c.label, text: c.detail, status: c.status });
  const art = st.focus.artifact && fixtureFor(ctx, st.focus.artifact);
  if (art?.parsed) {
    const p = art.parsed;
    if (p.kind === 'certificate') items.push({ kind: 'Real fixture data', label: `${scenario.artifacts.find((a) => a.id === st.focus.artifact).label}: parsed fields`, text: `Subject ${p.subject}; serial ${p.serialNumber}; SHA-1 ${p.thumbprints.sha1}; valid ${p.notBefore} to ${p.notAfter}.`, status: 'info' });
    if (p.kind === 'csr') items.push({ kind: 'Real fixture data', label: 'CSR: parsed fields', text: `Subject ${p.subject}; SAN ${p.san.map((n) => n.value).join(', ')}; ${p.publicKey.algorithm} ${p.publicKey.bits}-bit; signature ${p.signatureAlgorithm}; self-signature valid: ${p.signatureValid}.`, status: 'info' });
    if (p.kind === 'inf') items.push({ kind: 'Real fixture data', label: 'Request policy (INF): parsed fields', text: `MachineKeySet = ${p.fields['NewRequest.MachineKeySet']}; KeyLength = ${p.fields['NewRequest.KeyLength']}; template ${p.template}.`, status: 'info' });
    if (p.kind === 'crl') items.push({ kind: 'Real fixture data', label: 'CRL: parsed fields', text: `Issuer ${p.issuer}; CRL #${p.crlNumber}; ${p.entries.length} entries; next update ${p.nextUpdate}.`, status: 'info' });
  }
  if (s.activeFault !== 'healthy' && s.halted && ev.firstFailure && ev.firstFailure.stage === st.id) items.push({ kind: 'User-selected fault', label: `Fault selected: ${getFault(scenario, s.activeFault).label}`, text: 'This failure was selected by the learner in the Failure menu; it is a simulation input, not a measurement.', status: 'fail' });
  items.push({ kind: 'Derived conclusion', label: 'Conclusion for this step', text: st.narrative, status: 'info' });
  return items;
}

export function evidenceHtml(ctx) {
  const { scenario, state: s } = ctx; const items = evidenceItems(ctx); const trace = buildTrace(scenario, s.activeFault); const rev = s.direction === 'reverse';
  const list = items.map((i) => `<li class="ev-item ev-${i.status}"><div>${kindBadge(i.kind)} <strong>${esc(i.label)}</strong>${i.status === 'pass' ? ' ' + badge('pass', 'ok') : i.status === 'fail' ? ' ' + badge('fail', 'fail') : ''}</div><p>${esc(i.text)}</p></li>`).join('');
  const traceHtml = trace.map((e, i) => `<li class="${rev && i === s.evidenceIndex ? 'current' : ''} ${e.verdict === 'fail' ? 'fail' : ''}"><button class="trace-btn" data-evidence="${i}"><span class="q">${esc(e.question)}</span><span class="a">${esc(e.claim)}</span><span class="k">${esc(e.evidenceKind ?? 'Derived conclusion')}</span></button>
      ${rev && i === s.evidenceIndex ? `<div class="evi"><p class="muted">Forward stage: ${esc(scenario.stages[e.stageIndex].title)}${e.entity ? ` · ${esc(entityById[e.entity]?.label ?? e.entity)}` : ''}</p>${ctx.ev.checks.filter((k) => k.stage === e.stage).map((k) => `<p>${kindBadge(k.kind)} ${esc(k.label)}: ${esc(k.detail)}</p>`).join('')}
      ${e.artifact && scenario.artifacts.find((a) => a.id === e.artifact)?.inspectable ? `<p><button class="linkbtn" data-open="artifact:${e.artifact}">Inspect ${esc(scenario.artifacts.find((a) => a.id === e.artifact).label)}</button></p>` : ''}
      ${e.entity ? `<p><button class="linkbtn" data-open="entity:${e.entity}">Open ${esc(entityById[e.entity]?.label ?? e.entity)}</button></p>` : ''}</div>` : ''}</li>`).join('');
  return `<h2>Evidence for this step</h2><p class="muted">Each item says where the information comes from.</p><ul class="ev-list">${list}</ul>
    <h2>Evidence trace</h2><p class="muted">${rev ? 'Reverse mode: each step cites the evidence behind the previous one.' : 'Switch to “Reverse evidence” to walk this trace, or click an item.'}</p><ol class="trace">${traceHtml}</ol>`;
}

// ---------- Troubleshoot ----------
const FUTURE = { 'chain-build': 'aia-chain-retrieval', 'verify-chain': 'aia-chain-retrieval', revocation: 'cdp-crl-validation', followup: 'autoenrollment', submit: 'cep-ces-enrollment' };
export function troubleshootHtml(ctx) {
  const { scenario, state: s } = ctx; const st = currentStage(ctx); const x = st.explain ?? {};
  const fault = getFault(scenario, s.activeFault);
  const failingHere = s.halted && ctx.ev.firstFailure?.stage === st.id;
  const current = failingHere ? `Check failed: “${ctx.ev.firstFailure.label}”` : s.halted ? 'The run stopped at an earlier step.' : 'As expected (no fault at this step).';
  return `<h2>Troubleshoot: ${esc(st.title)}</h2>
    ${kv([['Expected result', st.narrative], ['Current result', current], ['Owning role', x.owner ?? '—']])}
    <h4>Likely failure causes</h4><ul class="tight">${(x.wrong ?? []).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
    <h4>Suggested checks</h4><ul class="tight">${(x.checks ?? []).map((w) => `<li><code>${esc(w)}</code></li>`).join('')}</ul>
    <h4>Simulated remediation</h4><p>${s.halted ? esc(fault.remediation) : 'None needed for the healthy path. Pick a failure in the Failure menu to see a worked example.'}</p>
    ${FUTURE[st.id] ? `<p class="muted">Related future scenario: <code>${FUTURE[st.id]}</code> (planned).</p>` : ''}
    ${faultExplanation(ctx)}
    <details class="dev"><summary>Developer state</summary><pre class="pem" id="dev-state">${esc(JSON.stringify(s, null, 2))}</pre></details>`;
}

// ---------- Friendly artifact summaries ----------
export function friendlyHtml(ctx, artifactId) {
  const fx = fixtureFor(ctx, artifactId); if (!fx) return '';
  const p = fx.parsed;
  if (p.kind === 'csr') {
    const who = ENV.web.host, template = String(p.templateRequest ?? '—');
    const opn = ENV.owner.user;
    return `<section class="card friendly"><h3>Friendly summary</h3><ul class="tight">
      <li>This is a <strong>Certificate Signing Request (CSR)</strong>.</li><li>It was created by <strong>${who}</strong>.</li><li>It contains ${who}'s <strong>public key</strong> (${esc(p.publicKey.algorithm)}, ${p.publicKey.bits}-bit).</li>
      <li>It requests a certificate under the <strong>${esc(template)}</strong> template.</li><li>It does <strong>not</strong> contain the private key.</li><li>The <strong>private key remains on ${who}</strong>.</li></ul></section>
      <details class="card" open><summary>Request identity</summary>${kv([['Requester (operator)', opn], ['Certificate subject identity', p.subject], ['Machine context', 'Local Machine (server)'], ['Hostname', who], ['Domain', ENV.domain],
        ['Synthetic IP', `${ENV.web.ip} (contextual only, not an authority)`], ['Requested template', template], ['Request creation time', ENV.simulationNow]])}</details>
      <details class="card"><summary>Cryptographic details</summary>${kv([['Public-key algorithm', p.publicKey.algorithm], ['Public-key size', `${p.publicKey.bits} bits`], ['CSR signature algorithm', p.signatureAlgorithm], ['Proof of possession', H(`The CSR is signed with the private key and verifies with the public key it contains (<strong>${p.signatureValid ? 'valid' : 'INVALID'}</strong>). This shows the requester holds the private key without revealing it.`)]])}<p class="muted">Raw PEM and ASN.1 are in the tabs below.</p></details>
      <details class="card"><summary>What happens next</summary><p>The CSR is submitted to ${esc(ENV.issuingCa)}. The CA checks the requester, the template and the names, then issues or rejects the request (likely disposition: <strong>Issued</strong> in the healthy path). If approved the certificate is returned to ${who}.</p></details>
      <details class="card"><summary>Common failures</summary><ul class="tight"><li>Template not published on the CA</li><li>Computer lacks Enroll permission</li><li>Request submitted in the wrong (user) context</li><li>Malformed or mismatched subject / SAN</li><li>Unsupported key settings</li><li>CA unavailable</li><li>Request becomes pending approval</li><li>Issued certificate cannot match the private key</li></ul></details>`;
  }
  if (p.kind === 'certificate') {
    const csr = ctx.model.resolve('csr', ctx.state.activeFault)?.parsed; const isLeaf = !!p.template;
    const match = isLeaf && csr ? (csr.publicKey.spkiSha256 === p.publicKey.spkiSha256 ? 'Its public key matches the CSR, so it belongs with the private key that stays on the requester.' : 'Its public key does NOT match the CSR: no private key on the requester corresponds to it.') : '';
    return `<section class="card friendly"><h3>Friendly summary</h3><ul class="tight"><li>${isLeaf ? 'An <strong>end-entity certificate</strong> that identifies ' + esc(p.san.map((n) => n.value).join(', ') || p.subject) : 'A <strong>CA certificate</strong> (' + (p.selfSigned ? 'self-signed trust anchor' : 'issuing CA') + ')'}.</li>
      <li>Issued by <strong>${esc(p.issuer)}</strong>.</li><li>Valid ${esc(p.notBefore)} to ${esc(p.notAfter)}.</li><li>Purposes: ${esc(p.eku.map((e) => e.name).join(', ') || 'not restricted')}.</li>${match ? `<li>${match}</li>` : ''}
      ${p.selfSigned ? '<li>The Root CA signs CA certificates only; it never issues the website or Domain Controller certificate.</li>' : ''}</ul></section>`;
  }
  if (p.kind === 'crl') return `<section class="card friendly"><h3>Friendly summary</h3><p>A <strong>Certificate Revocation List</strong> published at the CDP. Clients download it to check whether a certificate was withdrawn. It is different from the AIA, which provides the issuer certificate.</p></section>`;
  if (p.kind === 'inf') return `<section class="card friendly"><h3>Friendly summary</h3><p>A <strong>teaching request policy</strong> read by <code>certreq.exe -new</code>. It asks for a machine-context 2048-bit key and the ${esc(p.template)} template. It contains no secrets and is not a recommendation for every environment.</p></section>`;
  if (p.kind === 'chain') return `<section class="card friendly"><h3>Friendly summary</h3><p>The chain file lists the certificate, the Issuing CA and the Root CA in order. The Issuing CA signs the certificate; the Root CA signs the Issuing CA.</p></section>`;
  return '';
}
void stageIndex;
