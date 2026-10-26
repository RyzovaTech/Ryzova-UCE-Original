#!/usr/bin/env node
/** Authored T5 investigation hypothesis fixture; never an accuracy trial. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {investigateRootCauses} from './root-causes.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const fixture=[
 ['package.json','{"name":"trilogy-t5-fixture","version":"1.0.0","engines":{"node":">=22"}}'],
 ['.nvmrc','20\n'],
 ['src/app.ts',"import {x} from './service';\nexport const app=x;\n"],
 ['src/service.ts',"import {x} from './data';\nexport const x=1;\n"],
 ['src/data.ts','export const data=true;\n'],
 ['src/island.ts','export const island=true;\n'],
];
const files=fixture.map(([path,content])=>({path,content,size:Buffer.byteLength(content),isDirectory:false}));
const input={fileName:'trilogy-t5-fixture',source:'upload',files,
 scanStats:{projectSize:files.reduce((s,x)=>s+x.size,0),filesFound:files.length,
 filesAnalyzed:files.length,filesIgnored:0,ignoredCategories:[]}};
const report=analyzeProject(input);
report.issues=[
 {id:'t5-fixture-critical',affectedFile:'src/app.ts:1',title:'Synthetic critical review observation',
 severity:'critical',category:'runtime',description:'Authored example not real defect',
 reason:'No proven cause',recommendation:'Manually investigate source relationships'},
 {id:'t5-fixture-isolated',affectedFile:'src/island.ts:1',title:'Synthetic unrelated observation',
 severity:'info',category:'runtime',description:'Authored example not real defect',
 reason:'No proven cause',recommendation:'Manually investigate'},
];
const original=JSON.stringify(report);
const options={inventoryComplete:true,expectedInventorySha256:
 buildWholeProjectGraph(report,files,{inventoryComplete:true}).suppliedInventorySha256};
const result=investigateRootCauses(report,files,options);
assert.deepEqual(result,investigateRootCauses(report,[...files].reverse(),options));
assert.equal(JSON.stringify(report),original);
assert.equal(result.rootCauseVerifiedCount,0);
assert.equal(result.originalIssueCount,2);
assert.equal(result.originalUCEIssueRecords.length,2);
assert.ok(result.rootCauseHypotheses.some(g=>g.possibleReachabilityNodeCount===2));
assert.ok(result.ungroupedIssueHashes.includes(sha('t5-fixture-isolated')));
assert.equal(result.originCounts.Both,0);
assert.equal(result.automaticPatchesAllowed,false);
const artifact={
 schemaVersion:1,suite:'trilogy-t5-source-anchored-root-cause-hypotheses',
 benchmark:'authored-relationships-not-independent-human-accuracy',
 authoredSourceSnapshotSha256:sha(JSON.stringify(fixture)),
 report:result,
 realWorldAccuracy:null,independentGroundTruthCases:0,
 rootCausesIndependentlyProven:0,changesToCanonicalUCE:false,
 nativeSolverHostAcceptance:false,releaseReady:false,
};
const output=process.argv.find(a=>a.startsWith('--output='));
if(output)fs.writeFileSync(output.slice('--output='.length),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
