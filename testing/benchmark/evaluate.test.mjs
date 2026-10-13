import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluate } from './evaluate.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';
const corpus=()=>JSON.parse(fs.readFileSync(new URL('./corpus.json',import.meta.url),'utf8'));
test('silent detector fails recall and noisy detector fails precision',()=>{
  const silent=evaluate(corpus(),()=>[]);assert.equal(silent.metrics.fn,10);assert.equal(silent.metrics.recall,0);assert.equal(silent.metrics.precision,null);
  const noisy=evaluate(corpus(),c=>[{id:c.finding}]);assert.equal(noisy.metrics.fp,20);assert.equal(noisy.metrics.precision,33.33);assert.equal(noisy.priorities.length,10);
});
test('perfect provisional results never establish a 95% global claim',()=>{
  const result=evaluate(corpus(),c=>c.expected?[{id:c.finding}]:[]);
  assert.equal(result.metrics.precision,100);assert.equal(result.metrics.recall,100);
  assert.equal(result.claim.status,'not-established');assert.equal(result.globalAccuracy,null);assert.equal(result.claim.perRuleWilsonLowerBoundsMeetTarget,false);
});
test('invalid or incomplete evidence fails before detector execution',()=>{
  for(const change of [c=>c.cases.push(c.cases[0]),c=>c.cases[0].evidence[0].line=999,c=>c.cases[0].files[0].path='../go.mod',c=>c.cases[0].rationale='',c=>c.cases[0].expected=false,c=>c.cases.splice(1,1)]){
    const c=corpus();change(c);let calls=0;assert.throws(()=>evaluate(c,()=>{calls++;return [];}));assert.equal(calls,0);
  }
});
test('unexpected findings stay visible but are not silently labeled false positives',()=>{
  const r=evaluate(corpus(),()=>[{id:'unadjudicated-rule',severity:'warning'}]);assert.equal(r.metrics.fp,0);assert.equal(r.results[0].actualFindings[0].id,'unadjudicated-rule');
});
const rule=load('src/lib/compatibility/rules/extended-runtime.ts').extendedRuntimeRules.find(r=>r.id==='dotnet-target-framework');
const run=entries=>rule.run({files:Object.entries(entries).map(([path,content])=>({path,content,isDirectory:false,size:content?.length??0})),stack:{runtime:'.NET'},detectedFiles:[]});
test('nearest inherited metadata wins; siblings cannot hide missing targets',()=>{
  assert.equal(run({'src/App.csproj':'<Project />','Directory.Build.props':'<Project><TargetFramework>net8.0</TargetFramework></Project>','src/Directory.Build.props':'<Project />'}).length,1);
  assert.equal(run({'src/App.csproj':'<Project />','other/Directory.Build.props':'<TargetFramework>net8.0</TargetFramework>'}).length,1);
});
test('comments and empty targets do not count; multiple production projects are checked',()=>{
  const findings=run({'A.csproj':'<Project><!-- <TargetFramework>net8.0</TargetFramework> --></Project>','B.csproj':'<Project><TargetFramework> </TargetFramework></Project>','C.csproj':'<Project><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></Project>'});
  assert.deepEqual(findings.map(f=>f.affectedFile),['A.csproj','B.csproj']);
});
test('unread metadata and dynamic imports are uncertain, not confirmed missing',()=>{
  assert.equal(run({'src/App.csproj':'<Project />','Directory.Build.props':undefined}).length,0);
  assert.equal(run({'App.csproj':'<Project><Import Project="external.props" /></Project>'}).length,0);
});
