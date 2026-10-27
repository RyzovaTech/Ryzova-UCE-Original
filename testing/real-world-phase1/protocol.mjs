/** Phase 1 real GitHub repo diagnostics: NOT adjudicated accuracy data. */
import {createHash} from 'node:crypto';
const ID=/^[a-z][a-z0-9-]{0,63}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const GIT_SHA=/^[a-f0-9]{40}$/;
const ECOSYSTEMS=new Set(['javascript','typescript','python','rust']);
const sha=s=>createHash('sha256').update(s).digest('hex');
export function validatePublicPilotRegistry(registry){
 if(!registry||registry.schemaVersion!==1||
 registry.purpose!=='UNREVIEWED_PUBLIC_SOURCE_DIAGNOSTIC_NOT_ACCURACY_STUDY'||
 !Array.isArray(registry.cases)||registry.cases.length<1||registry.cases.length>8)
  throw Error('Phase1 invalid or overclaimed registry');
 const ids=new Set(),repositories=new Set(),paths=new Set();
 for(const c of registry.cases){
  if(!c||typeof c!=='object'||!ID.test(c.id??'')||ids.has(c.id)||
   !REPO.test(c.repository??'')||repositories.has(c.repository)||
   !GIT_SHA.test(c.commitSha??'')||!ECOSYSTEMS.has(c.ecosystem)||
   !ID.test(c.repoDirectory??'')||paths.has(c.repoDirectory)||
   c.repository.includes('..'))
   throw Error('Phase1 invalid/duplicate project identity or immutable revision');
  ids.add(c.id);repositories.add(c.repository);paths.add(c.repoDirectory);
 }
 return registry.cases;
}
export function summarizePilot(caseSpec,observedHead,report,graph,fusion,inventory){
 if(observedHead!==caseSpec.commitSha)throw Error('Phase1 checked-out revision mismatch');
 if(!report||!report.score||!Array.isArray(report.issues)||!graph||!fusion||!inventory)
  throw Error('Phase1 incomplete scan/fusion');
 if(graph.originalCoreScore!==report.score.overall||
  fusion.originalScore!==report.score.overall||
  graph.originalIssueCount!==report.issues.length||
  fusion.originalIssueCount!==report.issues.length||
  fusion.originalUCEIssues?.length!==report.issues.length||
  graph.canonicalEvidenceSha256!==fusion.canonicalEvidenceSha256||
  graph.suppliedInventorySha256!==fusion.suppliedInventorySha256||
  fusion.originCounts?.Both!==0||fusion.originalReportModified!==false||
  fusion.scoreModified!==false||fusion.appliedPatches!==0||
  fusion.removedCanonicalIssues!==0||fusion.suppressedCanonicalIssues!==0||
  fusion.developerSafety?.releaseReady!==false||
  graph.coverage?.negativeAbsenceEligible!==false||
  graph.sourceSnapshotAuthenticated!==false)
  throw Error('Phase1 original UCE or review-only guarantee violated');
 const critical=report.issues.filter(x=>x.severity==='critical').length;
 const warning=report.issues.filter(x=>x.severity==='warning').length;
 return {
  schemaVersion:1,phase:'real-world-diagnostic-phase1',
  caseId:caseSpec.id,repository:caseSpec.repository,ecosystem:caseSpec.ecosystem,
  pinnedGitCommit:observedHead,
  sampleScope:'public-repository-source-read-only-no-target-code-execution',
  uce:{originalScore:report.score.overall,originalIssueCount:report.issues.length,
   rawCriticalFindings:critical,rawWarningFindings:warning,
   filesFound:report.scanStats?.filesFound??null,
   filesAnalyzed:report.scanStats?.filesAnalyzed??null,
   // Output schema does not guarantee scanStats; absence is Unknown, never truncated=true.
   scanTruncated:typeof report.trust?.execution?.truncated==='boolean'?report.trust.execution.truncated:null,
   canonicalEvidenceSha256:graph.canonicalEvidenceSha256},
  trilogy:{stage:'T4-review-only-source-fusion',
   candidateObservations:fusion.originCounts.Trilogy,
   mappedBackToExistingUCE:fusion.originCounts.UCE,
   independentlyVerifiedOverlap:fusion.originCounts.Both,
   graphFacts:graph.counts.relationships,
   graphUnknownFacts:graph.counts.unknown,
   graphParseFailures:graph.coverage.parseFailures,
   sourceReviewSummary:fusion.sourceReviewSummary,
   graphCoverage:fusion.graphCoverage,
   allIssuesPreserved:true,originalScorePreserved:true,
   automaticFixesApplied:0},
  inventory:{selectedFiles:inventory.selectedFiles,availableSourceBytes:inventory.availableSourceBytes,
   unreadableSelectedFiles:inventory.unreadableSelectedFiles,
   unselectedOrOverBudgetFiles:inventory.unselectedOrOverBudgetFiles,
   inventoryComplete:false,localSourceInventorySha256:graph.suppliedInventorySha256},
  labels:{independentHumanReviewedCases:0,truthPositive:null,truthNegative:null,
   pairedTP:null,pairedFP:null,pairedTN:null,pairedFN:null,
   falsePositiveRate:null,falseNegativeRate:null,independentRealWorldAccuracy:null},
  sourceOriginIndependentlyAuthenticated:false,reviewerIdentityAuthenticated:false,
  measuredImprovement:null,releaseReady:false,
  caveat:'A real public repository was scanned, but neither reviewer truth nor independently authenticated findings exist; counts cannot be interpreted as measured accuracy.',
 };
}
