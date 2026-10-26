import { spawnNativeSolver } from '../solver-safe-spawn.mjs';
import { performance } from 'node:perf_hooks';
import semver from 'semver';
import { buildCvc5SmtLib } from './cvc5.mjs';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { terminateSolverProcessTree } from '../solver-process-lifecycle.mjs';

// Benchmark-only native Z3 experiment. A fresh CLI child is started and closed
// during the Z3 stage. This does NOT change the default WASM-backed verifier.
// Both independent solver executables receive the same bounded normalized facts;
// source witness/UNSAT provenance remains validated by smart-sequential.mjs.
const unknown = reason => ({status:'unknown',engine:'Z3-native-experiment',reason,
  witness:null,unsatCore:[]});
export async function solveWithNativeZ3(constraints, options={}) {
  const program=buildCvc5SmtLib(constraints);
  if(!program) return unknown('unsupported-smt-constraints');
  const binary=options.binary??'z3';
  const wallMs=options.wallMs??4000;
  if(typeof binary!=='string'||!binary||binary.length>256||
    !Number.isInteger(wallMs)||wallMs<100||wallMs>30000)
    return unknown('invalid-native-z3-options');
  const start=performance.now();
  return new Promise(resolve=>{
    let child;
    try {
      child=spawnNativeSolver('z3',binary,['-in','-smt2'],{
        shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
        env:solverProcessEnv(),
        detached:process.platform!=='win32' && process.env.UCE_TRILOGY_EXPERIMENT!=='1',
      });
    }catch{return resolve(unknown('native-z3-spawn-failed'));}
    let stdout='',errBytes=0,answer=null,failure=null,done=false;
    const kill=()=>terminateSolverProcessTree(child);
    const finish=result=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      resolve({...result,elapsedMs:Math.round((performance.now()-start)*100)/100});
    };
    const timer=setTimeout(()=>{failure='native-z3-time-budget';kill();},wallMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{
      stdout+=chunk;
      if(stdout.length>8192){failure='native-z3-output-budget';kill();return;}
      if(answer!==null)return;
      const n=stdout.indexOf('\n');
      if(n<0)return;
      const first=stdout.slice(0,n).trim();
      if(first!=='sat'&&first!=='unsat'){failure='native-z3-unexpected-status';kill();return;}
      answer=first;
      try{
        if(first==='sat') child.stdin.end('(get-value (major minor patch))\n');
        else child.stdin.end();
      }catch{failure='native-z3-stdin-failed';kill();}
    });
    child.stderr.on('data',chunk=>{
      errBytes+=chunk.length;
      if(errBytes>4096){failure='native-z3-stderr-budget';kill();}
    });
    child.on('error',()=>{failure='native-z3-process-error';});
    child.on('close',code=>{
      kill();
      if(failure||code!==0||answer===null)
        return finish(unknown(failure??'native-z3-exit-or-incomplete-result'));
      if(answer==='unsat')
        return finish({status:'conflict',engine:'Z3-native-experiment',
          reason:'The bounded SMT-LIB conjunction is UNSAT.',
          witness:null,
          // The complete set is a valid, source-backed UNSAT subset,
          // not a claimed minimal unsat core.
          unsatCore:constraints.map(c=>({id:c.id,source:c.source,range:c.range}))});
      const extract=key=>{
        const re=new RegExp('\\('+key+'\\s+([0-9]{1,7})\\)');
        return re.exec(stdout)?.[1];
      };
      const components=['major','minor','patch'].map(extract);
      if(components.some(x=>x===undefined))
        return finish(unknown('missing-native-z3-model-coordinate'));
      const version=components.join('.');
      if(!semver.valid(version)||!constraints.every(c=>semver.satisfies(version,c.range)))
        return finish(unknown('unvalidated-native-z3-model'));
      finish({status:'satisfiable',engine:'Z3-native-experiment',
        reason:'Modeled Node requirement witness checked against source semver.',
        witness:version,unsatCore:[]});
    });
    child.stdin.on('error',()=>{failure='native-z3-input-error';kill();});
    child.stdin.write('(set-option :produce-models true)\n'+program);
  });
}
