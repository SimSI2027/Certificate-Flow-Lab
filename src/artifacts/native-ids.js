// Allowlist of public CER fixtures that may be opened in the native Windows certificate viewer (local companion only).
// Shared by the browser UI (to know which buttons to offer) and the companion (the only authority on what may be opened).
// Values are paths relative to fixtures/certificates; never user-supplied.
export const NATIVE_CERTIFICATES = Object.freeze({
  'root-ca': 'simsi2027-rootca.cer',
  'issuing-ca': 'simsi2027-ica01.cer',
  'portal-leaf': 'portal.simsi2027.test.cer',
  'fault-wrong-dns': 'fault-wrong-dns.cer',
  'fault-expired': 'fault-expired.cer',
  'fault-wrong-eku': 'fault-wrong-eku.cer',
  'fault-revoked': 'fault-revoked.cer',
  'dc-issued': 'dc01-issued.cer',
  'fault-dc-wrong-eku': 'fault-dc-wrong-eku.cer',
  'fault-dc-san-missing': 'fault-dc-san-missing.cer',
  'fault-dc-key-mismatch': 'fault-dc-key-mismatch.cer',
  'fault-dc-expired': 'fault-dc-expired.cer'
});

// manifest filename (certificates/<file>.cer) -> artifact id
export const nativeIdForFilename = (filename) => Object.entries(NATIVE_CERTIFICATES).find(([, f]) => `certificates/${f}` === filename)?.[0] ?? null;

export const COMPANION_PORT = 5184;
export const COMPANION_ORIGINS = Object.freeze(['http://127.0.0.1:5183', 'http://localhost:5183', 'http://127.0.0.1:5185', 'http://localhost:5185']);
