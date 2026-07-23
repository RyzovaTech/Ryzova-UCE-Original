import type { CategoryResult, Issue } from '../../analyzer/types';

export function buildRecommendations(categories: CategoryResult[]): string[] {
  const recs: string[] = [];
  const critical = categories.flatMap((c) => c.issues).filter((i) => i.severity === 'critical');
  const warnings = categories.flatMap((c) => c.issues).filter((i) => i.severity === 'warning');

  if (critical.length) {
    recs.push(`Resolve ${critical.length} critical issue${critical.length > 1 ? 's' : ''} before deploying — these block runtime or security.`);
  }
  if (warnings.length) {
    recs.push(`Address ${warnings.length} warning${warnings.length > 1 ? 's' : ''} to improve long-term maintainability.`);
  }
  const lowest = [...categories].sort((a, b) => a.score - b.score)[0];
  if (lowest && lowest.score < 90) {
    recs.push(`Focus on the ${lowest.label} category next — it has the lowest score (${lowest.score}).`);
  }
  if (recs.length === 0) {
    recs.push('No action required — the project passes all deterministic compatibility checks.');
  }
  return recs;
}

export function sortIssues(issues: Issue[], by: 'severity' | 'category' | 'file'): Issue[] {
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const copy = [...issues];
  if (by === 'severity') copy.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  else if (by === 'category') copy.sort((a, b) => a.category.localeCompare(b.category));
  else copy.sort((a, b) => a.affectedFile.localeCompare(b.affectedFile));
  return copy;
}
