import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateT7Study} from './evaluate.mjs';
const hex='a'.repeat(64),other='b'.repeat(64),third='c'.repeat(64);
const git='1'.repeat(40);
const manifest=(n=24)=>({schemaVersion:1,studyId:'t7-frozen-study',
 protocolSha256:hex,samplingFrameSha256:other,cases:Array.from({length:n},(_,i)=>({
 id:'case-'+String(i).padStart(4,'0'),repositoryAlias:'repo-'+String(Math.floor(i/4)),
 commitSha:git,sourceEvidenceSha256:third,
 domain:i%3===0?'security':'runtime',severity:i%2===0?'critical':'warning',
 ecosystem:'js-ts'}))});
const review=(id,decision,overrides={})=>({caseId:id,reviewers:[
 {reviewerAlias:'reviewer-a',blindToPredictions:true,decision,evidenceSha256:hex,rationaleSha256:other},
 {reviewerAlias:'reviewer-b',blindToPredictions:true,decision,evidenceSha256:hex,rationaleSha256:other},
 ],...overrides});
const gold=(m)=>({schemaVersion:1,studyId:m.studyId,cases:m.cases.map((c,i)=>
 review(c.id,i%2===0?'positive':'negative'))});
const preds=(m,mode='base')=>m.cases.map((c,i)=>({caseId:c.id,
 decision:mode==='base' ? (i%4===0?'positive':i%4===1?'positive':'negative'):
 (i%2===0?'positive':'negative'),
 scanComplete:true,commitSha:c.commitSha,sourceEvidenceSha256:c.sourceEvidenceSha256}));
const run=(n=24)=>{const m=manifest(n);return {m,r:gold(m),b:preds(m),a:preds(m,'aug')}};
const evaluate=x=>evaluateT7Study(x.m,x.r,x.b,x.a);
test('an empty real-world registration cannot claim a single human label or accuracy',()=>{
 const m=manifest(0),result=evaluateT7Study(m,gold(m),[],[]);
 assert.equal(result.caseUniverseCount,0);
 assert.equal(result.studyStatus,'awaiting-frozen-independent-real-repository-cases');
 assert.equal(result.pairedDiagnostic.baseline,null);
 assert.equal(result.measuredIndependentRealWorldAccuracy,null);
 assert.equal(result.overallReleaseReady,false);
});
test('same paired case universe computes independent diagnostic confusion, not verified accuracy',()=>{
 const x=run(),v=evaluate(x);
 assert.equal(v.caseUniverseCount,24);
 assert.equal(v.declaredDualReviewedCases,24);
 assert.deepEqual(v.pairedDiagnostic.baseline.confusion,
  {tp:6,fp:6,fn:6,tn:6,abstainPositive:0,abstainNegative:0});
 assert.deepEqual(v.pairedDiagnostic.augmented.confusion,
  {tp:12,fp:0,fn:0,tn:12,abstainPositive:0,abstainNegative:0});
 assert.equal(v.pairedDiagnostic.baseline.falseNegativeRateDecided,50);
 assert.equal(v.pairedDiagnostic.baseline.missedPositiveIncidenceAllLabeledPositives,50);
 assert.equal(v.pairedDiagnostic.augmented.falseNegativeRateDecided,0);
 assert.equal(v.pairedDiagnostic.paired.newTrueDetections,6);
 assert.equal(v.pairedDiagnostic.paired.avoidedFalseAlerts,6);
 assert.equal(v.demonstratedTrilogyImprovement,false);
 assert.equal(v.independentlyAuthenticatedHumanCases,0);
 assert.equal(v.measuredIndependentRealWorldAccuracy,null);
});
test('labels unresolved by human disagreement are excluded rather than turned negative',()=>{
 const x=run();x.r.cases[0].reviewers[1].decision='negative';
 const v=evaluate(x);
 assert.equal(v.missingOrUnresolved.unresolved,1);
 assert.equal(v.declaredResolvedBinaryCases,23);
 assert.equal(v.pairedDiagnostic.baseline.labeledPositive,11);
 assert.equal(v.independentlyVerifiedFixCorrectness,null);
});
test('a distinct third review resolves disagreement, never claims external identity verification',()=>{
 const x=run();x.r.cases[0].reviewers[1].decision='negative';
 x.r.cases[0].adjudicator={reviewerAlias:'reviewer-c',blindToPredictions:true,
  decision:'positive',evidenceSha256:hex,rationaleSha256:other};
 const v=evaluate(x);
 assert.equal(v.missingOrUnresolved.unresolved,0);
 assert.equal(v.declaredResolvedBinaryCases,24);
 assert.equal(v.reviewerIdentityAndBlindingExternallyVerified,false);
});
test('a third reviewer cannot impersonate either initial reviewer',()=>{
 const x=run();x.r.cases[0].reviewers[1].decision='negative';
 x.r.cases[0].adjudicator={reviewerAlias:'reviewer-a',blindToPredictions:true,
  decision:'positive',evidenceSha256:hex,rationaleSha256:other};
 assert.throws(()=>evaluate(x),/adjudicator/);
});
test('reviewer aliases must be distinct and explicitly blind',()=>{
 const x=run();x.r.cases[0].reviewers[1].reviewerAlias='reviewer-a';
 assert.throws(()=>evaluate(x),/distinct/);
 x.r.cases[0].reviewers[1].reviewerAlias='reviewer-b';
 x.r.cases[0].reviewers[1].blindToPredictions=false;
 assert.throws(()=>evaluate(x),/blinding/);
});
test('one missing review withholds all aggregate metrics to prevent convenient exclusions',()=>{
 const x=run();x.r.cases.pop();
 const v=evaluate(x);
 assert.equal(v.studyStatus,'incomplete-paired-study');
 assert.equal(v.missingOrUnresolved.dualReviews,1);
 assert.equal(v.pairedDiagnostic.baseline,null);
 assert.equal(v.pairedDiagnostic.augmented,null);
});
test('missing baseline or augmented decision withholds metrics',()=>{
 const x=run();x.b.pop();
 assert.equal(evaluate(x).pairedDiagnostic.paired,null);
 x.b=preds(x.m);x.a.pop();
 assert.equal(evaluate(x).pairedDiagnostic.paired,null);
});
test('empty label universe does not permit positives on unknown truth',()=>{
 const x=run();for(const r of x.r.cases){
  r.reviewers[0].decision='unknown';r.reviewers[1].decision='unknown';
 }
 const v=evaluate(x);
 assert.equal(v.missingOrUnresolved.unknownLabels,24);
 assert.equal(v.pairedDiagnostic.baseline,null);
 assert.equal(v.studyStatus,'no-resolved-gold-labels');
});
test('unknown predictions never become true negatives or rewarded as accuracy',()=>{
 const x=run();x.a=x.a.map(p=>({...p,decision:'unknown'}));
 const v=evaluate(x).pairedDiagnostic.augmented;
 assert.equal(v.confusion.tn,0);
 assert.equal(v.confusion.tp,0);
 assert.equal(v.confusion.abstainPositive,12);
 assert.equal(v.confusion.abstainNegative,12);
 assert.equal(v.strictRecallIncludingUnknown,0);
 assert.equal(v.alertPrecision,null);
 assert.equal(v.falsePositiveRateDecided,null);
 assert.equal(v.falseNegativeRateDecided,null);
 assert.equal(v.missedPositiveIncidenceAllLabeledPositives,0);
 assert.equal(v.decisionCoverage,0);
});
test('partial scans are abstentions even if they emit positive findings',()=>{
 const x=run();x.a=x.a.map(p=>({...p,scanComplete:false}));
 const v=evaluate(x).pairedDiagnostic.augmented;
 assert.equal(v.confusion.fp,0);
 assert.equal(v.confusion.tn,0);
 assert.equal(v.confusion.abstainPositive,12);
 assert.equal(v.confusion.abstainNegative,12);
});
test('strata smaller than twenty cases withhold misleading score percentages',()=>{
 const x=run();const v=evaluate(x);
 assert.equal(v.pairedDiagnostic.strata.domain.security.support,8);
 assert.equal(v.pairedDiagnostic.strata.domain.security.baseline,null);
 assert.equal(v.pairedDiagnostic.strata.domain.runtime.augmented,null);
 assert.ok(v.pairedDiagnostic.baseline.precisionWilson95);
});
test('duplicated and alien case IDs cannot silently change denominators',()=>{
 const x=run();x.m.cases[0]={...x.m.cases[0],id:x.m.cases[1].id};
 assert.throws(()=>evaluate(x),/invalid identity/);
 x.m=manifest();x.r=gold(x.m);x.b=preds(x.m);x.a=preds(x.m,'aug');
 x.a[0].caseId='alien-id';assert.throws(()=>evaluate(x),/mismatch/);
});
test('prediction snapshot mismatch or leaked expected truth fails closed',()=>{
 const x=run();x.a[0].sourceEvidenceSha256=hex;
 assert.throws(()=>evaluate(x),/mismatch/);
 x.a=preds(x.m,'aug');x.m.cases[0].expected=true;
 assert.throws(()=>evaluate(x),/leaked truth/);
});
test('malformed commit pin and unsupported study domains rejected',()=>{
 const x=run();x.m.cases[0].commitSha='main';
 assert.throws(()=>evaluate(x),/invalid identity/);
 x.m=manifest();x.m.cases[0].domain='unspecified-vulnerability';
 assert.throws(()=>evaluate(x),/invalid identity/);
});
test('repeated prediction for a case cannot create a new true positive',()=>{
 const x=run();x.a[1]={...x.a[0]};
 assert.throws(()=>evaluate(x),/mismatch/);
});
test('unknown reviews do not count as independently reviewed positive/negative cases',()=>{
 const x=run();x.r.cases[0].reviewers[1].decision='unknown';
 const v=evaluate(x);assert.equal(v.missingOrUnresolved.unresolved,1);
 assert.equal(v.pairedDiagnostic.augmented.labeledCases,23);
 assert.equal(v.independentlyAuthenticatedHumanCases,0);
});
test('synthetic apparent performance jump cannot promote safe fixes or native acceptance',()=>{
 const v=evaluate(run());
 assert.equal(v.independentlyVerifiedFixCorrectness,null);
 assert.equal(v.recommendationCorrectness,null);
 assert.equal(v.nativeSolverHostAcceptance,false);
 assert.equal(v.automaticPatchesAllowed,false);
 assert.equal(v.changesToCanonicalUCEScoring,false);
 assert.equal(v.overallReleaseReady,false);
});
test('input arrays and nested records remain byte-for-byte unchanged',()=>{
 const x=run(),before=JSON.stringify(x);
 evaluate(x);assert.equal(JSON.stringify(x),before);
});
test('over-budget case universe and unsupported input types reject',()=>{
 const x=run(2001);
 assert.throws(()=>evaluate(x),/invalid frozen/);
 const y=run();assert.throws(()=>evaluateT7Study(y.m,{},y.b,y.a));
 assert.throws(()=>evaluateT7Study([],y.r,y.b,y.a));
});
