#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { evaluateDatalogZ3Cvc5 } from '../../experiments/datalog-z3/triple.mjs';
import { makeFiles, validateHoldout, scoreTrilogyHoldout } from './holdout-lib.mjs';

const file = fileURLToPath(new URL('./holdout-v1.json',import.meta.url));
const corpus=JSON.parse(await readFile(file,'utf8'));
validateHoldout(corpus);

const observations=[];
for(const entry of corpus.cases){
  const {files,workspace}=makeFiles(entry);
  const started=performance.now();
  let output;
  try { output=await evaluateDatalogZ3Cvc5(files,{workspace}); }
  catch { output={status:'unknown',verification:'incomplete'}; }
  const status=['conflict','satisfiable','unknown'].includes(output.status)?output.status:'unknown';
  observations.push({
    id:entry.id,status,verification:output.verification??null,
    elapsedMs:Math.round((performance.now()-started)*100)/100,
  });
}
const result=scoreTrilogyHoldout(corpus.cases,observations);
const out={
  ...result,
  corpus:{
    schema:corpus.schema,frozenAt:corpus.frozenAt,
    independentlyHumanReviewed:corpus.provenance.humanReviewed,
    externallyAdjudicated:corpus.provenance.independentExternalAdjudication,
    realWorldRepositorySample:corpus.provenance.realWorldRepositorySample,
  },
  environment:{node:process.version,platform:process.platform,ci:process.env.CI==='true',
    githubSha:process.env.GITHUB_SHA??null},
  gates:{
    noFalsePositives:result.counts.FP===0,
    noFalseNegatives:result.counts.FN===0,
    noUnsupportedAssertions:result.metrics.unsupportedAssertionCount===0,
    referenceUnknownAbstained:result.counts.unknownReferenceCorrect===12,
    minimumKnownCoverage:result.metrics.labeledCoverage!==null && result.metrics.labeledCoverage>=0.90,
  },
};
out.status=Object.values(out.gates).every(Boolean)?'pass':'fail';
const outPath=resolve(dirname(file),'reports/latest-holdout.json');
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({
  status:out.status,n:out.n,referenceCounts:out.referenceCounts,
  confusion:out.confusion,counts:out.counts,metrics:out.metrics,gates:out.gates,
  reportPath:'testing/trilogy/reports/latest-holdout.json',
  qualification:'Authored synthetic holdout, NOT independently human-reviewed real repository accuracy.',
},null,2));
if (out.status!=='pass') process.exitCode=1;
