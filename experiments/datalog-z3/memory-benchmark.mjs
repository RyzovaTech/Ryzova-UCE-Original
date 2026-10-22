#!/usr/bin/env node
// Linux-only experimental /proc sampled process-tree RSS comparison.
// Full hard isolation must be validated separately with delegated cgroups.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { terminateSolverProcessTree } from '../solver-process-lifecycle.mjs';

if (process.platform!=='linux') {
  console.log(JSON.stringify({status:'unsupported',reason:'Linux /proc required'}));
  process.exit(0);
}
const script=fileURLToPath(new URL('./memory-benchmark-child.mjs',import.meta.url));
async function treeRssKiB(root) {
  const todo=[root], seen=new Set();
  let sum=0;
  while(todo.length) {
    const pid=todo.pop();
    if(seen.has(pid)) continue;
    seen.add(pid);
    try {
      const [status,children]=await Promise.all([
        readFile('/proc/'+pid+'/status','utf8'),
        readFile('/proc/'+pid+'/task/'+pid+'/children','utf8'),
      ]);
      const m=/^VmRSS:\s+(\d+)\s+kB/m.exec(status);
      if(m) sum+=Number(m[1]);
      for(const x of children.trim().split(/\s+/)) if(/^\d+$/.test(x)) todo.push(Number(x));
    } catch { /* processes can disappear between samples */ }
  }
  return sum;
}
async function measure(mode) {
  return new Promise((resolve,reject)=>{
    const started=performance.now();
    const child=spawn(process.execPath,[script,mode],{
      stdio:['ignore','pipe','pipe'],shell:false,detached:true,
      env:solverProcessEnv({ UCE_TRILOGY_EXPERIMENT:'1' }),
    });
    let output='',stderrBytes=0,peakKiB=0,busy=false;
    const sample=setInterval(async()=>{
      if(busy) return;
      busy=true;
      try{peakKiB=Math.max(peakKiB,await treeRssKiB(child.pid));}
      finally{busy=false;}
    },20);
    const kill=setTimeout(()=>terminateSolverProcessTree(child),20000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',x=>{
      output+=x;
      if(output.length>32768) terminateSolverProcessTree(child);
    });
    child.stderr.on('data',x=>{
      stderrBytes+=x.length;
      if(stderrBytes>8192) terminateSolverProcessTree(child);
    });
    child.on('error',error=>{clearInterval(sample);clearTimeout(kill);terminateSolverProcessTree(child);reject(error);});
    child.on('close',code=>{
      clearInterval(sample);clearTimeout(kill);
      // Reap remaining descendants in the isolated POSIX benchmark group.
      terminateSolverProcessTree(child);
      if(code!==0) return reject(Error('benchmark mode failed: '+mode));
      try{
        const parsed=JSON.parse(output);
        if(parsed.status!=='conflict'||parsed.verification!=='independent-smt-agreement')
          return reject(Error('benchmark result mismatch: '+mode));
        if(mode!=='legacy') {
          const stages=parsed.stageTrace??[];
          if(stages.length!==3 || stages.map(x=>x.stage).join(',')!=='souffle,z3,cvc5' ||
            stages.some((x,i)=>!Number.isFinite(x.startedMs)||!Number.isFinite(x.closedMs)||
              x.closedMs<x.startedMs||(i>0&&stages[i-1].closedMs>x.startedMs)))
            return reject(Error('stage-close-before-next-start invariant failed: '+mode));
        }
        resolve({mode,wallMs:Math.round(performance.now()-started),
          sampledTreePeakMiB:Math.round(peakKiB/1024*100)/100,
          stageTrace: parsed.stageTrace??[]});
      } catch(e){reject(e);}
    });
  });
}
const requestedRepeats = process.env.UCE_BENCH_REPEATS ?? '10';
if (!/^(?:[3-9]|1[0-9]|20)$/.test(requestedRepeats))
  throw Error('UCE_BENCH_REPEATS must be a supported integer from 3 to 20');
const repetitions=Number(requestedRepeats);
const samples=[];
for(let i=0;i<repetitions;i++){
  samples.push(await measure('legacy'));
  samples.push(await measure('sequential'));
  // This is an exploratory third arm. A failure is recorded, not misreported
  // as a win or allowed to hide the validated default-arm comparison.
  try { samples.push(await measure('sequential-heap128')); }
  catch { samples.push({mode:'sequential-heap128',error:'candidate-failed'}); }
  // Experimental independent Z3 executable. A missing native binary or an
  // invalid model is recorded as a failed arm, never compared as improvement.
  try { samples.push(await measure('sequential-native-z3')); }
  catch { samples.push({mode:'sequential-native-z3',error:'candidate-failed'}); }
}
const clean=mode=>samples.filter(x=>x.mode===mode && Number.isFinite(x.sampledTreePeakMiB));
const summary=mode=>{
  const xs=samples.filter(x=>x.mode===mode);
  if(xs.length!==repetitions||xs.some(x=>!Number.isFinite(x.sampledTreePeakMiB)))
    return {runs:xs.length,failures:xs.filter(x=>x.error).length,meanPeakMiB:null};
  const vals=xs.map(x=>x.sampledTreePeakMiB).sort((a,b)=>a-b);
  const times=xs.map(x=>x.wallMs).sort((a,b)=>a-b);
  const round=x=>Math.round(x*100)/100;
  const median=v=>(v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;
  return { runs:xs.length,failures:0,
    meanPeakMiB:round(vals.reduce((a,b)=>a+b,0)/vals.length),
    medianPeakMiB:round(median(vals)),p95SampledPeakMiB:round(vals[Math.ceil(vals.length*.95)-1]),
    medianWallMs:round(median(times)),
  };
};
const byStage=()=>{
  const result={};
  for(const name of ['souffle','z3','cvc5']){
    const values=samples.filter(x=>x.mode==='sequential').map(x=>
      x.stageTrace.find(y=>y.stage===name)?.sampledWorkerPeakRssMiB);
    result[name]=(values.length===repetitions && values.every(Number.isFinite))
      ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100 : null;
  }
  return result;
};
console.log(JSON.stringify({
  suite:'uce-trilogy-memory-comparison',
  host:{node:process.version,platform:process.platform,arch:process.arch,
    gitSha:process.env.GITHUB_SHA??null},
  repetitions,
  samples,
  byMode: { legacy:summary('legacy'), sequential:summary('sequential'),
    sequentialHeap128Experimental:summary('sequential-heap128'),
    sequentialNativeZ3Experimental:summary('sequential-native-z3') },
  meanSampledTreePeakMiB:{
    legacy:summary('legacy').meanPeakMiB,
    sequential:summary('sequential').meanPeakMiB,
    sequentialHeap128Experimental:summary('sequential-heap128').meanPeakMiB,
    sequentialNativeZ3Experimental:summary('sequential-native-z3').meanPeakMiB,
  },
  meanDirectStageWorkerRssMiB:byStage(),
  caveat:'20ms /proc child-tree sampling may miss peaks; this is NOT cgroup memory.peak, NOT an enforced limit, and fixture is synthetic.',
},null,2));
