import type { TrustedPublisherKey } from './types';
import type { V3PackValidation, V3RulePack } from './v3-types';
import { validateV3RulePack } from './v3-validator';

export interface V3PackVerification extends V3PackValidation { trusted: boolean; digestVerified: boolean; signatureVerified: boolean; }
export async function signV3RulePack(pack: V3RulePack, keyId: string, privateKey: CryptoKey): Promise<V3RulePack> {
  const unsigned = { ...pack }; delete unsigned.signature;
  const validation = validateV3RulePack(unsigned);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const payload = new TextEncoder().encode(canonicalV3RulePack(unsigned));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, payload));
  return { ...unsigned, signature: { algorithm: 'ed25519', keyId, digest: `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`, signature: encodeBase64(signature) } };
}
export async function verifyV3RulePack(pack: V3RulePack, trustStore: TrustedPublisherKey[]): Promise<V3PackVerification> {
  const validation = validateV3RulePack(pack); const result = { ...validation, trusted: false, digestVerified: false, signatureVerified: false };
  if (!validation.valid || !pack.signature) return result;
  const key = trustStore.find((item) => item.keyId === pack.signature?.keyId && item.publisher === pack.publisher && !item.revoked);
  if (!key) return { ...result, valid: false, errors: [...result.errors, 'Publisher key is not trusted.'] };
  try {
    const payload = new TextEncoder().encode(canonicalV3RulePack(pack));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
    const digestValue = `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    const digestVerified = safeEqual(digestValue, pack.signature.digest);
    if (!digestVerified) return { ...result, digestVerified, valid: false, errors: [...result.errors, 'Pack digest does not match canonical content.'] };
    const publicKey = await crypto.subtle.importKey('raw', base64(key.publicKey), { name: 'Ed25519' }, false, ['verify']);
    const signatureVerified = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, base64(pack.signature.signature), payload);
    return { ...result, valid: signatureVerified, trusted: signatureVerified, digestVerified, signatureVerified, errors: signatureVerified ? result.errors : [...result.errors, 'Ed25519 signature verification failed.'] };
  } catch (error) { return { ...result, valid: false, errors: [...result.errors, `Signature verification failed safely: ${error instanceof Error ? error.message : 'unknown error'}.`] }; }
}
export function canonicalV3RulePack(pack: V3RulePack): string { const unsigned = { ...pack }; delete unsigned.signature; return stable(unsigned); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`; return JSON.stringify(value); }
function base64(value: string): Uint8Array { const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(decoded, (character) => character.charCodeAt(0)); }
function encodeBase64(value: Uint8Array): string { let binary = ''; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary); }
function safeEqual(left: string, right: string): boolean { if (left.length !== right.length) return false; let result = 0; for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index); return result === 0; }
