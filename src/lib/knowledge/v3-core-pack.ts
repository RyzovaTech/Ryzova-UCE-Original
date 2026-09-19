import pack from './packs/v3-core.json';
import type { V3RulePack } from './v3-types';

/** Small bootstrap pack proving every V3 detector adapter. V3 knowledge batches extend this without changing the engine. */
export const V3_CORE_RULE_PACK = pack as V3RulePack;
