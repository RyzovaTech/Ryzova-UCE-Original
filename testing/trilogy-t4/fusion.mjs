/**
 * Trilogy T4 — conservative accuracy-aware evidence fusion (experimental).
 * This is a read-only view, not an AnalysisResult rewrite or verified proof.
 * No matching titles/categories/paths alone can ever promote origin "Both".
 */
import { createHash } from 'node:crypto';
import { canonicalEvidenceHash } from '../trilogy-t0/safety.mjs';
import { adjudicateEvidence } from '../trilogy-t1/evidence.mjs';
import { buildWholeProjectGraph } from '../trilogy-t2/graph.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const HEX = /^[a-f0-9]{64}$/;
const validPath = path => typeof path==='string' && path.length<=512 &&
  /^[A-Za-z0-9_.@/-]+$/.test(path) && !path.startsWith('/') &&
  path.split('/').every(s => s && s!=='.' && s!=='..');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const MAX_ISSUES=5000, MAX_FACTS=5000, MAX_BINDINGS=5000;
function location(value){
 if(typeof value!=='string')return null;
 const match=/(?::\d+|#L\d+)$/.exec(value);
 const source=match?value.slice(0,match.index):value;
 return validPath(source)?source:null;
}
function isPlain(v){return v!==null && typeof v==='object' && !Array.isArray(v)}
function stableFacts(graph){
 const facts=[...graph.edges,...graph.decisions];
 if(facts.length>MAX_FACTS)throw Error('T4 graph fact budget exceeded');
 const ids=new Set();
 for(const fact of facts){
  if(!fact||typeof fact.id!=='string'||!HEX.test(fact.id)||ids.has(fact.id)||
    typeof fact.fromSha256!=='string'||!HEX.test(fact.fromSha256)||
    !['source-supported','review-required','unknown'].includes(fact.status))
   throw Error('T4 ambiguous or invalid source fact');
  ids.add(fact.id);
 }
 return facts.sort((a,b)=>compare(a.id,b.id));
}
/** Review bindings are *untrusted suggestions*, NEVER native-truth attestation. */
function parseBindings(bindings, issueMap, factMap, inventoryComplete){
 if(!Array.isArray(bindings)||bindings.length>MAX_BINDINGS)
   throw Error('T4 review binding resource budget exceeded');
 const reviewed=[], seen=new Set(), flags=new Set();
 const issueBindings=new Map(),factBindings=new Map();
 for(const candidate of bindings){
  if(!isPlain(candidate)||typeof candidate.issueId!=='string'||
      typeof candidate.factId!=='string'||!HEX.test(candidate.factId)||
      typeof candidate.expectedFileSha256!=='string'||!HEX.test(candidate.expectedFileSha256))
    throw Error('T4 malformed review suggestion');
  const key=JSON.stringify([candidate.issueId,candidate.factId]);
  if(seen.has(key)){flags.add('duplicate-review-suggestion');continue}
  seen.add(key);
  const issue=issueMap.get(candidate.issueId),fact=factMap.get(candidate.factId);
  let status='rejected';
  let reason='nonexistent-or-unverifiable-identity';
  if(issue&&fact){
   const source=location(issue.affectedFile);
   if(!source){reason='untrusted-issue-location'}
   else if(sha256(source)!==candidate.expectedFileSha256 ||
           fact.fromSha256!==candidate.expectedFileSha256)reason='source-identity-mismatch';
   else if(fact.status!=='source-supported'||!inventoryComplete)
     {status='unknown';reason='incomplete-or-unconfirmed-source-relationship'}
   else{status='review-only';reason='same-source-candidate-not-verified-same-claim'}
   if(status==='review-only'){
    issueBindings.set(candidate.issueId,(issueBindings.get(candidate.issueId)??0)+1);
    factBindings.set(candidate.factId,(factBindings.get(candidate.factId)??0)+1);
   }
  }
  reviewed.push({
   issueSha256:sha256(candidate.issueId),factId:candidate.factId,
   status,reason,promotedToBoth:false,verifiedIssue:false,
  });
 }
 // Ambiguous many-to-one links cannot be called uniquely related.
 for(const item of reviewed)if(item.status==='review-only'){
  const issue=issueMap.get([...issueMap.keys()].find(k=>sha256(k)===item.issueSha256));
  // Compare hashes only in the artifact; never expose raw issue IDs.
  if(!issue || issueBindings.get(issue.id)>1 || factBindings.get(item.factId)>1){
   item.status='ambiguous';
   item.reason='many-to-one-or-one-to-many-source-overlap';
  }
 }
 return {reviewed:reviewed.sort((a,b)=>compare(
   [a.issueSha256,a.factId].join(':'),[b.issueSha256,b.factId].join(':'))),
  flags:[...flags].sort(compare)};
}
/**
 * Re-derives T1 and T2 from the same supplied source inventory; does not
 * trust arbitrary client "verified" statuses or saved browser origin labels.
 */
export function fuseAccuracyEvidence(report,sourceFiles,options={}) {
 if(!isPlain(options)||!Array.isArray(sourceFiles)||
   options.inventoryComplete!==true&&options.inventoryComplete!==false&&
      options.inventoryComplete!==undefined ||
   options.assertions!==undefined&&!Array.isArray(options.assertions)||
   options.reviewBindings!==undefined&&!Array.isArray(options.reviewBindings))
   throw Error('T4 invalid input/options');
 const previousReport=JSON.stringify(report);
 const previousSource=JSON.stringify(sourceFiles);
 const previousOptions=JSON.stringify(options);
 const reportFingerprint=canonicalEvidenceHash(report);
 if(report.issues.length>MAX_ISSUES)throw Error('T4 issue resource budget exceeded');
 const issueMap=new Map();
 for(const issue of report.issues){
  if(!issue||typeof issue.id!=='string'||!issue.id||issue.id.length>256||
    issueMap.has(issue.id))throw Error('T4 duplicated or invalid canonical UCE issue ID');
  issueMap.set(issue.id,issue);
 }
 const stage1=adjudicateEvidence(report,sourceFiles,options.assertions??[]);
 const graph=buildWholeProjectGraph(report,sourceFiles,{
   inventoryComplete:options.inventoryComplete===true,
 });
 if(stage1.canonicalEvidenceSha256!==reportFingerprint||
   graph.canonicalEvidenceSha256!==reportFingerprint)
    throw Error('T4 incompatible canonical source inputs');
 if(typeof options.expectedInventorySha256==='string' &&
   options.expectedInventorySha256!==graph.suppliedInventorySha256)
    throw Error('T4 supplied inventory digest mismatch');
 if(options.expectedInventorySha256!==undefined &&
    (typeof options.expectedInventorySha256!=='string'||
     !HEX.test(options.expectedInventorySha256)))
    throw Error('T4 invalid source inventory digest');
 const facts=stableFacts(graph);
 const factMap=new Map(facts.map(f=>[f.id,f]));
 const incomplete=describeReportReadiness(report).partial ||
   graph.coverage.filesReadable!==graph.coverage.filesListed ||
   graph.coverage.truncatedByBudget || graph.coverage.parseFailures>0 ||
   graph.counts.unmodeledDynamicImports>0 ||
   graph.counts.manifestReadFailures>0 ||
   graph.counts.unknown>0 ||
   graph.inputScope!=='caller-asserted-inventory';
 const inventoryUsable=!incomplete &&
   options.inventoryComplete===true &&
   typeof options.expectedInventorySha256==='string' &&
   options.expectedInventorySha256===graph.suppliedInventorySha256;
 const reviewed=parseBindings(options.reviewBindings??[],issueMap,factMap,inventoryUsable);
 const independentStates=new Map(stage1.findings.map(f=>[f.findingIdSha256,f]));
 const originals=report.issues.map((issue,index)=>{
  const state=independentStates.get(sha256(issue.id));
  if(!state)throw Error('T4 missing original issue audit');
  return {
   canonicalIndex:index, issueSha256:sha256(issue.id),
   origin:'UCE',findingType:'canonical-uce-issue',
   sourceObservationStatus:state.status,
   sourceDisagreement:state.status==='disputed'?'literal-predicate-review-only':null,
   factOrIssueVerified:false,
   autoSuppressed:false,autoFixed:false,
   changedCanonicalSeverity:false,
   requiresDeveloperReview:true,
  };
 });
 const candidates=facts.map(f=>({
   evidenceFactId:f.id,
   origin:'Trilogy',findingType:'independent-source-relationship-observation',
   relationshipType:f.type,
   sourceStatus:f.status,
   issueCorrectnessVerified:false,
   sameIssueAsUCEVerified:false,
   compatibleBuildVerified:false,
   sourceLocationSha256:f.fromSha256,
   targetLocationSha256:f.toSha256,
   claimClass:f.kind,
   autoApplied:false,
 }));
 const associationCounts={
  reviewOnly:reviewed.reviewed.filter(x=>x.status==='review-only').length,
  ambiguous:reviewed.reviewed.filter(x=>x.status==='ambiguous').length,
  rejected:reviewed.reviewed.filter(x=>x.status==='rejected').length,
  unknown:reviewed.reviewed.filter(x=>x.status==='unknown').length,
 };
 const result={
  schemaVersion:1,phase:'Trilogy-T4',mode:'accuracy-aware-review-only-fusion',
  canonicalEvidenceSha256:reportFingerprint,
  suppliedInventorySha256:graph.suppliedInventorySha256,
  inventoryAuthenticatedToGitCommit:false,
  independentGroundTruthVerified:false,
  claimLevelIndependentVerification:'not-established',
  originalScore:report.score.overall,
  originalIssueCount:report.issues.length,
  originalReportModified:false,scoreModified:false,
  originalUCEIssues:originals,
  trilogyObservations:candidates,
  overlapsForReview:reviewed.reviewed,
  overlapCounts:associationCounts,
  originCounts:{UCE:originals.length,Trilogy:candidates.length,Both:0},
  fusionDeduplicatedCanonicalIssues:0,
  suppressedCanonicalIssues:0, removedCanonicalIssues:0,
  appliedPatches:0,
  sourceReviewSummary:{
   sourceReferenced:stage1.counts['source-referenced'],
   independentlyCheckedLiteral:stage1.counts['independently-checked-in-scope'],
   disputedLiterals:stage1.counts.disputed,
   unknown:stage1.counts.unknown,
  },
  graphCoverage:{
   partial:incomplete,
   callerInventoryPinned:inventoryUsable,
   sourceCandidates:graph.counts.relationships,
   modeledRuntimeDecisions:graph.counts.runtimeDecisions,
  },
  verification:{
   nativeSolvers:'not-run-in-t4',
   compatibilityVerified:0,securityVulnerabilitiesVerified:0,
   confidenceCalibrated:false,globalAccuracy:null,
   precision:null,recall:null,falsePositiveRate:null,falseNegativeRate:null,
   recommendationCorrectness:null,
  },
  flags:reviewed.flags,
  developerSafety:{
   deterministicReadOnly:true,
   rootCausesProven:0,automaticFixesAllowed:false,
   externalManualReviewRequired:true,releaseReady:false,
  },
  limitations:[
   'T4 reports source-graph candidate observations, NOT proven project errors or vulnerabilities.',
   'A shared source path, duplicate title or deterministic hash is not independent same-claim evidence; Both is deliberately zero.',
   'Unverified or disputed literal evidence does not invalidate or suppress an original UCE warning.',
   'Pinned inventory SHA-256 is an integrity check on caller-supplied bytes, not independent Git revision authentication.',
   'T3 native results are not accepted as claim-level proof; native end-to-end and ground truth validation remain pending.',
   'All original UCE issues and their original score remain unchanged; no automatic destructive fixes are enabled.',
  ],
 };
 if(JSON.stringify(report)!==previousReport || JSON.stringify(sourceFiles)!==previousSource ||
    JSON.stringify(options)!==previousOptions)
   throw Error('T4 mutated canonical input');
 return result;
}
