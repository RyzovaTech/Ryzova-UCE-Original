/**
 * Trilogy T5 — source-anchored investigation hypotheses, not root cause proof.
 * T4/T2 are recomputed from canonical report + supplied files; never trust
 * a saved browser report, native solver claim, or untrusted "confirmed" label.
 * All original UCE issue identities, severities and score remain untouched.
 */
import {createHash} from 'node:crypto';
import {fuseAccuracyEvidence} from '../trilogy-t4/fusion.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const LIMIT={issues:5000,facts:5000,groups:100,neighbors:32,depth:2};
const severityRank={critical:0,warning:1,info:2};
const pathPattern=/^[A-Za-z0-9_.@/-]{1,512}$/;
const validPath=p=>typeof p==='string'&&pathPattern.test(p)&&!p.startsWith('/')&&
 p.split('/').every(x=>x&&x!=='.'&&x!=='..');
function issuePath(value){
 if(typeof value!=='string')return null;
 const match=/(?::\d+|#L\d+)$/.exec(value);
 const file=match?value.slice(0,match.index):value;
 return validPath(file)?file:null;
}
function validOpt(o){
 return o&&typeof o==='object'&&!Array.isArray(o)&&
  (!('maxGroups' in o)||(Number.isSafeInteger(o.maxGroups)&&o.maxGroups>=1&&o.maxGroups<=LIMIT.groups))&&
  (!('neighborLimit' in o)||(Number.isSafeInteger(o.neighborLimit)&&o.neighborLimit>=1&&o.neighborLimit<=LIMIT.neighbors))&&
  (!('graphDepth' in o)||(Number.isSafeInteger(o.graphDepth)&&o.graphDepth>=1&&o.graphDepth<=LIMIT.depth))&&
  (!('maxIssues' in o)||(Number.isSafeInteger(o.maxIssues)&&o.maxIssues===LIMIT.issues));
}
const safeCount=n=>Number.isSafeInteger(n)&&n>=0;
const groupOrdering=(a,b)=>a.priorityOrdinal-b.priorityOrdinal||
 b.rawIssueCount-a.rawIssueCount||cmp(a.anchorSha256,b.anchorSha256);
function graphAdjacency(graph){
 const adjacency=new Map();
 const node=e=>{
  if(!HEX.test(e.fromSha256)||!HEX.test(e.toSha256??''))return false;
  if(!['relative-source-import','workspace-package-reference'].includes(e.type))return false;
  if(e.status!=='source-supported')return false;
  const from=adjacency.get(e.fromSha256)??[];
  from.push({to:e.toSha256,factId:e.id,type:e.type});
  adjacency.set(e.fromSha256,from);
  return true;
 };
 for(const e of graph.edges)node(e);
 for(const neighbors of adjacency.values())neighbors.sort((a,b)=>cmp(a.factId,b.factId)||cmp(a.to,b.to));
 return adjacency;
}
function explore(anchor,adj,depth,neighborLimit){
 const queued=[{id:anchor,depth:0}],visited=new Set([anchor]),edges=new Set();
 let clipped=false;
 for(let at=0;at<queued.length;at++){
  const step=queued[at];
  if(step.depth>=depth)continue;
  const neighbors=adj.get(step.id)??[];
  for(const next of neighbors){
   if(edges.has(next.factId))continue;
   if(edges.size>=neighborLimit){clipped=true;break}
   edges.add(next.factId);
   if(!visited.has(next.to)){
    visited.add(next.to);
    queued.push({id:next.to,depth:step.depth+1});
   }
  }
  if(clipped)break;
 }
 return {edgeIds:[...edges].sort(cmp),reachableNodeHashes:[...visited].filter(x=>x!==anchor).sort(cmp),
  clipped};
}
const emptyResult=(r,f,graph,kind,extra={})=>({
 schemaVersion:1,phase:'Trilogy-T5',mode:'root-cause-investigation-hypotheses',
 canonicalEvidenceSha256:f.canonicalEvidenceSha256,
 sourceInventorySha256:graph.suppliedInventorySha256,
 rootCauseVerifiedCount:0,validCausalInference:false,
 originalCoreScore:r.score.overall,originalIssueCount:r.issues.length,
 originalUCEIssueRecords:f.originalUCEIssues,
 originalIssuesDropped:0,canonicalScoreChanged:false,canonicalIssueRecordsChanged:false,
 originCounts:{...f.originCounts,Both:0},findingDeduplicationApplied:false,
 rootCauseHypotheses:[],ungroupedIssueHashes:[],omittedHypotheses:0,
 candidatesForManualReview:0,
 confidence:'uncalibrated-no-independent-ground-truth',
 coverageStatus:kind,
 verifiedBuildOrRuntime:false,verifiedSecurityVulnerabilities:0,
 recommendationSafety:'not-established',automaticPatchesAllowed:false,
 nativeSolvers:'not-invoked',humanApproved:false,releaseReady:false,
 accuracy:{precision:null,recall:null,falsePositiveRate:null,falseNegativeRate:null,
  globalAccuracy:null,recommendationCorrectness:null},
 limitations:[
  'Groups are review hypotheses based on source relationships, not confirmed shared causes.',
  'Syntax-level import and modeled runtime links are not proof of execution, causality, or severity.',
  'Caller-pinned source inventory SHA-256 is not authenticated to an upstream Git revision.',
  'No independent human-labeled real-world accuracy or fix safety was established.',
  'Original UCE warnings are preserved; no merging, suppression, rescoring, or automatic fixes.',
  'Upstream source paths are represented by hashes, which remain susceptible to guessing.',
 ],
 ...extra,
});
/**
 * Every group has ONE exact hashed source anchor, never cross-file title
 * similarity. At most 2 directed import hops are previewed. No graph
 * relationship -> no fabricated root-cause hypothesis.
 */
export function investigateRootCauses(report,sourceFiles,options={}){
 if(!validOpt(options))throw Error('T5 invalid bounded review options');
 const beforeReport=JSON.stringify(report),beforeFiles=JSON.stringify(sourceFiles),
  beforeOpts=JSON.stringify(options);
 const fusionOpts={
  inventoryComplete:options.inventoryComplete,
  expectedInventorySha256:options.expectedInventorySha256,
  assertions:options.assertions,
  reviewBindings:options.reviewBindings,
 };
 const fusion=fuseAccuracyEvidence(report,sourceFiles,fusionOpts);
 const graph=buildWholeProjectGraph(report,sourceFiles,{
  inventoryComplete:options.inventoryComplete===true,
 });
 if(fusion.canonicalEvidenceSha256!==graph.canonicalEvidenceSha256||
    fusion.suppliedInventorySha256!==graph.suppliedInventorySha256 ||
    fusion.originalIssueCount!==report.issues.length||
    fusion.originalUCEIssues.length!==report.issues.length||
    fusion.originCounts.Both!==0||
    graph.edges.length+graph.decisions.length>LIMIT.facts ||
    report.issues.length>LIMIT.issues)
  throw Error('T5 inconsistent or oversized provenance');
 const issueRecords=new Map(),nodes=new Map(),seen=new Set(),originals=[];
 for(let i=0;i<report.issues.length;i++){
  const issue=report.issues[i];
  const record=fusion.originalUCEIssues[i];
  if(record.canonicalIndex!==i||record.issueSha256!==sha(issue.id)||
    seen.has(record.issueSha256))throw Error('T5 issue provenance mismatch');
  seen.add(record.issueSha256);
  const file=issuePath(issue.affectedFile);
  const key=file?sha(file):null;
  const sev=Object.hasOwn(severityRank,issue.severity)?issue.severity:'unknown';
  const summary={issueSha256:record.issueSha256,canonicalIndex:i,
    severity:sev,sourceLocationSha256:key,sourceObservationStatus:record.sourceObservationStatus,
    preserved:true,suppressed:false,causalStatus:'unknown'};
  originals.push(summary);
  if(!key)continue;
  const list=nodes.get(key)??[];list.push(summary);nodes.set(key,list);
  issueRecords.set(record.issueSha256,summary);
 }
 const complete=fusion.graphCoverage.callerInventoryPinned &&
  !fusion.graphCoverage.partial && options.inventoryComplete===true;
 const reachable=graphAdjacency(graph);
 const listedReadable=new Set(sourceFiles.filter(x=>typeof x?.content==='string'&&
  validPath(x.path)).map(x=>sha(x.path)));
 const runtimeAnchors=new Map();
 for(const d of graph.decisions){
  if(d.status!=='review-required'||d.type!=='runtime-pin-vs-engine'||
    !HEX.test(d.fromSha256)||!HEX.test(d.toSha256??''))continue;
  const list=runtimeAnchors.get(d.fromSha256)??[];list.push(d.id);
  runtimeAnchors.set(d.fromSha256,list);
 }
 const anchors=new Set([...nodes.keys(),...runtimeAnchors.keys()]);
 const maxGroups=options.maxGroups??LIMIT.groups,neighborLimit=options.neighborLimit??LIMIT.neighbors,
  graphDepth=options.graphDepth??LIMIT.depth;
 const candidates=[];
 const eligible=complete&&sourceFiles.every(x=>typeof x.content==='string');
 if(eligible){
  for(const anchor of [...anchors].sort(cmp)){
   if(!listedReadable.has(anchor))continue;
   const relatedIssues=nodes.get(anchor)??[];
   const runtimeFactIds=(runtimeAnchors.get(anchor)??[]).sort(cmp);
   const walk=explore(anchor,reachable,graphDepth,neighborLimit);
   if(walk.edgeIds.length===0&&runtimeFactIds.length===0)continue;
   const ordered=relatedIssues.slice().sort((a,b)=>
    (severityRank[a.severity]??3)-(severityRank[b.severity]??3)||
     cmp(a.issueSha256,b.issueSha256));
   const severity=ordered.length ? ordered[0].severity:'unranked';
   const priorityOrdinal=ordered.length?severityRank[severity]??3:4;
   candidates.push({
    hypothesisId:sha(['t5',anchor,...ordered.map(x=>x.issueSha256).sort(cmp),
      ...runtimeFactIds,...walk.edgeIds].join('\0')),
    anchorSha256:anchor,kind:runtimeFactIds.length?'runtime-constraint-investigation':'source-relationship-investigation',
    status:'review-hypothesis-only',
    rootCauseVerified:false,causalityProven:false,
    priorityOrdinal,priorityBasis:'existing-uce-severity-only-not-validated-impact',
    severityHint:severity,rawIssueCount:relatedIssues.length,
    issueHashes:ordered.map(x=>x.issueSha256),
    directAndTransitiveFactIds:walk.edgeIds,
    runtimeReviewFactIds:runtimeFactIds,
    possibleReachabilityNodeCount:walk.reachableNodeHashes.length,
    possibleReachabilityNodeHashes:walk.reachableNodeHashes,
    traversalMaxDepth:graphDepth,truncatedByPreviewBudget:walk.clipped,
    impactType:'possible-source-relationship-only',
    blastRadiusVerified:false,safeFixKnown:false,
    recommendation:'manually-check-exact-source-evidence-build-targets-and-runtime-declarations',
    evidenceLimitations:[
      'Not a demonstrated causal root; do not auto-change dependencies or runtime targets.',
      'Import direction and candidate path do not establish actual runtime impact.',
    ],
   });
  }
 }
 candidates.sort(groupOrdering);
 const groups=candidates.slice(0,maxGroups);
 const participating=new Set(groups.flatMap(g=>g.issueHashes));
 const ungrouped=originals.filter(x=>!participating.has(x.issueSha256))
  .map(x=>x.issueSha256).sort(cmp);
 const result=emptyResult(report,fusion,graph,eligible?'bounded-source-hypotheses':'abstained-incomplete-evidence',{
  originalUCEIssueRecords:originals,
  rootCauseHypotheses:groups,ungroupedIssueHashes:ungrouped,
  omittedHypotheses:candidates.length-groups.length,
  candidatesForManualReview:groups.length,
  totalCandidateHypotheses:candidates.length,
  sourceGraph: { edges:graph.edges.length,runtimeDecisions:graph.decisions.length,
    validatedInventoryForReview:eligible,
    unknownRelations:graph.counts.unknown,unmodeledPackages:graph.counts.unmodeledPackageImports,
    parseFailures:graph.coverage.parseFailures },
 });
 if(!safeCount(result.originalIssueCount)||originals.length!==report.issues.length||
    result.originalIssuesDropped!==0||result.rootCauseVerifiedCount!==0||
    result.originCounts.Both!==0)
   throw Error('T5 unsafe or incomplete reporting invariant');
 if(JSON.stringify(report)!==beforeReport||JSON.stringify(sourceFiles)!==beforeFiles||
    JSON.stringify(options)!==beforeOpts)
   throw Error('T5 mutated source or canonical inputs');
 return result;
}
