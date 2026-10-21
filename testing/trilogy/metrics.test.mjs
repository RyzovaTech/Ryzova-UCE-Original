import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeFiles,validateHoldout,scoreTrilogyHoldout } from './holdout-lib.mjs';

const corpus=JSON.parse(await readFile(new URL('./holdout-v1.json',import.meta.url),'utf8'));

test('frozen independent-from-solver holdout contains 14 conflicts, 14 satisfiable and 12 Unknown',()=>{
  assert.deepEqual(validateHoldout(corpus),{conflict:14,satisfiable:14,unknown:12});
  assert.equal(corpus.provenance.humanReviewed,false);
  assert.equal(corpus.provenance.realWorldRepositorySample,false);
  assert.equal(corpus.provenance.independentExternalAdjudication,false);
});
test('project fixture compiler does not import solver predictions or execute project source',()=>{
  for(const entry of corpus.cases){
    const generated=makeFiles(entry);
    assert.ok(Array.isArray(generated.files)&&generated.files.length>=1);
    assert.ok(generated.files.every(f=>typeof f.path==='string'&&f.isDirectory===false));
    assert.equal(typeof generated.workspace,'string');
  }
});
test('precision, conservative recall and abstention metrics correctly handle Unknown',()=>{
  const cases=['conflict','conflict','satisfiable','satisfiable','unknown','unknown']
    .map((label,i)=>({id:'T'+i,label,title:'Fixture '+i}));
  const found=['conflict','unknown','conflict','satisfiable','conflict','unknown']
    .map((status,i)=>({id:'T'+i,status,elapsedMs:1}));
  const m=scoreTrilogyHoldout(cases,found);
  assert.deepEqual(m.counts,{
    TP:1,FP:1,FN:0,TN:1,abstainedPositive:1,abstainedNegative:0,
    unknownReferenceCorrect:1,unsupportedConflictAssertions:1,unsupportedSatisfiableAssertions:0,
  });
  assert.equal(m.metrics.conflictPrecision,0.5);
  assert.equal(m.metrics.conflictRecallConservative,0.5);
  assert.equal(m.metrics.labeledCoverage,0.75);
  assert.equal(m.metrics.unknownReferenceAbstentionRate,0.5);
  assert.equal(m.metrics.unsupportedAssertionCount,1);
  assert.equal(m.metrics.falsePositiveRateOnDecidedNegatives,0.5);
  assert.equal(m.metrics.falsePositiveRateAllLabeledNegatives,0.5);
});
test('zero classified positives have undefined precision, not artificial perfect precision',()=>{
  const cases=[{id:'C',label:'conflict',title:'fixture'}, {id:'N',label:'satisfiable',title:'fixture'}];
  const m=scoreTrilogyHoldout(cases,[{id:'C',status:'unknown'},{id:'N',status:'unknown'}]);
  assert.equal(m.metrics.conflictPrecision,null);
  assert.equal(m.metrics.conflictRecallConservative,0);
  assert.equal(m.metrics.labeledCoverage,0);
  assert.equal(m.metrics.selectiveAccuracy,null);
});
test('false negatives and withheld benign decisions are not conflated',()=>{
  const cases=[{id:'C',label:'conflict',title:'fixture'}, {id:'N',label:'satisfiable',title:'fixture'}];
  const m=scoreTrilogyHoldout(cases,[{id:'C',status:'satisfiable'},{id:'N',status:'unknown'}]);
  assert.equal(m.counts.FN,1);
  assert.equal(m.counts.abstainedNegative,1);
  assert.equal(m.metrics.conflictRecallConservative,0);
});
test('case alignment and duplicate predictions are mandatory',()=>{
  assert.throws(()=>scoreTrilogyHoldout([{id:'A',label:'conflict'}],[{id:'B',status:'conflict'}]),/Unknown\/duplicate\/missing/);
});

test('unknown negatives stay out of decided-negative FPR but enter clearly named all-negative FPR',()=>{
  const cases=[{id:'S1',label:'satisfiable',title:'a'},{id:'S2',label:'satisfiable',title:'b'},{id:'C',label:'conflict',title:'c'}];
  const seen=[{id:'S1',status:'conflict'},{id:'S2',status:'unknown'},{id:'C',status:'unknown'}];
  const m=scoreTrilogyHoldout(cases,seen);
  assert.equal(m.metrics.falsePositiveRateOnDecidedNegatives,1);
  assert.equal(m.metrics.falsePositiveRateAllLabeledNegatives,0.5);
  assert.equal(m.metrics.balancedAccuracyConservative,0);
});
test('balanced accuracy is undefined if a reference class is absent',()=>{
  const cases=[{id:'C',label:'conflict',title:'only conflict'}];
  const m=scoreTrilogyHoldout(cases,[{id:'C',status:'conflict'}]);
  assert.equal(m.metrics.balancedAccuracyConservative,null);
});
