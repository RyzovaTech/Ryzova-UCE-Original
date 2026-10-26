/**
 * Trilogy T3 — reproducible independent model cross-check, native solver gate.
 * This stage NEVER executes untrusted project code nor native binaries.
 * Its two graph algorithms independently check T2's syntactic graph model.
 * A consistent model is NOT proof of application compatibility.
 */
import { createHash } from 'node:crypto';
import { buildWholeProjectGraph } from '../trilogy-t2/graph.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const hex64=/^[a-f0-9]{64}$/;
const stableSort=(a,b)=>a<b?-1:a>b?1:0;
const MAX_ROOTS=8, MAX_VISITS=5000, MAX_RELATIONS=4000;
function result(status,reason,values={}) {
  return {
    schemaVersion:1,stage:'Trilogy-T3',status,reason,
    method:'bounded-independent-graph-model-cross-check',
    stages:{souffle:'not-run',z3:'not-run',cvc5:'not-run'},
    strictNativeIsolation:'not-attested',nativeVerification:'not-run',
    verifiedCompatibility:false,verifiedVulnerability:false,
    verifiedBuildOrRuntime:false,independentAccuracy:null,
    originalScoreModified:false,originalIssuesModified:false,
    automaticFixAllowed:false,patchesGenerated:0,
    ...values,
    limitations:[
      'Two JS graph algorithms agreeing on the SAME supplied T2 model are not independently implemented native Souffle/Z3/cvc5 solver agreement.',
      'The source snapshot is caller supplied and has not been authenticated to the original scan or checked against a trusted signed commit.',
      'Reachability of syntactic import edges is not proof of module resolution, install, build, security or runtime compatibility.',
      'No native subprocess is launched without separately implemented and audited OS-enforced entire-process-tree isolation.',
      'No synthetic test measures real-world false positives, false negatives or recommendation correctness.',
    ],
  };
}
function rootsValid(roots) {
  return Array.isArray(roots) && roots.length<=MAX_ROOTS && roots.every(x=>
    typeof x==='string' && x.length>0 && x.length<=512 &&
    /^[a-zA-Z0-9_.@/-]+$/.test(x) && !x.startsWith('/') &&
    x.split('/').every(s=>s && s!=='.'&&s!=='..')) &&
    new Set(roots).size===roots.length;
}
function connections(graph) {
  if(!Array.isArray(graph?.edges)||graph.edges.length>MAX_RELATIONS)
    return null;
  const map=new Map();
  for(const edge of graph.edges) {
    if(!edge||edge.status!=='source-supported'||
       !['relative-source-import','workspace-package-reference'].includes(edge.type)) continue;
    if(!hex64.test(edge.fromSha256)||!hex64.test(edge.toSha256??''))return null;
    const existing=map.get(edge.fromSha256)??new Set();
    existing.add(edge.toSha256);
    map.set(edge.fromSha256,existing);
  }
  return map;
}
/** Independent iterative breadth-first algorithm with step/visit budget. */
function breadthFirst(root,adjacency) {
  const queue=[root],seen=new Set([root]);
  for(let at=0;at<queue.length;at++){
    if(at>=MAX_VISITS)return null;
    const next=[...(adjacency.get(queue[at])??[])].sort(stableSort);
    for(const node of next)if(!seen.has(node)){
      if(seen.size>=MAX_VISITS)return null;
      seen.add(node);queue.push(node);
    }
  }
  return [...seen].sort(stableSort);
}
/** Separate iterative depth-first algorithm; no shared traversal state. */
function depthFirst(root,adjacency) {
  const stack=[root],observed=new Set();
  while(stack.length){
    if(observed.size>=MAX_VISITS)return null;
    const current=stack.pop();
    if(observed.has(current))continue;
    observed.add(current);
    const children=adjacency.get(current);
    if(children)for(const child of [...children].sort(stableSort).reverse())
      if(!observed.has(child))stack.push(child);
    if(stack.length>MAX_RELATIONS*2+MAX_ROOTS)return null;
  }
  return [...observed].sort(stableSort);
}
function auditedRoots(roots,sourceFiles) {
  const names=new Set(sourceFiles.map(x=>x?.path));
  return roots.map(x=>({sourcePathSha256:sha(x), present:names.has(x)}))
    .sort((a,b)=>stableSort(a.sourcePathSha256,b.sourcePathSha256));
}
/**
 * Explicit opt-in, but native execution is a hard safety HOLD until strict
 * cgroup/job-object isolation + attested source revision are implemented.
 * Input candidate graph is treated as untrusted and re-derived from source.
 */
export function verifyTrilogyModel(report,sourceFiles,options={}) {
  if(!options || typeof options!=='object'||Array.isArray(options) ||
     typeof options.enabled!=='boolean' ||
     (options.nativeSolvers!==undefined && typeof options.nativeSolvers!=='boolean')||
     (options.inventoryComplete!==undefined && typeof options.inventoryComplete!=='boolean')||
     !rootsValid(options.roots??[]))
    throw Error('T3 invalid verification authorization/options');
  const roots=options.roots??[];
  if(!options.enabled)return result('disabled','explicit-opt-in-required');
  const before=JSON.stringify(report);
  const originalFiles=JSON.stringify(sourceFiles);
  // Derive model from supplied snapshot (not from claim-bearing untrusted JSON).
  const graph=buildWholeProjectGraph(report,sourceFiles,{
    inventoryComplete:options.inventoryComplete===true,
  });
  const rootsInfo=auditedRoots(roots,sourceFiles);
  const base={
    canonicalEvidenceSha256:graph.canonicalEvidenceSha256,
    sourceInventorySha256:graph.suppliedInventorySha256,
    originalCoreScore:report.score.overall,originalIssueCount:report.issues.length,
    modeledEdges:graph.counts.relationships,
    matchedRoots:rootsInfo.filter(x=>x.present).length,
    reachability:[],scope:graph.inputScope,
    sourceSnapshotAuthenticated:graph.sourceSnapshotAuthenticated,
    verifiedSourceClaimCount:0,
  };
  if(options.nativeSolvers===true) {
    return result('unknown','hard-process-tree-isolation-and-real-native-solver-gates-not-met',base);
  }
  const map=connections(graph);
  if(map===null)return result('unknown','invalid-or-over-budget-model',base);
  if(rootsInfo.some(x=>!x.present))
    return result('unknown','requested-entrypoint-not-in-supplied-snapshot',base);
  const evidence=[];
  for(const root of rootsInfo) {
    const bfs=breadthFirst(root.sourcePathSha256,map);
    const dfs=depthFirst(root.sourcePathSha256,map);
    if(!bfs||!dfs)return result('unknown','graph-traversal-budget-exceeded',base);
    if(JSON.stringify(bfs)!==JSON.stringify(dfs))
      return result('disputed','independent-graph-traversal-disagreement',base);
    evidence.push({rootSha256:root.sourcePathSha256,
      modeledReachableNodes:bfs.length,reachabilityDigestSha256:sha(JSON.stringify(bfs))});
  }
  // Important: a caller-asserted inventory is NOT a cryptographically
  // authenticated source snapshot, even when both algorithms agree.
  const incomplete=graph.coverage.truncatedByBudget||
    graph.coverage.parseFailures>0 ||
    graph.coverage.filesReadable!==graph.coverage.filesListed ||
    graph.inputScope!=='caller-asserted-inventory' ||
    graph.counts.unknown>0 ||
    graph.counts.reviewRequired>0 ||
    graph.counts.unmodeledPackageImports>0 ||
    graph.counts.unmodeledDynamicImports>0 ||
    graph.counts.manifestReadFailures>0;
  const status=incomplete?'unknown':'model-consistent-review-only';
  const conclusion=result(status,incomplete?'incomplete-or-partial-source-model':
    'independent-js-traversals-agree-on-source-backed-graph', {
      ...base,reachability:evidence,
      modelAgreement:!incomplete,
      modeledRuntimeDecisions:graph.counts.runtimeDecisions,
      claimedIndependentNativeProofs:0,
    });
  if(JSON.stringify(report)!==before||JSON.stringify(sourceFiles)!==originalFiles)
    throw Error('T3 unexpectedly modified canonical report/source');
  return conclusion;
}
