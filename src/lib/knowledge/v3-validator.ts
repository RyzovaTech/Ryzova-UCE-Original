import { V3_RULE_SCHEMA_VERSION } from './v3-types';
import type { V3Detector, V3PackValidation, V3Rule, V3RuleGraph, V3RulePack } from './v3-types';

const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SAFE_FLAGS = /^[imsu]*$/;
const MAX_PATTERN = 1_000;
const MODULES = new Set(['security','browser','language','technology','architecture','code','dependency','runtime','platform','build','testing','performance','accessibility','api','database','environment','deployment','license','documentation','repository']);
const SCOPES = new Set(['production','test','fixture','generated','vendor','documentation','configuration']);
const CONFIDENCE = new Set(['confirmed','likely','possible','review-required']);

export function validateV3RulePack(value: unknown): V3PackValidation {
  const errors: string[] = []; const warnings: string[] = [];
  if (!record(value)) return { valid: false, errors: ['Pack must be an object.'], warnings, signed: false };
  const pack = value as unknown as V3RulePack;
  if (pack.schemaVersion !== V3_RULE_SCHEMA_VERSION) errors.push(`schemaVersion must be ${V3_RULE_SCHEMA_VERSION}.`);
  if (!validId(pack.id)) errors.push('Pack id is invalid.');
  if (!text(pack.name) || !text(pack.publisher) || !text(pack.description)) errors.push('Pack name, publisher, and description are required.');
  if (!SEMVER.test(pack.version ?? '')) errors.push('Pack version must be semantic version format.');
  if (!text(pack.uceCompatibility)) errors.push('UCE compatibility range is required.');
  if (!stringArray(pack.technologies) || !pack.technologies.length) errors.push('Pack technologies must be a non-empty string array.');
  if (!Array.isArray(pack.modules) || !pack.modules.length || pack.modules.some((item) => !MODULES.has(item))) errors.push('Pack modules contain unsupported values.');
  if (pack.dependencies !== undefined && (!Array.isArray(pack.dependencies) || pack.dependencies.some((item) => !record(item) || !validId(item.id) || !text(item.version)))) errors.push('Pack dependencies must contain valid ids and version ranges.');
  if (!Array.isArray(pack.rules) || !pack.rules.length) errors.push('Pack must contain at least one executable rule.');
  else {
    const ids = new Set<string>(); const signatures = new Map<string, string>();
    pack.rules.forEach((rule, index) => {
      for (const error of validateV3Rule(rule)) errors.push(`Rule ${index}: ${error}`);
      if (ids.has(rule.id)) errors.push(`Duplicate rule id: ${rule.id}.`); else ids.add(rule.id);
      if (!pack.modules.includes(rule.module)) errors.push(`Rule ${rule.id} uses module ${rule.module}, which is not declared by the pack.`);
      const signature = detectorSignature(rule); const duplicate = signatures.get(signature);
      if (duplicate && duplicate !== rule.id) errors.push(`Rules ${duplicate} and ${rule.id} have duplicate detector signatures.`); else signatures.set(signature, rule.id);
    });
    const graph = analyzeV3RuleGraph([pack]);
    errors.push(...graph.missingDependencies.map((item) => `Missing rule dependency: ${item}.`));
    errors.push(...graph.cycles.map((cycle) => `Rule dependency cycle: ${cycle.join(' -> ')}.`));
    errors.push(...graph.conflicts.map((item) => `Enabled rule conflict: ${item}.`));
  }
  const signed = record(pack.signature);
  if (!signed) warnings.push('Pack is unsigned and requires explicit approval unless bundled with UCE.');
  else if (pack.signature?.algorithm !== 'ed25519' || !text(pack.signature.keyId) || !/^sha256:[a-f0-9]{64}$/.test(pack.signature.digest) || !text(pack.signature.signature)) errors.push('Pack signature envelope is invalid.');
  return { valid: errors.length === 0, errors, warnings, signed };
}

export function validateV3Rule(rule: V3Rule): string[] {
  const errors: string[] = [];
  if (!validId(rule.id) || rule.id.split('.').length < 3) errors.push('id must be a globally namespaced identifier with at least three segments.');
  if (!SEMVER.test(rule.version ?? '')) errors.push('version must use semantic version format.');
  if (!MODULES.has(rule.module)) errors.push('module is unsupported.');
  if (!text(rule.title) || !text(rule.description) || !text(rule.recommendation)) errors.push('title, description, and recommendation are required.');
  if (!stringArray(rule.technologies) || !rule.technologies.length) errors.push('technologies must not be empty.');
  if (!Array.isArray(rule.scope) || !rule.scope.length || rule.scope.some((scope) => !SCOPES.has(scope))) errors.push('scope is empty or invalid.');
  if (!['critical','warning','info'].includes(rule.severity)) errors.push('severity is invalid.');
  if (rule.module === 'security' && rule.severity === 'critical')
    errors.push('critical security findings require proven semantic data flow, which the current bounded static detectors cannot establish.');
  if (!CONFIDENCE.has(rule.confidence)) errors.push('confidence is invalid.');
  if (!Array.isArray(rule.detectors) || !rule.detectors.length) errors.push('at least one detector is required.');
  else rule.detectors.forEach((detector, index) => errors.push(...validateDetector(detector).map((error) => `detector ${index}: ${error}`)));
  if (!rule.evidenceRequirements || !Number.isInteger(rule.evidenceRequirements.minimum) || rule.evidenceRequirements.minimum < 1 || rule.evidenceRequirements.minimum > (rule.detectors?.length ?? 0)) errors.push('evidenceRequirements.minimum must be within the detector count.');
  if (!Array.isArray(rule.references) || rule.references.some((url) => !/^https:\/\//.test(url))) errors.push('references must contain HTTPS URLs only.');
  if (!Array.isArray(rule.falsePositiveNotes)) errors.push('falsePositiveNotes must be an array.');
  if (rule.budget) {
    for (const [key, value] of Object.entries(rule.budget)) if (!Number.isFinite(value) || Number(value) <= 0) errors.push(`budget.${key} must be positive.`);
  }
  return errors;
}

export function analyzeV3RuleGraph(packs: V3RulePack[]): V3RuleGraph {
  const rules = packs.flatMap((pack) => pack.rules); const byId = new Map<string, V3Rule>(); const duplicates: string[] = [];
  for (const rule of rules) { if (byId.has(rule.id)) duplicates.push(rule.id); else byId.set(rule.id, rule); }
  const missingDependencies: string[] = []; const conflicts: string[] = [];
  for (const rule of rules) {
    for (const dependency of rule.dependsOn ?? []) if (!byId.has(dependency)) missingDependencies.push(`${rule.id} -> ${dependency}`);
    for (const conflict of rule.conflictsWith ?? []) if (byId.has(conflict) && rule.enabled !== false && byId.get(conflict)?.enabled !== false) conflicts.push(`${rule.id} <> ${conflict}`);
  }
  const order: string[] = []; const cycles: string[][] = []; const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string, trail: string[]) => {
    if (visiting.has(id)) { cycles.push([...trail.slice(trail.indexOf(id)), id]); return; }
    if (visited.has(id)) return;
    visiting.add(id); const rule = byId.get(id);
    for (const dependency of rule?.dependsOn ?? []) if (byId.has(dependency)) visit(dependency, [...trail, id]);
    visiting.delete(id); visited.add(id); order.push(id);
  };
  for (const id of byId.keys()) visit(id, []);
  return { order, missingDependencies: unique(missingDependencies), cycles, conflicts: unique(conflicts), duplicates: unique(duplicates) };
}

export function detectorSignature(rule: V3Rule): string {
  return JSON.stringify({ module: rule.module, technologies: [...rule.technologies].sort(), scope: [...rule.scope].sort(), detectors: rule.detectors });
}

function validateDetector(detector: V3Detector): string[] {
  const errors: string[] = [];
  if (!['regex','ast','manifest','dependency','config','correlation'].includes(detector.kind)) return ['kind is unsupported.'];
  if (detector.kind === 'correlation') {
    if (!['flow', 'browser-target', 'lockfile-version', 'import-boundary', 'paired-evidence'].includes(detector.mode)) errors.push('correlation mode is unsupported.');
    if (detector.mode === 'flow') {
      if (!detector.include?.length || !detector.sourcePattern?.includes('(') || !detector.sinkPattern?.includes('{{variable}}')) errors.push('flow requires file scope, captured variable and sink variable placeholder.');
      for (const pattern of [detector.sourcePattern, detector.sinkPattern?.replace(/\{\{variable\}\}/g, 'value')]) try { new RegExp(pattern); } catch { errors.push('flow pattern is invalid.'); }
      if (detector.maxLineDistance !== undefined && (!Number.isInteger(detector.maxLineDistance) || detector.maxLineDistance < 1 || detector.maxLineDistance > 100)) errors.push('flow distance must be between 1 and 100 lines.');
    }
    if (detector.mode === 'browser-target' && (!text(detector.featureId) || !text(detector.browser))) errors.push('browser correlation needs feature and browser.');
    if (detector.mode === 'lockfile-version' && !text(detector.packageName)) errors.push('lockfile correlation needs a package name.');
    if (detector.mode === 'import-boundary' && (!detector.include?.length || !detector.target?.length)) errors.push('import boundary needs origin and target paths.');
    if (detector.mode === 'paired-evidence') {
      if (!detector.first?.include?.length || !detector.second?.include?.length || !['same-file', 'same-workspace'].includes(detector.relation)) errors.push('paired evidence needs two path patterns and a relation.');
      for (const pattern of [detector.first?.pattern, detector.second?.pattern]) try { new RegExp(pattern); } catch { errors.push('paired evidence pattern is invalid.'); }
    }
  }
  if (detector.kind === 'regex') {
    if (!detector.include?.length || detector.include.some((item) => unsafePath(item))) errors.push('include globs must be bounded project-relative patterns.');
    if (!detector.pattern || detector.pattern.length > MAX_PATTERN) errors.push(`pattern must be 1-${MAX_PATTERN} characters.`);
    if (!SAFE_FLAGS.test(detector.flags ?? '')) errors.push('flags may contain only i, m, s, and u.');
    try { new RegExp(detector.pattern, detector.flags); } catch { errors.push('pattern is not valid regular expression syntax.'); }
  }
  if (detector.kind === 'ast' && (!detector.languages?.length || !detector.names?.length)) errors.push('AST detector requires languages and names.');
  if (detector.kind === 'manifest' && (!detector.files?.length || !text(detector.path))) errors.push('manifest detector requires files and path.');
  if (detector.kind === 'dependency' && (!detector.ecosystems?.length || !detector.names?.length)) errors.push('dependency detector requires ecosystems and names.');
  if (detector.kind === 'dependency' && detector.version !== undefined) try { new RegExp(detector.version); } catch { errors.push('dependency version pattern is invalid.'); }
  if (detector.kind === 'config' && !detector.files?.length) errors.push('config detector requires files.');
  return errors;
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function validId(value: unknown): value is string { return text(value) && ID.test(value); }
function unsafePath(value: string): boolean { return value.length > 240 || value.includes('..') || value.startsWith('/'); }
function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
