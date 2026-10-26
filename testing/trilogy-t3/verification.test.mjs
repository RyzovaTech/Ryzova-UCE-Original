import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTrilogyModel} from './verification.mjs';
const file=(path,content)=>({path,content,size:Buffer.byteLength(content??''),isDirectory:false});
function report(partial=false){
 return {id:'r1',createdAt:'2026',analysisVersion:'3.0.0-beta.1',
  classification:{isSoftware:true},
  summary:{name:'t3',scanStats:{filesFound:3,filesAnalyzed:3,filesIgnored:0,
   projectSize:200,ignoredCategories:[],truncated:partial},
   analysisCoverage:{status:partial?'partial':'full',filesFound:3,
   filesAnalyzed:3,fileCoveragePercent:100}},
  score:{overall:99,applicableCategories:['runtime']},stack:{},issues:[],
  categories:[{id:'runtime',status:'warning',label:'Runtime',score:99,issues:[]}]};
}
const files=()=>[
 file('package.json','{"name":"demo","engines":{"node":">=22"}}'),
 file('.nvmrc','20\n'),
 file('src/root.ts',"import './child';\nexport const value=1;"),
 file('src/child.ts',"import './grandchild';\nexport const child=true;"),
 file('src/grandchild.ts','export const grandchild=true;'),
];
const opts={enabled:true,inventoryComplete:true,roots:['src/root.ts']};
test('T3 defaults to disabled and cannot accidentally execute native solvers',()=>{
 const r=verifyTrilogyModel(report(),files(),{enabled:false});
 assert.equal(r.status,'disabled');assert.equal(r.nativeVerification,'not-run');
 assert.ok(Object.values(r.stages).every(x=>x==='not-run'));
 assert.equal(r.automaticFixAllowed,false);
});
test('dual traversals independently agree on cross-file reachability without certifying project',()=>{
 const r=report(),f=files(),before=JSON.stringify([r,f]);
 const result=verifyTrilogyModel(r,f,opts);
 assert.equal(result.status,'model-consistent-review-only');
 assert.equal(result.modelAgreement,true);
 assert.equal(result.reachability.length,1);
 assert.equal(result.reachability[0].modeledReachableNodes,3);
 assert.equal(result.originalCoreScore,99);
 assert.equal(result.originalIssueCount,0);
 assert.equal(result.verifiedCompatibility,false);
 assert.equal(result.verifiedVulnerability,false);
 assert.equal(result.verifiedBuildOrRuntime,false);
 assert.equal(result.independentAccuracy,null);
 assert.equal(JSON.stringify([r,f]),before);
});
test('synthetic source code is parsed but never imported or executed',()=>{
 const f=[file('src/root.ts',"throw new Error('never-run');\nimport './child';"),
  file('src/child.ts','export const child = true')];
 const result=verifyTrilogyModel(report(),f,opts);
 assert.equal(result.status,'model-consistent-review-only');
 assert.equal(result.reachability[0].modeledReachableNodes,2);
});
test('T3 never launches native tools even with forged isolation-claim option',()=>{
 const result=verifyTrilogyModel(report(),files(),{
   ...opts,nativeSolvers:true,strictIsolationAttested:true,cgroupRoot:'/sys/fs/cgroup',
 });
 assert.equal(result.status,'unknown');
 assert.equal(result.reason,'hard-process-tree-isolation-and-real-native-solver-gates-not-met');
 assert.equal(result.nativeVerification,'not-run');
 assert.ok(Object.values(result.stages).every(x=>x==='not-run'));
 assert.equal(result.automaticFixAllowed,false);
});
test('unauthed supplied sources never promote model consistency to verified truth',()=>{
 const result=verifyTrilogyModel(report(),files(),opts);
 assert.equal(result.sourceSnapshotAuthenticated,false);
 assert.equal(result.verifiedSourceClaimCount,0);
 assert.equal(result.claimedIndependentNativeProofs,0);
 assert.equal(result.verifiedCompatibility,false);
});
test('missing entrypoint cannot yield a healthy success verdict',()=>{
 const result=verifyTrilogyModel(report(),files(),
  {enabled:true,inventoryComplete:true,roots:['src/not-present.ts']});
 assert.equal(result.status,'unknown');
 assert.equal(result.reason,'requested-entrypoint-not-in-supplied-snapshot');
});
test('partial UCE report keeps T3 Unknown even if imports look valid',()=>{
 const r=verifyTrilogyModel(report(true),files(),opts);
 assert.equal(r.status,'unknown');
 assert.equal(r.automaticFixAllowed,false);
});
test('missing unreadable source, parse failure and nonliteral import cause Unknown',()=>{
 const fixtures=[
  [file('src/root.ts',"import './child';"),{path:'src/child.ts',content:undefined}],
  [file('src/root.ts',"import { from './child';")],
  [file('src/root.ts',"import(part);")],
 ];
 for(const f of fixtures){
  const r=verifyTrilogyModel(report(),f,opts);
  assert.equal(r.status,'unknown');
  assert.equal(r.modelAgreement,false);
 }
});
test('source and file ordering do not change canonical model evidence',()=>{
 const a=report(),b=structuredClone(a),f=files();
 b.id='new-generated-id';b.createdAt='2099';
 b.summary.scanStats.scanTimeMs=9999;
 assert.deepEqual(verifyTrilogyModel(a,f,opts),verifyTrilogyModel(b,[...f].reverse(),opts));
});
test('multiple entrypoints stay bounded and report separate graph digests',()=>{
 const result=verifyTrilogyModel(report(),files(),{
  ...opts,roots:['src/child.ts','src/root.ts']});
 assert.equal(result.status,'model-consistent-review-only');
 assert.equal(result.matchedRoots,2);
 assert.equal(result.reachability.length,2);
 const visited=result.reachability.map(x=>x.modeledReachableNodes).sort();
 assert.deepEqual(visited,[2,3]);
});
test('invalid opt-in settings, entrypoint traversal, overbudget count and duplicates reject',()=>{
 for(const invalid of [
  {},{enabled:'yes'}, {enabled:true,roots:['../secret']},
  {enabled:true,roots:['src/root.ts','src/root.ts']},
  {enabled:true,roots:Array.from({length:9},(_,i)=>'src/x'+i+'.ts')},
  {enabled:true,nativeSolvers:'on'},
 ])
  assert.throws(()=>verifyTrilogyModel(report(),files(),invalid));
 assert.throws(()=>verifyTrilogyModel(report(),[...files(),files()[0]],opts));
});
test('repeated inputs keep result deterministic and never leak raw source fragments',()=>{
 const result=verifyTrilogyModel(report(),files(),opts);
 assert.deepEqual(result,verifyTrilogyModel(report(),files(),opts));
 assert.ok(!JSON.stringify(result).includes("import './child'"));
 assert.ok(!JSON.stringify(result).includes('src/root.ts'));
 assert.equal(result.patchesGenerated,0);
});
