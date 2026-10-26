import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewDeveloperFixes} from './proposals.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {investigateRootCauses} from '../trilogy-t5/root-causes.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const file=(path,content)=>({path,content,isDirectory:false,size:Buffer.byteLength(content??'')});
const source=(pin='20\n',range='>=22')=>[
 file('package.json',JSON.stringify({name:'t6',engines:{node:range}})),
 file('.nvmrc',pin),
 file('src/app.ts',"import './helper';\nexport const app = true;"),
 file('src/helper.ts','export const helper=true;'),
];
const issue=(id,affectedFile='package.json')=>({
 id,affectedFile,title:'T6 authored reference only',severity:'warning',
 category:'runtime',description:'No independently verified fix',reason:'Need manual review',
 recommendation:'No automatic patch',
});
function report(issues=[issue('original')],partial=false){
 return {
  id:'report',createdAt:'2026',analysisVersion:'3.0.0-beta.1',
  classification:{isSoftware:true},
  score:{overall:90,applicableCategories:['runtime']},
  categories:[{id:'runtime',label:'Runtime',score:90,status:'warning',issues:[]}],
  issues,stack:{},
  summary:{name:'t6',analysisCoverage:{status:partial?'partial':'full',
    filesFound:4,filesAnalyzed:4,fileCoveragePercent:100},
   scanStats:{projectSize:100,filesFound:4,filesAnalyzed:4,filesIgnored:0,
     ignoredCategories:[],truncated:partial}},
 };
}
function setup(f=source(),r=report()){
 const inventory=buildWholeProjectGraph(r,f,{inventoryComplete:true}).suppliedInventorySha256;
 const hypotheses=investigateRootCauses(r,f,{
  inventoryComplete:true,expectedInventorySha256:inventory});
 const runtime=hypotheses.rootCauseHypotheses.find(x=>x.kind==='runtime-constraint-investigation');
 return {r,f,inventory,hypotheses,runtime,opts:{inventoryComplete:true,
   expectedInventorySha256:inventory,requests:[]}};
}
function request(s,overrides={}){
 return {hypothesisId:s.runtime?.hypothesisId??'0'.repeat(64),
 evidenceFactId:s.runtime?.runtimeReviewFactIds?.[0]??'0'.repeat(64),
 manifestPath:'package.json',pinPath:'.nvmrc',
 expectedPinSha256:hash(s.f.find(x=>x.path==='.nvmrc')?.content??''),
 requestedMajor:22,...overrides};
}
const execute=(s,reqs=[request(s)])=>previewDeveloperFixes(s.r,s.f,{...s.opts,requests:reqs});
test('reviewer-selected Node major yields exact bounded diff without modifying any source',()=>{
 const s=setup(),before=JSON.stringify([s.r,s.f]);
 const out=execute(s);
 assert.equal(JSON.stringify([s.r,s.f]),before);
 assert.equal(out.proposalCount,1);
 assert.equal(out.rejectedCount,0);
 const p=out.proposals[0];
 assert.equal(p.status,'reviewable-preview-only');
 assert.equal(p.patchCategory,'node-major-pin-review');
 assert.equal(p.patch.oldText,'20\n');
 assert.equal(p.patch.newText,'22\n');
 assert.equal(p.patch.unifiedPreview,'--- a/[node-pin]\n+++ b/[node-pin]\n@@ -1 +1 @@\n-20\n+22\n');
 assert.equal(p.sourceSnapshotSha256,hash('20\n'));
 assert.equal(p.proposedSnapshotSha256,hash('22\n'));
 assert.equal(p.risk.classification,'high-requires-developer-validation');
 assert.equal(p.proposalVerified,false);
 assert.equal(p.automaticallyApplicable,false);
 assert.equal(p.actualSourceModified,false);
 assert.equal(out.appliedPatches,0);
});
test('core scores, findings and warning identities remain exactly unchanged',()=>{
 const s=setup(source(),report([issue('a'),issue('b','src/app.ts')]));
 const old=JSON.stringify(s.r),out=execute(s);
 assert.equal(out.originalIssueCount,2);
 assert.equal(out.originalCoreScore,90);
 assert.equal(out.originalIssueRecordsPreserved,true);
 assert.equal(out.originalIssuesSuppressed,0);
 assert.equal(out.originalScoreModified,false);
 assert.equal(out.confirmedRootCauses,0);
 assert.equal(out.verifiedSafeFixes,0);
 assert.equal(JSON.stringify(s.r),old);
});
test('no reviewer request means no inferred fix and no automatic advice',()=>{
 const s=setup(),o=execute(s,[]);
 assert.equal(o.requestsReceived,0);
 assert.equal(o.proposalCount,0);
 assert.equal(o.appliedPatches,0);
});
test('matching source snapshot stays deterministic regardless of input ordering',()=>{
 const s=setup();
 const a=execute(s);
 const reversed=setup([...s.f].reverse(),s.r);
 const b=execute(reversed);
 assert.deepEqual(a,b);
});
test('stale source SHA cannot yield a preview',()=>{
 const s=setup(),p=execute(s,[request(s,{expectedPinSha256:'a'.repeat(64)})]);
 assert.equal(p.proposalCount,0);
 assert.equal(p.proposals[0].reason,'stale-or-changed-pin-source-hash');
});
test('wrong graph fact, hypothesis or pin path cannot provide source authority',()=>{
 const s=setup();
 for(const over of [{evidenceFactId:'0'.repeat(64)},
  {hypothesisId:'1'.repeat(64)},
  {manifestPath:'src/app.ts'}, {pinPath:'src/helper.ts'}]){
  const p=execute(s,[request(s,over)]);
  assert.equal(p.proposalCount,0);
  assert.equal(p.proposals[0].status,'rejected');
 }
});
test('target already matching source becomes a no-op rather than a fictitious patch',()=>{
 const s=setup();
 const p=execute(s,[request(s,{requestedMajor:20})]);
 assert.equal(p.proposalCount,0);
 assert.equal(p.proposals[0].status,'rejected');
});
test('unsupported and unsafe Node major ranges do not yield a patch',()=>{
 const s=setup();
 for(const value of [0,-1,100,2.2,'22',null]){
  const out=execute(s,[request(s,{requestedMajor:value})]);
  assert.equal(out.proposalCount,0);
 }
});
test('version outside modeled Node engine constraint is rejected',()=>{
 const s=setup();
 assert.equal(execute(s,[request(s,{requestedMajor:21})]).proposalCount,0);
 assert.equal(execute(s,[request(s,{requestedMajor:99})]).proposalCount,1);
});
test('limited major-only exact and upper Node semver ranges remain bounded',()=>{
 const a=setup(source('22\n','<21'));
 assert.equal(execute(a).proposalCount,0);
 const b=setup(source('20\n','^22'));
 assert.equal(execute(b).proposalCount,0);
 const c=setup(source('20\n','22'));
 assert.equal(execute(c).proposalCount,1);
});
test('preserves v-prefix and CRLF of a single-line runtime pin',()=>{
 const s=setup(source('v20\r\n'));
 const p=execute(s).proposals[0];
 assert.equal(p.status,'reviewable-preview-only');
 assert.equal(p.patch.oldText,'v20\r\n');
 assert.equal(p.patch.newText,'v22\r\n');
 assert.ok(p.patch.unifiedPreview.includes('-v20\n+v22'));
});
test('comments, multiple lines, shell code and unusual pin text are never patched',()=>{
 for(const content of ['20 # LTS\n','20\n22\n','$(rm -rf /)\n','v20.8.0\n',' 20\n','20  \n']){
  const s=setup(source(content));
  assert.equal(execute(s).proposalCount,0,content);
 }
});
test('duplicate requests and two competing fixes for one pin reject every collision',()=>{
 const s=setup(),a=request(s),b=request(s,{requestedMajor:24});
 let result=execute(s,[a,a]);
 assert.equal(result.proposalCount,0);
 assert.equal(result.rejectedCount,2);
 result=execute(s,[a,b]);
 assert.equal(result.proposalCount,0);
 assert.equal(result.rejectedCount,2);
});
test('missing source content, traversal, or conflicting file identities cannot build a preview',()=>{
 const s=setup();
 for(const override of [{pinPath:'../secret'},{manifestPath:'/etc/passwd'},
  {pinPath:'src//bad'},{pinPath:'.node-version'}]){
  const x=execute(s,[request(s,override)]);
  assert.equal(x.proposalCount,0);
 }
 const files=s.f.map(f=>f.path==='.nvmrc'?{...f,content:undefined}:f);
 const graph=buildWholeProjectGraph(s.r,files,{inventoryComplete:true});
 const out=previewDeveloperFixes(s.r,files,{inventoryComplete:true,
  expectedInventorySha256:graph.suppliedInventorySha256,
  requests:[request(s)]});
 assert.equal(out.proposalCount,0);
});
test('partial UCE or unresolved external source cannot authorize even a diff preview',()=>{
 const partial=setup(source(),report(undefined,true));
 assert.equal(execute(partial).proposalCount,0);
 const f=source();f[2]=file('src/app.ts',"import 'not-modeled';\n");
 const s=setup(f);
 assert.equal(execute(s).proposalCount,0);
});
test('tampered inventory digest fails prior to proposal generation',()=>{
 const s=setup();
 assert.throws(()=>previewDeveloperFixes(s.r,s.f,{...s.opts,
  expectedInventorySha256:'f'.repeat(64),requests:[request(s)]}),/digest mismatch|provenance/);
});
test('invalid approval options, overbudget requests and malformed revision claims fail closed',()=>{
 const s=setup();
 for(const bad of [{},[],{requests:[]},{inventoryComplete:true,requests:[]},
  {inventoryComplete:'yes',expectedInventorySha256:s.inventory,requests:[]},
  {...s.opts,requests:Array.from({length:65},()=>request(s))}]){
  assert.throws(()=>previewDeveloperFixes(s.r,s.f,bad));
 }
});
test('safe preview never represents a successful build, patch correctness or independent accuracy',()=>{
 const s=setup(),x=execute(s),p=x.proposals[0];
 assert.equal(x.authenticatedGitRevision,false);
 assert.equal(x.globalAccuracy,null);
 assert.equal(x.recommendationCorrectness,null);
 assert.equal(x.nativeSolvers,'not-run');
 assert.equal(x.releaseReady,false);
 assert.equal(p.projectBuildTested,false);
 assert.equal(p.runtimeVerified,false);
 assert.equal(p.developerApproved,false);
 assert.ok(p.verificationPlan.some(x=>x.includes('clean install')));
});
test('two workspace pins can be independently reviewed with no cross-target changes',()=>{
 const f=source();
 f.push(file('packages/tool/package.json','{"name":"tool","engines":{"node":">=22"}}'));
 f.push(file('packages/tool/.nvmrc','20\n'));
 const s=setup(f);
 const graph=buildWholeProjectGraph(s.r,f,{inventoryComplete:true});
 const t5=investigateRootCauses(s.r,f,{inventoryComplete:true,
  expectedInventorySha256:graph.suppliedInventorySha256});
 const group=t5.rootCauseHypotheses.find(x=>x.anchorSha256===hash('packages/tool/package.json'));
 assert.ok(group);
 const req=request(s);
 const second={...req,hypothesisId:group.hypothesisId,evidenceFactId:group.runtimeReviewFactIds[0],
 manifestPath:'packages/tool/package.json',pinPath:'packages/tool/.nvmrc',
 expectedPinSha256:hash('20\n')};
 const result=execute(s,[req,second]);
 assert.equal(result.proposalCount,2);
 assert.equal(new Set(result.proposals.map(x=>x.affectedSourcePathHash)).size,2);
});
test('no developer-requested version may trigger native solvers or automatic file writes',()=>{
 const s=setup();
 const out=execute(s);
 assert.equal(out.automaticPatchesAllowed,undefined);
 assert.ok(out.proposals.every(p=>p.automaticallyApplicable===false));
 assert.equal(out.appliedPatches,0);
});
