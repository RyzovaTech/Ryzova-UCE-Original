import type { AnalysisResult, Severity } from '../analyzer/types';

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
  confidence?: number | string;
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
  scoreDelta: number;
  newFindings: WorkspaceFinding[];
  resolvedFindings: WorkspaceFinding[];
  persistingFindings: WorkspaceFinding[];
  categoryDeltas: Array<{ id: string; label: string; current: number; baseline: number; delta: number }>;
}

export interface ReportReviewState {
  version: 1;
  reviewed: string[];
  suppressed: string[];
  updatedAt: string;
}

export function collectWorkspaceFindings(report: AnalysisResult): WorkspaceFinding[] {
  const findings: WorkspaceFinding[] = report.issues.map((item) => ({
    id: `compatibility:${item.id}`,
    title: item.title,
    severity: item.severity,
    module: item.category,
    file: item.affectedFile,
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
  const baselineCategories = new Map(baseline.categories.map((item) => [item.id, item.score]));

  return {
    currentId: current.id,
    baselineId: baseline.id,
    scoreDelta: current.score.overall - baseline.score.overall,
    newFindings: currentFindings.filter((item) => !baselineByKey.has(findingFingerprint(item))),
    resolvedFindings: baselineFindings.filter((item) => !currentByKey.has(findingFingerprint(item))),
    persistingFindings: currentFindings.filter((item) => baselineByKey.has(findingFingerprint(item))),
    categoryDeltas: current.categories.map((item) => {
      const baselineScore = baselineCategories.get(item.id) ?? item.score;
      return { id: item.id, label: item.label, current: item.score, baseline: baselineScore, delta: item.score - baselineScore };
    }),
  };
}

export function findingFingerprint(finding: WorkspaceFinding): string {
  return [finding.module, normalize(finding.title), normalize(finding.file), finding.line ?? 0].join('|');
}

export function compatibleProjectReports(current: AnalysisResult, reports: AnalysisResult[]): AnalysisResult[] {
  const name = normalize(current.summary.name);
  return reports.filter((item) => item.id !== current.id && normalize(item.summary.name) === name).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function normalize(value: string): string { return value.trim().toLowerCase().replace(/\\/g, '/').replace(/\s+/g, ' '); }
function severityRank(value: Severity): number { return value === 'critical' ? 0 : value === 'warning' ? 1 : 2; }
