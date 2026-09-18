import type { IntelligenceInsight, TechnologyStack } from './types';

export function buildCorrelatedInsights(stack: TechnologyStack): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = [];
  const add = (item: IntelligenceInsight) => { if (!insights.some((existing) => existing.id === item.id)) insights.push(item); };
  const criticalSecurity = stack.securityIntelligence?.findings.filter((finding) => finding.severity === 'critical') ?? [];
  if (criticalSecurity.length) add({ id: 'security-critical', domain: 'security', title: `${criticalSecurity.length} critical security signal${criticalSecurity.length === 1 ? '' : 's'} require review`, severity: 'critical', confidence: 95, evidence: criticalSecurity.slice(0, 5).map((finding) => `${finding.ruleId ?? finding.id} at ${finding.file}:${finding.line}`), recommendation: 'Review critical findings before deployment and rotate any exposed credentials.' });
  const browser = stack.browserCompatibility;
  if (browser?.findings.length) add({ id: 'browser-target-gaps', domain: 'browser', title: 'Detected features exceed configured browser targets', severity: 'warning', confidence: browser.defaultTargetsUsed ? 70 : 92, evidence: browser.findings.slice(0, 5).map((finding) => `${finding.feature}: ${finding.affectedBrowsers.join(', ')}`), recommendation: 'Add feature detection, fallbacks, or update the documented browser support policy.' });
  const risks = stack.dependencyIntelligence?.risks ?? [];
  if (risks.length) add({ id: 'dependency-risk', domain: 'dependencies', title: `${risks.length} dependency declaration risk${risks.length === 1 ? '' : 's'} detected`, severity: 'warning', confidence: 90, evidence: risks.slice(0, 5).map((risk) => `${risk.name} (${risk.kind}) in ${risk.source}`), recommendation: 'Resolve version conflicts and replace mutable or remote dependency declarations.' });
  const cycles = stack.codeIntelligence?.quality.circularDependencies ?? [];
  if (cycles.length) add({ id: 'architecture-cycles', domain: 'architecture', title: `${cycles.length} internal dependency cycle${cycles.length === 1 ? '' : 's'} detected`, severity: 'warning', confidence: 88, evidence: cycles.slice(0, 3).map((cycle) => cycle.join(' → ')), recommendation: 'Extract shared contracts or invert dependencies to remove cycles.' });
  const large = stack.codeIntelligence?.quality.largeFunctions ?? [];
  if (large.length) add({ id: 'large-functions', domain: 'quality', title: `${large.length} large function${large.length === 1 ? '' : 's'} detected`, severity: 'info', confidence: 80, evidence: large.slice(0, 5).map((item) => `${item.file}:${item.line}${item.lines ? ` (${item.lines} lines)` : ''}`), recommendation: 'Review function responsibilities and extract cohesive units where useful.' });
  const testing = stack.capabilities?.find((capability) => capability.id === 'testing');
  if (!testing && (stack.codeIntelligence?.filesAnalyzed ?? 0) >= 10) add({ id: 'testing-not-detected', domain: 'testing', title: 'No testing capability was detected', severity: 'info', confidence: 65, evidence: [`${stack.codeIntelligence?.filesAnalyzed ?? 0} production source files analyzed`], recommendation: 'Confirm the test setup or add automated coverage for critical behavior.' });
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return insights.sort((a, b) => order[a.severity] - order[b.severity] || b.confidence - a.confidence);
}
