/**
 * Trilogy T6 — narrow, reviewer-authored Node major pin change PREVIEW.
 * Never selects a target Node version, writes project files, runs a build,
 * changes canonical UCE findings or asserts that a patch is correct.
 */
import {createHash} from 'node:crypto';
import {investigateRootCauses} from '../trilogy-t5/root-causes.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const LIMIT=64;
const validPath=p=>typeof p==='string'&&p.length<=512&&
 /^[A-Za-z0-9_.@/-]+$/.test(p)&&!p.startsWith('/')&&
 p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function matchesRestrictedEngine(engine,major){
 if(typeof engine!=='string'||!Number.isSafeInteger(major))return false;
 const x=engine.trim();
 let m=/^>=\s*(\d{1,3})$/.exec(x);
 if(m)return major>=Number(m[1]);
 m=/^<\s*(\d{1,3})$/.exec(x);
 if(m)return major<Number(m[1]);
 m=/^v?(\d{1,3})$/.exec(x);
 return Boolean(m&&major===Number(m[1]));
}
const rejection=(index,reason)=>({
 requestIndex:index,status:'rejected',reason,
 originalSourceChanged:false,proposedFixVerified:false,
 automaticallyApplicable:false,
});
function inspectPin(content){
 if(typeof content!=='string'||Buffer.byteLength(content)>128)return null;
 const m=/^(v?)([1-9]\d{0,2})(\r?\n)?$/.exec(content);
 if(!m)return null;
 return {prefix:m[1],major:Number(m[2]),eol:m[3]??''};
}
/** Preview-only proposals for explicit reviewed source-backed runtime pin choices. */
export function previewDeveloperFixes(report,sourceFiles,options={}){
 if(!isObj(options)||!Array.isArray(options.requests)||options.requests.length>LIMIT||
  options.inventoryComplete!==true||
  typeof options.expectedInventorySha256!=='string'||
  !HEX.test(options.expectedInventorySha256))
  throw Error('T6 requires explicit bounded review requests and pinned complete inventory');
 const oldReport=JSON.stringify(report),oldFiles=JSON.stringify(sourceFiles),
  oldOptions=JSON.stringify(options);
 const t5=investigateRootCauses(report,sourceFiles,{
  inventoryComplete:true,expectedInventorySha256:options.expectedInventorySha256,
 });
 const graph=buildWholeProjectGraph(report,sourceFiles,{inventoryComplete:true});
 if(t5.canonicalEvidenceSha256!==graph.canonicalEvidenceSha256||
  graph.suppliedInventorySha256!==options.expectedInventorySha256||
  t5.sourceInventorySha256!==graph.suppliedInventorySha256)
  throw Error('T6 source provenance mismatch');
 const accessible=t5.coverageStatus==='bounded-source-hypotheses'&&
  !t5.sourceGraph.parseFailures&&t5.sourceGraph.unknownRelations===0&&
  t5.sourceGraph.unmodeledPackages===0;
 const files=new Map(sourceFiles.map(f=>[f.path,f]));
 const groups=new Map(t5.rootCauseHypotheses.map(g=>[g.hypothesisId,g]));
 const decisions=new Map(graph.decisions.map(d=>[d.id,d]));
 const usedRequestKeys=new Set(),collisionPins=new Map();
 for(const request of options.requests){
  if(isObj(request)&&validPath(request.pinPath))
   collisionPins.set(request.pinPath,(collisionPins.get(request.pinPath)??0)+1);
 }
 const proposed=options.requests.map((r,index)=>{
  if(!isObj(r)||typeof r.hypothesisId!=='string'||!HEX.test(r.hypothesisId)||
   typeof r.evidenceFactId!=='string'||!HEX.test(r.evidenceFactId)||
   !validPath(r.manifestPath)||!validPath(r.pinPath)||
   typeof r.expectedPinSha256!=='string'||!HEX.test(r.expectedPinSha256)||
   !Number.isSafeInteger(r.requestedMajor)||r.requestedMajor<1||r.requestedMajor>99)
    return rejection(index,'malformed-or-untrusted-review-request');
  const id=hash(JSON.stringify([r.hypothesisId,r.evidenceFactId,
   r.manifestPath,r.pinPath,r.expectedPinSha256,r.requestedMajor]));
  if(usedRequestKeys.has(id)||collisionPins.get(r.pinPath)!==1)
   return rejection(index,'duplicate-or-conflicting-target-proposal');
  usedRequestKeys.add(id);
  if(!accessible)return rejection(index,'insufficient-or-unauthenticated-source-coverage');
  const g=groups.get(r.hypothesisId),d=decisions.get(r.evidenceFactId);
  if(!g||!d||g.kind!=='runtime-constraint-investigation'||
    g.status!=='review-hypothesis-only'||g.rootCauseVerified!==false||
    !g.runtimeReviewFactIds.includes(d.id)||
    d.type!=='runtime-pin-vs-engine'||d.kind!=='modeled-disjoint'||
    d.status!=='review-required'||d.fromSha256!==hash(r.manifestPath)||
    d.toSha256!==hash(r.pinPath)||g.anchorSha256!==hash(r.manifestPath))
   return rejection(index,'no-matching-conservative-runtime-evidence');
  if(r.pinPath!==(r.manifestPath==='package.json'?'.nvmrc':
    r.manifestPath.slice(0,-'package.json'.length)+'.nvmrc')&&
   r.pinPath!==(r.manifestPath==='package.json'?'.node-version':
    r.manifestPath.slice(0,-'package.json'.length)+'.node-version'))
   return rejection(index,'runtime-pin-is-not-in-manifest-workspace');
  const pin=files.get(r.pinPath),manifest=files.get(r.manifestPath);
  if(typeof pin?.content!=='string'||typeof manifest?.content!=='string')
   return rejection(index,'source-bytes-unavailable');
  if(hash(pin.content)!==r.expectedPinSha256)
   return rejection(index,'stale-or-changed-pin-source-hash');
  const parsed=inspectPin(pin.content);
  if(!parsed||parsed.major===r.requestedMajor)
   return rejection(index,'unsupported-pin-format-or-no-op');
  let data;
  try{data=JSON.parse(manifest.content)}catch{
   return rejection(index,'invalid-package-manifest');
  }
  if(!isObj(data)||!isObj(data.engines)||
    !matchesRestrictedEngine(data.engines.node,r.requestedMajor)||
    matchesRestrictedEngine(data.engines.node,parsed.major))
   return rejection(index,'target-not-proven-in-restricted-engine-range');
  const target=parsed.prefix+String(r.requestedMajor)+parsed.eol;
  const selectedGroupFiles=g.possibleReachabilityNodeHashes.length;
  return {
   requestIndex:index,proposalId:id,status:'reviewable-preview-only',
   patchCategory:'node-major-pin-review',sourceFileSha256:hash(r.pinPath),
   sourceSnapshotSha256:r.expectedPinSha256,proposedSnapshotSha256:hash(target),
   manifestSha256:hash(manifest.content),hypothesisId:g.hypothesisId,
   evidenceFactId:d.id,sourceInventorySha256:graph.suppliedInventorySha256,
   patch:{format:'bounded-single-line-unified-review-diff',
    oldText:pin.content,newText:target,
    unifiedPreview:'--- a/[node-pin]\n+++ b/[node-pin]\n@@ -1 +1 @@\n-'+
      pin.content.trimEnd()+'\n+'+target.trimEnd()+'\n',
    fileContentIncluded:true,alteredSourceFileCount:1,
    appliesAutomatically:false},
   affectedSourcePathHash:hash(r.pinPath),
   modeledReachableNeighborCount:selectedGroupFiles,
   risk:{classification:'high-requires-developer-validation',
    impacts:['runtime-major-change','dependency-engine-compatibility-unknown',
      'toolchain-and-lockfile-runtime-unknown','deployment-runtime-unknown'],
    correctnessClaim:'not-established',blastRadiusVerified:false},
   verificationPlan:[
    'Confirm target Node runtime is available in the developer deployment and CI environments.',
    'Review package engines, lockfile, build tools, dependencies and platform support.',
    'Apply manually on a reviewed local branch only after rechecking exact source SHA-256.',
    'Run the project own clean install, tests, build, integration and deploy previews.',
    'Compare failure/behavior against baseline and revert if compatibility regresses.',
   ],
   proposalVerified:false,projectBuildTested:false,runtimeVerified:false,
   developerApproved:false,automaticallyApplicable:false,
   actualSourceModified:false,independentAccuracy:null,
  };
 });
 const accepted=proposed.filter(x=>x.status==='reviewable-preview-only');
 const output={
  schemaVersion:1,phase:'Trilogy-T6',
  mode:'developer-review-only-no-apply',
  originalCoreScore:report.score.overall,originalIssueCount:report.issues.length,
  canonicalEvidenceSha256:t5.canonicalEvidenceSha256,
  sourceInventorySha256:graph.suppliedInventorySha256,
  authenticatedGitRevision:false,
  sourceScope:accessible?'caller-pinned-not-commit-attested':'insufficient',
  requestsReceived:options.requests.length,
  proposalCount:accepted.length,
  rejectedCount:proposed.length-accepted.length,
  proposals:proposed,
  originalIssueRecordsPreserved:t5.originalUCEIssueRecords.length===report.issues.length,
  originalIssuesSuppressed:0,originalScoreModified:false,
  confirmedRootCauses:0,verifiedSafeFixes:0,appliedPatches:0,
  developerApprovalRequired:true,releaseReady:false,
  globalAccuracy:null,recommendationCorrectness:null,
  nativeSolvers:'not-run',
  limitations:[
   'Developer independently supplies the target Node major; T6 does not infer an objectively correct version.',
   'Only a source-anchored Node runtime pin conflict and a restricted engines.node model can produce a preview.',
   'A reviewed text diff is not proof of successful installation, build, runtime or safe remediation.',
   'Supplied SHA-256 binds caller bytes but does not authenticate the original Git revision or branch.',
   'No project files are written, commands run, warnings removed or UCE scores changed.',
   'No automatic application or independently validated recommendation safety is available.',
  ],
 };
 if(JSON.stringify(report)!==oldReport||
   JSON.stringify(sourceFiles)!==oldFiles||
   JSON.stringify(options)!==oldOptions)
  throw Error('T6 mutated project source or canonical UCE report');
 return output;
}
