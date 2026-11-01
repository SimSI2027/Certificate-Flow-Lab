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
  // Fixed simulation clock so evaluation is deterministic.
  simulationNow: '2026-10-31T14:05:00Z'
};
export const URLS = {
  icaAia: 'http://pki.simsi2027.test/aia/SIMSI2027-ICA01.crt',
  icaCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-ICA01.crl',
  rootAia: 'http://pki.simsi2027.test/aia/SIMSI2027-ROOTCA.crt',
  rootCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-ROOTCA.crl'
};
// The online Issuing CA, shared by every lesson. The configuration string is always derived, never hand-typed.
const caHost = 'ICA01.simsi2027.test', caName = 'SIMSI2027 Issuing CA 01';
export const CA = { host: caHost, name: caName, config: `${caHost}\\${caName}`, label: 'SIMSI2027-ICA01', rootLabel: 'SIMSI2027-ROOTCA' };

// Website TLS lesson (tls-manual-enrollment, v0.5.0). Synthetic template OIDs are not registered enterprise OIDs.
export const TLS = {
  visitor: ENV.visitor,
  owner: ENV.owner.user,
  web: { host: 'WEB01', fqdn: 'WEB01.simsi2027.test', ip: '10.20.20.30', site: 'portal.simsi2027.test', iisSite: 'portal' },
  requesterGroup: 'Web Server Certificate Requesters',
  template: { name: 'SIMSI2027WebServer', display: 'SIMSI2027 Web Server', oid: '1.3.6.1.4.1.311.21.8.2027.1.1', major: 100, minor: 4, version: '100.4', schema: 2 },
  builtinTemplate: { name: 'WebServer', display: 'Web Server', schema: 1 },
  wrongEkuTemplate: { name: 'SIMSI2027WorkstationAuth', display: 'SIMSI2027 Workstation Authentication', oid: '1.3.6.1.4.1.311.21.8.2027.1.7', major: 100, minor: 2, version: '100.2', schema: 2 },
  caHost: CA.host, caName: CA.name, caConfig: CA.config,
  requestId: 1043,
  renewBy: '2027-10-30'
};

// Domain Controller manual-enrollment scenario (synthetic).
export const DC = {
  host: 'DC01', fqdn: 'DC01.simsi2027.test', ip: '10.20.10.10', domainDns: 'simsi2027.test', netbios: 'SIMSI2027',
  machineAccount: 'SIMSI2027\\DC01$', operator: 'SIMSI2027\\PKIOperator', certManager: 'SIMSI2027\\PKICertManager', operatorGroup: 'PKI Operators',
  transferHost: 'PKI-TRANSFER01', caHost: CA.host, caName: CA.name, caConfig: CA.config, caLabel: CA.label, rootLabel: CA.rootLabel,
  pubServer: 'PKIWEB01', pubFqdn: 'pki.simsi2027.test',
  template: 'KerberosAuthentication', templateOid: '1.3.6.1.4.1.311.21.8.2027.1.2', templateVersion: '100.5',
  offlineTemplate: 'DCOfflineKerberosAuth', offlineTemplateDisplay: 'SIMSI2027 DC Offline Kerberos Authentication', offlineTemplateOid: '1.3.6.1.4.1.311.21.8.2027.1.3', offlineTemplateVersion: '100.1',
  altTemplate: 'DomainControllerAuthentication', requestId: 1042
};
// Template OID -> template name, used to resolve the certificate template information extension (1.3.6.1.4.1.311.21.7).
export const TEMPLATE_NAMES = {
  [TLS.template.oid]: TLS.template.name, [DC.templateOid]: DC.template, [DC.offlineTemplateOid]: DC.offlineTemplate, [TLS.wrongEkuTemplate.oid]: TLS.wrongEkuTemplate.name
};
export const OIDS = {
  templateName: '1.3.6.1.4.1.311.20.2',
  templateInfo: '1.3.6.1.4.1.311.21.7',
  enrollmentNameValuePair: '1.3.6.1.4.1.311.13.2.1',
  clientInformation: '1.3.6.1.4.1.311.21.20',
  extensionRequest: '1.2.840.113549.1.9.14',
  kdcAuth: '1.3.6.1.5.2.3.5',
  smartCardLogon: '1.3.6.1.4.1.311.20.2.2',
  crlNumber: '2.5.29.20'
};
