import type { KnowledgePackManifest } from './types';

export const CORE_KNOWLEDGE_PACK: KnowledgePackManifest = {
  schemaVersion: 1,
  id: 'com.ryzova.uce.core',
  name: 'UCE Core Knowledge',
  version: '5.0.0-alpha.1',
  publisher: 'RyzovaTech',
  description: 'Built-in deterministic technology, security, browser, compatibility, and project intelligence knowledge.',
  uceCompatibility: '>=2.0.0 <4.0.0',
  permissions: ['read-project-files', 'emit-findings', 'declare-technology', 'declare-compatibility'],
  rules: [
    { id: 'core.technology', kind: 'technology', title: 'Technology registry', documentation: 'docs/KNOWLEDGE_PACKS.md#technology', version: '2.0.0' },
    { id: 'core.security', kind: 'security', title: 'Security intelligence', documentation: 'docs/KNOWLEDGE_PACKS.md#security', version: '3.0.0' },
    { id: 'core.browser', kind: 'browser', title: 'Browser compatibility', documentation: 'docs/KNOWLEDGE_PACKS.md#browser', version: '3.0.0' },
    { id: 'core.compatibility', kind: 'compatibility', title: 'Compatibility rules', documentation: 'docs/KNOWLEDGE_PACKS.md#compatibility', version: '2.0.0' },
    { id: 'core.intelligence', kind: 'intelligence', title: 'Extended intelligence', documentation: 'docs/KNOWLEDGE_PACKS.md#intelligence', version: '3.5.0' },
  ],
};
