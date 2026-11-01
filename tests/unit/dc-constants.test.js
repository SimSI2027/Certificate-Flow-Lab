import { describe, it, expect, beforeAll } from 'vitest';
import { DC } from '../../src/artifacts/synthetic.js';
import { loadModel } from '../helpers/fixtures.js';

let M;
beforeAll(async () => { M = (await loadModel()).model; });

describe('v0.4.0 Domain Controller synthetic constants', () => {
  it('caName equals the Issuing CA fixture CN and caConfig is derived, never hand-typed', () => {
    const ica = M.resolve('ica', null).parsed;
    expect(/CN=([^,]+)/.exec(ica.subject)[1]).toBe(DC.caName);
    expect(DC.caConfig).toBe(`${DC.caHost}\\${DC.caName}`);
    expect(DC.caConfig).toBe('ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01');
  });
  it('defines the three identities separately (golden rules 1-5)', () => {
    expect(DC.fqdn).toBe('DC01.simsi2027.test');
    expect(DC.operator).toBe('SIMSI2027\\PKIOperator');
    expect(DC.machineAccount).toBe('SIMSI2027\\DC01$');
    expect(new Set([DC.fqdn, DC.operator, DC.machineAccount]).size).toBe(3);
  });
  it('defines the templates, hosts and request id', () => {
    expect(DC).toMatchObject({ domainDns: 'simsi2027.test', netbios: 'SIMSI2027', certManager: 'SIMSI2027\\PKICertManager', operatorGroup: 'PKI Operators', transferHost: 'PKI-TRANSFER01',
      caLabel: 'SIMSI2027-ICA01', rootLabel: 'SIMSI2027-ROOTCA', pubServer: 'PKIWEB01', pubFqdn: 'pki.simsi2027.test', template: 'KerberosAuthentication', templateOid: '1.3.6.1.4.1.311.21.8.2027.1.2',
      templateVersion: '100.5', offlineTemplate: 'DCOfflineKerberosAuth', offlineTemplateOid: '1.3.6.1.4.1.311.21.8.2027.1.3', offlineTemplateVersion: '100.1', altTemplate: 'DomainControllerAuthentication', requestId: 1042 });
  });
});
