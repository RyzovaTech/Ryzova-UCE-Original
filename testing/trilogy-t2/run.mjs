#!/usr/bin/env node
/** Authored whole-project graph probe; not a real-world accuracy trial. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {buildWholeProjectGraph} from './graph.mjs';
const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const sha=s=>createHash('sha256').update(s).digest('hex');
const values=[
 ['package.json',JSON.stringify({name:'t2-authored',engines:{node:'>=22'}})],
 ['.nvmrc','20\n'],
 ['src/main.ts',"import {x} from './helper';\nimport '@sample/core';\nimport './possibly-generated';\n"],
 ['src/helper.ts','export const x = 42;\n'],
 ['packages/core/package.json',JSON.stringify({name:'@sample/core',version:'0.1.0'})],
 ['packages/core/src/index.ts','export const core = true;\n'],
];
const files=values.map(([path,content])=>({path,content,size:Buffer.byteLength(content),isDirectory:false}));
const input={fileName:'t2-authored',source:'upload',files,scanStats:{
 projectSize:files.reduce((v,f)=>v+f.size,0),filesFound:files.length,
 filesAnalyzed:files.length,filesIgnored:0,ignoredCategories:[],
}};
const report=analyzeProject(input);
const before=JSON.stringify(report);
const a=buildWholeProjectGraph(report,files,{inventoryComplete:true});
const b=buildWholeProjectGraph(report,[...files].reverse(),{inventoryComplete:true});
assert.deepEqual(a,b,'Graph must be deterministic across file ordering');
assert.equal(JSON.stringify(report),before,'Canonical report must be immutable');
assert.ok(a.counts.sourceSupported>=2,'Local and workspace import edges must be observed');
assert.equal(a.counts.runtimeReviewRequired,1,'Explicit Node pinned disagreement must require review');
assert.equal(a.verifiedCompatibilityCount,0);
assert.equal(a.independentlyAdjudicatedAccuracy,null);
assert.equal(a.automaticPatchesAllowed,false);
const output={
 schemaVersion:1,suite:'trilogy-t2-whole-project-relationships',
 benchmark:'authored-source-graph-contract-not-blinded-accuracy',
 fileSnapshotSha256:sha(JSON.stringify(values)),
 canonicalScoreUnchanged:true, originalIssueCount:report.issues.length,
 graph:a, groundTruthAccuracy:null, humanReviewedCases:0,
 runtimeVerified:false, nativeSolversRun:false, releaseReady:false,
};
const target=process.argv.find(s=>s.startsWith('--output='));
if(target)fs.writeFileSync(target.slice(9),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
