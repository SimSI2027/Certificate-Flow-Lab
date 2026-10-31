// Presentation metadata for the website TLS scenario: zone layout, routing, flow kinds and per-stage disclosure.
import { entityStatus } from '../views/status.js';

export const layout = {
  visitor: [110, 160], client01: [110, 400], decision: [110, 640], owner: [330, 160], browser: [330, 290], web01: [600, 400], iis: [600, 640],
  template: [820, 400], chain: [840, 640], ica01: [1040, 400], cadb: [1040, 640], aia: [1260, 230], cdp: [1260, 560], rootca: [1480, 400]
};
export const zones = [
  { id: 'client', label: 'Client', x: 10, y: 80, w: 210, h: 700 },
  { id: 'server', label: 'Owner and web server', x: 240, y: 80, w: 480, h: 700 },
  { id: 'policy', label: 'Policy and validation', x: 730, y: 80, w: 220, h: 700 },
  { id: 'ca', label: 'Issuing CA', x: 960, y: 80, w: 190, h: 700 },
  { id: 'pub', label: 'Publication', x: 1170, y: 80, w: 200, h: 700 },
  { id: 'offline', label: 'OFFLINE TRUST', x: 1385, y: 80, w: 205, h: 700, offline: true }
];
export const zoneOf = { visitor: 'client', client01: 'client', decision: 'client', owner: 'server', browser: 'server', web01: 'server', iis: 'server', template: 'policy', chain: 'policy', ica01: 'ca', cadb: 'ca', aia: 'pub', cdp: 'pub', rootca: 'offline' };

// kind: request | policy | cert | install | validate | trust ; route: explicit orthogonal waypoints; lane: vertical offset for horizontal runs
export const FLOW_META = {
  'f-visit': { kind: 'request' }, 'f-error': { kind: 'validate', lane: 34 }, 'f-report': { kind: 'request' }, 'f-review': { kind: 'request' },
  'f-keygen': { kind: 'request' }, 'f-csr': { kind: 'request' }, 'f-policy': { kind: 'policy' }, 'f-submit': { kind: 'request' }, 'f-evaluate': { kind: 'policy' },
  'f-issue': { kind: 'cert' }, 'f-return': { kind: 'cert', route: [[1040, 442], [1040, 490], [600, 490], [600, 442]] }, 'f-install': { kind: 'install' }, 'f-bind': { kind: 'install' },
  'f-retry': { kind: 'request' }, 'f-present': { kind: 'cert', lane: 34 },
  'f-aia': { kind: 'validate', route: [[198, 385], [215, 385], [215, 40], [1100, 40], [1100, 230], [1172, 230]] },
  'f-validate': { kind: 'validate', lane: -34 },
  'f-root': { kind: 'validate', route: [[110, 442], [110, 560], [720, 560], [720, 640], [752, 640]] },
  'f-cdp': { kind: 'validate', route: [[198, 415], [230, 415], [230, 520], [1100, 520], [1100, 560], [1172, 560]] },
  'f-trust': { kind: 'trust' }
};
// Extra entities to reveal at a stage (beyond the endpoints of the previous, current and next stage).
export const SHOW = { 'root-trust': ['rootca'], revocation: ['rootca'], trust: ['rootca'], 'chain-build': ['rootca'], 'browser-error': ['browser'] };

export const statusOf = (id, s) => entityStatus(id, s);
export const overrides = {};
export const home = { purpose: 'An IIS web application receives and deploys a server certificate so visitors stop seeing a browser warning.', requester: 'Application owner (the visitor only reports the problem)', destination: 'WEB01 (IIS HTTPS binding)', method: 'Manual certificate request (CSR) to an Enterprise Issuing CA' };
export const entityIds = ['visitor', 'client01', 'browser', 'owner', 'web01', 'iis', 'template', 'ica01', 'cadb', 'aia', 'cdp', 'chain', 'decision', 'rootca'];
export const rootLink = { from: 'ica01', to: 'rootca' };
