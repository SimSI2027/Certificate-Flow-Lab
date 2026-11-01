// Learning film: every certificate, CSR and CRL value the film displays is derived here from the parsed fixtures
// (src/artifacts/model.js). Environment and policy values that are not inside a fixture come from src/artifacts/synthetic.js
// and are labelled as simulation values on screen.
import { TLS, URLS } from '../artifacts/synthetic.js';

const cn = (dn) => /CN=([^,]+)/.exec(dn ?? '')?.[1] ?? '';
const day = (iso) => String(iso).slice(0, 10);
const group4 = (hex, n = 4) => hex.match(/.{1,4}/g).slice(0, n).join(' ');
const shortSerial = (s) => `…${s.slice(-4)}`;

export function filmFacts(model) {
  const p = (role, fault = null) => model.resolve(role, fault)?.parsed;
  const leaf = p('leaf'), ica = p('ica'), root = p('root'), csr = p('csr'), crl = p('crl'), inf = p('inf'), temp = p('selfsigned');
  const handshake = p('handshake');
  if (!leaf || !ica || !root || !csr || !crl || !inf || !temp || !handshake) throw new Error('Learning film: a required fixture is missing');
  return {
    now: day(model.manifest.simulationNow),
    site: TLS.web.site,
    url: `https://${TLS.web.site}`,
    visitor: { name: 'Jordan', account: TLS.visitor.user, host: TLS.visitor.host, ip: TLS.visitor.ip },
    owner: { name: 'Morgan', account: TLS.owner },
    web: { host: TLS.web.host, fqdn: TLS.web.fqdn, ip: TLS.web.ip },
    ca: { name: cn(ica.subject), host: TLS.caHost, config: TLS.caConfig },
    requestId: TLS.requestId,
    requesterGroup: TLS.requesterGroup,
    template: { name: TLS.template.name, display: TLS.template.display, version: TLS.template.version, schema: TLS.template.schema },
    renewBy: TLS.renewBy,
    temp: { file: model.resolve('selfsigned', null).manifest.filename.replace(/^certificates\//, ''), subjectCn: cn(temp.subject), issuerCn: cn(temp.issuer), selfSigned: temp.selfSigned },
    inf: {
      file: inf.filename.replace(/^requests\//, ''), machineKeySet: inf.fields['NewRequest.MachineKeySet'], exportable: inf.fields['NewRequest.Exportable'],
      keyLength: inf.fields['NewRequest.KeyLength']
    },
    csr: {
      file: csr.filename.replace(/^requests\//, ''), subject: csr.subject, subjectCn: cn(csr.subject), san: csr.san.map((n) => `${n.type} ${n.value}`).join(', '),
      sanDns: csr.san.filter((n) => n.type === 'DNS').map((n) => n.value),
      keyAlg: `RSA ${csr.publicKey.bits}`, keyBits: csr.publicKey.bits, spki: csr.publicKey.spkiSha256, spkiShort: group4(csr.publicKey.spkiSha256),
      template: csr.templateAttribute, sigAlg: csr.signatureAlgorithm, signatureValid: csr.signatureValid, hasPrivateKey: csr.hasPrivateKeyMaterial,
      clientMachine: csr.clientInfo?.machine, clientUser: csr.clientInfo?.user, clientProcess: csr.clientInfo?.process,
      requestedKu: csr.requestedKeyUsage
    },
    leaf: {
      file: leaf.filename.replace(/^certificates\//, ''), subject: leaf.subject, subjectCn: cn(leaf.subject), san: leaf.san.map((n) => `${n.type} ${n.value}`).join(', '),
      sanDns: leaf.san.filter((n) => n.type === 'DNS').map((n) => n.value),
      issuer: leaf.issuer, issuerCn: cn(leaf.issuer), serial: leaf.serialNumber, serialShort: shortSerial(leaf.serialNumber),
      notBefore: day(leaf.notBefore), notAfter: day(leaf.notAfter), eku: leaf.eku.map((e) => e.name), ekuOids: leaf.eku.map((e) => e.oid),
      ku: leaf.keyUsage, kuCritical: leaf.keyUsageCritical, isCa: leaf.basicConstraints?.ca ?? null,
      aia: leaf.aia.map((a) => a.location), cdp: leaf.cdp, sha1: leaf.thumbprints.sha1, sha1Short: group4(leaf.thumbprints.sha1, 5),
      keyAlg: `RSA ${leaf.publicKey.bits}`, spki: leaf.publicKey.spkiSha256, spkiShort: group4(leaf.publicKey.spkiSha256),
      sigAlg: leaf.signatureAlgorithm, template: leaf.template?.name, templateVersion: leaf.template?.version, selfSigned: leaf.selfSigned
    },
    ica: { subjectCn: cn(ica.subject), issuerCn: cn(ica.issuer), sha1Short: group4(ica.thumbprints.sha1, 5), notAfter: day(ica.notAfter), isCa: ica.basicConstraints?.ca, selfSigned: ica.selfSigned },
    root: { subjectCn: cn(root.subject), issuerCn: cn(root.issuer), sha1Short: group4(root.thumbprints.sha1, 5), notAfter: day(root.notAfter), selfSigned: root.selfSigned, isCa: root.basicConstraints?.ca },
    handshakeChain: handshake.certs.map((c) => cn(c.subject)),
    crl: {
      file: crl.filename.replace(/^crl\//, ''), issuerCn: cn(crl.issuer), number: crl.crlNumber, thisUpdate: day(crl.thisUpdate), nextUpdate: day(crl.nextUpdate),
      entries: crl.entries.map((e) => ({ serial: e.serialNumber, serialShort: shortSerial(e.serialNumber), reason: e.reason })),
      leafListed: crl.entries.some((e) => e.serialNumber === leaf.serialNumber), url: crl.distribution
    },
    urls: { aia: URLS.icaAia, cdp: URLS.icaCdp },
    demo: 'simsi2027.github.io/Certificate-Flow-Lab/'
  };
}
