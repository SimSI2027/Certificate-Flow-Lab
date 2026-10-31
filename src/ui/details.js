// Builds detail-panel HTML for entities, flows and non-inspectable artifacts. Values come from state and the real fixtures.
import { ENV, URLS, TEMPLATE } from '../artifacts/synthetic.js';
import { entityById } from '../entities/entities.js';
import { flowStatus, stageIndex, getFault } from '../engine/engine.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v === undefined || v === null ? '—' : typeof v === 'object' && v.html ? v.html : esc(v)}</dd>`).join('')}</dl>`;
const H = (html) => ({ html });
const sec = (title, body, cls = '') => `<section class="card ${cls}"><h3>${esc(title)}</h3>${body}</section>`;
const link = (type, id, text) => `<button class="linkbtn" data-open="${type}:${id}">${esc(text)}</button>`;
const badge = (text, kind) => `<span class="pill pill-${kind}">${esc(text)}</span>`;
const SYN = '<p class="syn">Synthetic simulation data — not a real organization.</p>';

const BROWSER_ERROR = {
  initial: ['NET::ERR_CERT_AUTHORITY_INVALID', 'WEB01 presents its default self-signed certificate (CN=WEB01); the issuer is not trusted and the name does not match.'],
  'wrong-dns': ['NET::ERR_CERT_COMMON_NAME_INVALID', 'The certificate is not valid for portal.simsi2027.test.'],
  expired: ['NET::ERR_CERT_DATE_INVALID', 'The certificate has expired.'],
  'untrusted-root': ['NET::ERR_CERT_AUTHORITY_INVALID', 'The chain ends at a root that is not in the trust store.'],
  'wrong-eku': ['NET::ERR_CERT_INVALID', 'The certificate is not valid for use as a TLS server certificate.'],
  'missing-ica': ['NET::ERR_CERT_AUTHORITY_INVALID', 'The issuing CA certificate could not be found to complete the chain.'],
  revoked: ['NET::ERR_CERT_REVOKED', 'The issuing CA has revoked this certificate.'],
  'cdp-unavailable': ['NET::ERR_CERT_UNABLE_TO_CHECK_REVOCATION', 'Revocation status could not be checked (message wording varies by browser and policy).'],
  'no-private-key': ['NET::ERR_CERT_AUTHORITY_INVALID', 'IIS could not use the new certificate; the default certificate is still served.']
};

function fixtureOf(ctx, role) { return ctx.model.resolve(role, ctx.state.activeFault)?.parsed; }

export function faultExplanation(ctx) {
  const { scenario, state, evidence } = ctx;
  if (!state.halted) return '';
  const fault = getFault(scenario, state.activeFault);
  const ev = evidence[fault.id];
  const f = ev.firstFailure;
  const failIdx = stageIndex(scenario, fault.failStage);
  const healthy = ev.checks.filter((c) => c.status === 'pass' && stageIndex(scenario, c.stage) <= failIdx);
  const stageTitle = scenario.stages.find((s) => s.id === fault.failStage).title;
  return sec(`Failure: ${fault.label}`, `
    <p><strong>What failed:</strong> ${esc(f.label)} — at stage “${esc(stageTitle)}”.</p>
    <p><strong>Evidence:</strong> ${esc(f.detail)}</p>
    <p class="muted">Evidence timestamp ${esc(f.timestamp)} (simulation clock).</p>
    <p><strong>Still healthy:</strong></p><ul>${[...new Set(healthy.map((c) => c.label))].map((l) => `<li>${esc(l)}</li>`).join('')}<li>Every stage before “${esc(stageTitle)}” completed normally</li></ul>
    <p><strong>Likely remediation:</strong> ${esc(fault.remediation)}</p>
    <p><strong>Owner of the correction:</strong> ${esc(fault.owner)}</p>`, 'fault');
}

export function describeEntity(id, ctx) {
  const { state: s, model, scenario, evidence, ev } = ctx;
  const e = entityById[id];
  const leaf = fixtureOf(ctx, 'leaf'), ica = fixtureOf(ctx, 'ica'), root = fixtureOf(ctx, 'root'), crl = fixtureOf(ctx, 'crl'), csr = fixtureOf(ctx, 'csr');
  const fault = getFault(scenario, s.activeFault);
  const T = fault.template ?? { name: TEMPLATE.name, oid: TEMPLATE.oid };
  const reached = (stageId) => s.direction === 'reverse' || s.stage > stageIndex(scenario, stageId) || (s.stage === stageIndex(scenario, stageId) && s.stageProgress >= 1);
  let title = e.label, body = '';
  switch (id) {
    case 'visitor': {
      const [code, text] = reached('browser-error') ? (s.activeFault !== 'healthy' && s.halted && s.stage >= stageIndex(scenario, 'retry') ? BROWSER_ERROR[s.activeFault] : BROWSER_ERROR.initial) : ['(none yet)', 'The visitor has not opened the site yet.'];
      body = sec('Visitor (synthetic)', kv([['Username', ENV.visitor.user], ['Role', 'Standard user — not an administrator, not the certificate requester'], ['Client computer', ENV.visitor.host], ['Synthetic IP', ENV.visitor.ip],
        ['Authentication context', 'Interactive Windows logon (Kerberos) to the synthetic SIMSI2027 domain; no client certificate'], ['Observed browser error', `${code} — ${text}`],
        ['Report submitted', reached('report') ? 'Yes — problem report sent to the application owner (Morgan)' : 'Not yet']]))
        + sec('Why the visitor does not enroll', '<p>The visitor only experiences the problem. The application owner requests the certificate for the server, and the server (WEB01) generates and keeps its own private key.</p>');
      break;
    }
    case 'client01': {
      body = sec('CLIENT01 (synthetic)', kv([['Hostname', ENV.visitor.host], ['Synthetic IP', ENV.visitor.ip], ['Domain', ENV.domain], ['Operating system', 'Windows 11 Enterprise (synthetic)'], ['DNS server', 'DC01.simsi2027.test — 10.20.1.10 (synthetic)'],
        ['Trust store', s.activeFault === 'untrusted-root' ? 'Trusted Root store does NOT contain SIMSI2027-ROOTCA' : 'Trusted Root store contains SIMSI2027-ROOTCA (distributed by Group Policy, synthetic)'],
        ['Active browser session', `https://portal.simsi2027.test — connection ${s.connectionState}`], ['Current chain state', s.chainState], ['Revocation state', s.revocationState], ['Trust decision', s.trustDecision]]))
        + sec('About the source IP', '<p>The client IP address (10.20.10.45) is <strong>contextual information</strong> for logging, firewalls and conditional policy. It is <strong>not</strong> the enrollment authority: the CA decides based on the authenticated identity and the template’s enrollment permissions.</p>');
      break;
    }
    case 'browser': body = sec('Browser session', kv([['URL', 'https://portal.simsi2027.test'], ['Connection state', s.connectionState], ['Indicator', s.connectionState === 'trusted' ? 'Secure (padlock)' : 'Not secure / warning page'], ['Trust decision', s.trustDecision]])); break;
    case 'owner': {
      body = sec('Application owner (synthetic)', kv([['Username', ENV.owner.user], ['Role', 'Owner of the portal application'], ['Group memberships', 'SIMSI2027\\Portal-App-Owners; SIMSI2027\\WebServer-Requesters (synthetic)'],
        ['Assigned application', 'Portal — portal.simsi2027.test on WEB01'], ['Permission to request the certificate', 'Yes — Enroll on the WebServer template via WebServer-Requesters'],
        ['Request history', H(`<ul class="tight"><li>Request ${ENV.requestId}: ${esc(s.requestState === 'none' || s.requestState === 'needed' ? 'not yet submitted' : s.requestState)}</li><li>Earlier requests: none in this simulation</li></ul>`)]]));
      break;
    }
    case 'web01': {
      const thumb = reached('install') && s.installationState === 'installed' ? leaf.thumbprints.sha1 : '(none installed)';
      body = sec('WEB01 (synthetic)', kv([['Hostname', ENV.web.host], ['Synthetic IP', ENV.web.ip], ['Domain', ENV.domain], ['IIS role', 'Web Server (IIS) installed'],
        ['Certificate store', 'LocalMachine\\My'], ['Private-key state', `${s.keyState} — ${s.keyState === 'missing-for-cert' ? 'no private key matches the installed certificate' : 'generated locally and never transmitted'}`],
        ['Current HTTPS binding', s.iisBindingState === 'bound' ? 'portal.simsi2027.test:443 (new certificate)' : 'Default binding with self-signed certificate (CN=WEB01)'],
        ['SNI state', s.iisBindingState === 'bound' ? 'Enabled — host name portal.simsi2027.test' : 'Not configured'], ['Installed certificate thumbprint (SHA-1)', thumb]]))
        + sec('Key custody', '<p>The private key is generated on WEB01 and stays on WEB01. Only the CSR (public key + request) leaves; only the signed certificate returns.</p>');
      break;
    }
    case 'iis': body = sec('IIS HTTPS binding', kv([['Site', 'portal'], ['Binding', 'https *:443 portal.simsi2027.test'], ['SNI', 'Required'], ['State', s.iisBindingState], ['Certificate', s.iisBindingState === 'bound' ? `${leaf.subject} — SHA-1 ${leaf.thumbprints.sha1}` : 'none (default self-signed certificate in use)']])); break;
    case 'enroll': body = sec('Request interface', '<p>The manual enrollment tool on WEB01 (conceptually <code>certreq</code> or the Certificates console). It builds the CSR from the local key and submits it.</p>' + kv([['CSR state', s.csrState], ['Requested template', T.name]])); break;
    case 'template': {
      const pass = (b) => (b ? 'Pass' : 'Fail');
      const nsOk = csr.san.every((n) => n.value.endsWith('.simsi2027.test'));
      const decision = { pending: 'Not evaluated', evaluating: 'Evaluating…', permitted: 'Permitted' }[s.templateDecision];
      body = sec('WebServer certificate template (synthetic)', kv([['Template name', T.name], ['Template OID', T.oid], ['Schema version', 'Version 4 template (major.minor 100.4), synthetic custom copy of WebServer'], ['Subject / SAN source', 'Supplied in the request (CN and DNS SAN)'],
        ['EKU', 'Server Authentication (1.3.6.1.5.5.7.3.1)'], ['Key requirements', 'RSA, minimum 2048 bits; private key not exportable'], ['Validity period', '1 year'], ['Renewal period', '6 weeks'],
        ['Enrollment permissions', 'SIMSI2027\\WebServer-Requesters: Read, Enroll'], ['Approval requirement', 'None (simulated): automatic issuance when policy checks pass'], ['Issuing CA availability', `Published on ${ENV.issuingCa}`]]))
        + sec('Policy decision', `<p>${badge(decision, s.templateDecision === 'permitted' ? 'policy' : 'idle')}</p>` + kv([['Requester permitted', pass(true)], ['Subject/SAN in namespace .simsi2027.test', `${pass(nsOk)} (${csr.san.map((n) => n.value).join(', ')})`],
          ['Key size', `${pass(csr.publicKey.bits >= 2048)} (${csr.publicKey.bits}-bit ${csr.publicKey.algorithm})`], ['CSR signature (proof of possession)', pass(csr.signatureValid)]])
          + `<p class="muted">Evidence: policy decision record for request ${ENV.requestId} (simulation clock ${esc(ev.timestamp)}). ${link('artifact', 'csr', 'Inspect the CSR')}</p>`
          + (s.activeFault === 'wrong-dns' ? '<p class="warn">Note: policy checks the namespace, not the owner’s intent — the wrong host name inside the namespace is still permitted.</p>' : '')
          + (s.activeFault === 'wrong-eku' ? '<p class="warn">In this fault the request used template WorkstationAuth (Client Authentication EKU) instead of WebServer.</p>' : ''), 'policy');
      break;
    }
    case 'ica01': {
      const issued = ['issued'].includes(s.issuanceState);
      body = sec('SIMSI2027-ICA01 (synthetic)', kv([['CA name', ENV.issuingCa], ['Role', 'Online Enterprise Issuing CA — signs the website certificate'], ['CA certificate', H(`${esc(ica.subject)}<br><span class="mono">SHA-1 ${esc(ica.thumbprints.sha1)}</span> ${link('artifact', 'ica', 'Inspect')}`)],
        ['Request ID', String(ENV.requestId)], ['Request disposition', { none: 'No request yet', received: 'Pending (received)', evaluating: 'Evaluating', approved: 'Approved', signing: 'Signing', issued: 'Issued' }[s.issuanceState]],
        ['Requester', ENV.owner.user], ['Template', T.name], ['Issued serial number', issued ? leaf.serialNumber : '(not issued yet)'], ['Validity of issued certificate', issued ? `${leaf.notBefore} → ${leaf.notAfter}` : '—'],
        ['Signature algorithm', leaf.signatureAlgorithm], ['Database record', issued ? 'Row 1042: Issued, template WebServer, SAN portal.simsi2027.test' : s.issuanceState === 'none' ? '—' : 'Row 1042: Pending'],
        ['AIA configuration', H(`<span class="mono">${esc(URLS.rootAia)}</span> (this CA’s own certificate chain location)`)], ['CDP configuration', H(`<span class="mono">${esc(URLS.rootCdp)}</span>`)],
        ['Extensions it stamps on issued certificates', H(`AIA <span class="mono">${esc(URLS.icaAia)}</span><br>CDP <span class="mono">${esc(URLS.icaCdp)}</span>`)]]))
        + sec('Identity, permissions and policy', '<p>The CA authorizes by the <strong>authenticated requester identity</strong> and template permissions — not by source IP address.</p>');
      break;
    }
    case 'rootca': body = sec('SIMSI2027-ROOTCA (synthetic)', kv([['Role', 'Offline root CA (powered off; not on the network)'], ['Certificate', H(`Self-signed: ${esc(root.subject)}<br><span class="mono">SHA-1 ${esc(root.thumbprints.sha1)}</span> ${link('artifact', 'root', 'Inspect')}`)],
      ['Trust-anchor purpose', 'Clients trust this certificate directly; every chain must end here'], ['Path-length constraint', `pathLenConstraint = ${root.basicConstraints.pathLength} (may sign subordinate CAs only one level deep)`],
      ['Issued', 'Only the Issuing CA certificate, in a past offline ceremony (synthetic)']])) + sec('Not involved in issuing the website certificate', '<p>The Root CA does <strong>not</strong> issue the website certificate and is never contacted during enrollment or validation. SIMSI2027-ICA01 signs the leaf; the root only anchors trust.</p>'); break;
    case 'cadb': body = sec('CA database', kv([['Request', `${ENV.requestId} — ${s.requestState}`], ['Stores', 'Request rows, issued certificate records, revocation records'], ['Issued serial', ['issued'].includes(s.issuanceState) ? leaf.serialNumber : '—']])); break;
    case 'pkiweb01': case 'aia': case 'cdp': {
      body = sec(id === 'pkiweb01' ? 'PKIWEB01 (synthetic publication server)' : e.label, kv([['Publication role', 'Hosts static AIA and CDP content over HTTP for clients'], ['Available issuing CA certificate', `${ica.subject}${s.activeFault === 'missing-ica' ? ' — NOT published (fault)' : ' — published'}`],
        ['Available CRL', `${crl.issuer}, CRL #${crl.crlNumber}${s.activeFault === 'cdp-unavailable' ? ' — service unavailable (fault)' : ' — published'}`], ['AIA endpoint', URLS.icaAia], ['CDP endpoint', URLS.icaCdp]]))
        + pubBlock('AIA — where to get the issuing CA certificate', ev.aia, ctx, 'ica') + pubBlock('CDP — where to get revocation information (CRL)', ev.cdp, ctx, 'crl')
        + sec('AIA vs CDP', '<p><strong>AIA</strong> (Authority Information Access) tells a client <em>where to download the issuing CA certificate</em> to finish building a chain. <strong>CDP</strong> (CRL Distribution Point) tells it <em>where to download the CRL</em> to learn whether a certificate was revoked. They are separate extensions, URLs and failure modes.</p>');
      break;
    }
    case 'chain': body = sec('Certificate chain', `<p>CLIENT01 builds the path leaf → ${esc(ica.subject.split(',')[0])} → ${esc(root.subject.split(',')[0])}.</p>` + kv([['Chain state', s.chainState], ['Name', s.validation.name], ['Dates', s.validation.dates], ['EKU', s.validation.eku], ['Signatures', s.validation.signatures], ['Root trust', s.validation.root], ['Revocation', s.revocationState]])
      + `<p>${link('artifact', 'leaf', 'Inspect leaf')} ${link('artifact', 'ica', 'Inspect issuing CA')} ${link('artifact', 'root', 'Inspect root')} ${link('artifact', 'chain', 'Inspect chain file')}</p>`); break;
    case 'decision': body = sec('Final trust decision', kv([['Decision', s.trustDecision], ['Connection', s.connectionState]]) + `<ul class="tight">${ev.checks.map((c) => `<li>${c.status === 'pass' ? '✔' : '✘'} ${esc(c.label)}${reached(c.stage) ? '' : ' (not reached yet)'}</li>`).join('')}</ul>`); break;
    default: body = '';
  }
  return `<h2>${esc(title)}</h2>${SYN}${body}`;
}

function pubBlock(title, p, ctx, art) {
  return sec(title, kv([['Raw extension value', H(p.raw.map((u) => `<span class="mono">${esc(u)}</span>`).join('<br>'))], ['Resolved synthetic URL', p.resolved], ['Expected object', p.expected], ['Simulated retrieval result', p.result],
    ['Status', H(badge(p.ok ? 'OK' : 'FAILED', p.ok ? 'ok' : 'fail'))], ['Evidence timestamp', p.timestamp]]) + `<p>${link('artifact', art, 'Inspect object')}</p>`);
}

export function describeFlow(id, ctx) {
  const { scenario, state: s, ev } = ctx;
  const f = scenario.flows.find((x) => x.id === id);
  const fs = flowStatus(scenario, s, f);
  const check = ev.checks.find((c) => c.stage === f.stage && fs.failed);
  const result = fs.phase === 'idle' ? 'Not started' : fs.phase === 'active' ? 'In progress…' : fs.failed ? `FAILED — ${check?.detail ?? 'see failure card'}` : f.result;
  return `<h2>Flow: ${esc(entityById[f.from].label)} → ${esc(entityById[f.to].label)}</h2>${SYN}` + sec(scenario.stages[stageIndex(scenario, f.stage)].title, kv([
    ['Source', entityById[f.from].label], ['Destination', entityById[f.to].label], ['Conceptual protocol / transport', f.protocol], ['Payload', f.payload], ['Authenticated identity', f.identity],
    ['Request ID', f.stage === 'visit' || f.stage === 'browser-error' || f.stage === 'report' || f.stage === 'owner-review' ? 'n/a (before the CA request exists)' : String(ENV.requestId)],
    ['Result', H(`${badge(fs.phase === 'done' ? (fs.failed ? 'failed' : 'done') : fs.phase, fs.failed ? 'fail' : fs.phase === 'done' ? 'ok' : 'idle')} ${esc(result)}`)],
    ['Simulated duration', f.durationMs >= 60000 ? `${Math.round(f.durationMs / 60000)} min (human time, simulated)` : `${f.durationMs} ms (simulated)`], ['Evidence generated', f.evidence]]));
}

export function describeOtherArtifact(id, ctx) {
  const a = ctx.scenario.artifacts.find((x) => x.id === id);
  if (id === 'private-key') return `<h2>Private key (WEB01)</h2>${SYN}` + sec('Held by WEB01 only', kv([['Algorithm', 'RSA 2048 (conceptual)'], ['State', ctx.state.keyState], ['Location', 'WEB01 machine key store'], ['Distribution', 'Never exported or transmitted; no private key exists in this project’s files']]) + '<p>This is a simulation marker. No private-key material is stored or downloadable.</p>');
  if (id === 'ticket') return `<h2>Problem report</h2>${SYN}` + sec('Visitor report', kv([['From', ENV.visitor.user], ['To', ENV.owner.user], ['Content', 'Browser warning on https://portal.simsi2027.test'], ['Meaning', 'A report, not an enrollment request']]));
  return `<h2>${esc(a.label)}</h2>${SYN}<p>${esc(a.note ?? '')}</p>`;
}
