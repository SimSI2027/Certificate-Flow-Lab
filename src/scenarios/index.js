// Scenario registry. Add new scenarios here; the engine and UI are scenario-driven.
import tls from './tls-manual-enrollment.js';
import dc from './dc-manual-certificate-request.js';

export const scenarios = [tls, dc];
export const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));
export const COMING_LATER = [
  { id: 'ndes-scep-device-enrollment', title: 'NDES / SCEP Device Enrollment' },
  { id: 'cep-ces-enrollment', title: 'CEP / CES Enrollment' },
  { id: 'autoenrollment', title: 'Autoenrollment' },
  { id: 'aia-chain-retrieval', title: 'AIA Chain Retrieval' },
  { id: 'cdp-crl-validation', title: 'CRL and OCSP Validation' }
];
