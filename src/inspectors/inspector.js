// Artifact inspector: renders certificate / CSR / CRL / chain tabs from the real parsed fixtures.
import { ENV, DC } from '../artifacts/synthetic.js';
import { colonHex } from '../artifacts/model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v?.html ?? esc(v ?? '—')}</dd>`).join('')}</dl>`;
const mono = (s) => ({ html: `<span class="mono">${esc(s)}</span>` });
const pre = (s) => `<pre class="pem" tabindex="0">${esc(s)}</pre>`;
const list = (a) => (a.length ? `<ul class="tight">${a.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="muted">None.</p>');

export const CERT_TABS = ['General', 'Details', 'Certification Path', 'Subject Alternative Names', 'Enhanced Key Usage', 'Key Usage', 'Basic Constraints', 'Authority Information Access', 'CRL Distribution Points', 'Thumbprints', 'PEM', 'Raw ASN.1 summary', 'Issuance history', 'Matching CSR'];
export const CSR_TABS = ['Subject', 'SAN', 'Public key', 'Signature', 'Requested extensions', 'Template request', 'PEM', 'Raw ASN.1 summary'];
export const CRL_TABS = ['Issuer', 'This Update', 'Next Update', 'CRL number', 'Revoked entries', 'Signature', 'Distribution location', 'Raw data summary'];
export const CHAIN_TABS = ['Chain', 'PEM'];
export const tabId = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const INF_TABS = ['Summary', 'Fields', 'Raw INF'];
const isDc = (ctx) => ctx?.scenario?.id === 'dc-manual-certificate-request';

export function tabsFor(parsed) {
  return { certificate: CERT_TABS, csr: CSR_TABS, crl: CRL_TABS, chain: CHAIN_TABS, inf: INF_TABS }[parsed.kind];
}

export function renderTab(parsed, tab, ctx) {
  const t = typeof tab === 'string' && tabsFor(parsed).includes(tab) ? tab : tabsFor(parsed).find((x) => tabId(x) === tab);
  const fn = { certificate: certTab, csr: csrTab, crl: crlTab, chain: chainTab, inf: infTab }[parsed.kind];
  return fn(parsed, t, ctx);
}

function infTab(i, tab) {
  const f = i.fields;
  switch (tab) {
    case 'Summary':
      return kv([['What it is', 'A teaching request policy (INF) that certreq.exe reads to build the CSR'], ['Subject', f['NewRequest.Subject']], ['Template requested', i.template], ['Key', `${f['NewRequest.KeyLength']}-bit, ${f['NewRequest.HashAlgorithm']}`],
        ['Key store', { html: `<span class="pill pill-${i.machineContext ? 'ok' : 'fail'}">${i.machineContext ? 'Local Computer (machine context)' : 'Current user (wrong for a Domain Controller)'}</span>` }],
        ['Exportable', f['NewRequest.Exportable']], ['Notice', 'Synthetic teaching sample; not a recommendation for every environment.']]);
    case 'Fields': return `<table class="tbl"><tr><th>Setting</th><th>Value</th></tr>${Object.entries(f).map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}</table>`;
    case 'Raw INF': return pre(i.text);
    default: return '';
  }
}

function certTab(c, tab, ctx) {
  const { model, evidence, state } = ctx;
  const ev = evidence[state.activeFault];
  switch (tab) {
    case 'General': {
      const st = statusOf(c, ctx);
      return kv([['Subject', c.subject], ['Issued by', c.issuer], ['Valid from', c.notBefore], ['Valid to', c.notAfter], ['Serial number', mono(c.serialNumber)], ['Certificate status', { html: `<span class="pill pill-${st.ok ? 'ok' : 'fail'}">${esc(st.text)}</span>` }],
        ['Purpose', c.eku.length ? c.eku.map((e) => e.name).join(', ') : 'All (no EKU restriction)'], ['Fixture notice', 'Demonstration fixture generated for Certificate Flow Lab — synthetic']]);
    }
    case 'Details':
      return kv([['Version', 'V3'], ['Serial number', mono(c.serialNumber)], ['Signature algorithm', c.signatureAlgorithm], ['Issuer', c.issuer], ['Valid from', c.notBefore], ['Valid to', c.notAfter], ['Subject', c.subject],
        ['Public key', `${c.publicKey.algorithm} (${c.publicKey.bits ?? '?'} bits)`], ['Public key SHA-256', mono(c.publicKey.spkiSha256)], ['Extensions', { html: list(c.extensions.map((e) => `<span class="mono">${esc(e.oid)}</span>${e.critical ? ' (critical)' : ''}`)) }]]);
    case 'Certification Path': return pathView(c, ctx);
    case 'Subject Alternative Names': return c.san.length ? list(c.san.map((n) => `${esc(n.type)}=<strong>${esc(n.value)}</strong>`)) : '<p class="muted">No SAN extension.</p>';
    case 'Enhanced Key Usage': return list(c.eku.map((e) => `${esc(e.name)} <span class="mono">${esc(e.oid)}</span>`)) + (c.eku.length ? '' : '<p class="muted">No EKU extension.</p>');
    case 'Key Usage': return `<p>${c.keyUsageCritical ? 'Critical.' : 'Not critical.'}</p>` + list(c.keyUsage.map(esc));
    case 'Basic Constraints': return c.basicConstraints ? kv([['Subject type', c.basicConstraints.ca ? 'CA' : 'End entity'], ['Path length constraint', c.basicConstraints.pathLength ?? 'None'], ['Critical', String(c.basicConstraints.critical)]]) : '<p class="muted">No Basic Constraints extension.</p>';
    case 'Authority Information Access':
      return `<p class="note"><strong>AIA</strong> says where to download the <em>issuing CA certificate</em>. It is not where revocation lists come from (that is the CDP).</p>` + (c.aia.length ? kv(c.aia.map((a) => [a.method, mono(a.location)])) : '<p class="muted">No AIA extension.</p>') + (c.ocsp.length ? kv(c.ocsp.map((o) => ['OCSP', mono(o)])) : '');
    case 'CRL Distribution Points':
      return `<p class="note"><strong>CDP</strong> says where to download the <em>CRL</em> (revocation information). It is not where the issuing CA certificate comes from (that is the AIA).</p>` + (c.cdp.length ? kv(c.cdp.map((u, i) => [`Distribution point ${i + 1}`, mono(u)])) : '<p class="muted">No CDP extension.</p>');
    case 'Thumbprints': return kv([['SHA-1', mono(colonHex(c.thumbprints.sha1))], ['SHA-256', mono(colonHex(c.thumbprints.sha256))]]);
    case 'PEM': return pre(c.pem);
    case 'Raw ASN.1 summary': return pre(c.asn1);
    case 'Issuance history': {
      const leafLike = c.template;
      return kv([['Request ID', c.template ? String(ENV.requestId) : 'n/a (CA certificate, issued in an offline ceremony — synthetic)'], ['Issuing CA', c.issuer], ['Template', leafLike ? `${c.template.name}${c.template.oid ? ` (${c.template.oid} v${c.template.version})` : ''}` : 'n/a'],
        ['Requester', leafLike ? (isDc(ctx) ? `${DC.operator}, for computer DC01$ (machine context)` : ENV.owner.user) : 'n/a'], ['Serial number', mono(c.serialNumber)], ['Disposition', 'Issued'], ['Issued (not before)', c.notBefore], ['Note', 'Synthetic simulation history; derived from the fixture, not from a live CA.']]);
    }
    case 'Matching CSR': {
      const csr = model.resolve(isDc(ctx) ? 'dc-csr' : 'csr', state.activeFault)?.parsed;
      if (!csr || !c.template) return '<p class="muted">Only end-entity certificates have a matching CSR in this simulation.</p>';
      const same = csr.publicKey.spkiSha256 === c.publicKey.spkiSha256;
      const sanSame = JSON.stringify(csr.san) === JSON.stringify(c.san);
      return kv([['CSR subject', csr.subject], ['CSR SAN', csr.san.map((n) => n.value).join(', ')], ['Certificate SAN', c.san.map((n) => n.value).join(', ')], ['SAN identical', { html: `<span class="pill pill-${sanSame ? 'ok' : 'fail'}">${sanSame ? 'yes' : 'no'}</span>` }],
        ['Public key identical', { html: `<span class="pill pill-${same ? 'ok' : 'fail'}">${same ? 'yes — certificate was issued for this CSR key' : 'no'}</span>` }], ['CSR SHA-256', mono(csr.thumbprints.sha256)]]) + `<p><button class="linkbtn" data-open="artifact:csr">Open the CSR</button></p>`;
    }
    default: return '';
  }
}

function statusOf(c, ctx) {
  const checks = ctx.evidence[ctx.state.activeFault].checks;
  if (c.template) { const bad = checks.find((x) => x.status === 'fail' && ['name', 'dates', 'eku', 'revocation'].includes(x.id)); return bad ? { ok: false, text: `Not valid: ${bad.label}` } : { ok: true, text: 'This certificate is OK for this simulated connection' }; }
  return { ok: true, text: 'CA certificate in the demonstration hierarchy' };
}

function pathView(c, ctx) {
  const { model, state, evidence } = ctx;
  const leaf = model.resolve(isDc(ctx) ? 'dc-cert' : 'leaf', state.activeFault).parsed, ica = model.resolve('ica', state.activeFault).parsed, root = model.resolve('root', state.activeFault).parsed;
  const ev = evidence[state.activeFault];
  const item = (x, label, depth, role) => `<li style="margin-left:${depth * 18}px"><button class="linkbtn" data-open="artifact:${role}">${esc(label)}</button> <span class="muted">${esc(x.subject.split(',')[0])}</span></li>`;
  return `<ul class="path">${item(root, 'Root CA', 0, 'root')}${item(ica, 'Issuing CA', 1, 'ica')}${item(leaf, 'Website certificate', 2, 'leaf')}</ul>` +
    kv(ev.checks.map((k) => [k.label, { html: `<span class="pill pill-${k.status === 'pass' ? 'ok' : 'fail'}">${k.status}</span> <span class="muted">${esc(k.detail)}</span>` }]));
}

function csrTab(r, tab) {
  switch (tab) {
    case 'Subject': return kv([['Subject', r.subject], ['Request ID', String(ENV.requestId)], ['Fixture notice', 'Demonstration fixture — synthetic']]);
    case 'SAN': return list(r.san.map((n) => `${esc(n.type)}=<strong>${esc(n.value)}</strong>`));
    case 'Public key': return kv([['Algorithm', r.publicKey.algorithm], ['Size', `${r.publicKey.bits} bits`], ['Public key SHA-256', mono(r.publicKey.spkiSha256)], ['Private key', 'Held only on WEB01 — not in this file, not in this project']]);
    case 'Signature': return kv([['Algorithm', r.signatureAlgorithm], ['Verifies with the CSR’s own public key', { html: `<span class="pill pill-${r.signatureValid ? 'ok' : 'fail'}">${r.signatureValid}</span> (proof of possession)` }]]);
    case 'Requested extensions': return list(r.requestedExtensions.map((e) => `<span class="mono">${esc(e.oid)}</span>`)) + `<h4>Key usage</h4>${list(r.requestedKeyUsage.map(esc))}<h4>EKU</h4>${list(r.requestedEku.map((e) => esc(e.name)))}`;
    case 'Template request': return r.templateRequest ? kv([['Certificate template name extension (1.3.6.1.4.1.311.20.2)', String(r.templateRequest)]]) : '<p class="muted">No template extension.</p>';
    case 'PEM': return pre(r.pem);
    case 'Raw ASN.1 summary': return pre(r.asn1);
    default: return '';
  }
}

function crlTab(c, tab) {
  switch (tab) {
    case 'Issuer': return kv([['Issuer', c.issuer], ['Signature algorithm', c.signatureAlgorithm]]);
    case 'This Update': return kv([['This update', c.thisUpdate]]);
    case 'Next Update': return kv([['Next update', c.nextUpdate], ['Simulation clock', ENV.simulationNow]]);
    case 'CRL number': return kv([['CRL number', String(c.crlNumber)]]);
    case 'Revoked entries': return c.entries.length ? `<table class="tbl"><tr><th>Serial</th><th>Revoked</th><th>Reason</th></tr>${c.entries.map((e) => `<tr><td class="mono">${esc(e.serialNumber)}</td><td>${esc(e.revocationDate)}</td><td>${esc(e.reason)}</td></tr>`).join('')}</table>` : '<p>No entries.</p>';
    case 'Signature': return kv([['Algorithm', c.signatureAlgorithm], ['SHA-256 of CRL', mono(c.thumbprints.sha256)]]);
    case 'Distribution location': return `<p class="note">This is the <strong>CDP</strong> location clients use to fetch this CRL.</p>` + kv([['URL', mono(c.distribution)]]);
    case 'Raw data summary': return pre(c.asn1) + pre(c.pem);
    default: return '';
  }
}

function chainTab(c, tab) {
  if (tab === 'PEM') return pre(c.pem);
  return `<p>Chain file order: leaf, issuing CA, root.</p>` + list(c.certs.map((x, i) => `${['Leaf', 'Issuing CA', 'Root'][i]}: ${esc(x.subject)} <span class="mono">SHA-1 ${esc(x.thumbprints.sha1)}</span>`));
}
