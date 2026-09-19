import { V3_CORE_RULE_PACK } from './v3-core-pack';
import type { V3RulePack } from './v3-types';

/** Pack registration boundary: new built-in packs are added here, never in analyzer core. */
export const V3_DEFAULT_RULE_PACKS: V3RulePack[] = [V3_CORE_RULE_PACK];
