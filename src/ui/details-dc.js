// Technical details for the Domain Controller manual-enrollment scenario. Values come from state and the parsed fixtures.
import { ENV, DC, URLS } from '../artifacts/synthetic.js';
import { entityById } from '../entities/entities.js';
import { esc, kv, H, sec, link, badge, SYN, pubBlock } from './details.js';
import { paths } from '../scenarios/dc-manual-certificate-request.js';
const cmdOf = (id) => paths.csr.stages.find((s) => s.id === id).command.text;
const commands = { new: cmdOf('a-new'), submit: cmdOf('a-submit'), accept: cmdOf('a-accept') };

export function describeDcEntity(id, ctx) {
  const { state: s, model, scenario, ev } = ctx;
  const e = { ...entityById[id], ...(scenario.overrides?.[id] ?? {}) };
  const cert = model.resolve('dc-cert', s.activeFault).parsed, csr = model.resolve('dc-csr', s.activeFault).parsed, inf = model.resolve('dc-inf', s.activeFault).parsed;
  const ica = model.resolve('ica', null).parsed, root = model.resolve('root', null).parsed, crl = model.resolve('crl', null).parsed;
  const installed = s.installationState === 'accepted';
  let body = '';
  switch (id) {
    case 'operator':
      body = sec('PKI operator (synthetic)', kv([['Username', DC.operator], ['Role', 'Administrator running the manual request (starts the procedure)'], ['Needs', 'Local administrator on DC01 to use the Local Computer context; rights to submit to the CA'],
        ['Does NOT own', 'The certificate. The certificate identity is the computer DC01.simsi2027.test'], ['Request context', 'Local Computer (machine) — see the request policy'], ['Request ID', s.requestState === 'none' || s.requestState === 'drafted' || s.requestState === 'drafting' ? 'not assigned yet' : String(DC.requestId)]]));
      break;
    case 'dc01':
      body = sec('DC01 (synthetic)', kv([['Hostname', DC.host], ['FQDN', DC.fqdn], ['Synthetic IP', `${DC.ip} (context only, not an enrollment authority)`], ['Domain', ENV.domain], ['Role', 'Domain Controller'], ['Certificate store', 'LocalMachine\\My (Local Computer\\Personal)'],
        ['Private-key state', `${s.keyState}${s.keyState === 'held-on-dc01' ? ' — generated locally with MachineKeySet = TRUE, never transmitted' : ''}`], ['Request context', s.contextState], ['Current request', s.requestState],
        ['Certificate thumbprint (SHA-1)', installed ? cert.thumbprints.sha1 : '(none accepted yet)'], ['Key association', s.keyAssociation]]));
      break;
    case 'certstore':
      body = sec('Local Computer\\Personal on DC01', kv([['Store', 'Certificates (Local Computer) > Personal > Certificates'], ['Suitable DC certificate', s.dcCertState === 'missing' && !installed ? 'None found' : installed ? 'Yes, after certreq -accept' : 'Checking'],
        ['Private key present', installed ? (s.keyAssociation === 'mismatch' ? 'No — certificate does not match any key on DC01' : 'Yes, associated with the certificate') : '—'],
        ['Subject', installed ? cert.subject : '—'], ['SAN', installed ? cert.san.map((n) => `${n.type}=${n.value}`).join(', ') : '—'], ['EKU', installed ? cert.eku.map((x) => x.name).join(', ') : '—'],
        ['Key Usage', installed ? cert.keyUsage.join(', ') : '—'], ['Template', installed ? `${cert.template?.name} (${cert.template?.oid}, v${cert.template?.version})` : '—']]));
      break;
    case 'template': {
      const decision = { pending: 'Not evaluated', evaluating: 'Evaluating…', permitted: 'Permitted', denied: 'Denied' }[s.templateDecision];
      body = sec(`${DC.template} template (synthetic)`, kv([['Template name', DC.template], ['Template OID', cert.template?.oid ?? DC.templateOid], ['Schema / version', `Version ${cert.template?.version ?? DC.templateVersion} (synthetic copy)`],
        ['Published on CA', s.templatePublished === 'missing' ? 'No (fault)' : s.templatePublished === 'unchecked' ? 'Not checked yet' : `Yes — ${ENV.issuingCa}`], ['Enrollment permission', s.permissionState === 'enroll-denied' ? 'DC01$ has Read only (fault)' : 'Domain Controllers: Read, Enroll (simulated)'],
        ['Subject / SAN source', 'In this simulation the request supplies CN and DNS SAN. Real DC templates usually build them from Active Directory, so always verify the issued names.'], ['EKUs', 'Client Authentication, Server Authentication, KDC Authentication, Smart Card Logon'],
        ['Key requirements', 'RSA, minimum 2048 bits, machine key store'], ['Alternative template for comparison', `${DC.altTemplate} (fewer purposes; availability depends on your AD CS)`], ['Note', 'The exact template available in a real environment depends on AD CS configuration and published templates.']]))
        + sec('Policy decision', `<p>${badge(decision, s.templateDecision === 'permitted' ? 'policy' : 'idle')}</p>` + kv([['Requester context', inf.machineContext ? 'Machine (Local Computer)' : 'User (rejected)'], ['Subject DNS in namespace', csr.san.every((n) => n.value.endsWith('.simsi2027.test')) ? 'Pass' : 'Fail'], ['Key size', `${csr.publicKey.bits}-bit ${csr.publicKey.algorithm}`]]) + `<p class="muted">${link('artifact', 'csr', 'Inspect the CSR')} ${link('artifact', 'inf', 'Inspect the request policy')}</p>`, 'policy');
      break;
    }
    case 'ica01':
      body = sec('SIMSI2027-ICA01 (synthetic)', kv([['CA name', ENV.issuingCa], ['CA configuration string', DC.caConfig], ['Role', 'Online Enterprise Issuing CA'], ['CA certificate', H(`${esc(ica.subject)}<br><span class="mono">SHA-1 ${esc(ica.thumbprints.sha1)}</span> ${link('artifact', 'ica', 'Inspect')}`)],
        ['Request ID', String(DC.requestId)], ['Disposition', { none: 'No request yet', received: 'Received', evaluating: 'Evaluating', approved: 'Approved', signing: 'Signing', issued: 'Issued', pending: 'PENDING approval', denied: 'DENIED' }[s.issuanceState]],
        ['Requester', `${DC.operator} (for ${ENV.netbios}\\${DC.host}$)`], ['Template', DC.template], ['Issued serial', s.issuanceState === 'issued' ? cert.serialNumber : '—'], ['Signature algorithm', cert.signatureAlgorithm],
        ['Stamped AIA', URLS.icaAia], ['Stamped CDP', URLS.icaCdp]]) + '<p class="note">The CA decides from the authenticated requester and template permissions; the source IP is not an authority. The Root CA is not contacted.</p>');
      break;
    case 'cadb': body = sec('CA database', kv([['Request', `${DC.requestId} — ${s.requestState}`], ['Issued serial', s.issuanceState === 'issued' ? cert.serialNumber : '—'], ['Stores', 'Request rows, issued certificates, revocations']])); break;
    case 'aia': case 'cdp':
      body = pubBlock('AIA: where to get the issuing CA certificate', ev.aia, ctx, 'ica') + pubBlock('CDP: where to get revocation information (CRL)', ev.cdp, ctx, 'crl')
        + sec('AIA vs CDP', '<p><strong>AIA</strong> downloads the issuer certificate to finish the chain. <strong>CDP</strong> downloads the CRL to check revocation. Separate extensions, URLs and failures. Both are hosted on PKIWEB01.</p>');
      break;
    case 'rootca':
      body = sec('SIMSI2027-ROOTCA (synthetic, offline)', kv([['Role', 'Offline root CA and trust anchor'], ['Certificate', H(`${esc(root.subject)}<br><span class="mono">SHA-1 ${esc(root.thumbprints.sha1)}</span> ${link('artifact', 'root', 'Inspect')}`)], ['Path length', `pathLenConstraint = ${root.basicConstraints.pathLength}`]]))
        + sec('Not involved in this request', '<p>Previously signed the Issuing CA certificate; <strong>not contacted</strong> for this request and does <strong>not</strong> sign the DC01 certificate.</p>');
      break;
    case 'result': {
      const rows = ev.checks.map((c) => `<li>${c.status === 'pass' ? '✔' : '✘'} ${esc(c.label)} <span class="muted">(${esc(c.kind)})</span></li>`).join('');
      body = sec('Suitability result', `<p>${s.trustDecision === 'trusted' ? '<strong>SUITABLE FOR THIS SIMULATED DOMAIN CONTROLLER PURPOSE</strong>' : s.trustDecision === 'rejected' ? '<strong>NOT SUITABLE — see Troubleshoot</strong>' : 'Not yet determined'}</p><ul class="tight">${rows}</ul>`);
      break;
    }
    default: body = '';
  }
  void commands; void model; void scenario;
  return `<h2>${esc(e.label)}</h2>${SYN}${body}`;
}

export function dcCommandsHtml() {
  return `<ol class="tight cmds"><li><code>${esc(commands.new)}</code></li><li><code>${esc(commands.submit)}</code></li><li><code>${esc(commands.accept)}</code></li></ol><p class="muted">Educational simulation commands. Nothing is executed against a real CA.</p>`;
}
