// Derives a visual status for each entity purely from the canonical state. No animation state lives elsewhere.
// Statuses: idle | active | ok | fail | policy | policy-ok
export function entityStatus(id, s) {
  switch (id) {
    case 'visitor':
      return s.visitorState === 'secure' ? 'ok' : ['seeing-error', 'blocked'].includes(s.visitorState) ? 'fail'
        : ['browsing', 'reporting', 'retrying'].includes(s.visitorState) ? 'active' : s.visitorState === 'reported' ? 'ok' : 'idle';
    case 'client01': case 'browser':
      return s.connectionState === 'trusted' ? 'ok' : ['failed', 'blocked'].includes(s.connectionState) ? 'fail' : ['connecting', 'tls-handshake', 'validating'].includes(s.connectionState) ? 'active' : 'idle';
    case 'owner': return s.requestState === 'needed' ? 'active' : ['reviewed', 'submitted', 'received', 'issued'].includes(s.requestState) ? 'ok' : 'idle';
    case 'web01':
      if (s.installationState === 'no-private-key') return 'fail';
      if (s.keyState === 'generating' || s.csrState === 'building' || s.certificateState === 'returning' || s.installationState === 'installing') return 'active';
      if (s.installationState === 'installed') return 'ok';
      return s.keyState === 'held-on-web01' ? 'ok' : 'idle';
    case 'iis': return s.iisBindingState === 'bound' ? 'ok' : s.iisBindingState === 'binding' ? 'active' : s.iisBindingState === 'unavailable' ? 'fail' : 'idle';
    case 'enroll': return s.csrState === 'building' ? 'active' : ['created', 'submitted'].includes(s.csrState) ? 'ok' : 'idle';
    case 'template': return s.templateDecision === 'permitted' ? 'policy-ok' : s.templateDecision === 'evaluating' ? 'policy' : 'idle';
    case 'ica01': return ['evaluating', 'signing'].includes(s.issuanceState) || s.requestState === 'submitted' ? 'active' : ['approved', 'issued'].includes(s.issuanceState) ? 'ok' : s.issuanceState === 'received' ? 'active' : 'idle';
    case 'rootca': return s.validation.root === 'pass' ? 'ok' : s.validation.root === 'fail' ? 'fail' : 'idle';
    case 'cadb': return ['received', 'issued'].includes(s.requestState) ? 'ok' : s.issuanceState === 'evaluating' ? 'active' : 'idle';
    case 'pkiweb01': return s.aiaState === 'failed' || s.revocationState === 'unavailable' ? 'fail' : s.aiaState === 'fetching' || s.revocationState === 'checking' ? 'active' : s.aiaState === 'retrieved' || s.revocationState === 'good' || s.revocationState === 'revoked' ? 'ok' : 'idle';
    case 'aia': return s.aiaState === 'failed' ? 'fail' : s.aiaState === 'fetching' ? 'active' : s.aiaState === 'retrieved' ? 'ok' : 'idle';
    case 'cdp': return s.revocationState === 'unavailable' ? 'fail' : s.revocationState === 'checking' ? 'active' : ['good', 'revoked'].includes(s.revocationState) ? 'ok' : 'idle';
    case 'chain': return ['incomplete', 'untrusted-root'].includes(s.chainState) ? 'fail' : s.chainState === 'building' ? 'active' : ['built', 'trusted-root'].includes(s.chainState) ? 'ok' : 'idle';
    case 'decision': return s.trustDecision === 'trusted' ? 'ok' : s.trustDecision === 'rejected' ? 'fail' : s.trustDecision === 'pending' ? 'active' : 'idle';
    default: return 'idle';
  }
}

// Status of the three chain cards (leaf, ICA, root) derived from state.
export function chainCardStatus(card, s) {
  if (s.chainState === 'none') return 'idle';
  const v = s.validation;
  if (card === 'leaf') {
    if ([v.name, v.dates, v.eku].includes('fail') || s.revocationState === 'revoked') return 'fail';
    if (v.name === 'pass' && s.revocationState === 'good') return 'ok';
    return s.chainState === 'building' ? 'active' : v.name === 'pass' ? 'ok' : 'idle';
  }
  if (card === 'ica') {
    if (s.chainState === 'incomplete') return 'fail';
    if (s.chainState === 'building') return 'active';
    return v.signatures === 'fail' ? 'fail' : 'ok';
  }
  if (s.chainState === 'incomplete') return 'idle';
  return v.root === 'fail' ? 'fail' : v.root === 'pass' ? 'ok' : s.chainState === 'building' ? 'idle' : 'active';
}
