import type { AnalysisTrustMetadata } from './types';
import { CORE_KNOWLEDGE_PACK } from '../knowledge/core-pack';
import { COMPATIBILITY_SCORE_WEIGHTS } from '../compatibility/scoring/index';

export function buildTrustMetadata(): AnalysisTrustMetadata {
  return {
    localOnly: true,
    networkAccessUsed: false,
    sourceUploaded: false,
    scoringFormula: 'Weighted arithmetic mean of eight compatibility category scores, rounded to the nearest integer.',
    scoreWeights: { ...COMPATIBILITY_SCORE_WEIGHTS },
    knowledgePacks: [{ id: CORE_KNOWLEDGE_PACK.id, version: CORE_KNOWLEDGE_PACK.version, schemaVersion: CORE_KNOWLEDGE_PACK.schemaVersion, signed: true }],
    limitations: [
      'Static findings are review signals, not proof of runtime behavior or exploitable vulnerabilities.',
      'Browser and platform checks do not execute the project on real devices.',
      'Accessibility checks do not replace keyboard, screen-reader, contrast, or user testing.',
      'License metadata checks do not replace legal review or an external dependency-license database.',
    ],
  };
}
