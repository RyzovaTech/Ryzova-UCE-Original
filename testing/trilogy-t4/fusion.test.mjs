import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fuseAccuracyEvidence} from './fusion.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';

const digest=s=>createHash('sha256').update(s).digest('hex');
const file=(path,content)=>({path,content,isDirectory:false,size:Buffer.byteLength(content??'')});
const source="import {dep} from './dep';\nexport const result = dep;\n";
const makeFiles=()=>[
 file('package.json',JSON.stringify({name:'demo',engines:{node:'>=22'}})),
 file('.nvmrc','20\n'),
 file('src/app.ts',source),
 file('src/dep.ts','export const dep = 1;\n'),
];
const issue=(id='issue-one',path='src/app.ts:1')=>({
 id,affectedFile:path,title:'Same title does not establish same defect',
 severity:'warning',category:'runtime',description:'Synthetic rule for T4 only',
 reason:'No independent adjudication',recommendation:'Manual review only',
});
function report(list=[issue()],partial=false){
 return {
 id:'report',createdAt:'2026',analysisVersion:'3.0.0-beta.1',
 classification:{isSoftware:true},
 score:{overall:94,applicableCategories:['runtime']},
 categories:[{id:'runtime',label:'Runtime',status:'warning',score:94,issues:[]}],
 issues:list,stack:{},
 summary:{name:'t4',scanStats:{filesFound:4,filesAnalyzed:4,
 filesIgnored:0,ignoredCategories:[],projectSize:100,truncated:partial},
 analysisCoverage:{status:partial?'partial':'full',filesFound:4,
 filesAnalyzed:4,fileCoveragePercent:100}},
 };
}
const opts=(r,f)=>({inventoryComplete:true,
 expectedInventorySha256:buildWholeProjectGraph(r,f,{inventoryComplete:true}).suppliedInventorySha256});
const withBinding=(r,f,issueId='issue-one')=>{
 const graph=buildWholeProjectGraph(r,f,{inventoryComplete:true});
 const fact=graph.edges.find(x=>x.type==='relative-source-import'&&
  x.fromSha256===digest('src/app.ts'));
 assert.ok(fact);
 return {issueId,factId:fact.id,expectedFileSha256:digest('src/app.ts')};
};
test('canonical UCE score/issues untouched; independent graph fact stays separate source observation',()=>{
 const r=report(),f=makeFiles(), before=JSON.stringify(r),beforeFiles=JSON.stringify(f);
 const fused=fuseAccuracyEvidence(r,f,opts(r,f));
 assert.equal(JSON.stringify(r),before);
 assert.equal(JSON.stringify(f),beforeFiles);
 assert.equal(fused.originalScore,94);
 assert.equal(fused.originalIssueCount,1);
 assert.equal(fused.originCounts.UCE,1);
 assert.ok(fused.originCounts.Trilogy>=2);
 assert.equal(fused.originCounts.Both,0);
 assert.equal(fused.fusionDeduplicatedCanonicalIssues,0);
 assert.equal(fused.verification.globalAccuracy,null);
 assert.equal(fused.developerSafety.automaticFixesAllowed,false);
});
test('explicit matching same-source claim only yields a review overlap, never Both',()=>{
 const r=report(),f=makeFiles();
 const bind=withBinding(r,f);
 const result=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[bind]});
 assert.equal(result.overlapCounts.reviewOnly,1);
 assert.equal(result.overlapsForReview[0].promotedToBoth,false);
 assert.equal(result.overlapsForReview[0].verifiedIssue,false);
 assert.equal(result.originCounts.Both,0);
 assert.equal(result.suppressedCanonicalIssues,0);
});
test('identical titles or severity without exact source-bound ID do not produce a merge',()=>{
 const r=report([issue('alpha'),issue('beta','src/dep.ts:1')]),f=makeFiles();
 const result=fuseAccuracyEvidence(r,f,opts(r,f));
 assert.equal(result.originalUCEIssues.length,2);
 assert.equal(result.overlapsForReview.length,0);
 assert.equal(result.originCounts.Both,0);
 assert.equal(result.removedCanonicalIssues,0);
});
test('source path mismatch fails a proposed overlap without dropping either side',()=>{
 const r=report(),f=makeFiles();
 const bind=withBinding(r,f);
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[
 {...bind,expectedFileSha256:digest('src/dep.ts')},
 ]});
 assert.equal(x.overlapCounts.rejected,1);
 assert.equal(x.originCounts.UCE,1);
 assert.ok(x.originCounts.Trilogy>0);
});
test('ambiguous many-to-one overlap is explicitly ambiguous not Both',()=>{
 const r=report([issue('first'),issue('second')]),f=makeFiles();
 const one=withBinding(r,f,'first'),two={...one,issueId:'second'};
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[one,two]});
 assert.equal(x.overlapCounts.ambiguous,2);
 assert.equal(x.overlapCounts.reviewOnly,0);
 assert.equal(x.originCounts.Both,0);
});
test('duplicate review binding is flagged and never allowed to multiply matches',()=>{
 const r=report(),f=makeFiles(),binding=withBinding(r,f);
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[binding,binding]});
 assert.deepEqual(x.flags,['duplicate-review-suggestion']);
 assert.equal(x.overlapsForReview.length,1);
 assert.equal(x.originCounts.Both,0);
});
test('partial UCE scan cannot produce positive overlap even if the same source exists',()=>{
 const r=report([issue()],true),f=makeFiles();
 const binding=withBinding(r,f);
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[binding]});
 assert.equal(x.overlapCounts.unknown,1);
 assert.equal(x.graphCoverage.partial,true);
 assert.equal(x.sourceReviewSummary.independentlyCheckedLiteral,0);
});
test('unverified inventory declaration blocks any review match even with a hash',()=>{
 const r=report(),f=makeFiles(),binding=withBinding(r,f);
 const opt={...opts(r,f),inventoryComplete:false,reviewBindings:[binding]};
 const x=fuseAccuracyEvidence(r,f,opt);
 assert.equal(x.overlapCounts.unknown,1);
 assert.equal(x.graphCoverage.callerInventoryPinned,false);
});
test('inventory digest absent or forged cannot provide review-level provenance',()=>{
 const r=report(),f=makeFiles(),binding=withBinding(r,f);
 const without=fuseAccuracyEvidence(r,f,{inventoryComplete:true,reviewBindings:[binding]});
 assert.equal(without.overlapCounts.unknown,1);
 assert.throws(()=>fuseAccuracyEvidence(r,f,{
  ...opts(r,f),expectedInventorySha256:'a'.repeat(64),reviewBindings:[binding],
 }),/digest mismatch/);
});
test('a pinned source literal disagreement does not suppress canonical UCE finding',()=>{
 const r=report(),f=makeFiles();
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),assertions:[{
  findingId:'issue-one',file:'src/app.ts',line:1,
  predicate:'literal-source-fragment-at-line',
  sourceSha256:digest(source),fragment:'never-in-source',
 }]});
 assert.equal(x.sourceReviewSummary.disputedLiterals,1);
 assert.equal(x.originalUCEIssues[0].sourceDisagreement,'literal-predicate-review-only');
 assert.equal(x.originalUCEIssues[0].autoSuppressed,false);
 assert.equal(x.suppressedCanonicalIssues,0);
});
test('source literal matching does not certify issue correctness or build compatibility',()=>{
 const r=report(),f=makeFiles();
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),assertions:[{
  findingId:'issue-one',file:'src/app.ts',line:1,
  predicate:'literal-source-fragment-at-line',
  sourceSha256:digest(source),fragment:'import {dep}',
 }]});
 assert.equal(x.sourceReviewSummary.independentlyCheckedLiteral,1);
 assert.equal(x.originalUCEIssues[0].factOrIssueVerified,false);
 assert.equal(x.verification.compatibilityVerified,0);
});
test('malformed, duplicate and unknown canonical issue IDs fail explicitly',()=>{
 const f=makeFiles();
 assert.throws(()=>fuseAccuracyEvidence(report([issue('x'),issue('x')]),f),
  /duplicated/);
 assert.throws(()=>fuseAccuracyEvidence(report([issue('')]),f),/invalid/);
});
test('unknown source paths and traversal cannot turn into affirmative fusion',()=>{
 const r=report([issue('evil','../password.txt')]),f=makeFiles();
 const x=fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:[{
  issueId:'evil',factId:buildWholeProjectGraph(r,f,{inventoryComplete:true}).edges[0].id,
  expectedFileSha256:digest('src/app.ts'),
 }]});
 assert.equal(x.overlapCounts.rejected,1);
 assert.equal(x.sourceReviewSummary.unknown,1);
 assert.ok(!JSON.stringify(x).includes('../password.txt'));
});
test('nondeterministic metadata and source file ordering do not change the report',()=>{
 const a=report(),b=structuredClone(a),f=makeFiles();
 b.id='random-new-id';b.createdAt='2099';
 b.summary.scanStats.scanTimeMs=999999;
 const binding=withBinding(a,f);
 const optsA={...opts(a,f),reviewBindings:[binding]};
 const optsB={...opts(b,f),reviewBindings:[binding]};
 assert.deepEqual(fuseAccuracyEvidence(a,f,optsA),
  fuseAccuracyEvidence(b,[...f].reverse(),optsB));
});
test('review binding ordering cannot alter aggregate statistics or relations',()=>{
 const r=report([issue('a'),issue('b')]),f=makeFiles();
 const one=withBinding(r,f,'a'),two={...one,issueId:'b'};
 const o=opts(r,f);
 const x=fuseAccuracyEvidence(r,f,{...o,reviewBindings:[one,two]});
 const y=fuseAccuracyEvidence(r,f,{...o,reviewBindings:[two,one]});
 assert.deepEqual(x,y);
});
test('untrusted forged native verdict or browser Both label in options is not accepted as proof',()=>{
 const r=report(),f=makeFiles();
 const x=fuseAccuracyEvidence(r,f,{
  ...opts(r,f),nativeProof:{verification:'independent-smt-agreement',status:'conflict'},
  browserOrigin:'Both',confirmedCompatibility:true,
 });
 assert.equal(x.originCounts.Both,0);
 assert.equal(x.verification.nativeSolvers,'not-run-in-t4');
 assert.equal(x.developerSafety.releaseReady,false);
});
test('source limitations/unknown relationship statuses remain visible and not verified',()=>{
 const f=[file('src/app.ts',"import './missing';")];
 const r=report();
 const out=fuseAccuracyEvidence(r,f,{inventoryComplete:true,
  expectedInventorySha256:buildWholeProjectGraph(r,f,{inventoryComplete:true}).suppliedInventorySha256});
 assert.equal(out.originCounts.Both,0);
 assert.equal(out.verification.compatibilityVerified,0);
 assert.equal(out.trilogyObservations[0].sourceStatus,'review-required');
});
test('valid report with no issues still does not claim clean runtime',()=>{
 const r=report([]),f=makeFiles();
 const x=fuseAccuracyEvidence(r,f,opts(r,f));
 assert.equal(x.originalIssueCount,0);
 assert.ok(x.trilogyObservations.length>0);
 assert.equal(x.verification.globalAccuracy,null);
 assert.equal(x.verification.securityVulnerabilitiesVerified,0);
});
test('malformed user-supplied review bindings/options cannot introduce verification',()=>{
 const r=report(),f=makeFiles();
 for(const bindings of [{},'arbitrary',[{}],[{issueId:'x',factId:'bad'}]]){
  assert.throws(()=>fuseAccuracyEvidence(r,f,{...opts(r,f),reviewBindings:bindings}));
 }
 assert.throws(()=>fuseAccuracyEvidence(r,f,{inventoryComplete:'true'}));
 assert.throws(()=>fuseAccuracyEvidence(r,f,[]));
});
test('beyond bounded canonical issue budget fails instead of silently dropping findings',()=>{
 const r=report(Array.from({length:5001},(_,i)=>issue('issue-'+i))),f=makeFiles();
 assert.throws(()=>fuseAccuracyEvidence(r,f),/issue resource budget/);
});
test('T4 never supports automatic patches, score changes or certified root causes',()=>{
 const r=report(),f=makeFiles(),x=fuseAccuracyEvidence(r,f,opts(r,f));
 assert.equal(x.developerSafety.rootCausesProven,0);
 assert.equal(x.developerSafety.externalManualReviewRequired,true);
 assert.equal(x.developerSafety.releaseReady,false);
 assert.equal(x.appliedPatches,0);
 assert.equal(x.scoreModified,false);
 assert.equal(x.verification.recommendationCorrectness,null);
 assert.ok(x.originalUCEIssues.every(i=>i.origin==='UCE' && i.autoFixed===false));
 assert.ok(x.trilogyObservations.every(i=>i.origin==='Trilogy'&&i.autoApplied===false));
});
