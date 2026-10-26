#!/usr/bin/env node
/**
 * T6 reproducible authored, reviewer-selected node-pin preview fixture.
 * No fix is applied, no command from analyzed source is executed.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {investigateRootCauses} from '../trilogy-t5/root-causes.mjs';
import {previewDeveloperFixes} from './proposals.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const fixture=[
 ['package.json','{"name":"t6-review-fixture","engines":{"node":">=22"}}'],
 ['.nvmrc','20\n'],
 ['src/index.ts','export const ready = true;'],
];
const files=fixture.map(([path,content])=>({
 path,content,size:Buffer.byteLength(content),isDirectory:false}));
const input={fileName:'t6-review-fixture',source:'upload',files,
 scanStats:{projectSize:files.reduce((s,f)=>s+f.size,0),
 filesFound:files.length,filesAnalyzed:files.length,filesIgnored:0,
 ignoredCategories:[]}};
const report=analyzeProject(input);
const oldReport=JSON.stringify(report),oldFiles=JSON.stringify(files);
const graph=buildWholeProjectGraph(report,files,{inventoryComplete:true});
const t5=investigateRootCauses(report,files,{inventoryComplete:true,
 expectedInventorySha256:graph.suppliedInventorySha256});
const runtime=t5.rootCauseHypotheses.find(h=>h.kind==='runtime-constraint-investigation');
assert.ok(runtime);
const options={inventoryComplete:true,
 expectedInventorySha256:graph.suppliedInventorySha256,
 requests:[{
  hypothesisId:runtime.hypothesisId,evidenceFactId:runtime.runtimeReviewFactIds[0],
  manifestPath:'package.json',pinPath:'.nvmrc',
  expectedPinSha256:sha('20\n'),requestedMajor:22,
 }]};
const first=previewDeveloperFixes(report,files,options);
const second=previewDeveloperFixes(report,[...files].reverse(),options);
assert.deepEqual(first,second);
assert.equal(first.proposalCount,1);
assert.equal(first.proposals[0].status,'reviewable-preview-only');
assert.equal(first.proposals[0].patch.newText,'22\n');
assert.equal(first.appliedPatches,0);
assert.equal(first.confirmedRootCauses,0);
assert.equal(JSON.stringify(report),oldReport);
assert.equal(JSON.stringify(files),oldFiles);
const artifact={
 schemaVersion:1,suite:'trilogy-t6-developer-safe-fix-previews',
 benchmark:'authored-reviewer-request-contract-not-real-world-fix-correctness',
 sourceFixtureSha256:sha(JSON.stringify(fixture)),
 preview:first,actuallyApplied:false,buildAndRuntimeVerified:false,
 originalUCEReportUnchanged:true,
 humanAdjudicatedFixCases:0,recommendationAccuracy:null,releaseReady:false,
};
const path=process.argv.find(s=>s.startsWith('--output='));
if(path)fs.writeFileSync(path.slice('--output='.length),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
