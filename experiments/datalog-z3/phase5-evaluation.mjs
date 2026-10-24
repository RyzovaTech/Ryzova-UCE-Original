/**
 * Phase 5.5 read-only engineering audit of an existing CLI scan result.
 * Does not parse or run project files, generate fixes, alter UCE outputs,
 * execute a solver, or assign real-world accuracy/confidence percentages.
 *
 * Accepts ONLY bounded in-memory original UCE report metadata and the
 * already-generated Phase 5 scan result; source content is not required.
 */
const MAX_ORIGINALS = 512;
const MAX_FINDINGS = 1024;
const MAX_FLAGS = 64;
const MAX_REVIEW = 64;
const severity = new Set(['critical', 'warning', 'info']);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sourceRef = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 240 && /^[A-Za-z0-9_.@\/-]+(?:#[^\s#]{1,120})?$/.test(value) &&
  value.split('#')[0].split('/').every(p => p && p !== '.' && p !== '..');

function empty(reason) {
  return {
    version: 1, structuralStatus: 'unknown', graphCoverage: 'unknown',
    originalScoreParity: 'unknown', originalIssueParity: 'unknown',
    reason, counts: null, flags: [], reviewQueue: [],
    accuracy: { falsePositiveRate: null, falseMergeRate: null,
      usefulNewFindingRate: null, recommendationCorrectnessRate: null,
      state: 'not-measured-needs-independent-labels' },
    limitations: ['A structural audit is not proof of correctness, usefulness, causality or runtime behavior.'],
  };
}

/** Check source-record preservation, conservative fusion and evidence traceability. */
export function evaluatePhase5Intelligence(original, unified) {
  if (!record(original) || !Array.isArray(original.issues) ||
      original.issues.length > MAX_ORIGINALS || !record(original.score) ||
      !Number.isFinite(original.score.overall) || !record(unified) ||
      unified.version !== 1 || !['ok', 'partial'].includes(unified.status) ||
      !Array.isArray(unified.findings) || unified.findings.length > MAX_FINDINGS ||
      !Array.isArray(unified.rootCauses) || unified.rootCauses.length > 128 ||
      !Array.isArray(unified.patchTargets) || unified.patchTargets.length > 64) {
    return empty('invalid-or-over-budget-report-or-unified-result');
  }
  const issues = original.issues;
  const findings = unified.findings;
  const flags = [];
  let truncatedFlags = 0;
  const flag = (code, id = '') => {
    if (flags.length < MAX_FLAGS) flags.push({ code, id: String(id).slice(0, 100) });
    else truncatedFlags++;
  };
  const ids = new Set();
  for (const issue of issues) {
    if (!record(issue) || typeof issue.id !== 'string' ||
        !issue.id || issue.id.length > 100 ||
        !severity.has(issue.severity)) {
      flag('invalid-original-issue-id-or-severity');
      continue;
    }
    if (ids.has(issue.id)) flag('ambiguous-original-issue-id', issue.id);
    ids.add(issue.id);
  }
  const originalScoreParity = Object.is(unified.originalScore, original.score.overall)
    ? 'preserved' : 'mismatch';
  const originalIssueParity = unified.originalIssueCount === issues.length
    ? 'preserved' : 'mismatch';
  if (originalScoreParity === 'mismatch') flag('original-score-mismatch');
  if (originalIssueParity === 'mismatch') flag('original-issue-count-mismatch');

  let uceOnly = 0, trilogyOnly = 0, both = 0, contextual = 0;
  let sourceLinked = 0, missingSource = 0, invalidSource = 0;
  const byOriginal = new Map([...ids].map(id => [id, []]));
  const reviewQueue = [];
  const seenFindings = new Set();
  for (const finding of findings) {
    if (!record(finding) || typeof finding.id !== 'string' ||
        !finding.id || finding.id.length > 200 ||
        !['UCE', 'Trilogy', 'Both'].includes(finding.origin)) {
      flag('invalid-finding-record');
      continue;
    }
    if (seenFindings.has(finding.id)) flag('duplicate-finding-id', finding.id);
    seenFindings.add(finding.id);
    if (!severity.has(finding.severity)) flag('invalid-finding-severity', finding.id);
    if (finding.verification !== 'not-run') flag('unsubstantiated-verification-claim', finding.id);
    if (finding.origin === 'UCE') uceOnly++;
    if (finding.origin === 'Trilogy') trilogyOnly++;
    if (finding.origin === 'Both') both++;
    if (finding.contextOnly === true) contextual++;
    const native = finding.origin === 'UCE' || finding.origin === 'Both';
    const refs = finding.evidenceRefs;
    if (!Array.isArray(refs) || refs.length > 64 ||
        refs.some(ref => !sourceRef(ref))) {
      if (native && (refs === undefined || Array.isArray(refs) && refs.length === 0)) {
        // Source references are not required for original UCE issues.
      } else {
        invalidSource++;
        flag('invalid-source-provenance', finding.id);
      }
    } else if (refs.length === 0) {
      if (!native) {
        missingSource++;
        flag('trilogy-finding-lacks-source-reference', finding.id);
      }
    } else {
      sourceLinked++;
    }
    if (native) {
      if (!Array.isArray(finding.sourceIssueIds) ||
          finding.sourceIssueIds.length !== 1 ||
          !byOriginal.has(finding.sourceIssueIds[0])) {
        flag('missing-or-ambiguous-original-record-link', finding.id);
      } else {
        byOriginal.get(finding.sourceIssueIds[0]).push(finding);
      }
    } else if (Array.isArray(finding.sourceIssueIds) && finding.sourceIssueIds.length) {
      flag('trilogy-record-claims-native-id', finding.id);
    }
    if (finding.origin === 'Both' &&
        (!Array.isArray(finding.relatedTrilogyIds) ||
         finding.relatedTrilogyIds.length === 0)) {
      flag('merged-finding-lacks-trilogy-correlation-id', finding.id);
    }
    if (finding.origin !== 'UCE' && reviewQueue.length < MAX_REVIEW) {
      reviewQueue.push({ findingId: finding.id, origin: finding.origin,
        evidenceStatus: Array.isArray(refs) && refs.length &&
          refs.every(sourceRef) ? 'source-references-present' : 'review-provenance',
        review: 'independent-adjudication-required' });
    }
  }
  for (const issue of issues) {
    if (!record(issue) || typeof issue.id !== 'string') continue;
    const matched = byOriginal.get(issue.id) ?? [];
    if (matched.length !== 1) {
      flag('original-record-not-preserved-exactly-once', issue.id);
      continue;
    }
    const f = matched[0];
    if (f.severity !== issue.severity ||
        f.title !== (typeof issue.title === 'string' ? issue.title.slice(0, 200) : 'Unnamed UCE issue') ||
        f.file !== (typeof issue.affectedFile === 'string' ? issue.affectedFile.slice(0, 200) : '')) {
      flag('original-record-content-or-severity-drift', issue.id);
    }
  }
  const knownIds = new Set(findings.filter(record).map(f => f.id));
  for (const group of unified.rootCauses) {
    if (!record(group) || !Array.isArray(group.findingIds) ||
        group.findingIds.length > MAX_FINDINGS ||
        group.findingIds.some(id => !knownIds.has(id))) {
      flag('invalid-investigation-cluster-link');
    }
    if (record(group) && group.proofStatus !== 'not-run') {
      flag('unsubstantiated-cluster-proof-claim', group.id);
    }
  }
  if (unified.status === 'partial' && (trilogyOnly > 0 || both > 0 ||
      unified.patchTargets.length > 0 || unified.rootCauses.length > 0)) {
    flag('partial-graph-claims-extra-intelligence-or-patch');
  }
  const structuralStatus = flags.length || truncatedFlags ? 'review-required' : 'passed';
  return {
    version: 1, structuralStatus,
    graphCoverage: unified.status === 'ok' && unified.graphStatus === 'ok'
      ? 'bounded-modeled-graph' : 'unknown',
    originalScoreParity, originalIssueParity, reason: '',
    counts: { originalIssues: issues.length, unifiedFindings: findings.length,
      uceOnly, trilogyOnly, both, contextual,
      sourceLinked, trilogyWithoutSource: missingSource,
      invalidSource, linkedReviewCandidates: reviewQueue.length,
      truncatedReviewCandidates: Math.max(0, trilogyOnly + both - reviewQueue.length),
      flagsTruncated: truncatedFlags },
    flags, reviewQueue,
    accuracy: { falsePositiveRate: null, falseMergeRate: null,
      usefulNewFindingRate: null, recommendationCorrectnessRate: null,
      state: 'not-measured-needs-independent-labels' },
    limitations: [
      'Structural parity does not establish that findings are true, useful or representative.',
      'Evidence references are syntactically checked, not verified against original file bytes.',
      'Both labels and source-backed relationships require independent human adjudication.',
      'No code execution, native formal proof, patch generation or report mutation occurs here.',
      'Unknown graph coverage is not clean compatibility or a zero false-positive rate.',
    ],
  };
}
