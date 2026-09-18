import type { DeclarativeDetectorRule, DetectorContextFile, DetectorSdkFinding } from './types';

const MAX_PATTERN_LENGTH = 500;
const MAX_FILES_PER_RULE = 25_000;
const SAFE_FLAGS = /^[gimsu]*$/;

export function validateDetectorRule(rule: DeclarativeDetectorRule): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(rule.id)) errors.push('Rule id is invalid.');
  if (!rule.title.trim() || !rule.message.trim() || !rule.recommendation.trim()) errors.push('Title, message, and recommendation are required.');
  if (!rule.include.length || rule.include.some((pattern) => pattern.length > 200 || pattern.includes('..'))) errors.push('Include patterns must be bounded project-relative globs.');
  if (!rule.pattern || rule.pattern.length > MAX_PATTERN_LENGTH) errors.push(`Pattern must be 1-${MAX_PATTERN_LENGTH} characters.`);
  if (!SAFE_FLAGS.test(rule.flags ?? '')) errors.push('Only g, i, m, s, and u regular-expression flags are supported.');
  try { new RegExp(rule.pattern, normalizeFlags(rule.flags)); } catch { errors.push('Pattern is not a valid regular expression.'); }
  return errors;
}

export function runDetectorRules(rules: DeclarativeDetectorRule[], files: DetectorContextFile[]): DetectorSdkFinding[] {
  const findings: DetectorSdkFinding[] = [];
  for (const rule of rules) {
    if (validateDetectorRule(rule).length) continue;
    const limit = Math.min(Math.max(rule.maxFindings ?? 50, 1), 500);
    const regex = new RegExp(rule.pattern, normalizeFlags(rule.flags));
    for (const file of files.slice(0, MAX_FILES_PER_RULE)) {
      if (!file.content || !rule.include.some((glob) => matchesGlob(file.path, glob))) continue;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(file.content)) && findings.filter((item) => item.ruleId === rule.id).length < limit) {
        findings.push({ ruleId: rule.id, title: rule.title, severity: rule.severity, file: file.path, line: 1 + file.content.slice(0, match.index).split('\n').length - 1, message: rule.message, recommendation: rule.recommendation });
        if (!regex.global) break;
        if (match[0].length === 0) regex.lastIndex++;
      }
    }
  }
  return findings;
}

function normalizeFlags(flags = ''): string { return [...new Set(`${flags}g`)].join(''); }
function matchesGlob(path: string, glob: string): boolean {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '__UCE_GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__UCE_GLOBSTAR__/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(path.replace(/\\/g, '/'));
}
