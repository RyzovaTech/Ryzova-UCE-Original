import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicPilotRegistry,summarizePilot} from './protocol.mjs';
const commit='a'.repeat(40);
const caseSpec={id:'example-js',repository:'sample/example',commitSha:commit,
 ecosystem:'javascript',repoDirectory:'example'};
const registry=()=>({schemaVersion:1,
 purpose:'UNREVIEWED_PUBLIC_SOURCE_DIAGNOSTIC_NOT_ACCURACY_STUDY',cases:[{...caseSpec}]});
function fixture(){
 const report={score:{overall:89},issues:[{id:'first',severity:'critical'},
   {id:'second',severity:'warning'}],scanStats:{filesFound:5,filesAnalyzed:5,truncated:false}};
 const graph={originalCoreScore:89,originalIssueCount:2,
  canonicalEvidenceSha256:'x'.repeat(64),suppliedInventorySha256:'y'.repeat(64),
  sourceSnapshotAuthenticated:false,coverage:{negativeAbsenceEligible:false,parseFailures:0},
  counts:{relationships:2,unknown:1}};
 const fusion={originalScore:89,originalIssueCount:2,
  canonicalEvidenceSha256:graph.canonicalEvidenceSha256,
  suppliedInventorySha256:graph.suppliedInventorySha256,
  originalUCEIssues:[{},{}],originCounts:{UCE:2,Trilogy:2,Both:0},
  sourceReviewSummary:{unknown:2},graphCoverage:{partial:true},
  originalReportModified:false,scoreModified:false,appliedPatches:0,
  removedCanonicalIssues:0,suppressedCanonicalIssues:0,
  developerSafety:{releaseReady:false}};
 return {report,graph,fusion,inventory:{selectedFiles:5,
  availableSourceBytes:200,unreadableSelectedFiles:0,unselectedOrOverBudgetFiles:0}};
}
test('real open-source registry still has no accuracy labels',()=>{
 assert.equal(validatePublicPilotRegistry(registry()).length,1);
 const f=fixture(),result=summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory);
 assert.equal(result.uce.originalIssueCount,2);
 assert.equal(result.uce.rawCriticalFindings,1);
 assert.equal(result.trilogy.independentlyVerifiedOverlap,0);
 assert.equal(result.labels.independentHumanReviewedCases,0);
 assert.equal(result.labels.independentRealWorldAccuracy,null);
 assert.equal(result.measuredImprovement,null);
 assert.equal(result.releaseReady,false);
 assert.equal(result.inventory.inventoryComplete,false);
});
test('duplicate projects, case IDs and invalid SHA cannot enter public pilot',()=>{
 const r=registry();r.cases.push({...caseSpec,id:'different'});
 assert.throws(()=>validatePublicPilotRegistry(r),/duplicate/);
 r.cases[1].repository='another/repo';r.cases[1].repoDirectory='another';
 r.cases[1].id='example-js';
 assert.throws(()=>validatePublicPilotRegistry(r),/duplicate/);
 r.cases[1].id='another';r.cases[1].commitSha='main';
 assert.throws(()=>validatePublicPilotRegistry(r),/invalid/);
});
test('different checked out revision is always rejected',()=>{
 const f=fixture();assert.throws(()=>
 summarizePilot(caseSpec,'b'.repeat(40),f.report,f.graph,f.fusion,f.inventory),
 /revision mismatch/);
});
test('Trilogy score or original issue mutation fails closed',()=>{
 const f=fixture();f.fusion.originalScore=100;
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
 f.fusion.originalScore=89;f.fusion.originalIssueCount=1;
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
});
test('incorrect canonical or source evidence fingerprint fails closed',()=>{
 const f=fixture();f.fusion.canonicalEvidenceSha256='z'.repeat(64);
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
 f.fusion.canonicalEvidenceSha256=f.graph.canonicalEvidenceSha256;
 f.fusion.suppliedInventorySha256='z'.repeat(64);
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
});
test('unsafe Both promotion, patch or suppression cannot enter report',()=>{
 for(const [key,val] of [['appliedPatches',1],['removedCanonicalIssues',1],
 ['suppressedCanonicalIssues',1]]){
  const f=fixture();f.fusion[key]=val;
  assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
 }
 const f=fixture();f.fusion.originCounts.Both=1;
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
});
test('unestablished source inventory can never turn into negative proof',()=>{
 const f=fixture();f.graph.coverage.negativeAbsenceEligible=true;
 assert.throws(()=>summarizePilot(caseSpec,commit,f.report,f.graph,f.fusion,f.inventory),/guarantee/);
 const g=fixture();g.graph.sourceSnapshotAuthenticated=true;
 assert.throws(()=>summarizePilot(caseSpec,commit,g.report,g.graph,g.fusion,g.inventory),/guarantee/);
});
