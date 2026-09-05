import type { ProjectFile, SecurityFinding, SecurityIntelligence } from './types';

interface Rule { id: string; title: string; severity: SecurityFinding['severity']; pattern: RegExp; evidence: string; recommendation: string; }

const RULES: Rule[] = [
  { id: 'SEC001', title: 'Potential hardcoded credential', severity: 'critical', pattern: /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"]{8,}['"]/i, evidence: 'A credential-like value is assigned directly in source.', recommendation: 'Move secrets to environment variables or a managed secret store.' },
  { id: 'SEC002', title: 'Dynamic code execution', severity: 'critical', pattern: /\beval\s*\(|new\s+Function\s*\(/, evidence: 'Dynamic code execution was detected.', recommendation: 'Avoid eval/new Function and use explicit parsing or safe dispatch.' },
  { id: 'SEC003', title: 'Potential command injection sink', severity: 'critical', pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(/, evidence: 'A process execution API is used and should be reviewed for untrusted input.', recommendation: 'Use fixed commands, argument arrays, and strict input validation.' },
  { id: 'SEC004', title: 'Unsafe HTML injection sink', severity: 'warning', pattern: /\bdangerouslySetInnerHTML\b|\binnerHTML\s*=/, evidence: 'Raw HTML is inserted into a document.', recommendation: 'Prefer escaped rendering and sanitize any HTML that must be accepted.' },
  { id: 'SEC005', title: 'Insecure HTTP endpoint', severity: 'warning', pattern: /http:\/\//i, evidence: 'An HTTP URL literal was found; review whether sensitive traffic can use HTTPS.', recommendation: 'Use HTTPS for production network traffic and avoid sending secrets over HTTP.' },
  { id: 'SEC006', title: 'Wildcard CORS policy', severity: 'warning', pattern: /(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*['"]\*['"]|cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]/is, evidence: 'CORS appears to allow every origin.', recommendation: 'Restrict allowed origins to the domains required by the application.' },
  { id: 'SEC007', title: 'Debug logging in source', severity: 'info', pattern: /\bconsole\.(?:log|debug)\s*\(/, evidence: 'Debug logging is present and may expose sensitive runtime data.', recommendation: 'Remove sensitive debug logs or gate them behind a safe development-only logger.' },
];

const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|go|rs|php|rb|ex|exs|dart|swift|scala|cs|c|cc|cpp|h|hpp|zig|lua|jl|r|cr|nim|sol|v|erl|hrl)$/i;
const INTERNAL_PATH_RE = /(^|\/)(src\/lib\/analyzer\/|security-intelligence\.|analyzer\.)/i;

export function detectSecurityIntelligence(files: ProjectFile[]): SecurityIntelligence {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();
  const sourceFiles = files.filter((file) => !file.isDirectory && SOURCE_RE.test(file.path) && !INTERNAL_PATH_RE.test(file.path));

  for (const file of sourceFiles) {
    const source = file.content ?? '';
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(source);
      if (!match) continue;
      const line = source.slice(0, match.index).split('\n').length;
      const id = `${rule.id}:${file.path}:${line}`;
      if (seen.has(id)) continue;
      seen.add(id);
      findings.push({ id, title: rule.title, severity: rule.severity, file: file.path, line, evidence: rule.evidence, recommendation: rule.recommendation });
    }
  }

  const weights = { critical: 20, warning: 7, info: 1 };
  const penalty = findings.reduce((sum, finding) => sum + weights[finding.severity], 0);
  return { findings: findings.slice(0, 300), score: Math.max(0, 100 - penalty), filesScanned: sourceFiles.length, rulesExecuted: RULES.length * sourceFiles.length };
}
