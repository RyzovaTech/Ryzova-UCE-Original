import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateManifestCorpus, projectMetrics, accuracyClaimReadiness } from './evaluation.mjs';
const fixture = () => ({schemaVersion:1,labelStatus:'agent-provisional',projects:[{repository:'org/repo',commit:'a'.repeat(40),sourcePath:'package.json',sourceSha256:'b'.repeat(64),sourceUrl:`https://github.com/org/repo/blob/${'a'.repeat(40)}/package.json`,upstreamLicense:'MIT',excerptKind:'selected-manifest-fields',ecosystem:'JavaScript',files:[{path:'package.json',content:'{"name":"example"}'}],decisions:[{technology:'Node.js',expected:true,rationale:'Package declaration'},{technology:'Django',expected:false,rationale:'No declaration in excerpt'}]}]});
test('pinned evaluation validates provenance and pairs labels without rewriting expectations',()=>{
  const corpus=fixture();const original=JSON.stringify(corpus);const rows=evaluateManifestCorpus(corpus,[],()=>['Node.js']);
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.passed));assert.equal(JSON.stringify(corpus),original);
  assert.equal(projectMetrics(rows).fullyCorrectProjects,1);
});
test('overlapping and duplicate repositories are rejected case-insensitively',()=>{
  assert.throws(()=>evaluateManifestCorpus(fixture(),['ORG/REPO'],()=>[]),/overlap/);
  const c=fixture();c.projects.push(structuredClone(c.projects[0]));assert.throws(()=>evaluateManifestCorpus(c,[],()=>[]),/overlap/);
});
test('unverified sources and unsafe excerpt paths are rejected',()=>{
  for (const mutate of [p=>p.commit='main',p=>p.sourceUrl='https://example.test/source',p=>p.upstreamLicense='',p=>p.sourceSha256='invalid',p=>p.files=[],p=>p.files.push(p.files[0]),p=>p.files[0].path='../package.json',p=>p.files[0].path='C:/package.json',p=>p.files[0].path='a\\package.json',p=>p.files[0].content='']) {
    const c=fixture();mutate(c.projects[0]);assert.throws(()=>evaluateManifestCorpus(c,[],()=>[]));
  }
});
test('missing, malformed and duplicate labels fail before detector execution',()=>{
  for (const mutate of [p=>p.decisions.pop(),p=>p.decisions[0].expected='true',p=>p.decisions[0].rationale='',p=>p.decisions.push(p.decisions[0])]) {
    const c=fixture();mutate(c.projects[0]);let called=false;assert.throws(()=>evaluateManifestCorpus(c,[],()=>{called=true;return [];}));assert.equal(called,false);
  }
});
test('a perfect provisional sample cannot authorize an accuracy claim',()=>{
  const rows=evaluateManifestCorpus(fixture(),[],()=>['Node.js']);
  const ready=accuracyClaimReadiness({results:rows,repositories:1,coveredModules:['technology']});
  assert.equal(ready.status,'not-established');assert.equal(ready.globalAccuracy,null);assert.equal(ready.automaticGlobalClaim,false);assert.equal(ready.blockers.length,6);
});
const largerEvidence=()=>{
  const results=Array.from({length:100},(_,i)=>({id:'case-'+i,expected:i<50,actual:i<50}));
  return {results,repositories:30,independentlyReviewedDecisionIds:results.map(r=>r.id),independentReviewVerified:true,blindEvaluation:true,fullRepositoryBoundariesVerified:true,coveredModules:['technology','security','compatibility']};
};
test('policy eligibility requires every review, evidence boundary and denominator',()=>{
  assert.equal(accuracyClaimReadiness(largerEvidence()).status,'eligible-for-benchmark-review');
  for (const mutate of [e=>e.independentlyReviewedDecisionIds.pop(),e=>e.independentlyReviewedDecisionIds='all',e=>e.independentReviewVerified=false,e=>e.independentReviewVerified='true',e=>e.blindEvaluation=false,e=>e.blindEvaluation='true',e=>e.fullRepositoryBoundariesVerified=false,e=>e.repositories=29,e=>e.coveredModules=['technology'],e=>e.coveredModules='technology security compatibility',e=>e.results=[]]) {
    const e=largerEvidence();mutate(e);assert.equal(accuracyClaimReadiness(e).status,'not-established');
  }
});
test('failed target metrics block review eligibility and never create a global percentage',()=>{
  const e=largerEvidence();for(let i=0;i<10;i++)e.results[i].actual=false;
  const result=accuracyClaimReadiness(e);assert.equal(result.status,'not-established');assert.equal(result.globalAccuracy,null);assert.ok(result.blockers.some(x=>x.includes('recall')));
});
test('project-level metrics group correlated decisions and retain null empty denominators',()=>{
  assert.equal(projectMetrics([]).projectPassRate,null);
  const rows=[{repository:'a',expected:true,actual:true},{repository:'a',expected:false,actual:true},{repository:'b',expected:true,actual:true}];
  assert.deepEqual(projectMetrics(rows),{repositories:2,fullyCorrectProjects:1,projectPassRate:50,projectPassWilson95:[9.45,90.55]});
});
