// Entity definitions (reusable across scenarios). All data is synthetic simulation data.
import { ENV } from '../artifacts/synthetic.js';

export const entities = [
  { id: 'visitor', label: 'Visitor', sub: ENV.visitor.user, kind: 'person' },
  { id: 'client01', label: ENV.visitor.host, sub: ENV.visitor.ip, kind: 'computer' },
  { id: 'browser', label: 'Browser session', sub: 'https://portal.simsi2027.test', kind: 'screen' },
  { id: 'owner', label: 'Application owner', sub: ENV.owner.user, kind: 'person' },
  { id: 'web01', label: ENV.web.host, sub: ENV.web.ip, kind: 'server' },
  { id: 'iis', label: 'IIS HTTPS binding', sub: 'portal.simsi2027.test:443', kind: 'binding' },
  { id: 'enroll', label: 'Request interface', sub: 'Manual enrollment (certreq)', kind: 'panel' },
  { id: 'template', label: 'WebServer template', sub: 'Policy gate', kind: 'gate' },
  { id: 'ica01', label: ENV.issuingCa, sub: 'Issuing CA (online)', kind: 'ca' },
  { id: 'rootca', label: ENV.rootCa, sub: 'Root CA (offline)', kind: 'root' },
  { id: 'cadb', label: 'CA database', sub: 'Request and issued records', kind: 'db' },
  { id: 'pkiweb01', label: ENV.pubServer, sub: 'Publication server', kind: 'server' },
  { id: 'aia', label: 'AIA repository', sub: 'CA certificates', kind: 'repo' },
  { id: 'cdp', label: 'CDP / CRL repository', sub: 'Revocation lists', kind: 'repo' },
  { id: 'chain', label: 'Certificate chain', sub: 'Leaf → Issuing CA → Root', kind: 'chain' },
  { id: 'decision', label: 'Trust decision', sub: 'Final result', kind: 'decision' }
];
export const entityById = Object.fromEntries(entities.map((e) => [e.id, e]));
