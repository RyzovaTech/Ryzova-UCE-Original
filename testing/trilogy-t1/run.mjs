#!/usr/bin/env node
/** T1 authored source-evidence fixture, not independent accuracy research. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { adjudicateEvidence } from './evidence.mjs';

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const sha = s=>createHash('sha256').update(s).digest('hex');
const source='export const enabled = true;\nexport const target = "web";\n';
const files=[
  {path:'package.json',content:'{"name":"t1-static-test","version":"1.0.0"}',isDirectory:false,size:44},
  {path:'src/demo.ts',content:source,isDirectory:false,size:Buffer.byteLength(source)}
];
const input={files,fileName:'t1-static-test',source:'upload',scanStats:{
  projectSize:files.reduce((n,f)=>n+f.size,0),filesFound:2,filesAnalyzed:2,
  filesIgnored:0,ignoredCategories:[],
}};
const report=analyzeProject(input);
const original=JSON.stringify(report);
// Authored audit probes, NOT UCE-detected vulnerabilities or labeled truth.
report.issues=[
 ['present','src/demo.ts:1'],['disputed','src/demo.ts:1'],
 ['unadjudicated','src/demo.ts'],['missing','src/no-such-file.ts'],
].map(([id,affectedFile])=>({
 id:'t1-fixture-'+id,affectedFile,title:'Synthetic T1 literal evidence probe',
 description:'Not a proven UCE defect',reason:'Authored contract',recommendation:'Review manually',
 category:'runtime',severity:'warning',
}));
const fixture=report.issues.map(x=>x.id);
const check=(findingId,fragment)=>({findingId, file:'src/demo.ts',line:1,
  predicate:'literal-source-fragment-at-line',sourceSha256:sha(source),fragment});
const review=adjudicateEvidence(report,files,[
  check(fixture[0],'enabled = true'),check(fixture[1],'enabled = false'),
]);
assert.equal(review.counts['independently-checked-in-scope'],1);
assert.equal(review.counts.disputed,1);
assert.equal(review.counts['source-referenced'],1);
assert.equal(review.counts.unknown,1);
assert.equal(review.originalIssueCount,4);
assert.equal(review.verifiedCompatibilities,0);
assert.equal(review.recommendationAutoApply,false);
assert.equal(review.independentAccuracy,null);
const second=adjudicateEvidence(report,[...files].reverse(),[
  check(fixture[1],'enabled = false'),check(fixture[0],'enabled = true'),
]);
assert.deepEqual(review,second);
const artifact={
  schemaVersion:1,suite:'trilogy-t1-evidence-reliability',
  source:'authored-predicate-contract-not-human-reviewed-ground-truth',
  baselineCanonicalReportSha256:sha(original),
  sourceFileSha256:sha(source), review,
  releaseReady:false, nativeTrilogySolversRun:false,
  realWorldAccuracyMeasured:false,
};
const output=process.argv.find(x=>x.startsWith('--output='));
if(output) fs.writeFileSync(output.slice(9),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
