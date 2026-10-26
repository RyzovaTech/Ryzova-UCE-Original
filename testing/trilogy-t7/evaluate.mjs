/**
 * Trilogy T7 — blinded paired accuracy evaluation CONTRACT, not proof of
 * independent human research. Reviewer identities/blinding and upstream Git
 * source authenticity cannot be authenticated from caller-supplied JSON.
 * Scoring and native solvers are not modified or invoked here.
 */
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const GIT_SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const DOMAIN=new Set(['runtime','security','browser','dependencies','deployment','framework','other']);
const DECISION=new Set(['positive','negative','unknown']);
const MAX_CASES=2000,MAX_STRATA=80;
const sort=(a,b)=>a<b?-1:a>b?1:0;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const percent=(numerator,denominator)=>denominator?Math.round(numerator/denominator*1e4)/100:null;
function wilson(success,total){
 if(!total)return null;
 const z=1.96,z2=z*z,p=success/total,denom=1+z2/total;
 const center=(p+z2/(2*total))/denom;
 const half=z*Math.sqrt(p*(1-p)/total+z2/(4*total*total))/denom;
 return [percent(Math.max(0,center-half),1),percent(Math.min(1,center+half),1)];
}
function checkManifest(manifest){
 if(!plain(manifest)||manifest.schemaVersion!==1||!ID.test(manifest.studyId??'')||
    !HEX.test(manifest.protocolSha256??'')||!HEX.test(manifest.samplingFrameSha256??'')||
    !Array.isArray(manifest.cases)||manifest.cases.length>MAX_CASES)
   throw Error('T7 invalid frozen study manifest');
 const cases=new Map();
 for(const c of manifest.cases){
  if(!plain(c)||!ID.test(c.id??'')||cases.has(c.id)||
    !ID.test(c.repositoryAlias??'')||!GIT_SHA.test(c.commitSha??'')||
    !HEX.test(c.sourceEvidenceSha256??'')||!DOMAIN.has(c.domain)||
    !['critical','warning','info','other'].includes(c.severity)||
    !ID.test(c.ecosystem??'')||Object.hasOwn(c,'expected')||Object.hasOwn(c,'truth'))
     throw Error('T7 case universe contains invalid identity, snapshot or leaked truth label');
  cases.set(c.id,c);
 }
 return cases;
}
function predictions(rows,cases,name){
 if(!Array.isArray(rows)||rows.length>MAX_CASES)throw Error('T7 invalid '+name+' predictions');
 const seen=new Map();
 for(const p of rows){
  if(!plain(p)||!ID.test(p.caseId??'')||seen.has(p.caseId)||
   !cases.has(p.caseId)||!DECISION.has(p.decision)||
   typeof p.scanComplete!=='boolean'||!HEX.test(p.sourceEvidenceSha256??'')||
   p.sourceEvidenceSha256!==cases.get(p.caseId).sourceEvidenceSha256||
   p.commitSha!==cases.get(p.caseId).commitSha)
    throw Error('T7 '+name+' prediction identity or source snapshot mismatch');
  seen.set(p.caseId,p);
 }
 return seen;
}
function readReviews(reviews,cases,studyId){
 if(!plain(reviews)||reviews.schemaVersion!==1||reviews.studyId!==studyId||
  !Array.isArray(reviews.cases)||reviews.cases.length>MAX_CASES)
  throw Error('T7 invalid review manifest');
 const out=new Map();
 let dual=0,unresolved=0,unknown=0;
 for(const row of reviews.cases){
  if(!plain(row)||!ID.test(row.caseId??'')||out.has(row.caseId)||!cases.has(row.caseId)||
   !Array.isArray(row.reviewers)||row.reviewers.length!==2)
   throw Error('T7 invalid, duplicate or unregistered human adjudication case');
  const r=row.reviewers;
  for(const v of r){
   if(!plain(v)||!ID.test(v.reviewerAlias??'')||
      v.blindToPredictions!==true||!DECISION.has(v.decision)||
      !HEX.test(v.evidenceSha256??'')||!HEX.test(v.rationaleSha256??''))
    throw Error('T7 review lacks declared blinding or pinned evidence');
  }
  if(r[0].reviewerAlias===r[1].reviewerAlias)
    throw Error('T7 dual review must declare distinct reviewers');
  dual++;
  let outcome='unknown';
  if(r[0].decision===r[1].decision){
   if(Object.hasOwn(row,'adjudicator'))
    throw Error('T7 unsolicited adjudicator on agreeing reviews');
   outcome=r[0].decision;
  }
  else if(row.adjudicator!==undefined){
   const a=row.adjudicator;
   if(!plain(a)||!ID.test(a.reviewerAlias??'')||
      r.some(x=>x.reviewerAlias===a.reviewerAlias)||
      a.blindToPredictions!==true||!DECISION.has(a.decision)||
      !HEX.test(a.evidenceSha256??'')||!HEX.test(a.rationaleSha256??''))
    throw Error('T7 invalid independent disagreement adjudicator');
   outcome=a.decision;
  }else unresolved++;
  if(outcome==='unknown')unknown++;
  out.set(row.caseId,outcome);
 }
 return {labels:out,dual,unresolved,unknown};
}
function resolved(p){return p?.scanComplete?p.decision:'unknown'}
function stats(cases,predictions,labels){
 let tp=0,fp=0,tn=0,fn=0,abstainPositive=0,abstainNegative=0;
 for(const c of cases){
  const truth=labels.get(c.id),decision=resolved(predictions.get(c.id));
  if(truth==='positive'){
   if(decision==='positive')tp++;
   else if(decision==='negative')fn++;
   else abstainPositive++;
  }else if(truth==='negative'){
   if(decision==='positive')fp++;
   else if(decision==='negative')tn++;
   else abstainNegative++;
  }
 }
 const positives=tp+fn+abstainPositive,negatives=fp+tn+abstainNegative;
 return {
  labeledCases:positives+negatives,labeledPositive:positives,labeledNegative:negatives,
  confusion:{tp,fp,fn,tn,abstainPositive,abstainNegative},
  decisionCoverage:percent(tp+fp+fn+tn,positives+negatives),
  alertPrecision:percent(tp,tp+fp),precisionWilson95:wilson(tp,tp+fp),
  strictRecallIncludingUnknown:percent(tp,positives),recallWilson95:wilson(tp,positives),
  falsePositiveRateDecided:percent(fp,fp+tn),
  falseAlertIncidenceAllLabeledNegatives:percent(fp,negatives),
  falseNegativeRateDecided:percent(fn,tp+fn),
  missedPositiveIncidenceAllLabeledPositives:percent(fn,positives),
  negativeDecisionCoverage:percent(fp+tn,negatives),
  abstentionRate:percent(abstainPositive+abstainNegative,positives+negatives),
 };
}
function paired(cases,base,aug,labels){
 const x={newTrueDetections:0,lostTrueDetections:0,newFalseAlerts:0,avoidedFalseAlerts:0,
   gainedCorrectDecisions:0,lostCorrectDecisions:0,bothAbstained:0};
 for(const c of cases){
  const truth=labels.get(c.id),a=resolved(base.get(c.id)),b=resolved(aug.get(c.id));
  if(truth==='positive'){
   if(a!=='positive'&&b==='positive')x.newTrueDetections++;
   if(a==='positive'&&b!=='positive')x.lostTrueDetections++;
  }else if(truth==='negative'){
   if(a!=='positive'&&b==='positive')x.newFalseAlerts++;
   if(a==='positive'&&b!=='positive')x.avoidedFalseAlerts++;
  }
  if(a==='unknown'&&b==='unknown')x.bothAbstained++;
  if(a!==truth&&b===truth)x.gainedCorrectDecisions++;
  if(a===truth&&b!==truth)x.lostCorrectDecisions++;
 }
 return x;
}
function perStratum(cases,base,aug,labels,field){
 const grouped=new Map();
 for(const c of cases){const k=c[field],a=grouped.get(k)??[];a.push(c);grouped.set(k,a)}
 if(grouped.size>MAX_STRATA)throw Error('T7 strata budget exceeded');
 return Object.fromEntries([...grouped.entries()].sort(([a],[b])=>sort(a,b)).map(([k,rows])=>[
  k,{support:rows.length,baseline:rows.length>=20?stats(rows,base,labels):null,
    augmented:rows.length>=20?stats(rows,aug,labels):null,
    note:rows.length<20?'underpowered-stratum-metrics-withheld':'diagnostic-not-independently-verified'},
 ]));
}
const unavailable={baseline:null,augmented:null,paired:null,strata:null};
/** Never certifies human reviewer identity or real-world accuracy from user JSON. */
export function evaluateT7Study(manifest,reviews,baselinePredictions,augmentedPredictions){
 const raw=[JSON.stringify(manifest),JSON.stringify(reviews),JSON.stringify(baselinePredictions),
   JSON.stringify(augmentedPredictions)];
 const cases=checkManifest(manifest);
 const labels=readReviews(reviews,cases,manifest.studyId);
 const base=predictions(baselinePredictions,cases,'UCE-only');
 const aug=predictions(augmentedPredictions,cases,'UCE-plus-Trilogy');
 const complete=labels.labels.size===cases.size&&base.size===cases.size&&aug.size===cases.size;
 const eligible=[...cases.values()].filter(c=>['positive','negative'].includes(labels.labels.get(c.id)));
 const missing={dualReviews:cases.size-labels.labels.size,baseline:cases.size-base.size,
  augmented:cases.size-aug.size,unresolved:labels.unresolved,unknownLabels:labels.unknown};
 const diagnostic=complete&&eligible.length>0?{
  baseline:stats(eligible,base,labels.labels),augmented:stats(eligible,aug,labels.labels),
  paired:paired(eligible,base,aug,labels.labels),
  strata:{domain:perStratum(eligible,base,aug,labels.labels,'domain'),
    severity:perStratum(eligible,base,aug,labels.labels,'severity'),
    ecosystem:perStratum(eligible,base,aug,labels.labels,'ecosystem')},
 }:unavailable;
 const result={
  schemaVersion:1,phase:'Trilogy-T7',studyId:manifest.studyId,
  inputManifestSha256:sha(JSON.stringify(manifest)),
  studyProtocolSha256:manifest.protocolSha256,samplingFrameSha256:manifest.samplingFrameSha256,
  studyStatus:cases.size===0?'awaiting-frozen-independent-real-repository-cases':
    !complete?'incomplete-paired-study':eligible.length===0?'no-resolved-gold-labels':
    'paired-diagnostic-only-review-provenance-unaudited',
  caseUniverseCount:cases.size,declaredDualReviewedCases:labels.dual,
  declaredResolvedBinaryCases:eligible.length,independentlyAuthenticatedHumanCases:0,
  independentlyAuthenticatedSourceRevisions:0,
  reviewerIdentityAndBlindingExternallyVerified:false,
  sourceGitCommitExternallyVerified:false,
  heldOutSamplingFrameIndependentlyAudited:false,
  missingOrUnresolved:missing,
  pairedDiagnostic:diagnostic,
  measuredIndependentRealWorldAccuracy:null,
  demonstratedTrilogyImprovement:false,
  independentlyVerifiedFixCorrectness:null,
  recommendationCorrectness:null,
  nativeSolverHostAcceptance:false,
  overallReleaseReady:false,
  changesToCanonicalUCEScoring:false,
  automaticPatchesAllowed:false,
  disclaimers:[
   'Declared reviewer roles, blinded status, evidence hashes and repository commit strings are not independently authenticated by this reader.',
   'Agent-authored UCE fixtures and source excerpts are not independent real-repository ground truth.',
   'Paired predictions must cover the same frozen case universe; partial scans and Unknown are abstentions, not true negatives.',
   'Diagnostic precision/recall and Wilson intervals are descriptive only, not production accuracy or demonstrated improvement.',
   'Correlated cases within repositories mean Wilson intervals cannot substitute for clustered independent study inference.',
   'Trilogy T0-T6 review-only findings do not become real independent detector predictions merely by appearing in a fusion view.',
   'Independent review audit, preregistered held-out sampling and real repository verification remain outside this code.',
  ],
 };
 if(JSON.stringify(manifest)!==raw[0]||JSON.stringify(reviews)!==raw[1]||
    JSON.stringify(baselinePredictions)!==raw[2]||JSON.stringify(augmentedPredictions)!==raw[3])
   throw Error('T7 mutated frozen input evidence');
 return result;
}
