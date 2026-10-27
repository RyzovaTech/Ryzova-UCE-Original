/**
 * Offline Phase 3 volunteer review intake audit.
 * Self-declared reviewer aliases/independence are never authenticated here.
 * Never reveal reviewers, case-level votes or rationale in public outputs.
 */
import {createHash} from 'node:crypto';
const ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const SHA64=/^[a-f0-9]{64}$/;
const DECISION=new Set(['positive','negative','unknown']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const only=(x,keys)=>Object.keys(x).every(k=>keys.includes(k));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const REVIEW_FIELDS=['caseId','reviewerAlias','decision','evidenceSha256','rationaleSha256',
 'blindToPredictions','blindToPeerVotes','independentOfUCEDevelopment','conflictOfInterest'];
function validateVote(row){
 if(!plain(row)||!only(row,REVIEW_FIELDS)||!ID.test(row.caseId??'')||
  !ID.test(row.reviewerAlias??'')||!DECISION.has(row.decision)||
  !SHA64.test(row.evidenceSha256??'')||!SHA64.test(row.rationaleSha256??'')||
  row.blindToPredictions!==true||row.blindToPeerVotes!==true||
  row.independentOfUCEDevelopment!==true||row.conflictOfInterest!==false)
  throw Error('Phase3 invalid, non-blinded or conflicted reviewer declaration');
}
export function auditVolunteerReviewIntake(packet,submissions){
 if(!plain(packet)||packet.schemaVersion!==1||packet.mode!=='blinded-claim-review'||
  packet.noPredictionsOrProvisionalLabelsIncluded!==true||
  packet.externalSourceIdentityVerified!==false||
  packet.humanReviewPerformedByThisTool!==false||
  !ID.test(packet.studyId??'')||!SHA64.test(packet.frozenManifestSha256??'')||
  !SHA64.test(packet.claimRegistrySha256??'')||
  !Array.isArray(packet.cases)||packet.cases.length<1||packet.cases.length>2000||
  packet.caseUniverseCount!==packet.cases.length)
  throw Error('Phase3 invalid blind packet identity');
 const cases=new Set();
 for(const c of packet.cases){
  if(!plain(c)||!ID.test(c.caseId??'')||cases.has(c.caseId)||
    typeof c.question!=='string'||!plain(c.source))
   throw Error('Phase3 duplicate or invalid packet case');
  cases.add(c.caseId);
 }
 if(!plain(submissions)||submissions.schemaVersion!==1||
  submissions.studyId!==packet.studyId||!Array.isArray(submissions.reviews)||
  !Array.isArray(submissions.adjudications)||
  submissions.reviews.length>4000||submissions.adjudications.length>2000||
  !only(submissions,['schemaVersion','studyId','reviews','adjudications']))
  throw Error('Phase3 invalid or mixed-up review submissions');
 const byCase=new Map();
 for(const vote of submissions.reviews){
  validateVote(vote);
  if(!cases.has(vote.caseId))throw Error('Phase3 review outside frozen case universe');
  const existing=byCase.get(vote.caseId)??[];
  if(existing.length>=2||existing.some(x=>x.reviewerAlias===vote.reviewerAlias))
   throw Error('Phase3 repeated or excessive reviewer vote');
  existing.push(vote);byCase.set(vote.caseId,existing);
 }
 const byAdjudication=new Map();
 for(const third of submissions.adjudications){
  validateVote(third);
  if(!cases.has(third.caseId)||byAdjudication.has(third.caseId))
   throw Error('Phase3 duplicated or unrelated third adjudicator');
  byAdjudication.set(third.caseId,third);
 }
 let awaitingDual=0,awaitingThird=0,adjudicated=0,dualAgreements=0;
 let unknown=0,complete=0;
 for(const id of cases){
  const votes=byCase.get(id)??[];
  const third=byAdjudication.get(id);
  if(votes.length<2){
   if(third)throw Error('Phase3 third review without independent dual review');
   awaitingDual++;
   continue;
  }
  const differs=votes[0].decision!==votes[1].decision;
  if(!differs){
   if(third)throw Error('Phase3 unsolicited adjudicator for agreement');
   dualAgreements++;
   if(votes[0].decision==='unknown')unknown++;
   else complete++;
   continue;
  }
  if(!third){awaitingThird++;continue}
  if(votes.some(x=>x.reviewerAlias===third.reviewerAlias))
   throw Error('Phase3 third adjudicator duplicates a primary reviewer');
  adjudicated++;
  if(third.decision==='unknown')unknown++;
  else complete++;
 }
 return {
  schemaVersion:1,phase:'community-independent-review-intake',
  studyId:packet.studyId,frozenManifestSha256:packet.frozenManifestSha256,
  claimRegistrySha256:packet.claimRegistrySha256,
  submittedRecordsSha256:hash(submissions),
  frozenCaseUniverseCount:cases.size,
  receivedPrimaryReviewRecords:submissions.reviews.length,
  receivedThirdReviewRecords:submissions.adjudications.length,
  declaredDualAgreements:dualAgreements,
  declaredThirdAdjudications:adjudicated,
  declaredBinaryResolvedCases:complete,
  declaredUnknownCases:unknown,
  awaitingSecondReviewCases:awaitingDual,
  awaitingThirdAdjudicatorCases:awaitingThird,
  locallyAuthenticatedHumanIdentities:0,
  independentlyAuthenticatedHumanCases:0,
  reviewerIndependenceExternallyVerified:false,
  sourceOriginExternallyVerified:false,
  formalAccuracyCertificationAllowed:false,
  measuredIndependentRealWorldAccuracy:null,
  overallReleaseReady:false,
  status:submissions.reviews.length===0?'awaiting-volunteer-reviewers':
    awaitingDual||awaitingThird||unknown?'incomplete-or-unknown-review-diagnostics':
      'submitted-records-need-external-human-provenance-audit',
  note:'Declarations and hashes are consistency checks, not proof that distinct blinded humans reviewed source; never publish private submissions or case-level labels.',
 };
}
