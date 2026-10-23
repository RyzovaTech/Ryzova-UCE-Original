import type { AnalysisResult, Severity } from '../analyzer/types';
import { collectWorkspaceFindings } from './workspace';

export type UnifiedOrigin = 'UCE' | 'Trilogy' | 'Both';
export interface UnifiedBrowserFinding {
  id: string;
  title: string;
  origin: UnifiedOrigin;
  severity: Severity;
  domain: string;
  file: string;
  evidence: string;
  recommendation: string;
  verification: 'not-run';
  evidenceLevel: 'uce-rule' | 'uce-extracted-dependency' | 'uce-extracted-framework';
  evidenceStatus: 'report-reference' | 'extracted-metadata' | 'report-only';
  potentialImpact: string;
  sourceRefs: string[];
  sourceIssueIds: string[];
  contextOnly: boolean;
}
export interface UnifiedRootGroup {
  id: string;
  title: string;
  findingIds: string[];
  severity: Severity;
  disclaimer: string;
  recommendation: string;
}
export interface UnifiedBrowserReport {
  version: 1;
  originalScore: number;
  originalIssueCount: number;
  originalIssues: Array<{ id: string; title: string; severity: Severity; affectedFile: string; reason: string }>;
  omittedWorkspaceFindings: number;
  findings: UnifiedBrowserFinding[];
  rootGroups: UnifiedRootGroup[];
  ungroupedIds: string[];
  limitations: string[];
}

const rank = (s: Severity) => s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const clean = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 240;
const sourcePath = (value: unknown): value is string => clean(value) &&
  /^[a-zA-Z0-9_.@/-]+(?:#[-a-zA-Z0-9_.]+)?$/.test(value) &&
  value.split('#')[0].split('/').every(part => part !== '.' && part !== '..' && part.length > 0);
const evidencePath = (value: string) => value.split('#')[0];
const AUXILIARY_SCOPE = /(^|\/)(?:tools?|docs?|documentation|tests?|testing|fixtures?|examples?|samples?|benchmarks?|vendor|third_party|node_modules)(\/|$)/i;
const projectEvidencePath = (value: unknown): value is string =>
  sourcePath(value) && !AUXILIARY_SCOPE.test(evidencePath(value));
const keyOf = (f: UnifiedBrowserFinding) => [norm(f.domain), norm(f.title), norm(f.file), norm(f.evidence), f.severity].join('|');
const DOMAIN_TITLES: Record<string, string> = {
  runtime: 'Runtime & environment relationships',
  dependencies: 'Dependency declaration relationships',
  framework: 'Framework evidence & integration context',
  configuration: 'Configuration relationships',
  security: 'Security review signals',
  other: 'Other project findings',
};

/**
 * Browser-safe report enrichment. Does not parse/execute user source files,
 * perform native solver verification, mutate native UCE issues or rescore UCE.
 * Trilogy labels indicate independent *correlation/report interpretation*
 * of existing UCE-extracted metadata, NOT independent raw-source extraction.
 */
export function buildUnifiedBrowserReport(report: AnalysisResult): UnifiedBrowserReport {
  const workspaceFindings = collectWorkspaceFindings(report);
  const native = workspaceFindings.slice(0, 1000).map((f): UnifiedBrowserFinding => ({
    id: 'uce:' + f.id,
    title: f.title,
    origin: 'UCE',
    severity: f.severity,
    domain: f.module.includes('security') ? 'security'
      : f.module.includes('dependency') ? 'dependencies'
      : f.module.includes('runtime') ? 'runtime'
      : f.module.includes('configuration') ? 'configuration' : 'other',
    file: f.file,
    evidence: f.evidence,
    potentialImpact: f.description || 'Potential effect has not been established by execution.',
    evidenceStatus: sourcePath(f.file) ? 'report-reference' : 'report-only',
    recommendation: f.recommendation,
    verification: 'not-run',
    evidenceLevel: 'uce-rule',
    sourceRefs: sourcePath(f.file) ? [f.line && Number.isSafeInteger(f.line) && f.line > 0 && !f.file.includes('#') ? `${f.file}#L${f.line}` : f.file] : [],
    sourceIssueIds: [f.id],
    contextOnly: false,
  }));
  const additions: UnifiedBrowserFinding[] = [];
  const risks = report.stack.dependencyIntelligence?.risks ?? [];
  for (const [i, risk] of risks.slice(0, 64).entries()) {
    if (!projectEvidencePath(risk.source) || !clean(risk.name) ||
        !['wildcard', 'remote-source', 'version-conflict'].includes(risk.kind)) continue;
    additions.push({
      id: 'trilogy:dependency:' + i + ':' + risk.kind,
      title: 'Dependency declaration review: ' + risk.name.slice(0, 80),
      origin: 'Trilogy', severity: risk.severity, domain: 'dependencies',
      file: evidencePath(risk.source),
      evidence: risk.kind + ' declaration for ' + risk.name + ' (' + risk.version.slice(0, 100) + ')',
      evidenceStatus: 'extracted-metadata',
      potentialImpact: 'This declaration warrants dependency-resolution review; installation or runtime impact is unknown.',
      recommendation: risk.recommendation.slice(0, 500),
      verification: 'not-run', evidenceLevel: 'uce-extracted-dependency',
      sourceRefs: [risk.source], sourceIssueIds: [], contextOnly: false,
    });
  }
  const detections = report.stack.technologyDetections ?? [];
  for (const [i, detection] of detections.filter(d => d.kind === 'framework').slice(0, 24).entries()) {
    const ref = detection.evidence.find(e => projectEvidencePath(e.source));
    if (!ref || !clean(detection.name)) continue;
    additions.push({
      id: 'trilogy:framework:' + i + ':' + detection.id,
      title: 'Framework source evidence: ' + detection.name.slice(0, 80),
      origin: 'Trilogy', severity: 'info', domain: 'framework',
      file: evidencePath(ref.source),
      evidence: ref.description.slice(0, 400),
      evidenceStatus: 'extracted-metadata',
      potentialImpact: 'Framework presence is context only; compatibility impact is unknown.',
      recommendation: 'Inspect framework configuration and integration requirements before assuming compatibility.',
      verification: 'not-run', evidenceLevel: 'uce-extracted-framework',
      sourceRefs: detection.evidence.filter(e => projectEvidencePath(e.source)).slice(0, 6).map(e => e.source),
      sourceIssueIds: [], contextOnly: true,
    });
  }
  // Match category, title, file, evidence AND severity. A collision among UCE
  // records is ambiguous: never choose an arbitrary record to label Both.
  const findings = [...native];
  const seen = new Map<string, UnifiedBrowserFinding[]>();
  for (const item of native) {
    const key = keyOf(item);
    seen.set(key, [...(seen.get(key) ?? []), item]);
  }
  for (const item of additions) {
    const key = keyOf(item);
    const matches = seen.get(key) ?? [];
    const prior = matches.length === 1 && matches[0].origin === 'UCE' ? matches[0] : undefined;
    if (prior) {
      prior.origin = 'Both';
      prior.sourceIssueIds.push(item.id);
      prior.sourceRefs = [...new Set([...prior.sourceRefs, ...item.sourceRefs])];
    } else {
      // Distinct/ambiguous source records remain visible, never silently dropped.
      findings.push(item);
      seen.set(key, [...matches, item]);
    }
  }
  const groups = new Map<string, UnifiedBrowserFinding[]>();
  for (const finding of findings) {
    if (finding.contextOnly) continue; // contextual framework evidence is not a defect
    const domain = finding.domain in DOMAIN_TITLES ? finding.domain : 'other';
    const list = groups.get(domain) ?? [];
    list.push(finding);
    groups.set(domain, list);
  }
  const rootGroups = [...groups].filter(([, items]) => items.length >= 2).map(([domain, items]): UnifiedRootGroup => ({
    id: 'review-cluster:' + domain, title: DOMAIN_TITLES[domain],
    findingIds: items.map(f => f.id),
    severity: [...items].sort((a, b) => rank(a.severity) - rank(b.severity))[0].severity,
    disclaimer: 'Related review cluster based on category, NOT a confirmed shared root cause or formal proof.',
    recommendation: domain === 'dependencies'
      ? 'Inspect declaration sources and dependency paths before selecting an upgrade.'
      : domain === 'runtime' ? 'Compare runtime declarations, CI and deployment targets using complete source evidence.'
      : 'Inspect all linked evidence before proposing a common fix.',
  })).sort((a, b) => rank(a.severity) - rank(b.severity) || b.findingIds.length - a.findingIds.length);
  const grouped = new Set(rootGroups.flatMap(g => g.findingIds));
  return {
    version: 1, originalScore: report.score.overall,
    originalIssueCount: report.issues.length,
    originalIssues: report.issues.map(issue => ({ id: issue.id, title: issue.title,
      severity: issue.severity, affectedFile: issue.affectedFile, reason: issue.reason })),
    omittedWorkspaceFindings: Math.max(0, workspaceFindings.length - native.length),
    findings: findings.sort((a, b) => rank(a.severity) - rank(b.severity) || a.id.localeCompare(b.id)),
    rootGroups, ungroupedIds: findings.filter(f => !grouped.has(f.id)).map(f => f.id),
    limitations: [
      'Root-cause groups are investigation clusters, not established causal explanations.',
      'Browser Trilogy context is derived from UCE-extracted metadata; it does not independently parse raw files.',
      'Framework evidence is informational context, not a compatibility warning.',
      'No Souffle, Z3 or cvc5 proof was run; all verification is not-run.',
      'Evidence status describes report provenance, not independently checked source bytes or calibrated confidence.',
      'Potential impact is an investigation hypothesis, not an observed build, installation or runtime result.',
      'A separate original-issue record view preserves every raw UCE issue, including records deduplicated by the existing workspace helper.',
      'The browser limits workspace enrichments to 1000; omitted counts are disclosed and all original issue records remain accessible.',
      'The original UCE issue records and score are unchanged.',
    ],
  };
}