/**
 * Trilogy T3-B: opt-in, Linux-only, hard-isolated real native triple verifier.
 * The result is restricted modeled npm Node-engine SAT/UNSAT, never evidence
 * of an application build/runtime or safety of a proposed patch.
 *
 * This module deliberately does not affect UCE AnalysisResult or browser/MCP.
 */
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createStrictSolverCgroup} from '../../experiments/solver-linux-cgroup.mjs';
import {solverProcessEnv} from '../../experiments/solver-process-env.mjs';
import {canonicalEvidenceHash} from '../trilogy-t0/safety.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {load} from '../../scripts/trusted-module-loader.mjs';

const WORKER=fileURLToPath(new URL('./native-worker.mjs',import.meta.url));
const {describeReportReadiness}=load('src/lib/report/readiness.ts');
const hash=v=>createHash('sha256').update(v).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const noopStages=()=>({souffle:'not-run',z3:'not-run',cvc5:'not-run'});
const unknown=(reason,more={})=>({
 schemaVersion:1,stage:'Trilogy-T3-B',status:'unknown',reason,
 nativeSolversAttempted:false,
 stages:noopStages(),
 strictProcessTreeIsolation:'unavailable',
 sourceSnapshotAuthenticated:false,
 originalCoreScore:null,originalIssueCount:null,
 originalReportModified:false,
 sourceRevisionProven:false,
 actualBuildOrRuntimeVerified:false,
 issueCorrectnessVerified:false,
 securityVulnerabilityVerified:false,
 accuracyMetrics:null,
 automaticFixAllowed:false,
 ...more,
});
const isPlain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const bytes=m=>Buffer.byteLength(m);
async function binaryDigest(file){
 const h=createHash('sha256');
 for await(const chunk of createReadStream(file))h.update(chunk);
 return h.digest('hex');
}
async function preflightBinaries(binaries){
 if(!isPlain(binaries))return null;
 const result={};
 for(const name of ['souffle','z3','cvc5']){
   const target=binaries[name];
   if(!isPlain(target)||typeof target.path!=='string'||
      target.path.length>320||!target.path.startsWith('/')||
      typeof target.sha256!=='string'||!HEX.test(target.sha256))
     return null;
   try{
     const real=await realpath(target.path);
     if(!real.startsWith('/')||!real.startsWith('/usr/')&&!real.startsWith('/opt/')&&
        !real.startsWith('/bin/'))return null;
     const st=await stat(real);
     if(!st.isFile()||st.size<=0||st.size>200*1024*1024||
        (st.mode&0o111)===0)return null;
     if(await binaryDigest(real)!==target.sha256)return null;
     result[name]=real;
   }catch{return null}
 }
 return result;
}
function checkInputs(files){
 if(!Array.isArray(files)||files.length>5000)return null;
 const found=new Map();
 for(const f of files){
   if(!f||typeof f.path!=='string'||f.isDirectory===true||
      f.path.startsWith('/')||f.path.split('/').some(s=>!s||s==='.'||s==='..')||
      found.has(f.path))return null;
   found.set(f.path,f);
 }
 const two=['package.json','package-lock.json'].map(p=>found.get(p));
 if(two.some(f=>!f||typeof f.content!=='string'||bytes(f.content)>1048576))return null;
 const minimal=two.map(f=>({path:f.path,content:f.content}))
   .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {minimal,sourceFactsSha256:hash(JSON.stringify(minimal.map(
  f=>[f.path,hash(f.content)]))),files:found.size};
}
function nodeTrust(options){
 return isPlain(options)&&options.enabled===true&&options.nativeSolvers===true&&
   options.inventoryComplete===true&&
   typeof options.expectedInventorySha256==='string'&&HEX.test(options.expectedInventorySha256)&&
   typeof options.cgroupRoot==='string'&&options.cgroupRoot.length>0&&
   Number.isInteger(options.memoryMiB??512)&&
   (options.memoryMiB??512)>=256&&(options.memoryMiB??512)<=2048&&
   Number.isInteger(options.wallMs??20000)&&
   (options.wallMs??20000)>=10000&&(options.wallMs??20000)<=30000;
}
/**
 * Only explicit trusted local caller can supply PATH+SHA256 of trusted native
 * binaries, a delegated cgroup parent and independently pinned inventory digest.
 * The digest pins caller bytes but DOES NOT authenticate their original commit.
 */
export async function verifyNativeTrilogy(report,sourceFiles,options={}) {
 const canonical=canonicalEvidenceHash(report);
 const core={canonicalEvidenceSha256:canonical,
   originalCoreScore:report.score.overall,originalIssueCount:report.issues.length};
 if(!nodeTrust(options))return unknown('native-verification-explicit-authority-required',core);
 if(process.platform!=='linux')return unknown('linux-hard-cgroup-required-windows-job-object-unimplemented',core);
 if(describeReportReadiness(report).partial||report.classification?.isSoftware===false)
   return unknown('incomplete-canonical-uce-report',core);
 const beforeReport=JSON.stringify(report),beforeFiles=JSON.stringify(sourceFiles);
 let model;
 try{model=buildWholeProjectGraph(report,sourceFiles,{inventoryComplete:true});}
 catch{return unknown('untrusted-source-inventory-or-budget',core)}
 if(model.suppliedInventorySha256!==options.expectedInventorySha256)
   return unknown('pinned-source-inventory-sha256-mismatch',core);
 if(model.coverage.truncatedByBudget||model.coverage.parseFailures>0||
    model.coverage.filesReadable!==model.coverage.filesListed||
    model.counts.manifestReadFailures>0)
   return unknown('incomplete-source-graph',core);
 const input=checkInputs(sourceFiles);
 if(!input)return unknown('supported-npm-root-manifest-lock-required',core);
 const binaries=await preflightBinaries(options.binaries);
 if(!binaries)return unknown('native-binary-provenance-unverified',core);
 // No native subprocess, or even a trusted worker, exists before this kernel
 // v2 controller verification. Unsupported hosts abstain.
 const isolation=await createStrictSolverCgroup({
   root:options.cgroupRoot,memoryMiB:options.memoryMiB??512,
 });
 if(!isolation.ok)return unknown(isolation.reason,core);
 let proc=null,stdout='',failure=null,exitCode=null,closed=false,started=false,deadline=null;
 try{
   const payload=JSON.stringify({files:input.minimal,
     expectedInputsSha256:input.sourceFactsSha256,binary:binaries});
   if(bytes(payload)>2200000){failure='worker-payload-budget';}
   else {
     proc=spawn(process.execPath,[WORKER],{
       detached:true,shell:false,windowsHide:true,
       stdio:['pipe','pipe','pipe'],env:solverProcessEnv({UCE_TRILOGY_EXPERIMENT:'1'}),
     });
     const done=new Promise(resolve=>{
       proc.once('error',()=>{failure??='native-worker-spawn-error'});
       proc.once('close',code=>{closed=true;exitCode=code;resolve()});
       proc.stdout.on('data',chunk=>{
         stdout+=chunk.toString('utf8');
         if(bytes(stdout)>16384){
           failure='worker-output-budget';try{proc.kill('SIGKILL')}catch{}
         }
       });
       let errorBytes=0;
       proc.stderr.on('data',chunk=>{
         errorBytes+=chunk.length;
         if(errorBytes>4096){failure='worker-stderr-budget';try{proc.kill('SIGKILL')}catch{}}
       });
     });
     deadline=setTimeout(()=>{
       failure='native-wall-budget-expired';
       try{proc.kill('SIGKILL')}catch{}
     },options.wallMs??20000);
     const attached=await isolation.attach(proc.pid);
     if(!attached){
       failure='strict-cgroup-worker-attach-failed';
       try{proc.kill('SIGKILL')}catch{}
     }else if(!failure){
       started=true;
       proc.stdin.on('error',()=>{failure??='worker-stdin-failed'});
       proc.stdin.end(payload);
     }
     await done;
   }
 }catch{failure??='native-worker-process-failure'}
 finally{
   if(deadline)clearTimeout(deadline);
   try{proc?.kill('SIGKILL')}catch{}
 }
 // Kernel attestation of *all* descendants' departure is authoritative.
 const cleanup=await isolation.destroy();
 if(!cleanup.verified)return unknown('kernel-descendant-cleanup-unverified',{
   ...core,nativeSolversAttempted:started,strictProcessTreeIsolation:'unverified'});
 if(cleanup.oomKills===null||cleanup.oomKills>0||cleanup.peakMiB===null)
   return unknown('kernel-resource-accounting-unavailable-or-oom',{
     ...core,nativeSolversAttempted:started,strictProcessTreeIsolation:'enforced'});
 if(failure||!closed||exitCode!==0)return unknown(failure??'native-worker-exit-failed',{
   ...core,nativeSolversAttempted:started,strictProcessTreeIsolation:'enforced'});
 let response;
 try{response=JSON.parse(stdout)}catch{return unknown('native-worker-response-malformed',core)}
 const stageSet=response?.stages;
 const ok=response&&['modeled-conflict','modeled-overlap'].includes(response.status)&&
   response.verification==='triple-native-solver-agreement'&&
   stageSet&&['souffle','z3','cvc5'].every(k=>stageSet[k]==='succeeded')&&
   response.sourceFactsSha256===input.sourceFactsSha256&&
   typeof response.modeledRequirementsSha256==='string'&&HEX.test(response.modeledRequirementsSha256)&&
   Number.isInteger(response.originalConstraints)&&response.originalConstraints>=2&&
   Number.isInteger(response.reachedNodes)&&response.reachedNodes>1;
 if(!ok)return unknown('native-identity-or-consensus-not-validated',{
   ...core,nativeSolversAttempted:started,strictProcessTreeIsolation:'enforced'});
 if(JSON.stringify(report)!==beforeReport||JSON.stringify(sourceFiles)!==beforeFiles)
   return unknown('canonical-or-source-inventory-mutation-detected',core);
 return {
   ...unknown('modeled-npm-engine-only',core),
   status:response.status,reason:'three-native-solvers-agree-in-restricted-npm-engine-model',
   stages:stageSet,nativeSolversAttempted:true,
   strictProcessTreeIsolation:'enforced',
   modeledRequirementsSha256:response.modeledRequirementsSha256,
   suppliedSourceInventorySha256:model.suppliedInventorySha256,
   witnessSha256:response.satWitnessSha256??null,
   modeledReachableNodes:response.reachedNodes,
   modeledRequirements:response.originalConstraints,
   hardTreePeakMiB:cleanup.peakMiB,hardOomKills:cleanup.oomKills,
   caveat:'Source digest is caller-pinned, not independently commit-authenticated. No build/runtime verification.',
 };
}
