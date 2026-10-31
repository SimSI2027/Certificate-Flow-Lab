// Synthetic SIMSI2027 environment constants. All values are simulation data, not a real organization.
export const ENV = {
  domain: 'simsi2027.test',
  netbios: 'SIMSI2027',
  visitor: { user: 'SIMSI2027\\Jordan', host: 'CLIENT01', ip: '10.20.10.45' },
  owner: { user: 'SIMSI2027\\Morgan' },
  web: { host: 'WEB01', ip: '10.20.20.30', site: 'portal.simsi2027.test' },
  issuingCa: 'SIMSI2027-ICA01',
  rootCa: 'SIMSI2027-ROOTCA',
  pubServer: 'PKIWEB01',
  template: 'WebServer',
  requestId: 1042,
  // Fixed simulation clock so evaluation is deterministic.
  simulationNow: '2026-10-31T14:05:00Z'
};
export const URLS = {
  icaAia: 'http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt',
  icaCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl',
  rootAia: 'http://pki.simsi2027.test/aia/SIMSI2027-ROOTCA.crt',
  rootCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-ROOTCA.crl'
};
export const TEMPLATE = {
  name: 'WebServer',
  // Synthetic OID (not a registered enterprise template OID).
  oid: '1.3.6.1.4.1.311.21.8.2027.1.1',
  major: 100,
  minor: 4
};
export const OIDS = {
  templateName: '1.3.6.1.4.1.311.20.2',
  templateInfo: '1.3.6.1.4.1.311.21.7',
  crlNumber: '2.5.29.20'
};
