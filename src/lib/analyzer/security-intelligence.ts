import type { ProjectFile, SecurityFinding, SecurityIntelligence, SecurityRuleCategory } from './types';
import { SECURITY_KNOWLEDGE_VERSION, SECURITY_RULES, validateSecurityRules } from './security-knowledge';

const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|go|rs|php|rb|ex|exs|dart|swift|scala|cs|c|cc|cpp|h|hpp|zig|lua|jl|r|cr|nim|sol|v|erl|hrl)$/i;
const INTERNAL_PATH_RE = /(^|\/)(src\/lib\/analyzer(?:\/|$)|security-intelligence\.|security-knowledge\.|analyzer\.)/i;
function normalizePath(path: string): string { return path.replace(/^\.\//, '').replace(/\\/g, '/'); }

/** Test, fixture, mock, documentation and sample code is excluded from production-security signals. */
export function isNonProductionPath(path: string): boolean {
  const normalized = normalizePath(path);
  return /(^|\/)(?:__tests__|tests?|e2e(?:-tests)?|fixtures?|mocks?|samples?|examples?|docs?|storybook|stories|scaffold|benchmarks?|generated|vendor)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalized);
}

const validationErrors = validateSecurityRules();
if (validationErrors.length) throw new Error(`Invalid UCE security registry: ${validationErrors.join('; ')}`);

export function detectSecurityIntelligence(files: ProjectFile[]): SecurityIntelligence {
  const findings: SecurityFinding[] = []; const seen = new Set<string>(); let rulesExecuted = 0;
  const sourceFiles = files.filter((file) => {
    const path = normalizePath(file.path);
    return !file.isDirectory && SOURCE_RE.test(path) && !INTERNAL_PATH_RE.test(path) && !isNonProductionPath(path);
  });
  for (const file of sourceFiles) {
    const source = file.content ?? ''; const normalizedPath = normalizePath(file.path);
    for (const rule of SECURITY_RULES) {
      if (rule.filePattern && !new RegExp(rule.filePattern.source, rule.filePattern.flags.replace('g', '')).test(normalizedPath)) continue;
      rulesExecuted++;
      const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
      for (const match of source.matchAll(new RegExp(rule.pattern.source, flags))) {
        if (rule.shouldReport && !rule.shouldReport(match)) continue;
        const line = source.slice(0, match.index).split('\n').length; const id = `${rule.id}:${normalizedPath}:${line}`;
        if (seen.has(id)) continue; seen.add(id);
        findings.push({ id, ruleId: rule.id, title: rule.title, category: rule.category, confidence: rule.confidence, severity: rule.severity, file: file.path, line, evidence: rule.evidence, recommendation: rule.recommendation });
        if (findings.length >= 300) break;
      }
      if (findings.length >= 300) break;
    }
    if (findings.length >= 300) break;
  }
  const weights = { critical: 20, warning: 7, info: 1 }; const confidenceWeights = { high: 1, medium: 0.7, low: 0.4 };
  const penalty = findings.reduce((sum, finding) => sum + weights[finding.severity] * confidenceWeights[finding.confidence ?? 'medium'], 0);
  const categoryCounts: Partial<Record<SecurityRuleCategory, number>> = {};
  for (const finding of findings) if (finding.category) categoryCounts[finding.category] = (categoryCounts[finding.category] ?? 0) + 1;
  return { findings: findings.slice(0, 300), score: Math.max(0, Math.round(100 - penalty)), filesScanned: sourceFiles.length, rulesExecuted, knowledgeVersion: SECURITY_KNOWLEDGE_VERSION, categoryCounts };
}
