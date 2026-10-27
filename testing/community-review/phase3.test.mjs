import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareBlindedCasePacket} from './packet.mjs';
import {auditVolunteerReviewIntake} from './intake.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const one=()=>({
 schemaVersion:1,studyId:'independent-phase3-study',
 protocolSha256:'1'.repeat(64),samplingFrameSha256:'2'.repeat(64),
 cases:[{id:'case-001',repositoryAlias:'public-repo-a',
 commitSha:'3'.repeat(40),sourceEvidenceSha256:'4'.repeat(64),
 domain:'runtime',severity:'warning',ecosystem:'js-ts'}]});
const claims=()=>({schemaVersion:1,studyId:'independent-phase3-study',
 claims:[{caseId:'case-001',repositoryAlias:'public-repo-a',
 repository:'example/project',sourcePath:'src/runtime.js',
 claimText:'Does this repository source establish support for the stated Node runtime requirement?'}]});
const votes=()=>({schemaVersion:1,studyId:'independent-phase3-study',reviews:[],adjudications:[]});
const vote=(alias,decision='positive')=>({
 caseId:'case-001',reviewerAlias:alias,decision,
 evidenceSha256:sha('source-evidence'),rationaleSha256:sha('rationale-'+alias),
 blindToPredictions:true,blindToPeerVotes:true,
 independentOfUCEDevelopment:true,conflictOfInterest:false,
});
const run=(v)=>auditVolunteerReviewIntake(prepareBlindedCasePacket(one(),claims()),v);
test('source-pinned packets exclude UCE predictions, scores, truth and severity',()=>{
 const packet=prepareBlindedCasePacket(one(),claims());
 assert.equal(packet.caseUniverseCount,1);
 assert.equal(packet.cases[0].source.commitSha,'3'.repeat(40));
 assert.equal(packet.cases[0].source.pinnedUrl,
  'https://github.com/example/project/blob/'+'3'.repeat(40)+'/src/runtime.js');
 assert.equal(packet.cases[0].severity,undefined);
 assert.equal(packet.cases[0].decision,undefined);
 assert.equal(packet.cases[0].source.sourceEvidenceSha256,'4'.repeat(64));
 assert.equal(packet.humanReviewPerformedByThisTool,false);
});
test('missing or biased case definitions fail before reviewer recruitment',()=>{
 const m=one(),q=claims();q.claims=[];
 assert.throws(()=>prepareBlindedCasePacket(m,q),/universe/);
 q.claims=claims().claims;q.claims[0].claimText='UCE-only says positive';
 assert.throws(()=>prepareBlindedCasePacket(m,q),/neutral/);
});
test('manifest truth labels and unexpected prediction fields are forbidden',()=>{
 const m=one();m.cases[0].expected='positive';
 assert.throws(()=>prepareBlindedCasePacket(m,claims()),/leaked/);
 const q=claims();q.claims[0].trilogyPrediction='positive';
 assert.throws(()=>prepareBlindedCasePacket(one(),q),/invalid/);
});
test('source path traversal and mutable refs are not admissible',()=>{
 const q=claims();q.claims[0].sourcePath='../.env';
 assert.throws(()=>prepareBlindedCasePacket(one(),q),/invalid/);
 const m=one();m.cases[0].commitSha='main';
 assert.throws(()=>prepareBlindedCasePacket(m,claims()),/invalid/);
});
test('empty volunteer intake cannot impersonate independent labels',()=>{
 const x=run(votes());
 assert.equal(x.status,'awaiting-volunteer-reviewers');
 assert.equal(x.awaitingSecondReviewCases,1);
 assert.equal(x.independentlyAuthenticatedHumanCases,0);
 assert.equal(x.measuredIndependentRealWorldAccuracy,null);
 assert.equal(x.overallReleaseReady,false);
});
test('two self-declared concordant decisions remain unauthenticated',()=>{
 const v=votes();v.reviews=[vote('reviewer-a'),vote('reviewer-b')];
 const x=run(v);
 assert.equal(x.declaredDualAgreements,1);
 assert.equal(x.declaredBinaryResolvedCases,1);
 assert.equal(x.independentlyAuthenticatedHumanCases,0);
 assert.equal(x.formalAccuracyCertificationAllowed,false);
 assert.equal(x.status,'submitted-records-need-external-human-provenance-audit');
});
test('conflicting votes withhold labels and request third adjudicator',()=>{
 const v=votes();v.reviews=[vote('reviewer-a'),vote('reviewer-b','negative')];
 const x=run(v);
 assert.equal(x.awaitingThirdAdjudicatorCases,1);
 assert.equal(x.declaredBinaryResolvedCases,0);
 v.adjudications=[vote('reviewer-c','negative')];
 const y=run(v);
 assert.equal(y.awaitingThirdAdjudicatorCases,0);
 assert.equal(y.declaredThirdAdjudications,1);
 assert.equal(y.declaredBinaryResolvedCases,1);
 assert.equal(y.independentlyAuthenticatedHumanCases,0);
});
test('no third adjudicator may reuse initial reviewer or join a consensus',()=>{
 const v=votes();v.reviews=[vote('reviewer-a'),vote('reviewer-b','negative')];
 v.adjudications=[vote('reviewer-a')];
 assert.throws(()=>run(v),/duplicates/);
 v.reviews[1].decision='positive';
 assert.throws(()=>run(v),/unsolicited/);
});
test('duplicate reviewer identities and prediction exposure are rejected',()=>{
 const v=votes();v.reviews=[vote('reviewer-a'),vote('reviewer-a')];
 assert.throws(()=>run(v),/repeated/);
 v.reviews[1].reviewerAlias='reviewer-b';
 v.reviews[1].blindToPredictions=false;
 assert.throws(()=>run(v),/non-blinded/);
});
test('declared conflicts or peer-vote exposure must fail closed',()=>{
 const v=votes();v.reviews=[vote('reviewer-a')];
 v.reviews[0].conflictOfInterest=true;
 assert.throws(()=>run(v),/conflicted/);
 v.reviews[0].conflictOfInterest=false;v.reviews[0].blindToPeerVotes=false;
 assert.throws(()=>run(v),/non-blinded/);
});
test('unknown votes are never interpreted as negative ground truth',()=>{
 const v=votes();v.reviews=[vote('reviewer-a','unknown'),vote('reviewer-b','unknown')];
 const x=run(v);
 assert.equal(x.declaredUnknownCases,1);
 assert.equal(x.declaredBinaryResolvedCases,0);
 assert.equal(x.measuredIndependentRealWorldAccuracy,null);
});
test('foreign cases and forged source packet counts are rejected',()=>{
 const v=votes();v.reviews=[{...vote('reviewer-a'),caseId:'alien-case'}];
 assert.throws(()=>run(v),/outside frozen/);
 const packet=prepareBlindedCasePacket(one(),claims());
 packet.caseUniverseCount=3;
 assert.throws(()=>auditVolunteerReviewIntake(packet,votes()),/packet identity/);
});
