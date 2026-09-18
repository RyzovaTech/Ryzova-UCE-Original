import type { KnowledgePackManifest, KnowledgePackVerification, TrustedPublisherKey } from './types';
import { importKnowledgePack } from './validator';
import { verifyKnowledgePack } from './signatures';

export const KNOWLEDGE_REGISTRY_VERSION = 1;
export interface InstalledKnowledgePack { pack: KnowledgePackManifest; enabled: boolean; installedAt: string; verification: KnowledgePackVerification; }
export interface KnowledgeRegistryExport { schemaVersion: 1; exportedAt: string; packs: InstalledKnowledgePack[]; }

export async function installKnowledgePack(raw: string, trustStore: TrustedPublisherKey[], allowUnsignedOrganizationPack = false): Promise<InstalledKnowledgePack> {
  const imported = importKnowledgePack(raw, !allowUnsignedOrganizationPack);
  if (!imported.pack || !imported.validation.valid) throw new Error(imported.validation.errors.join(' '));
  const verification = imported.pack.signature
    ? await verifyKnowledgePack(imported.pack, trustStore)
    : { ...imported.validation, trusted: false, digestVerified: false, signatureVerified: false };
  if (imported.pack.signature && !verification.trusted) throw new Error(verification.errors.join(' '));
  if (!imported.pack.signature && !allowUnsignedOrganizationPack) throw new Error('Unsigned packs require explicit organization-pack approval.');
  return { pack: imported.pack, enabled: true, installedAt: new Date().toISOString(), verification };
}

export function exportKnowledgeRegistry(packs: InstalledKnowledgePack[]): string {
  const bundle: KnowledgeRegistryExport = { schemaVersion: KNOWLEDGE_REGISTRY_VERSION, exportedAt: new Date().toISOString(), packs };
  return JSON.stringify(bundle, null, 2);
}

export function importKnowledgeRegistry(raw: string): KnowledgeRegistryExport {
  const value = JSON.parse(raw) as Partial<KnowledgeRegistryExport>;
  if (value.schemaVersion !== KNOWLEDGE_REGISTRY_VERSION || !Array.isArray(value.packs)) throw new Error('Unsupported knowledge registry export.');
  for (const entry of value.packs) {
    const validation = importKnowledgePack(JSON.stringify(entry.pack));
    if (!validation.validation.valid) throw new Error(`Invalid pack ${entry.pack?.id ?? 'unknown'}: ${validation.validation.errors.join(' ')}`);
  }
  return value as KnowledgeRegistryExport;
}
