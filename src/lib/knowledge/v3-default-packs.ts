import { V3_CORE_RULE_PACK } from './v3-core-pack';
import { V3_PHASE2_RULE_PACKS } from './v3-phase2-packs';
import { V3_PHASE3_RULE_PACKS } from './v3-phase3-packs';
import { V3_PHASE4_RULE_PACKS } from './v3-phase4-packs';
import { V3_PHASE5_RULE_PACKS } from './v3-phase5-packs';
import type { V3RulePack } from './v3-types';

/** Pack registration boundary: new built-in packs are added here, never in analyzer core. */
export const V3_DEFAULT_RULE_PACKS: V3RulePack[] = [V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS, ...V3_PHASE3_RULE_PACKS, ...V3_PHASE4_RULE_PACKS, ...V3_PHASE5_RULE_PACKS];
