import { KNOWLEDGE_PACK_SCHEMA_VERSION } from './types';
import type { KnowledgePackManifest, KnowledgePackPermission, KnowledgePackValidation } from './types';

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ALLOWED_PERMISSIONS = new Set<KnowledgePackPermission>(['read-project-files', 'emit-findings', 'declare-technology', 'declare-compatibility']);

export function validateKnowledgePack(value: unknown, requireSignature = false): KnowledgePackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Pack must be a JSON object.'], warnings, signed: false };
  const pack = value as Partial<KnowledgePackManifest>;

  if (pack.schemaVersion !== KNOWLEDGE_PACK_SCHEMA_VERSION) errors.push(`Unsupported schemaVersion; expected ${KNOWLEDGE_PACK_SCHEMA_VERSION}.`);
  if (!isNonEmpty(pack.id) || !ID_PATTERN.test(pack.id)) errors.push('Pack id must use lowercase letters, numbers, dots, underscores, or hyphens.');
  if (!isNonEmpty(pack.name)) errors.push('Pack name is required.');
  if (!isNonEmpty(pack.publisher)) errors.push('Pack publisher is required.');
  if (!isNonEmpty(pack.description)) errors.push('Pack description is required.');
  if (!isNonEmpty(pack.version) || !VERSION_PATTERN.test(pack.version)) errors.push('Pack version must be semantic version format.');
  if (!isNonEmpty(pack.uceCompatibility)) errors.push('UCE compatibility range is required.');

  if (!Array.isArray(pack.permissions)) errors.push('Permissions must be an array.');
  else for (const permission of pack.permissions) if (!ALLOWED_PERMISSIONS.has(permission)) errors.push(`Unsupported permission: ${String(permission)}.`);

  if (!Array.isArray(pack.rules) || pack.rules.length === 0) errors.push('At least one rule descriptor is required.');
  else {
    const ids = new Set<string>();
    for (const [index, rule] of pack.rules.entries()) {
      if (!isRecord(rule)) { errors.push(`Rule ${index} must be an object.`); continue; }
      if (!isNonEmpty(rule.id) || !ID_PATTERN.test(rule.id)) errors.push(`Rule ${index} has an invalid id.`);
      else if (ids.has(rule.id)) errors.push(`Duplicate rule id: ${rule.id}.`);
      else ids.add(rule.id);
      if (!isNonEmpty(rule.title)) errors.push(`Rule ${index} requires a title.`);
      if (!isNonEmpty(rule.documentation)) errors.push(`Rule ${index} requires documentation.`);
      if (!isNonEmpty(rule.version) || !VERSION_PATTERN.test(rule.version)) errors.push(`Rule ${index} requires a semantic version.`);
      if (!['technology', 'security', 'browser', 'compatibility', 'intelligence'].includes(String(rule.kind))) errors.push(`Rule ${index} has an unsupported kind.`);
    }
  }

  const signed = isRecord(pack.signature);
  if (requireSignature && !signed) errors.push('A trusted signature is required for this pack.');
  if (signed) {
    const signature = pack.signature as unknown as Record<string, unknown>;
    if (signature.algorithm !== 'ed25519') errors.push('Only ed25519 pack signatures are supported.');
    if (!isNonEmpty(signature.keyId)) errors.push('Signature keyId is required.');
    if (!isNonEmpty(signature.digest) || !DIGEST_PATTERN.test(signature.digest)) errors.push('Signature digest must be a sha256 digest.');
    if (!isNonEmpty(signature.signature)) errors.push('Signature value is required.');
  } else warnings.push('Pack is unsigned and must not be trusted automatically.');

  return { valid: errors.length === 0, errors, warnings, signed };
}

export function exportKnowledgePack(pack: KnowledgePackManifest): string { return JSON.stringify(pack, null, 2); }
export function importKnowledgePack(raw: string, requireSignature = false): { pack?: KnowledgePackManifest; validation: KnowledgePackValidation } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { validation: { valid: false, errors: ['Pack contains invalid JSON.'], warnings: [], signed: false } }; }
  const validation = validateKnowledgePack(value, requireSignature);
  return validation.valid ? { pack: value as KnowledgePackManifest, validation } : { validation };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isNonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
