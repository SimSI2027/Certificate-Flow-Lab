// Scenario: Domain Controller Manual Enrollment (v0.4.0 story redesign; synthetic SIMSI2027 environment).
// Two paths share one canonical engine: Path A (manual CSR transfer) and Path B (Certificates MMC enrollment).
// Educational simulation only: nothing here contacts a real CA or Active Directory, and no command is executed.
import { DC } from '../artifacts/synthetic.js';
import { evaluateDc } from './dc-evaluate.js';
import { ARTIFACTS, CONDITIONS, FAULTS, faultsFor, flowsFor, initialState, zonesFor, NEVER_EXECUTED, CFG } from './dc/shared.js';
import * as A from './dc/path-csr.js';
import * as B from './dc/path-mmc.js';

const PATH_DEFS = { csr: { label: 'Manual CSR transfer', mod: A }, mmc: { label: 'Certificates MMC enrollment', mod: B } };

function artifactsFor(pathId, stages) {
  return Object.entries(ARTIFACTS).map(([id, a]) => {
    const first = stages.find((s) => s.artifact === id);
    return { id, label: a.label, color: a.color, icon: a.icon, tag: a.tag, inspectable: !!a.role, fixtureRole: pathId === 'mmc' ? (a.mmcRole ?? a.role) : a.role, note: a.stamp,
      presence: first ? [{ arrive: first.id, at: first.zone, via: null }] : [] };
  });
}

function buildPath(pathId) {
  const { label, mod } = PATH_DEFS[pathId];
  const stages = mod.steps;
  const faults = faultsFor(pathId);
  const faultPatches = {}, faultStagePatches = {};
  for (const f of faults.filter((x) => x.id !== 'healthy')) {
    if (f.stops) faultPatches[f.id] = f.patch;
    const sp = {};
    for (const [stageId, patch] of Object.entries(f.effects ?? {})) if (stages.some((s) => s.id === stageId)) sp[stageId] = patch;
    if (!f.stops) { sp[f.stage] = { ...(sp[f.stage] ?? {}), ...f.patch }; if (f.finalPatch) sp[stages.at(-1).id] = f.finalPatch; }
    if (Object.keys(sp).length) faultStagePatches[f.id] = sp;
  }
  return { pathId, pathLabel: label, milestones: mod.MILESTONES, stages, flows: flowsFor(stages), faults, faultPatches, faultStagePatches,
    evidenceTrace: mod.evidenceTrace, zones: zonesFor(pathId), artifacts: artifactsFor(pathId, stages), verdictQuestion: 'Why is the DC01 certificate NOT suitable?' };
}

export const paths = { csr: buildPath('csr'), mmc: buildPath('mmc') };
export const conditions = CONDITIONS;

// Resolves the parsed fixture behind an artifact for the active path and fault.
function resolveFixture(model, artifactId, faultId = 'healthy') {
  const a = ARTIFACTS[artifactId]; if (!a?.role) return null;
  const fault = FAULTS.find((f) => f.id === faultId);
  if (artifactId === 'root' && fault?.fixtures?.['dc-root-candidate'] && this.pathId === 'csr') return model.resolve('dc-root-candidate', faultId);
  if (artifactId === 'inf') return model.resolve('dc-inf', fault?.fixtures?.['dc-inf'] ? faultId : null);
  if ((artifactId === 'leaf' || artifactId === 'accepted') && fault?.fixtures?.['dc-cert']) return model.resolve('dc-cert', faultId);
  const role = this.pathId === 'mmc' ? (a.mmcRole ?? a.role) : a.role;
  return model.resolve(role, null);
}

export const tour = [
  { id: 't1', stage: 'a-why', title: 'Why manual?', text: 'Autoenrollment failed: RPC/DCOM from DC01 to ICA01 is blocked.' },
  { id: 't2', stage: 'a-template', title: 'A controlled template', text: 'PKIOperator will submit, so a Supply-in-the-request template is used under tight controls.' },
  { id: 't3', stage: 'a-new', title: 'Key and CSR together', text: 'certreq -new creates the key on DC01 and the CSR signed with it. The key stays in the key vault.' },
  { id: 't4', stage: 'a-submit', title: 'Submit as PKIOperator', text: `The CA records request ${DC.requestId} with Requester SIMSI2027\\PKIOperator; the subject is still DC01.` },
  { id: 't5', stage: 'a-sign', title: 'A new certificate', text: 'ICA01 creates and signs a new leaf with the CSR public key. The Root CA is not contacted.' },
  { id: 't6', stage: 'a-root', title: 'Trust first', text: 'The verified Root and Issuing CA certificates go into the right stores before the leaf is accepted.' },
  { id: 't7', stage: 'a-accept', title: 'Accept on DC01', text: 'certreq -accept links the leaf to the existing key on the same computer. The key never travels.' },
  { id: 't8', stage: 'a-followup', title: 'Root cause still open', text: 'The certificate is suitable now; fix the firewall and autoenrollment so it renews.', handoff: true }
];

const base = paths.csr;
export default {
  id: 'dc-manual-certificate-request', title: 'Domain Controller Manual Enrollment', version: '0.4.0', layoutMode: 'story-zones',
  subtitle: 'DC01 has no Domain Controller certificate. Follow a controlled manual CSR transfer, or a direct Certificates console enrollment.',
  home: { purpose: 'Give DC01 a certificate with KDC Authentication when autoenrollment has not produced one.', requester: 'Path A: SIMSI2027\\PKIOperator (for DC01) · Path B: SIMSI2027\\DC01$',
    destination: 'Local Computer\\Personal on DC01, with the private key that never left DC01', method: 'Path A: certreq transfer via PKI-TRANSFER01 · Path B: Certificates (Local Computer) wizard' },
  paths, defaultPath: 'csr', conditions, defaultCondition: 'trust-missing', initialState,
  ...base, tour, futureScenarios: ['ndes-scep-device-enrollment', 'cep-ces-enrollment', 'autoenrollment', 'aia-chain-retrieval', 'cdp-crl-validation', 'ocsp-validation'],
  resolveFixture, evaluate: evaluateDc, neverExecuted: NEVER_EXECUTED, configMarker: CFG
};
