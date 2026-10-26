import type { AnalysisResult, Severity } from '../analyzer/types';
import { describeReportReadiness } from './readiness';

export interface WorkspaceFinding {
  id: string;
  title: string;
  severity: Severity;
  module: string;
  file: string;
  line?: number;
  description: string;
  evidence: string;
  recommendation: string;
  ruleId?: string;
  /** The exact V3 pack that emitted this observation, never inferred from its title. */
  packId?: string;
  confidence?: number | string;
  scope?: string;
  falsePositivePossible?: boolean;
}

export interface FindingGroup {
  key: string;
  module: string;
  title: string;
  severity: Severity;
  findings: WorkspaceFinding[];
}

export interface ScanComparison {
  currentId: string;
  baselineId: string;
  /** Null when either scan has incomplete scope; a numeric delta would mislead. */
  scoreDelta: number | null;
  scoreComparable: boolean;
  resolutionComparable: boolean;
  newFindings: WorkspaceFinding[];
  resolvedFindings: WorkspaceFinding[];
  persistingFindings: WorkspaceFinding[];
  categoryDeltas: Array<{ id: string; label: string; current: number | null; baseline: number | null; delta: number | null }>;
}

export interface ReportReviewState {
  version: 1;
  reviewed: string[];
  suppressed: string[];
  updatedAt: string;
}

export function collectWorkspaceFindings(report: AnalysisResult): WorkspaceFinding[] {
  // Batch issues mirror canonical module findings. Preserve orphaned issues in older reports.
  const mirrored = new Set([
    ...(report.stack.securityIntelligence?.findings ?? []).map(item => `batch-security:${item.id}`),
    ...(report.stack.browserCompatibility?.findings ?? []).map(item => `batch-browser:${item.file}:${item.id}:${item.affectedBrowsers.join(',')}`),
  ]);
  // Only remove generated security mirrors if their canonical source exists.
  // Legacy/orphaned security-intelligence-* issues remain reviewable.
  const securityMirrors = new Set((report.stack.securityIntelligence?.findings ?? [])
    .map(item => `security-intelligence-${item.ruleId ?? item.title}`));
  const findings: WorkspaceFinding[] = report.issues.filter((item) => !securityMirrors.has(item.id) && !mirrored.has(item.id)).map((item) => ({
    id: `compatibility:${item.id}`,
    title: item.title,
    severity: item.severity,
    module: item.category,
    ...issueLocation(item.affectedFile),
    description: item.description,
    evidence: item.reason,
    recommendation: item.suggestedAction || item.recommendation,
  }));

  for (const item of report.stack.securityIntelligence?.findings ?? []) {
    findings.push({
      id: `security:${item.id}`,
      title: item.title,
      severity: item.severity,
      module: item.category ? `security/${item.category}` : 'security',
      file: item.file,
      line: item.line,
      description: 'Static security-sensitive pattern requiring developer review.',
      evidence: item.evidence,
      recommendation: item.recommendation,
      ruleId: item.ruleId,
      confidence: item.confidence,
      scope: item.scope,
      falsePositivePossible: item.falsePositivePossible,
    });
  }

  for (const module of Object.values(report.stack.extendedIntelligence?.modules ?? {})) {
    for (const item of module.findings) {
      findings.push({
        id: `intelligence:${module.id}:${item.id}`,
        title: item.title,
        severity: item.severity,
        module: module.id,
        file: item.file ?? 'Project-wide',
        line: item.line,
        description: module.summary,
        evidence: item.evidence,
        recommendation: item.recommendation,
        ruleId: item.id,
        confidence: item.confidence,
      });
    }
  }

  for (const [index, item] of (report.stack.browserCompatibility?.findings ?? []).entries()) {
    findings.push({
      id: `browser:${item.id ?? item.feature}:${index}`,
      title: `${item.feature} browser support`,
      severity: item.status === 'unsupported' ? 'warning' : 'info',
      module: 'browser',
      file: item.file,
      line: item.line,
      description: `${item.status} for ${item.affectedBrowsers.join(', ')}`,
      evidence: `${item.kind} feature detected against configured browser targets.`,
      recommendation: item.recommendation,
      ruleId: item.id,
    });
  }

  // Phase 2/3 and newer V3 packs have the same provenance and review rights
  // as Phase 4/5. Never silently discard a pack based on its naming convention.
  for (const [index, item] of (report.stack.v3RulePlatform?.findings ?? []).entries()) {
    findings.push({
      id: 'v3:' + item.packId + ':' + item.ruleId + ':' + item.file + ':' + (item.line ?? 0) + ':' + index,
      title: item.title, severity: item.severity, module: 'v3/' + item.module,
      file: item.file, line: item.line,
      description: 'Evidence-linked static review signal; runtime behavior and impact are not proven.',
      evidence: item.evidence.map(evidence => evidence.detail + (evidence.relatedFile ? ' (related: ' + evidence.relatedFile + (evidence.relatedLine ? ':' + evidence.relatedLine : '') + ')' : '')).join('; '),
      recommendation: item.recommendation, ruleId: item.ruleId, packId: item.packId,
      confidence: item.confidence,
      falsePositivePossible: true,
    });
  }

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = findingFingerprint(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupWorkspaceFindings(findings: WorkspaceFinding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const finding of findings) {
    const key = `${finding.module}|${normalize(finding.title)}|${finding.severity}`;
    const current = groups.get(key);
    if (current) current.findings.push(finding);
    else groups.set(key, { key, module: finding.module, title: finding.title, severity: finding.severity, findings: [finding] });
  }
  return [...groups.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.findings.length - a.findings.length);
}

export function compareReports(current: AnalysisResult, baseline: AnalysisResult): ScanComparison {
  const currentFindings = collectWorkspaceFindings(current);
  const baselineFindings = collectWorkspaceFindings(baseline);
  const currentByKey = new Map(currentFindings.map((item) => [findingFingerprint(item), item]));
  const baselineByKey = new Map(baselineFindings.map((item) => [findingFingerprint(item), item]));
  const currentPartial = describeReportReadiness(current).partial;
  const baselinePartial = describeReportReadiness(baseline).partial;
  const comparable = !currentPartial && !baselinePartial &&
    current.classification?.isSoftware !== false && baseline.classification?.isSoftware !== false;
  const baselineCategories = new Map(baseline.categories.map(item => [item.id, item]));

  return {
    currentId: current.id,
    baselineId: baseline.id,
    scoreDelta: comparable ? current.score.overall - baseline.score.overall : null,
    scoreComparable: comparable,
    resolutionComparable: comparable,
    newFindings: currentFindings.filter((item) => !baselineByKey.has(findingFingerprint(item))),
    // A missing finding in a partial scan is not evidence of remediation.
    resolvedFindings: comparable ? baselineFindings.filter((item) => !currentByKey.has(findingFingerprint(item))) : [],
    persistingFindings: currentFindings.filter((item) => baselineByKey.has(findingFingerprint(item))),
    categoryDeltas: current.categories.map((item) => {
      const prior = baselineCategories.get(item.id);
      const bothAssessed = comparable && item.status !== 'unknown' && prior?.status !== 'unknown' && !!prior &&
        (current.score.applicableCategories?.includes(item.id) ?? true) &&
        (baseline.score.applicableCategories?.includes(item.id) ?? true);
      return { id: item.id, label: item.label,
        current: bothAssessed ? item.score : null,
        baseline: bothAssessed ? prior.score : null,
        delta: bothAssessed ? item.score - prior.score : null };
    }),
  };
}

export function findingFingerprint(finding: WorkspaceFinding): string {
  // Strong report identity: distinct rules, evidence, severity and locations
  // remain independent even when title and file are identical.
  // V3 array-index display IDs are intentionally excluded for cross-scan stability.
  return JSON.stringify([
    finding.module, finding.packId ?? '', finding.ruleId ?? finding.id,
    normalize(finding.file), finding.line ?? 0, finding.severity,
    normalize(finding.title), normalize(finding.evidence),
    normalize(finding.description), normalize(finding.recommendation),
  ]);
}

export function compatibleProjectReports(current: AnalysisResult, reports: AnalysisResult[]): AnalysisResult[] {
  const name = normalize(current.summary.name);
  return reports.filter((item) => item.id !== current.id && normalize(item.summary.name) === name).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function normalize(value: string): string { return value.trim().toLowerCase().replace(/\\/g, '/').replace(/\s+/g, ' '); }
function severityRank(value: Severity): number { return value === 'critical' ? 0 : value === 'warning' ? 1 : 2; }

/** Legacy issues encode a line after the path; do not strip drive letters or numeric basenames. */
function issueLocation(value: string): { file: string; line?: number } {
  const match = /^(.*\.[^/\\:]+):(\d+)$/.exec(value);
  const line = match ? Number(match[2]) : 0;
  return match && Number.isSafeInteger(line) && line > 0 ? { file: match[1], line } : { file: value };
}
