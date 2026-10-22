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
        resolve({mode,wallMs:Math.round(performance.now()-started),
          sampledTreePeakMiB:Math.round(peakKiB/1024*100)/100});
      } catch(e){reject(e);}
    });
  });
}
const samples=[];
for(let i=0;i<3;i++){
  samples.push(await measure('legacy'));
  samples.push(await measure('sequential'));
}
const avg=mode=>{
  const a=samples.filter(x=>x.mode===mode);
  return Math.round(a.reduce((n,x)=>n+x.sampledTreePeakMiB,0)/a.length*100)/100;
};
console.log(JSON.stringify({
  suite:'uce-trilogy-memory-comparison',
  host:{node:process.version,platform:process.platform,arch:process.arch,
    gitSha:process.env.GITHUB_SHA??null},
  samples,
  meanSampledTreePeakMiB:{legacy:avg('legacy'),sequential:avg('sequential')},
  caveat:'20ms /proc child-tree sampling may miss peaks; this is NOT cgroup memory.peak, NOT an enforced limit, and fixture is synthetic.',
},null,2));
