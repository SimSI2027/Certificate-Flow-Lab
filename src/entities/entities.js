// Shared entity catalogue (reusable across scenarios). All data is synthetic simulation data.
// Placement (zone, x, y) is scenario-specific and lives in each scenario's `layout`.
import { ENV, DC } from '../artifacts/synthetic.js';

export const entities = [
  { id: 'visitor', label: 'Visitor', sub: ENV.visitor.user, kind: 'person', icon: 'user', blurb: 'A normal user who opens the website and reports the browser warning. The visitor does not request or manage certificates.' },
  { id: 'client01', label: ENV.visitor.host, sub: ENV.visitor.ip, kind: 'computer', icon: 'client', blurb: 'The visitor\'s computer. It validates the server certificate: name, dates, purpose, signatures, trusted root and revocation.' },
  { id: 'browser', label: 'Browser session', sub: 'https://portal.simsi2027.test', kind: 'screen', icon: 'browser', blurb: 'The browser window on CLIENT01 that shows the secure or not-secure result.' },
  { id: 'owner', label: 'Application owner', sub: ENV.owner.user, kind: 'person', icon: 'user', blurb: 'The person responsible for the portal application. The owner (not the visitor) starts the certificate request.' },
  { id: 'web01', label: ENV.web.host, sub: ENV.web.ip, kind: 'server', icon: 'server', blurb: 'The web server. It creates and keeps its own private key, builds the request, installs the issued certificate and serves HTTPS.' },
  { id: 'iis', label: 'IIS HTTPS binding', sub: 'portal.simsi2027.test:443', kind: 'binding', icon: 'iis', blurb: 'The IIS (Internet Information Services) setting that tells the web server which certificate to present for portal.simsi2027.test on port 443.' },
  { id: 'enroll', label: 'Request interface', sub: 'Manual enrollment (certreq)', kind: 'panel', icon: 'csr', blurb: 'The tool on the server that builds and submits the certificate request.' },
  { id: 'template', label: 'WebServer template', sub: 'Policy gate', kind: 'gate', icon: 'policy', blurb: 'A certificate template is the CA\'s rulebook for one kind of certificate: who may request it, what names, purposes and key sizes are allowed.' },
  { id: 'ica01', label: ENV.issuingCa, sub: 'Issuing CA (online)', kind: 'ca', icon: 'ca', blurb: 'The online Enterprise Issuing CA. It evaluates requests against templates and signs end-entity certificates.' },
  { id: 'rootca', label: ENV.rootCa, sub: 'Root CA (offline)', kind: 'root', icon: 'root', blurb: 'The offline Root CA is the trust anchor. It signed the Issuing CA certificate in the past and is not contacted for ordinary requests.' },
  { id: 'cadb', label: 'CA database', sub: 'Request and issued records', kind: 'db', icon: 'db', blurb: 'The CA\'s database of requests, issued certificates and revocations.' },
  { id: 'pkiweb01', label: ENV.pubServer, sub: 'Publication server', kind: 'server', icon: 'repo', blurb: 'A web server that publishes AIA and CDP content so clients can finish chain building and check revocation.' },
  { id: 'aia', label: 'AIA repository', sub: 'Issuer certificates', kind: 'repo', icon: 'aia', blurb: 'AIA (Authority Information Access) tells a client where to download the issuing CA certificate.' },
  { id: 'cdp', label: 'CDP / CRL repository', sub: 'Revocation lists', kind: 'repo', icon: 'cdp', blurb: 'CDP (CRL Distribution Point) tells a client where to download the CRL (Certificate Revocation List).' },
  { id: 'chain', label: 'Certificate chain', sub: 'Leaf, Issuing CA, Root', kind: 'chain', icon: 'cert', blurb: 'The path of certificates from the server certificate up to a trusted root.' },
  { id: 'decision', label: 'Trust decision', sub: 'Final result', kind: 'decision', icon: 'shield', blurb: 'The outcome of validation: trusted or rejected.' },
  // Domain Controller manual enrollment
  { id: 'operator', label: 'PKI operator', sub: DC.operator, kind: 'person', icon: 'user', blurb: 'The administrator who runs the manual request. The operator starts the procedure; the certificate identity belongs to DC01, not to the operator.' },
  { id: 'dc01', label: DC.host, sub: `${DC.ip} · Domain Controller`, kind: 'dc', icon: 'dc', blurb: 'The Domain Controller. It creates and keeps its own private key and receives a certificate for its own DNS name.' },
  { id: 'certstore', label: 'Local Computer\\Personal', sub: 'DC01 certificate store', kind: 'store', icon: 'store', blurb: 'The machine certificate store on DC01 where a computer certificate and its private-key association live.' },
  { id: 'result', label: 'Suitability result', sub: 'Simulated DC purpose', kind: 'decision', icon: 'shield', blurb: 'The conclusion of the simulation: whether the certificate is suitable for the simulated Domain Controller purpose.' }
];
export const entityById = Object.fromEntries(entities.map((e) => [e.id, e]));
