#!/usr/bin/env node
/**
 * Trusted native verification worker; reads normalized FILE CONTENT from stdin
 * only after parent placed this PID inside verified delegated Linux cgroup.
 * Never imports or executes source project code. No network usage by this JS.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=reason=>({status:'unknown',reason,stages:{souffle:'unknown',z3:'not-run',cvc5:'not-run'}});
async function independentlyCheckKernelCgroup(){
 if(process.platform!=='linux')return false;
 try{
   const own=await readFile('/proc/self/cgroup','utf8');
   const entry=own.split('\n').find(line=>line.startsWith('0::/'));
   if(!entry)return false;
   const relative=entry.slice(3).trim();
   if(!/^\/(?:[a-zA-Z0-9_.-]+\/)*uce-solver-[a-zA-Z0-9]{6,}$/.test(relative))
     return false;
   const root=path.resolve('/sys/fs/cgroup','.'+relative);
   if(!root.startsWith('/sys/fs/cgroup/'))return false;
   const [memory,pids,cpu,swap,group]=await Promise.all(
     ['memory.max','pids.max','cpu.max','memory.swap.max','memory.oom.group']
       .map(f=>readFile(path.join(root,f),'utf8').then(v=>v.trim())));
   const m=Number(memory);
   return Number.isSafeInteger(m)&&m>=256*1048576&&m<=2048*1048576&&
     pids==='64'&&cpu==='50000 100000'&&swap==='0'&&group==='1';
 }catch{return false}
}
async function main(){
 let bytes=0,buf='';
 for await (const chunk of process.stdin) {
   bytes+=chunk.length;
   if(bytes>2300000) return fail('worker-input-budget-exceeded');
   buf+=chunk.toString('utf8');
 }
 if(!(await independentlyCheckKernelCgroup()))return fail('kernel-native-isolation-unattested');
 let v;
 try{v=JSON.parse(buf)}catch{return fail('malformed-worker-message')}
 if(!v||!Array.isArray(v.files)||v.files.length!==2||
    !['package.json','package-lock.json'].every(p=>v.files.some(f=>f.path===p&&typeof f.content==='string'))||
    !v.files.every(f=>f && typeof f.path==='string'&&typeof f.content==='string'&&
      Buffer.byteLength(f.content)<=1048576)||
    typeof v.expectedInputsSha256!=='string'||
    !/^[a-f0-9]{64}$/.test(v.expectedInputsSha256)||
    !v.binary||typeof v.binary!=='object')
      return fail('unsupported-or-oversized-locked-workspace');
 const expected=hash(JSON.stringify(v.files.map(f=>[f.path,hash(f.content)]).sort((a,b)=>a[0]<b[0]?-1:1)));
 if(expected!==v.expectedInputsSha256)return fail('source-fact-digest-changed');
 const names=['souffle','z3','cvc5'];
 if(names.some(name=>typeof v.binary[name]!=='string'||!v.binary[name].startsWith('/')))
    return fail('untrusted-binary-provenance');
 const graphMod=await import('../../experiments/datalog-z3/graph.mjs');
 const graph=graphMod.extractLockedDependencyGraph(v.files,'');
 if(graph.status!=='ok'||graph.constraints.length<2||graph.constraints.length>12)
   return fail('incomplete-or-unsupported-npm-graph');
 if(graph.edges.length===0 || graph.packages.length<2)return fail('no-supported-reachability');
 const data=await import('../../experiments/datalog-z3/datalog.mjs');
 const reach=await data.deriveReachability(graph,{souffleBinary:v.binary.souffle,timeoutMs:3000});
 if(reach.status!=='ok')return {...fail('souffle-unavailable-or-incomplete'),stages:{souffle:'unknown',z3:'not-run',cvc5:'not-run'}};
 const reachable=new Set(reach.reachable);
 if(graph.packages.some(p=>!reachable.has(p)))return fail('souffle-missing-required-node');
 const constrained=graph.constraints.filter(c=>reachable.has(c.package));
 if(constrained.length!==graph.constraints.length)return fail('unreachable-runtime-requirement');
 const facts=constrained.map(c=>({id:c.id,source:c.source,range:c.range}));
 const witnessDigest=hash(JSON.stringify(facts));
 const z3mod=await import('../../experiments/datalog-z3/native-z3.mjs');
 const z=await z3mod.solveWithNativeZ3(facts,{binary:v.binary.z3,wallMs:3000});
 if(!['conflict','satisfiable'].includes(z.status))return {status:'unknown',reason:'z3-unavailable-or-incomplete',stages:{souffle:'succeeded',z3:'unknown',cvc5:'not-run'}};
 const cmod=await import('../../experiments/datalog-z3/cvc5.mjs');
 const cv=await cmod.solveWithCvc5(facts,{binary:v.binary.cvc5,wallMs:3000,solverMs:2000});
 if(!['conflict','satisfiable'].includes(cv.status)||z.status!==cv.status)return {
   status:'unknown',reason:'z3-cvc5-disagreement-or-unavailable',
   stages:{souffle:'succeeded',z3:'succeeded',cvc5:cv.status==='unknown'?'unknown':'succeeded'},
 };
 if(z.status==='satisfiable') {
   const semver=(await import('../../experiments/datalog-z3/node_modules/semver/index.js')).default;
   if(typeof z.witness!=='string'||!semver.valid(z.witness)||
       !facts.every(c=>semver.satisfies(z.witness,c.range)))return {
         status:'unknown',reason:'invalid-sat-witness',
         stages:{souffle:'succeeded',z3:'succeeded',cvc5:'succeeded'},
       };
 } else {
   if(!Array.isArray(z.unsatCore)||z.unsatCore.length!==facts.length ||
      z.unsatCore.some(m=>!facts.some(f=>f.id===m.id&&f.source===m.source&&f.range===m.range)))
      return {status:'unknown',reason:'invalid-unsat-evidence',stages:{souffle:'succeeded',z3:'succeeded',cvc5:'succeeded'}};
 }
 return {
   status:z.status==='conflict'?'modeled-conflict':'modeled-overlap',
   reason:'three-native-solvers-agree-in-restricted-npm-node-model',
   stages:{souffle:'succeeded',z3:'succeeded',cvc5:'succeeded'},
   verification:'triple-native-solver-agreement',
   sourceFactsSha256:expected,modeledRequirementsSha256:witnessDigest,
   reachedNodes:reach.reachable.length,originalConstraints:facts.length,
   satWitnessSha256:z.witness?hash(z.witness):null,
   invalidOrOverBudget:false,
 };
}
try{
 const v=await main();
 process.stdout.write(JSON.stringify(v));
}catch{
 process.stdout.write(JSON.stringify(fail('native-worker-internal-error')));
}
