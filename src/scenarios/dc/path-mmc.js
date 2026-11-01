// Path B — Certificates MMC enrollment (6 milestones, 11 steps). DC01 can reach ICA01, so the Local Computer Certificates console
// enrolls directly as SIMSI2027\DC01$ with the KerberosAuthentication template; the identity is built from Active Directory.
import { DC } from '../../artifacts/synthetic.js';
import { step, command, cfg, KIND } from './shared.js';

const CA = `"${DC.caConfig}"`;
const X = (what, who, moves, staysLocal, canGoWrong) => ({ what, who, moves, staysLocal, canGoWrong });
export const MILESTONES = ['Diagnose', 'Check prerequisites', 'Open Local Computer store', 'Enroll', 'Verify', 'Follow up'];
const [M1, M2, M3, M4, M5, M6] = MILESTONES;

export const steps = [
  step({ id: 'b-detect', milestone: M1, title: 'Personal has no suitable DC certificate', zone: 'Z6', adjacent: ['Z1'], actor: 'OP', artifact: null, stores: true,
    purpose: 'Local Computer\\Personal on DC01 has no certificate with KDC Authentication.', command: command('certutil -store My'), result: 'Personal is empty of suitable certificates.',
    during: { dcCertState: 'checking', storeView: 'personal' }, done: { dcCertState: 'missing', storeView: 'personal', trust: { root: 'present', ica: 'present', rootSource: 'Enterprise (AD)', icaSource: 'Enterprise (AD)' } },
    explain: X('The operator looks in DC01\'s Personal store for a Domain Controller certificate usable by the KDC (Key Distribution Center, the Kerberos service). None is there yet.',
      'SIMSI2027\\PKIOperator on DC01.', 'Nothing moves.', 'The store is on DC01.', 'Looking in the Current User store (certmgr.msc) instead of Local Computer.') }),
  step({ id: 'b-connect', milestone: M1, title: 'CA reachable over RPC/DCOM', zone: 'Z1', adjacent: ['Z4'], actor: 'OP', artifact: null, connector: { from: 'Z1', to: 'Z4', channel: 'RPC/DCOM' },
    purpose: 'certutil -ping reaches ICA01, so direct enrollment can work.', command: command(`certutil -ping -config ${CA}`), result: 'ICA01 answers.',
    notes: ['On a Domain Controller the Active Directory enrollment policy is normally available locally.'],
    during: { rpcState: 'testing' }, done: { rpcState: 'ok' },
    explain: X('Unlike Path A, DC01 can reach the Issuing CA over RPC/DCOM, so the computer can enroll for itself.', 'SIMSI2027\\PKIOperator on DC01.', 'A test call to ICA01.', 'No key exists yet.', cfg('A firewall blocking the RPC/DCOM ports')) }),
  step({ id: 'b-template', milestone: M2, title: 'KerberosAuthentication is published on ICA01', zone: 'Z4', adjacent: ['Z1'], actor: 'OP', artifact: 'template',
    purpose: 'Confirm ICA01 publishes KerberosAuthentication, which builds the identity from AD.', result: 'Published on ICA01.', during: { templateState: 'checking' }, done: { templateState: 'published' },
    explain: X('KerberosAuthentication builds the subject and the SAN (Subject Alternative Name: the names the certificate is valid for) from DC01\'s Active Directory object, so nothing is typed by hand. It needs DC01 to reach ICA01 and DC01$ to have Read and Enroll.',
      'SIMSI2027\\PKIOperator.', 'Nothing moves.', 'Nothing secret is involved.', 'The template is not published on this CA.') }),
  step({ id: 'b-permission', milestone: M2, title: 'DC01$ has Read and Enroll', zone: 'Z4', adjacent: ['Z1'], actor: 'OP', artifact: 'template',
    purpose: cfg('DC01$ has Read and Enroll through Domain Controllers / Enterprise Domain Controllers; the default permissions'), result: 'DC01$: Read, Enroll.',
    done: { permissionState: 'granted' },
    explain: X('The computer account DC01$ needs Read and Enroll on the template. Running the console elevated only allows writing the Local Computer store; it does not grant template permission.',
      'SIMSI2027\\PKIOperator (checks); PKI administrator (owns the ACL).', 'Nothing moves.', 'Nothing secret is involved.', cfg('Enroll missing for the Domain Controller groups; template permission defaults')) }),
  step({ id: 'b-open', milestone: M3, title: 'Open Certificates (Local Computer)', zone: 'Z2', adjacent: ['Z1'], actor: 'OP', artifact: 'wizard',
    purpose: 'Open certlm.msc (or mmc → Add/Remove Snap-in → Certificates → Computer account → Local computer) and go to Personal\\Certificates.',
    command: command('certlm.msc'), gui: 'mmc → File → Add/Remove Snap-in → Certificates → Computer account → Local computer; Certificates (Local Computer) → Personal → Certificates. Not certmgr.msc (Current User).',
    result: 'Certificates (Local Computer) → Personal → Certificates is open.', done: { storeView: 'console' },
    explain: X('The Local Computer view is essential: the certificate and its key must belong to the computer, not to the operator. certmgr.msc opens the Current User store and is the wrong place.', 'SIMSI2027\\PKIOperator on DC01 (elevated).', 'Nothing moves.', 'Everything is on DC01.', 'Opening the Current User store.') }),
  step({ id: 'b-wizard', milestone: M4, title: 'Request New Certificate wizard', zone: 'Z2', adjacent: ['Z1'], actor: 'OP', artifact: 'wizard',
    purpose: 'Personal\\Certificates → All Tasks → Request New Certificate… → Active Directory Enrollment Policy → Kerberos Authentication.',
    gui: 'Personal\\Certificates → All Tasks → Request New Certificate… → Before You Begin → Select Certificate Enrollment Policy: Active Directory Enrollment Policy → Request Certificates: Kerberos Authentication. "Show all templates" also lists templates you cannot enroll for, with the reason.',
    result: 'Kerberos Authentication selected.', done: { templateState: 'chosen' },
    explain: X('The wizard lists only templates DC01$ may enroll for. "Show all templates" also shows hidden ones with the reason, which is the quickest way to spot a permission problem.', 'SIMSI2027\\PKIOperator.', 'Nothing moves yet.', 'No key exists yet.', 'The template does not appear: missing permission or not published.') }),
  step({ id: 'b-enroll', milestone: M4, title: 'Key, request and direct submission', zone: 'Z4', adjacent: ['Z2'], actor: 'SYS', artifact: 'csr', connector: { from: 'Z2', to: 'Z4', channel: 'RPC/DCOM', blockedBy: ['rpc-blocked'] },
    purpose: 'The wizard generates the key in the machine store, builds and signs the request in memory and sends it over RPC/DCOM authenticated as DC01$.',
    result: 'Requester SIMSI2027\\DC01$; subject built from AD.', during: { keyState: 'generating', csrState: 'building' }, done: { keyState: 'on-dc01', csrState: 'submitted', requestRecord: 'received', requester: 'SIMSI2027\\DC01$' },
    explain: X('The key pair is created in DC01\'s machine store and the request (a CSR: Certificate Signing Request) is built and signed in memory (not saved as a file). The CA records the computer identity SIMSI2027\\DC01$ as Requester and builds the names from AD.',
      'The enrollment wizard on DC01 (system), authenticated as DC01$.', 'The request (public key and attributes) over RPC/DCOM.', 'The private key stays in DC01\'s machine store.', cfg('RPC/DCOM blocked between DC01 and ICA01; required ports')) }),
  step({ id: 'b-issue', milestone: M4, title: 'ICA01 issues; wizard installs the response', zone: 'Z5', adjacent: ['Z4'], actor: 'SYS', artifact: 'accepted', connector: { from: 'Z4', to: 'Z5', channel: 'RPC/DCOM' },
    purpose: 'ICA01 creates and signs a new leaf; the response is installed automatically: Certificate Installation Results STATUS: Succeeded.',
    result: 'Leaf already in Personal with its private key; no accept step.', during: { leafState: 'signing' }, done: { leafState: 'accepted', requestRecord: 'issued', keyState: 'associated', keyAssociation: 'linked' },
    explain: X('The CA creates a new certificate from DC01\'s AD identity and the request public key, signs it with the Issuing CA key and returns it. The wizard installs it in Personal immediately; there is no separate accept step and no pending request to watch.',
      'ICA01 and the wizard (system).', 'The issued certificate, back to DC01.', 'The private key never moved.', 'Template EKUs misconfigured.') }),
  step({ id: 'b-verify', milestone: M5, title: 'Key, names, purposes, template, validity', zone: 'Z6', adjacent: [], actor: 'OP', artifact: 'accepted', stores: true,
    purpose: 'Check the private key, SAN, EKU, KU, template and dates; CA certificates are present via Enterprise (AD).', result: 'Suitable.',
    during: { purposeState: 'inspecting' }, done: { purposeState: 'suitable', keyAssociation: 'matched', validation: { name: 'pass', dates: 'pass', eku: 'pass' } },
    explain: X('The leaf has an empty subject: with this template the identity lives in the SAN (Subject Alternative Name: the list of names the certificate is valid for), which the CA built from AD and marked critical. EKU (Enhanced Key Usage) must include KDC Authentication; KU (Key Usage) limits the key.',
      'SIMSI2027\\PKIOperator.', 'Nothing moves.', 'Everything is on DC01.', 'Missing KDC Authentication or domain DNS name; expired.') }),
  step({ id: 'b-chain', milestone: M5, title: 'Chain and revocation', zone: 'Z6', adjacent: [], actor: 'SYS', artifact: 'chain', stores: true, pub: true, rootHistory: true, connector: { from: 'Z6', to: 'PUB:cdp', channel: 'HTTP (CDP)', blockedBy: ['cdp-unreachable'] },
    purpose: 'Build the chain from the Enterprise stores and fetch the CRL through the CDP.', command: command('certutil -verify -urlfetch dc01-issued.cer', { 'dc01-issued.cer': 'The certificate file to verify (here an export of the enrolled DC01 certificate).' }),
    result: 'Chain trusted; CRL current; serial not listed.', during: { chainState: 'building', revocationState: 'checking' }, done: { chainState: 'trusted', revocationState: 'good', validation: { signatures: 'pass', root: 'pass' } },
    explain: X('The chain builds from local stores filled by AD. AIA (Authority Information Access: where to download the issuer certificate) and the CDP (CRL Distribution Point: where to download the CRL, the Certificate Revocation List) are separate; only the CRL is fetched here.', 'DC01 (system).', 'The CRL over HTTP.', 'The private key stays on DC01.', cfg('CDP unreachable; whether services enforce revocation')) }),
  step({ id: 'b-followup', milestone: M6, title: 'Let autoenrollment take over', zone: 'Z1', adjacent: ['Z6'], actor: 'OP', artifact: 'remediation',
    purpose: cfg('certutil -pulse (or a Group Policy refresh) triggers autoenrollment, the permanent mechanism; confirm renewal works. When the service picks it up'), command: command('certutil -pulse'),
    result: 'Suitable now; confirm that autoenrollment renews it.', done: { trustDecision: 'suitable', followupState: 'open' },
    explain: X('Manual enrollment through the console fixed today\'s gap. Autoenrollment is what keeps the certificate renewed, so confirm it works.', 'SIMSI2027\\PKIOperator.', 'Nothing moves.', 'Everything stays on DC01.', cfg('Autoenrollment Group Policy not applied; service pickup timing')) })
];

const T = (id, stage, question, claim, entity, artifact, evidenceKind, faults = []) => ({ id, stage, question, claim, entity, artifact, evidenceKind, faults });
export const evidenceTrace = [
  T('suitable', 'b-followup', 'Is the DC01 certificate suitable?', 'Every check below passed, so it is suitable now.', 'Z1', 'remediation', KIND.DERIVED),
  T('purposes', 'b-verify', 'Purposes and names?', 'KDC Authentication EKU present; SAN has simsi2027.test and DC01.simsi2027.test; within validity.', 'Z6', 'accepted', KIND.REAL, ['wrong-eku', 'san-no-domain', 'expired']),
  T('key', 'b-issue', 'Private-key association?', 'Leaf SPKI equals the request SPKI; the wizard installed it with the key it generated on DC01.', 'Z6', 'accepted', `${KIND.REAL} + ${KIND.SIM}`),
  T('chain', 'b-chain', 'Trusted chain?', 'Leaf → Issuing CA → Root signatures verify; the Root CA was not contacted.', 'Z6', 'chain', KIND.REAL),
  T('revocation', 'b-chain', 'Revocation?', 'The CRL is signed by the Issuing CA, current, and does not list the serial.', 'PUB', 'crl', KIND.REAL, ['cdp-unreachable']),
  T('ca-certs', 'b-detect', 'CA certificates?', 'Root and Issuing CA certificates came from AD (Enterprise store).', 'Z6', 'root', KIND.SIM),
  T('requester', 'b-enroll', 'Who requested it?', 'Requester SIMSI2027\\DC01$; the subject was built from AD.', 'Z4', 'csr', KIND.SIM, ['rpc-blocked', 'no-enroll-permission', 'template-not-published']),
  T('pop', 'b-enroll', 'Request proof of possession?', 'The request signature verifies with the public key it contains.', 'Z2', 'csr', KIND.REAL),
  T('key-origin', 'b-enroll', 'Where was the key generated?', 'In DC01\'s machine store by the wizard.', 'Z1', null, `${KIND.REAL} + ${KIND.SIM}`),
  T('origin', 'b-detect', 'Why manual enrollment?', 'Autoenrollment had not yet produced a certificate; enrollment was triggered manually.', 'Z1', null, KIND.SIM)
];
