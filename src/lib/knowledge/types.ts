export const KNOWLEDGE_PACK_SCHEMA_VERSION = 1 as const;

export type KnowledgePackPermission = 'read-project-files' | 'emit-findings' | 'declare-technology' | 'declare-compatibility';
export type KnowledgeRuleKind = 'technology' | 'security' | 'browser' | 'compatibility' | 'intelligence';

export interface KnowledgePackRuleDescriptor {
  id: string;
  kind: KnowledgeRuleKind;
  title: string;
  documentation: string;
  version: string;
}

export interface KnowledgePackSignature {
  algorithm: 'ed25519';
  keyId: string;
  digest: string;
  signature: string;
}

export interface KnowledgePackManifest {
  schemaVersion: typeof KNOWLEDGE_PACK_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  uceCompatibility: string;
  permissions: KnowledgePackPermission[];
  rules: KnowledgePackRuleDescriptor[];
  signature?: KnowledgePackSignature;
}

export interface KnowledgePackValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  signed: boolean;
}

export interface TrustedPublisherKey { keyId: string; publisher: string; publicKey: string; revoked?: boolean; }
export interface KnowledgePackVerification extends KnowledgePackValidation { trusted: boolean; digestVerified: boolean; signatureVerified: boolean; publisher?: string; }

export interface DetectorContextFile { path: string; size: number; content?: string; }
export interface DeclarativeDetectorRule {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  include: string[];
  pattern: string;
  flags?: string;
  message: string;
  recommendation: string;
  maxFindings?: number;
}
export interface DetectorSdkFinding { ruleId: string; title: string; severity: 'critical' | 'warning' | 'info'; file: string; line: number; message: string; recommendation: string; }
