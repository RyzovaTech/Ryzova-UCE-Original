/** Single kernel-gated child-process API for all native Trilogy solvers. */
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {solverProcessEnv} from './solver-process-env.mjs';

export function isKernelSolverCgroup(){
 if(process.platform!=='linux')return false;
 try{
  const own=readFileSync('/proc/self/cgroup','utf8');
  const entry=own.split('\n').find(s=>s.startsWith('0::/'));
  if(!entry)return false;
  const relative=entry.slice(3).trim();
  if(!/^\/(?:[a-zA-Z0-9_.-]+\/)*uce-solver-[a-zA-Z0-9]{6,}$/.test(relative))return false;
  const root=path.resolve('/sys/fs/cgroup','.'+relative);
  if(!root.startsWith('/sys/fs/cgroup/'))return false;
  const read=f=>readFileSync(path.join(root,f),'utf8').trim();
  const mem=Number(read('memory.max'));
  return Number.isSafeInteger(mem)&&mem>=256*1048576&&mem<=2048*1048576&&
    read('pids.max')==='64'&&read('cpu.max')==='50000 100000'&&
    read('memory.swap.max')==='0'&&read('memory.oom.group')==='1';
 }catch{return false}
}
function allowed(role,args){
 if(!Array.isArray(args)||args.some(x=>typeof x!=='string'||x.length>1024))return false;
 if(role==='z3')return args.length===2&&args[0]==='-in'&&args[1]==='-smt2';
 if(role==='cvc5')return args.length===3&&args[0]==='--lang=smt2'&&
    /^--tlimit=\d{3,4}$/.test(args[1])&&Number(args[1].slice(9))<=5000&&args[2]==='-';
 if(role==='souffle')return args.length===5&&args[0]==='-F'&&args[2]==='-D'&&
    args[1]===args[3]&&path.isAbsolute(args[1])&&path.isAbsolute(args[4])&&
    args[4].endsWith('/rules/reachability.dl');
 return false;
}
export function spawnNativeSolver(role,binary,args,options={}){
 if(process.env.UCE_TRILOGY_EXPERIMENT!=='1'||!isKernelSolverCgroup())
   throw Error('kernel-native-isolation-required');
 if(typeof binary!=='string'||binary.length>320||!path.isAbsolute(binary)||
   !/^(?:\/usr\/|\/opt\/|\/bin\/)/.test(binary)||!allowed(role,args))
   throw Error('untrusted-native-solver-request');
 return spawn(binary,args,{...options,shell:false,detached:false,
  env:solverProcessEnv({UCE_TRILOGY_EXPERIMENT:'1'})});
}
