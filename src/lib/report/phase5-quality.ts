import type { AnalysisResult } from '../analyzer/types';
import type { UnifiedBrowserReport } from './unified-intelligence';

export interface BrowserQualityFlag {
  code: string;
  findingId?: string;
}
export interface BrowserQualityReviewCandidate {
  id: string;
  origin: 'Trilogy' | 'Both';
  severity: 'critical' | 'warning' | 'info';
  evidence: 'source-reference' | 'missing-or-unsafe';
}
export interface BrowserSymbolicSnapshot {
  localStatus: 'recorded' | 'not-available';
  conflict: number | null;
  satisfiable: number | null;
  unknown: number | null;
  limited: boolean | null;
  solverStatus: string;
  solverVerification: 'not-run' | 'reported-independent-smt-agreement';
  diagnosticSource: 'saved-report-only' | 'none';
}
export interface BrowserQualityAudit {
  version: 1;
  scope: 'browser-derived-report-only';
  status: 'passed-structural-checks' | 'review-required' | 'unknown';
  graphCoverage: 'bounded-report' | 'unknown';
  scoreParity: 'preserved' | 'mismatch' | 'unknown';
  originalIssueParity: 'preserved' | 'mismatch' | 'unknown';
  counts: {
    uce: number; trilogy: number; both: number; contextOnly: number;
    missingTrilogySources: number; omittedWorkspaceFindings: number;
    candidatesTotal: number; candidatesShown: number;
  };
  flags: BrowserQualityFlag[];
  additionalFlagsOmitted: number;
  reviewQueue: BrowserQualityReviewCandidate[];
  accuracy: {
    falsePositiveRate: null;
    falseMergeRate: null;
    usefulFindingRate: null;
    recommendationCorrectness: null;
    state: 'not-measured';
  };
  symbolic: BrowserSymbolicSnapshot;
  limitations: string[];
}

const SOURCE_REFERENCE = new RegExp('^[A-Za-z0-9_.@/-]+(?:#[A-Za-z0-9_.-]+)?$');
const sourceRef = (ref: string) => ref.length > 0 && ref.length <= 240 &&
  SOURCE_REFERENCE.test(ref) &&
  ref.split('#')[0].split('/').every(part => !!part && part !== '.' && part !== '..');
const rank = (level: string) => level === 'critical' ? 0 : level === 'warning' ? 1 : 2;
const MAX_FLAGS = 64;
const MAX_REVIEW = 40;

function symbolicSnapshot(report: AnalysisResult): BrowserSymbolicSnapshot {
  const local = report.stack?.symbolicReasoning;
  const counts = local?.counts;
  const valid = !!counts && ['conflict', 'satisfiable', 'unknown'].every(key => {
    const n = counts[key as keyof typeof counts];
    return Number.isSafeInteger(n) && n >= 0;
  });
  // Native Trilogy is not part of the browser-only production integration.
  // Read optional historical diagnostics structurally, never import a solver.
  const saved = (report as AnalysisResult & { optionalSolver?: {
    status: 'disabled' | 'skipped' | 'unknown' | 'conflict' | 'satisfiable';
    enabled: boolean; attempted: boolean; verification: string;
  } }).optionalSolver;
  // Saved diagnostics can be displayed as historical metadata only. A
  // browser report NEVER executes a solver or upgrades static findings.
  return {
    localStatus: valid ? 'recorded' : 'not-available',
    conflict: valid && counts ? counts.conflict : null,
    satisfiable: valid && counts ? counts.satisfiable : null,
    unknown: valid && counts ? counts.unknown : null,
    limited: typeof local?.limited === 'boolean' ? local.limited : null,
    solverStatus: saved?.status ?? 'not-run',
    solverVerification: saved?.enabled && saved?.attempted &&
      saved?.verification === 'independent-smt-agreement' &&
      (saved.status === 'conflict' || saved.status === 'satisfiable')
      ? 'reported-independent-smt-agreement' : 'not-run',
    diagnosticSource: saved ? 'saved-report-only' : 'none',
  };
}

/**
 * Browser-report-specific structural check, NOT the independent Node CLI
 * evaluator. Saved UCE summaries have no original project source bytes, so
 * no full dependency graph, solver proof or statistical accuracy is inferred.
 * Does not mutate report/model or execute user-supplied code.
 */
export function evaluateBrowserQuality(
  report: AnalysisResult, model: UnifiedBrowserReport,
): BrowserQualityAudit {
  const flags: BrowserQualityFlag[] = [];
  let additionalFlagsOmitted = 0;
  const flag = (code: string, findingId?: string) => {
    if (flags.length < MAX_FLAGS) flags.push(findingId ? { code, findingId } : { code });
    else additionalFlagsOmitted++;
  };
  const raw = Array.isArray(report.issues) ? report.issues : null;
  const saved = Array.isArray(model.originalIssues) ? model.originalIssues : null;
  const scoreParity = !Number.isFinite(report.score?.overall) ||
    !Number.isFinite(model.originalScore) ? 'unknown' :
      Object.is(model.originalScore, report.score.overall) ? 'preserved' : 'mismatch';
  const originalIssueParity = !raw || !saved ? 'unknown' :
    saved.length === raw.length && model.originalIssueCount === raw.length &&
    saved.every((item, i) => item.id === raw[i]?.id && item.title === raw[i]?.title &&
      item.severity === raw[i]?.severity &&
      item.affectedFile === raw[i]?.affectedFile &&
      item.reason === raw[i]?.reason) ? 'preserved' : 'mismatch';
  if (scoreParity === 'mismatch') flag('original-score-mismatch');
  if (originalIssueParity === 'mismatch') flag('original-issue-record-drift');
  const rawIds = new Set<string>();
  for (const original of raw ?? []) {
    if (typeof original.id !== 'string' || !original.id || rawIds.has(original.id))
      flag('ambiguous-original-issue-id');
    else rawIds.add(original.id);
  }
  const incomplete = report.summary?.analysisCoverage?.status === 'partial' ||
    report.summary?.scanStats?.truncated === true ||
    report.summary?.scanStats?.sampled === true ||
    report.summary?.scanStats?.findingsLimited === true ||
    Boolean(report.summary?.scanStats?.ruleFailures?.length) ||
    Boolean(report.stack?.securityIntelligence?.truncated) ||
    Boolean(report.stack?.v3RulePlatform?.metrics?.some(m => m.truncated)) ||
    Boolean(report.stack?.v3RulePlatform?.archiveSweep?.findingsOmitted) ||
    report.stack?.v3RulePlatform?.archiveSweep?.complete === false;
  const graphCoverage = incomplete || !report.summary?.analysisCoverage
    ? 'unknown' : 'bounded-report';
  const seen = new Set<string>();
  const candidates: BrowserQualityReviewCandidate[] = [];
  const counts = {
    uce: 0, trilogy: 0, both: 0, contextOnly: 0,
    missingTrilogySources: 0, omittedWorkspaceFindings: model.omittedWorkspaceFindings,
    candidatesTotal: 0, candidatesShown: 0,
  };
  const list = Array.isArray(model.findings) ? model.findings : [];
  for (const finding of list) {
    if (seen.has(finding.id)) flag('duplicate-derived-finding-id', finding.id);
    seen.add(finding.id);
    if (finding.origin === 'UCE') counts.uce++;
    else if (finding.origin === 'Trilogy') counts.trilogy++;
    else if (finding.origin === 'Both') counts.both++;
    else flag('invalid-finding-origin', finding.id);
    if (finding.contextOnly) counts.contextOnly++;
    if (finding.verification !== 'not-run')
      flag('unsupported-browser-proof-claim', finding.id);
    const validSources = Array.isArray(finding.sourceRefs) &&
      finding.sourceRefs.length > 0 && finding.sourceRefs.every(sourceRef);
    if (Array.isArray(finding.sourceRefs) &&
        finding.sourceRefs.some(ref => !sourceRef(ref))) {
      flag('invalid-source-reference', finding.id);
    }
    if (finding.origin === 'Trilogy' && !validSources) {
      counts.missingTrilogySources++;
      flag('trilogy-evidence-reference-missing', finding.id);
    }
    const sourceIds = Array.isArray(finding.sourceIssueIds) ?
      finding.sourceIssueIds.filter((id): id is string => typeof id === 'string') : [];
    if (finding.origin === 'Both') {
      const independent = sourceIds.filter(id => id.startsWith('trilogy:'));
      const native = sourceIds.filter(id => !id.startsWith('trilogy:'));
      if (independent.length !== 1 || native.length !== 1 ||
          sourceIds.length !== 2 || !validSources)
        flag('ambiguous-both-record-provenance', finding.id);
    } else if (finding.origin === 'UCE' &&
      (sourceIds.length !== 1 || finding.id !== 'uce:' + sourceIds[0])) {
      flag('ambiguous-uce-derived-record-link', finding.id);
    } else if (finding.origin === 'Trilogy' && sourceIds.length !== 0) {
      flag('trilogy-record-claims-native-link', finding.id);
    }
    if (finding.origin !== 'UCE') {
      counts.candidatesTotal++;
      candidates.push({
        id: finding.id, origin: finding.origin, severity: finding.severity,
        evidence: validSources ? 'source-reference' : 'missing-or-unsafe',
      });
    }
  }
  const ids = new Set(list.map(item => item.id));
  for (const group of model.rootGroups ?? []) {
    if (group.findingIds.some(id => !ids.has(id)))
      flag('unresolved-investigation-link', group.id);
  }
  for (const id of model.ungroupedIds ?? []) {
    if (!ids.has(id)) flag('unresolved-ungrouped-link', id);
  }
  const reviewQueue = candidates.sort((a, b) =>
    rank(a.severity) - rank(b.severity) || a.id.localeCompare(b.id)).slice(0, MAX_REVIEW);
  counts.candidatesShown = reviewQueue.length;
  const status = scoreParity === 'unknown' || originalIssueParity === 'unknown'
    ? 'unknown' : flags.length || additionalFlagsOmitted
      ? 'review-required' : 'passed-structural-checks';
  return {
    version: 1, scope: 'browser-derived-report-only', status, graphCoverage,
    scoreParity, originalIssueParity, counts, flags, additionalFlagsOmitted,
    reviewQueue,
    accuracy: {
      falsePositiveRate: null, falseMergeRate: null,
      usefulFindingRate: null, recommendationCorrectness: null,
      state: 'not-measured',
    },
    symbolic: symbolicSnapshot(report),
    limitations: [
      'Browser audit checks saved report structure, not the independent CLI evaluation or raw source bytes.',
      'Source references have not been re-opened, hashed or human-adjudicated.',
      'Partial or unavailable coverage cannot be treated as proof of an issue-free project.',
      'Trilogy browser additions use existing UCE-extracted metadata, not independent raw-file discovery.',
      'Source-backed relationships and root-cause clusters are not causal or application proofs.',
      'A recorded symbolic satisfiable decision is not a successful build or runtime test.',
      'Saved optional SMT diagnostics are not re-run or authenticated by this browser view.',
      'False-positive, false-merge and recommendation-correctness rates require independent labels.',
    ],
  };
}
