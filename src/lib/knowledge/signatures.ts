import type { KnowledgePackManifest, KnowledgePackVerification, TrustedPublisherKey } from './types';
import { validateKnowledgePack } from './validator';

export async function verifyKnowledgePack(pack: KnowledgePackManifest, trustStore: TrustedPublisherKey[]): Promise<KnowledgePackVerification> {
  const validation = validateKnowledgePack(pack, true);
  const result: KnowledgePackVerification = { ...validation, trusted: false, digestVerified: false, signatureVerified: false };
  if (!validation.valid || !pack.signature) return result;
  const key = trustStore.find((candidate) => candidate.keyId === pack.signature?.keyId && candidate.publisher === pack.publisher && !candidate.revoked);
  if (!key) return { ...result, valid: false, errors: [...result.errors, 'Signature key is not present in the trusted publisher store.'] };
  try {
    const payload = new TextEncoder().encode(canonicalKnowledgePack(pack));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
    const digestValue = `sha256:${toHex(digest)}`;
    result.digestVerified = timingSafeEqualText(digestValue, pack.signature.digest);
    if (!result.digestVerified) return { ...result, valid: false, errors: [...result.errors, 'Pack digest does not match its canonical content.'] };
    const publicKey = await crypto.subtle.importKey('raw', decodeBase64(key.publicKey), { name: 'Ed25519' }, false, ['verify']);
    result.signatureVerified = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, decodeBase64(pack.signature.signature), payload);
    result.trusted = result.signatureVerified;
    result.publisher = key.publisher;
    if (!result.signatureVerified) result.errors.push('Ed25519 signature verification failed.');
    result.valid = result.valid && result.trusted;
    return result;
  } catch (error) {
    return { ...result, valid: false, errors: [...result.errors, `Signature verification could not complete: ${error instanceof Error ? error.message : 'unknown error'}.`] };
  }
}

export function canonicalKnowledgePack(pack: KnowledgePackManifest): string {
  const unsigned = { ...pack };
  delete unsigned.signature;
  return stableStringify(unsigned);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function decodeBase64(value: string): Uint8Array { const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function toHex(value: Uint8Array): string { return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function timingSafeEqualText(left: string, right: string): boolean { if (left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index++) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0; }
