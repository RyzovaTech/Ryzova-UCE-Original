#!/usr/bin/env node
/**
 * T3 verification evidence: real source-backed graph, native solvers OFF.
 * This generated artifact makes NO independently adjudicated accuracy claim.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {verifyTrilogyModel} from './verification.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const inputs=[
 ['package.json','{"name":"trilogy-t3-demo","version":"1.0.0"}'],
 ['src/root.ts',"import './child';\nexport const root = true;"],
 ['src/child.ts',"export const child = true;"],
].map(([path,content])=>({path,content,size:Buffer.byteLength(content),isDirectory:false}));
const input={fileName:'trilogy-t3-demo',source:'upload',files:inputs,
 scanStats:{filesFound:inputs.length,filesAnalyzed:inputs.length,
 filesIgnored:0,projectSize:inputs.reduce((s,x)=>s+x.size,0),ignoredCategories:[]}};
const report=analyzeProject(input);
const canonical=JSON.stringify(report);
const settings={enabled:true,inventoryComplete:true,roots:['src/root.ts']};
const checked=verifyTrilogyModel(report,inputs,settings);
const reordered=verifyTrilogyModel(report,[...inputs].reverse(),settings);
assert.deepEqual(checked,reordered);
assert.equal(JSON.stringify(report),canonical);
assert.equal(checked.status,'model-consistent-review-only');
assert.equal(checked.nativeVerification,'not-run');
assert.equal(checked.automaticFixAllowed,false);
assert.equal(checked.verifiedCompatibility,false);
const nativeRequested=verifyTrilogyModel(report,inputs,{...settings,nativeSolvers:true});
assert.equal(nativeRequested.status,'unknown');
const artifact={
 schemaVersion:1,suite:'trilogy-t3-independent-verification-safety',
 source:'authored-fixture-no-human-adjudication',
 inputSha256:sha(JSON.stringify(inputs)),
 consistentSourceGraph:checked,
 attemptedNativeRequest:nativeRequested,
 released:false,realWorldAccuracy:null,buildRuntimeVerified:false,
};
const target=process.argv.find(s=>s.startsWith('--output='));
if(target)fs.writeFileSync(target.slice(9),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
