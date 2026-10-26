import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {investigateRootCauses} from './root-causes.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const f=(path,content)=>({path,content,size:Buffer.byteLength(content??''),isDirectory:false});
const source=()=>[
 f('package.json','{"name":"t5","engines":{"node":">=22"}}'),
 f('.nvmrc','20\n'),
 f('src/app.ts',"import './service';\nexport const app=true;"),
 f('src/service.ts',"import './db';\nexport const service=true;"),
 f('src/db.ts','export const db=1;'),
 f('src/island.ts','export const island=true;'),
];
const issue=(id,path,severity='warning',title='Same headline')=>({
 id,affectedFile:path,severity,title,
 category:'runtime',description:'Authored fixture, not a real-world defect',
 reason:'Unverified root-cause hypothesis only',recommendation:'Review source',
});
function report(issues=[issue('a','src/app.ts:1','critical'),issue('b','src/app.ts:2','warning'),
 issue('c','src/island.ts:1','info')],partial=false){
 return {
  id:'report-1',createdAt:'today',analysisVersion:'3.0.0-beta.1',
  classification:{isSoftware:true},
  score:{overall:90,applicableCategories:['runtime']},
  categories:[{id:'runtime',label:'Runtime',status:'warning',score:90,issues:[]}],
  issues,stack:{},summary:{name:'t5',scanStats:{
   projectSize:100,filesFound:6,filesAnalyzed:6,filesIgnored:0,
   ignoredCategories:[],truncated:partial,ruleFailures:[],
  },analysisCoverage:{status:partial?'partial':'full',
   filesFound:6,filesAnalyzed:6,fileCoveragePercent:100}},
 };
}
const opts=(r,files)=>({inventoryComplete:true,expectedInventorySha256:
 buildWholeProjectGraph(r,files,{inventoryComplete:true}).suppliedInventorySha256});
test('T5 produces source-anchored hypotheses with two-hop bounded links, not proven causes',()=>{
 const files=source(),r=report(),o=investigateRootCauses(r,files,opts(r,files));
 const app=o.rootCauseHypotheses.find(g=>g.anchorSha256===sha('src/app.ts'));
 assert.ok(app);
 assert.equal(app.kind,'source-relationship-investigation');
 assert.equal(app.status,'review-hypothesis-only');
 assert.equal(app.rawIssueCount,2);
 assert.equal(app.possibleReachabilityNodeCount,2);
 assert.equal(app.directAndTransitiveFactIds.length,2);
 assert.equal(app.rootCauseVerified,false);
 assert.equal(app.causalityProven,false);
 assert.equal(app.blastRadiusVerified,false);
 assert.equal(o.rootCauseVerifiedCount,0);
 assert.equal(o.validCausalInference,false);
 assert.equal(o.candidatesForManualReview,o.rootCauseHypotheses.length);
});
test('all original UCE issues survive including isolated ones, with original score parity',()=>{
 const r=report(),files=source(),before=JSON.stringify(r),fs=JSON.stringify(files);
 const o=investigateRootCauses(r,files,opts(r,files));
 assert.equal(JSON.stringify(r),before);assert.equal(JSON.stringify(files),fs);
 assert.equal(o.originalCoreScore,90);
 assert.equal(o.originalIssueCount,3);
 assert.equal(o.originalUCEIssueRecords.length,3);
 assert.equal(new Set(o.originalUCEIssueRecords.map(x=>x.issueSha256)).size,3);
 assert.equal(o.originalIssuesDropped,0);
 assert.equal(o.originCounts.Both,0);
 assert.equal(o.canonicalScoreChanged,false);
 assert.equal(o.canonicalIssueRecordsChanged,false);
 assert.deepEqual(o.ungroupedIssueHashes,[sha('c')]);
 assert.equal(o.automaticPatchesAllowed,false);
});
test('critical UCE review anchors rank before warning and runtime-only candidate',()=>{
 const files=source();
 const r=report([issue('critical','src/app.ts','critical'),
  issue('warning','src/service.ts','warning'),
  issue('runtime','package.json','info')]);
 const o=investigateRootCauses(r,files,opts(r,files));
 assert.ok(o.rootCauseHypotheses.length>=3);
 assert.equal(o.rootCauseHypotheses[0].anchorSha256,sha('src/app.ts'));
 assert.ok(o.rootCauseHypotheses.every(x=>x.priorityBasis==='existing-uce-severity-only-not-validated-impact'));
 assert.ok(o.rootCauseHypotheses.some(x=>x.kind==='runtime-constraint-investigation'));
});
test('runtime mismatch gets manual constraint review even without UCE issue on manifest',()=>{
 const files=source(),r=report([]);
 const o=investigateRootCauses(r,files,opts(r,files));
 const runtime=o.rootCauseHypotheses.find(g=>g.anchorSha256===sha('package.json'));
 assert.ok(runtime);
 assert.equal(runtime.kind,'runtime-constraint-investigation');
 assert.equal(runtime.rawIssueCount,0);
 assert.equal(runtime.runtimeReviewFactIds.length,1);
 assert.equal(runtime.safeFixKnown,false);
 assert.equal(o.originalIssueCount,0);
});
test('a matching file title, severity or category alone cannot merge separated issues',()=>{
 const files=source();
 const r=report([issue('x','src/app.ts'),issue('y','src/island.ts')]);
 const o=investigateRootCauses(r,files,opts(r,files));
 const matched=o.rootCauseHypotheses.filter(g=>g.issueHashes.length>0);
 assert.equal(matched.length,1);
 assert.equal(matched[0].issueHashes.length,1);
 assert.equal(o.originCounts.Both,0);
 assert.equal(o.originalIssueCount,2);
});
test('disputed literal source proof never auto-deletes a warning or upgrades root confidence',()=>{
 const files=source(),r=report([issue('x','src/app.ts:1')]);
 const o=investigateRootCauses(r,files,{...opts(r,files),assertions:[{
  findingId:'x',file:'src/app.ts',line:1,predicate:'literal-source-fragment-at-line',
  sourceSha256:sha(files[2].content),fragment:'not actually present',
 }]});
 assert.equal(o.originalUCEIssueRecords.length,1);
 assert.equal(o.originalUCEIssueRecords[0].sourceObservationStatus,'disputed');
 assert.equal(o.originalUCEIssueRecords[0].suppressed,false);
 assert.equal(o.rootCauseVerifiedCount,0);
});
test('partial canonical scan abstains, never declares root cause or healthy project',()=>{
 const files=source(),r=report(undefined,true);
 const o=investigateRootCauses(r,files,opts(r,files));
 assert.equal(o.coverageStatus,'abstained-incomplete-evidence');
 assert.equal(o.rootCauseHypotheses.length,0);
 assert.equal(o.ungroupedIssueHashes.length,3);
 assert.equal(o.rootCauseVerifiedCount,0);
 assert.equal(o.originalIssuesDropped,0);
});
test('untrusted absence of pinned inventory disables all grouped impact hypotheses',()=>{
 const files=source(),r=report();
 for(const x of [{inventoryComplete:true},{inventoryComplete:false},
  {inventoryComplete:false,expectedInventorySha256:opts(r,files).expectedInventorySha256}]){
  const o=investigateRootCauses(r,files,x);
  assert.equal(o.coverageStatus,'abstained-incomplete-evidence');
  assert.equal(o.rootCauseHypotheses.length,0);
 }
});
test('unmodeled package imports and unresolved modules abort causal grouping globally',()=>{
 const r=report();
 for(const injected of ["import 'outside-package';\n","import './not-present';\n",
  "import(dynamicExpr);\n"]){
  const files=source();
  files[3]=f('src/service.ts',files[3].content+'\n'+injected);
  const o=investigateRootCauses(r,files,opts(r,files));
  assert.equal(o.coverageStatus,'abstained-incomplete-evidence');
  assert.equal(o.rootCauseHypotheses.length,0);
  assert.equal(o.originalUCEIssueRecords.length,3);
 }
});
test('unreadable file, parser failure and partial inventory cannot invent blast radius',()=>{
 const r=report();
 const bads=[
  [...source().slice(0,4),{path:'src/db.ts',content:undefined},source()[5]],
  source().map(x=>x.path==='src/db.ts'?f('src/db.ts',"import { from './x';"):x),
 ];
 for(const files of bads){
  const o=investigateRootCauses(r,files,opts(r,files));
  assert.equal(o.rootCauseHypotheses.length,0);
  assert.equal(o.coverageStatus,'abstained-incomplete-evidence');
 }
});
test('bounded preview budget discloses clipped neighborhood instead of hidden full propagation',()=>{
 const files=source(),r=report();
 const x=investigateRootCauses(r,files,{...opts(r,files),neighborLimit:1});
 const anchor=x.rootCauseHypotheses.find(g=>g.anchorSha256===sha('src/app.ts'));
 assert.ok(anchor);
 assert.equal(anchor.directAndTransitiveFactIds.length,1);
 assert.equal(anchor.truncatedByPreviewBudget,true);
 assert.equal(anchor.blastRadiusVerified,false);
});
test('bounded depth one excludes second hop without claiming checked impact',()=>{
 const files=source(),r=report();
 const x=investigateRootCauses(r,files,{...opts(r,files),graphDepth:1});
 const g=x.rootCauseHypotheses.find(x=>x.anchorSha256===sha('src/app.ts'));
 assert.equal(g.possibleReachabilityNodeCount,1);
 assert.equal(g.traversalMaxDepth,1);
});
test('group output cap reports omissions and leaves dropped-priority UCE issues visible',()=>{
 const files=source(),r=report();
 const x=investigateRootCauses(r,files,{...opts(r,files),maxGroups:1});
 assert.equal(x.rootCauseHypotheses.length,1);
 assert.ok(x.omittedHypotheses>=1);
 assert.equal(x.originalIssueCount,3);
 assert.ok(x.ungroupedIssueHashes.includes(sha('c')));
});
test('stable ordering of source files and random report IDs yields identical hypotheses',()=>{
 const files=source(),a=report(),b=structuredClone(a);
 b.id='random-2099';b.createdAt='2099';
 b.summary.scanStats.scanTimeMs=19191;
 const optsA=opts(a,files),optsB=opts(b,files);
 assert.deepEqual(investigateRootCauses(a,files,optsA),
   investigateRootCauses(b,[...files].reverse(),optsB));
});
test('untrusted native solver and browser Both claims in options are ignored, never promoted',()=>{
 const files=source(),r=report();
 const o=investigateRootCauses(r,files,{...opts(r,files),
  nativeSolver:{status:'modeled-conflict',verified:true},
  verifiedRootCause:true,origin:'Both',safePatch:true});
 assert.equal(o.rootCauseVerifiedCount,0);
 assert.equal(o.originCounts.Both,0);
 assert.equal(o.automaticPatchesAllowed,false);
 assert.equal(o.nativeSolvers,'not-invoked');
 assert.equal(o.verifiedBuildOrRuntime,false);
});
test('path traversal and source tampering never appear in issue relationships',()=>{
 const files=source(),r=report([issue('evil','../secret')]);
 const o=investigateRootCauses(r,files,opts(r,files));
 assert.equal(o.ungroupedIssueHashes.length,1);
 assert.ok(!JSON.stringify(o).includes('../secret'));
 assert.equal(o.originalUCEIssueRecords[0].sourceLocationSha256,null);
 assert.equal(o.rootCauseVerifiedCount,0);
});
test('invalid graph limits, ambiguous issue IDs, bad inventory hashes fail explicitly',()=>{
 const f=source(),r=report();
 for(const options of [{maxGroups:0},{graphDepth:3},{neighborLimit:500},
  {maxIssues:10},{inventoryComplete:'true'}])
  assert.throws(()=>investigateRootCauses(r,f,options));
 assert.throws(()=>investigateRootCauses(
  report([issue('x','src/app.ts'),issue('x','src/service.ts')]),f));
 assert.throws(()=>investigateRootCauses(r,f,{
  ...opts(r,f),expectedInventorySha256:'a'.repeat(64)
 }));
});
test('author-provisional source graph is never independent real-world accuracy proof',()=>{
 const files=source(),r=report(),o=investigateRootCauses(r,files,opts(r,files));
 assert.equal(o.accuracy.globalAccuracy,null);
 assert.equal(o.accuracy.precision,null);
 assert.equal(o.accuracy.recall,null);
 assert.equal(o.accuracy.recommendationCorrectness,null);
 assert.equal(o.confidence,'uncalibrated-no-independent-ground-truth');
 assert.equal(o.recommendationSafety,'not-established');
 assert.equal(o.releaseReady,false);
});
test('empty repository reports no fabricated root cause and maintains correct original issue count',()=>{
 const files=source(),r=report([]);
 const x=investigateRootCauses(r,files,opts(r,files));
 assert.equal(x.originalUCEIssueRecords.length,0);
 assert.equal(x.originalIssueCount,0);
 assert.equal(x.originalIssuesDropped,0);
 assert.equal(x.rootCauseVerifiedCount,0);
 assert.ok(x.rootCauseHypotheses.every(h=>h.rawIssueCount===0));
});
test('bounded 5k source-independent canonical issues preserve one-to-one provenance',()=>{
 const files=source(),r=report(Array.from({length:5000},(_,i)=>issue('id-'+i,'src/island.ts')));
 const x=investigateRootCauses(r,files,opts(r,files));
 assert.equal(x.originalUCEIssueRecords.length,5000);
 assert.equal(x.ungroupedIssueHashes.length,5000);
 assert.equal(x.rootCauseVerifiedCount,0);
 assert.equal(x.originalIssuesDropped,0);
 r.issues.push(issue('overflow','src/island.ts'));
 assert.throws(()=>investigateRootCauses(r,files),/budget|5000/i);
});
