export const V3_RULE_SCHEMA_VERSION = 3 as const;

export type V3RuleModule =
  | 'security' | 'browser' | 'language' | 'technology' | 'architecture'
  | 'code' | 'dependency' | 'runtime' | 'platform' | 'build' | 'testing'
  | 'performance' | 'accessibility' | 'api' | 'database' | 'environment'
  | 'deployment' | 'license' | 'documentation' | 'repository';
export type V3RuleSeverity = 'critical' | 'warning' | 'info';
export type V3RuleConfidence = 'confirmed' | 'likely' | 'possible' | 'review-required';
export type V3RuleScope = 'production' | 'test' | 'fixture' | 'generated' | 'vendor' | 'documentation' | 'configuration';
export type V3DetectorKind = 'regex' | 'ast' | 'manifest' | 'dependency' | 'config';
export type V3Operator = 'exists' | 'equals' | 'not-equals' | 'contains' | 'matches';

export interface V3RegexDetector {
  kind: 'regex';
  include: string[];
  exclude?: string[];
  pattern: string;
  flags?: string;
}
export interface V3AstDetector {
  kind: 'ast';
  languages: string[];
  query: 'call' | 'import' | 'assignment' | 'jsx-attribute' | 'declaration';
  names: string[];
  include?: string[];
}
export interface V3ManifestDetector {
  kind: 'manifest';
  files: string[];
  path: string;
  operator: V3Operator;
  value?: string;
}
export interface V3DependencyDetector {
  kind: 'dependency';
  ecosystems: Array<'npm' | 'python' | 'cargo' | 'go' | 'maven' | 'gradle' | 'composer' | 'nuget' | 'ruby' | 'dart' | 'swift' | 'mix'>;
  names: string[];
  version?: string;
}
export interface V3ConfigDetector {
  kind: 'config';
  files: string[];
  path?: string;
  operator: V3Operator;
  value?: string;
  pattern?: string;
}
export type V3Detector = V3RegexDetector | V3AstDetector | V3ManifestDetector | V3DependencyDetector | V3ConfigDetector;

export interface V3EvidenceRequirements {
  minimum: number;
  requireDetectorKinds?: V3DetectorKind[];
  requireAllDetectors?: boolean;
}
export interface V3RuleBudget {
  maxFiles: number;
  maxMatches: number;
  maxContentBytes: number;
  maxMilliseconds: number;
}
export interface V3Rule {
  id: string;
  version: string;
  module: V3RuleModule;
  title: string;
  description: string;
  technologies: string[];
  scope: V3RuleScope[];
  severity: V3RuleSeverity;
  confidence: V3RuleConfidence;
  detectors: V3Detector[];
  evidenceRequirements: V3EvidenceRequirements;
  recommendation: string;
  references: string[];
  falsePositiveNotes: string[];
  dependsOn?: string[];
  conflictsWith?: string[];
  budget?: Partial<V3RuleBudget>;
  enabled?: boolean;
  tags?: string[];
}

export interface V3PackSignature { algorithm: 'ed25519'; keyId: string; digest: string; signature: string; }
export interface V3RulePack {
  schemaVersion: typeof V3_RULE_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  uceCompatibility: string;
  technologies: string[];
  modules: V3RuleModule[];
  dependencies?: Array<{ id: string; version: string }>;
  rules: V3Rule[];
  signature?: V3PackSignature;
}

export interface V3ProjectFile { path: string; size: number; content?: string; isDirectory?: boolean; }
export interface V3ExecutionContext {
  files: V3ProjectFile[];
  technologies: string[];
  modules?: V3RuleModule[];
  manifests?: Record<string, unknown>;
}
export interface V3RuleEvidence { detector: V3DetectorKind; file: string; line?: number; detail: string; }
export interface V3RuleFinding {
  ruleId: string;
  packId: string;
  title: string;
  module: V3RuleModule;
  severity: V3RuleSeverity;
  confidence: V3RuleConfidence;
  file: string;
  line?: number;
  evidence: V3RuleEvidence[];
  recommendation: string;
  falsePositiveNotes: string[];
}
export interface V3RuleMetric { ruleId: string; filesVisited: number; contentBytes: number; matches: number; durationMs: number; truncated: boolean; }
export interface V3ExecutionResult {
  schemaVersion: typeof V3_RULE_SCHEMA_VERSION;
  packIds: string[];
  rulesConsidered: number;
  rulesExecuted: number;
  rulesSkipped: number;
  findings: V3RuleFinding[];
  metrics: V3RuleMetric[];
  limitations: string[];
}
export interface V3PackValidation { valid: boolean; errors: string[]; warnings: string[]; signed: boolean; }
export interface V3RuleGraph { order: string[]; missingDependencies: string[]; cycles: string[][]; conflicts: string[]; duplicates: string[]; }
export interface V3LazyPackDescriptor {
  id: string;
  version: string;
  technologies: string[];
  modules: V3RuleModule[];
  load: () => Promise<V3RulePack>;
}
