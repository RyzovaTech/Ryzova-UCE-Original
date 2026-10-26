#!/usr/bin/env node
/* Read-only catalog of the ACTUAL registered UCE V3 rule packs. */
import { load } from '../../scripts/trusted-module-loader.mjs';
const [mode='packs',offsetString='0',limitString='50',filter='']=process.argv.slice(2);
const offset=Number(offsetString),limit=Number(limitString);
if(!['packs','rules'].includes(mode)||!Number.isSafeInteger(offset)||offset<0||
 !Number.isSafeInteger(limit)||limit<1||limit>100||typeof filter!=='string'||
 filter.length>60|| !/^[a-z0-9_-]*$/.test(filter))process.exit(2);
const {V3_DEFAULT_RULE_PACKS}=load('src/lib/knowledge/v3-default-packs.ts');
if(!Array.isArray(V3_DEFAULT_RULE_PACKS))throw Error('UCE rule registry unavailable');
const packs=V3_DEFAULT_RULE_PACKS;
const packSummary=packs.map(p=>({id:p.id,name:p.name,version:p.version,
  ruleCount:p.rules.length,modules:p.modules,technologies:p.technologies.slice(0,20)}));
if(mode==='packs'){
 process.stdout.write(JSON.stringify({type:'UCE-registered-rule-packs',
  source:'V3_DEFAULT_RULE_PACKS',total:packs.length,offset,limit,
  items:packSummary.slice(offset,offset+limit),hasMore:offset+limit<packs.length,
  notes:'These are registered built-in packs, not proof each rule was applicable to a scanned source.'}));
}else{
 const rows=packs.flatMap(p=>p.rules.map(rule=>({
  id:rule.id,packId:p.id,version:rule.version,module:rule.module,
  title:rule.title,severity:rule.severity,confidence:rule.confidence,
  technologies:rule.technologies,detectorKinds:rule.detectors.map(x=>x.kind),
  evidenceRequirements:rule.evidenceRequirements,enabled:rule.enabled!==false})))
 .filter(x=>!filter||x.module===filter);
 process.stdout.write(JSON.stringify({type:'UCE-built-in-rule-catalog',
  filter:filter||null,total:rows.length,offset,limit,
  items:rows.slice(offset,offset+limit),hasMore:offset+limit<rows.length,
  disclaimer:'Catalog lists rules; a finding must come from actual source evidence, not catalog presence.'}));
}
