#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {fuseAccuracyEvidence} from './fusion.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const fixture=[
 ['package.json','{"name":"trilogy-t4-contract","version":"1.0.0","engines":{"node":">=22"}}'],
 ['.nvmrc','20\n'],
 ['src/app.ts',"import {x} from './linked';\nexport const value=x;\n"],
 ['src/linked.ts','export const x=1;\n'],
];
const files=fixture.map(([path,content])=>({path,content,size:Buffer.byteLength(content),isDirectory:false}));
const input={fileName:'trilogy-t4-contract',source:'upload',files,
 scanStats:{projectSize:files.reduce((s,f)=>s+f.size,0),
 filesFound:files.length,filesAnalyzed:files.length,filesIgnored:0,ignoredCategories:[]}};
const report=analyzeProject(input);
report.issues=[{
 id:'t4-authored-rule-not-truth',affectedFile:'src/app.ts:1',
 title:'Synthetic rule observation for contract test',severity:'warning',
 category:'runtime',description:'T4 only; not a real-world defect',
 reason:'Synthetic input for negative controls',recommendation:'Manual review only',
}];
const canonical=JSON.stringify(report);
const graph=buildWholeProjectGraph(report,files,{inventoryComplete:true});
const linked=graph.edges.find(e=>e.fromSha256===sha('src/app.ts') &&
 e.type==='relative-source-import'&&e.status==='source-supported');
assert.ok(linked);
const options={inventoryComplete:true,
 expectedInventorySha256:graph.suppliedInventorySha256,
 reviewBindings:[{issueId:'t4-authored-rule-not-truth',factId:linked.id,
 expectedFileSha256:sha('src/app.ts')}],
};
const result=fuseAccuracyEvidence(report,files,options);
assert.deepEqual(result,fuseAccuracyEvidence(report,[...files].reverse(),options));
assert.equal(JSON.stringify(report),canonical);
assert.equal(result.originalIssueCount,1);
assert.equal(result.originCounts.Both,0);
assert.equal(result.overlapCounts.reviewOnly,1);
assert.equal(result.suppressedCanonicalIssues,0);
assert.equal(result.developerSafety.releaseReady,false);
assert.equal(result.verification.globalAccuracy,null);
const artifact={schemaVersion:1,suite:'trilogy-t4-accuracy-aware-fusion',
 benchmark:'authored-review-contract-only-not-blinded-ground-truth',
 inputSourcesSha256:sha(JSON.stringify(fixture)),fusion:result,
 humanAdjudicatedCases:0,globalAccuracy:null,
 confirmedRealProjectImpact:false,nativeSolverHostAcceptance:false,
 productionScoringChanged:false,releaseReady:false};
const output=process.argv.find(s=>s.startsWith('--output='));
if(output)fs.writeFileSync(output.slice('--output='.length),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
