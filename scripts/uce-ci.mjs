#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const input = args.find((item) => !item.startsWith('--'));
if (!input || args.includes('--help')) {
  console.log('Usage: npm run uce:ci -- <report.json> [--min-score=70] [--max-critical=0] [--max-warning=50] [--sarif=results.sarif]');
  process.exit(input ? 0 : 2);
}

const option = (name, fallback) => {
  const raw = args.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  return raw === undefined ? fallback : raw;
};
const numberOption = (name, fallback) => {
  const value = Number(option(name, fallback));
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a non-negative number.`);
  return value;
};

let report;
try { report = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8')); }
catch (error) { console.error(`[UCE CI] Unable to read report: ${error instanceof Error ? error.message : String(error)}`); process.exit(2); }

const validationErrors = validateReport(report);
if (validationErrors.length) {
  console.error('[UCE CI] Invalid report:');
  for (const error of validationErrors) console.error(`- ${error}`);
  process.exit(2);
}

const findings = collectFindings(report);
const critical = findings.filter((item) => item.severity === 'critical').length;
const warning = findings.filter((item) => item.severity === 'warning').length;
const minScore = numberOption('min-score', 0);
const maxCritical = numberOption('max-critical', Number.MAX_SAFE_INTEGER);
const maxWarning = numberOption('max-warning', Number.MAX_SAFE_INTEGER);
const failures = [];
if (report.score.overall < minScore) failures.push(`Overall score ${report.score.overall} is below ${minScore}.`);
if (critical > maxCritical) failures.push(`Critical findings ${critical} exceed ${maxCritical}.`);
if (warning > maxWarning) failures.push(`Warning findings ${warning} exceed ${maxWarning}.`);

const sarifPath = option('sarif', '');
if (sarifPath) fs.writeFileSync(path.resolve(sarifPath), JSON.stringify(toSarif(report, findings), null, 2));

console.log(JSON.stringify({ schemaVersion: 1, reportId: report.id, project: report.summary.name, score: report.score.overall, critical, warning, status: failures.length ? 'failed' : 'passed' }));
if (failures.length) { for (const failure of failures) console.error(`[UCE CI] ${failure}`); process.exit(1); }

function validateReport(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Root must be an object.'];
  if (typeof value.id !== 'string' || !value.id) errors.push('id is required.');
  if (typeof value.analysisVersion !== 'string') errors.push('analysisVersion is required.');
  if (!value.summary || typeof value.summary.name !== 'string') errors.push('summary.name is required.');
  if (!value.score || !Number.isFinite(value.score.overall) || value.score.overall < 0 || value.score.overall > 100) errors.push('score.overall must be between 0 and 100.');
  if (!Array.isArray(value.issues)) errors.push('issues must be an array.');
  if (!Array.isArray(value.categories)) errors.push('categories must be an array.');
  return errors;
}

function collectFindings(value) {
  const result = (value.issues ?? []).map((item) => ({ id: item.id, ruleId: `compatibility.${item.category}`, title: item.title, severity: item.severity, file: item.affectedFile, line: undefined, message: item.description, recommendation: item.recommendation, module: item.category }));
  for (const item of value.stack?.securityIntelligence?.findings ?? []) result.push({ id: `security:${item.id}`, ruleId: item.ruleId ?? 'security.unknown', title: item.title, severity: item.severity, file: item.file, line: item.line, message: item.evidence, recommendation: item.recommendation, module: 'security' });
  for (const module of Object.values(value.stack?.extendedIntelligence?.modules ?? {})) for (const item of module.findings ?? []) result.push({ id: `${module.id}:${item.id}`, ruleId: item.id, title: item.title, severity: item.severity, file: item.file, line: item.line, message: item.evidence, recommendation: item.recommendation, module: module.id });
  return result;
}

function toSarif(value, findings) {
  const rules = [...new Map(findings.map((item) => [item.ruleId, { id: item.ruleId, name: item.title, shortDescription: { text: item.title }, help: { text: item.recommendation } }])).values()];
  const locatedFindings = findings.filter((item) => item.file && item.file !== 'Project-wide');
  return { $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0', runs: [{ tool: { driver: { name: 'Ryzova UCE CI', version: value.analysisVersion, informationUri: 'https://uce.ryzova.com/', rules } }, results: locatedFindings.map((item) => ({ ruleId: item.ruleId, level: item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'note', message: { text: `${item.message} Recommendation: ${item.recommendation}` }, locations: [{ physicalLocation: { artifactLocation: { uri: String(item.file).replace(/\\/g, '/') }, ...(item.line ? { region: { startLine: item.line } } : {}) } }], properties: { module: item.module } })) }] };
}
