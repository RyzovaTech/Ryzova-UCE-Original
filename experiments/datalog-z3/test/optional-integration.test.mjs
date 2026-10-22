import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeProjectWithOptionalTrilogy } from '../optional-integration.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/conflict.json', import.meta.url),'utf8'));
const f = (path, content) => ({ path, content, isDirectory: false, size: Buffer.byteLength(content) });
function input(files=fixture.files, scanStats={}) {
  return {
    fileName:'node-constraints-project',
    files: [...files.map(x => f(x.path, x.content)),f('src/index.ts','export const x: number = 1;')],
    source:'upload',
    scanStats: {
      projectSize: 1000, filesFound: files.length + 1,
      filesAnalyzed: files.length + 1,
      filesIgnored:0, ignoredCategories:[], ...scanStats,
    },
  };
}
function revise(mutator) {
  const fs = fixture.files.map(x=>({...x}));
  const pkg = JSON.parse(fs.find(x=>x.path==='package.json').content);
  const lock = JSON.parse(fs.find(x=>x.path==='package-lock.json').content);
  mutator(pkg, lock);
  fs.find(x=>x.path==='package.json').content = JSON.stringify(pkg);
  fs.find(x=>x.path==='package-lock.json').content = JSON.stringify(lock);
  return fs;
}

test('default path never starts Trilogy and retains base UCE report',async()=>{
  const report=await analyzeProjectWithOptionalTrilogy(input());
  assert.equal(report.optionalSolver.status,'disabled');
  assert.equal(report.optionalSolver.attempted,false);
  assert.ok(report.stack.symbolicReasoning);
  assert.ok(report.classification.isSoftware);
  assert.ok(!report.notes.some(x=>x.includes('Optional Trilogy solver')));
});

test('real scan with explicit opt-in gets independent 3-solver conflict and source paths',async()=>{
  const original=await analyzeProjectWithOptionalTrilogy(input());
  const report=await analyzeProjectWithOptionalTrilogy(input(),{enableTrilogy:true});
  const s=report.optionalSolver;
  assert.equal(s.status,'conflict',JSON.stringify(s));
  assert.equal(s.verification,'independent-smt-agreement');
  assert.equal(s.attempted,true);
  assert.deepEqual(new Set(s.evidence.map(x=>x.field)),
    new Set(['packages["node_modules/alpha"].engines.node','packages["node_modules/beta"].engines.node']));
  assert.equal(report.score.overall,original.score.overall);
  assert.deepEqual(report.issues,original.issues);
  assert.deepEqual(report.stack.symbolicReasoning,original.stack.symbolicReasoning);
  assert.ok(report.notes.some(x=>x.includes('Optional Trilogy solver')));
});

test('transitive dependency constraints have a confirmed stable witness for SAT', async()=>{
  const files=revise((pkg,lock)=>{
    lock.packages['node_modules/beta'].engines.node='>=22';
  });
  const result=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(result.optionalSolver.status,'satisfiable',JSON.stringify(result.optionalSolver));
  assert.equal(result.optionalSolver.verification,'independent-smt-agreement');
  assert.match(result.optionalSolver.witness,/^22\./);
  assert.deepEqual(result.optionalSolver.evidence,[]);
});

test('missing cvc5 binary yields Unknown, preserving native score and issues',async()=>{
  const base=await analyzeProjectWithOptionalTrilogy(input());
  const r=await analyzeProjectWithOptionalTrilogy(input(),{
    enableTrilogy:true,cvc5Binary:'/nonexistent/uce-cvc5',
  });
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,true);
  assert.equal(r.optionalSolver.verification,'not-run');
  assert.equal(r.score.overall,base.score.overall);
  assert.deepEqual(r.issues,base.issues);
});

test('forced 1ms wall-clock deadline stops the solver group and returns Unknown',async()=>{
  const r=await analyzeProjectWithOptionalTrilogy(input(),{enableTrilogy:true,wallMs:1});
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,true);
  assert.match(r.optionalSolver.reason,/wall-timeout|worker-exit/);
});

test('small 16MiB Node worker RSS budget preserves UCE findings',async()=>{
  const r=await analyzeProjectWithOptionalTrilogy(input(),{
    enableTrilogy:true,workerRssLimitMiB:16,
  });
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,true);
  assert.match(r.optionalSolver.reason,/rss-budget-exceeded|worker-exit/);
});

test('sampled or truncated scan never claims complete formal proof',async()=>{
  for (const stats of [{sampled:true},{truncated:true},{findingsLimited:true}]) {
    const r=await analyzeProjectWithOptionalTrilogy(input(fixture.files,stats),{enableTrilogy:true});
    assert.equal(r.optionalSolver.status,'unknown');
    assert.equal(r.optionalSolver.attempted,false);
  }
});

test('two supported same-workspace requirements trigger verification regardless of simple size',async()=>{
  const files=revise((pkg,lock)=>{
    lock.packages['node_modules/alpha'].dependencies={};
    delete lock.packages['node_modules/beta'];
    lock.packages['node_modules/alpha'].engines={node:'>=22'};
  });
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(r.optionalSolver.status,'satisfiable',JSON.stringify(r.optionalSolver));
  assert.equal(r.optionalSolver.verification,'independent-smt-agreement');
  assert.deepEqual(r.optionalSolver.stages,{souffle:'succeeded',z3:'succeeded',cvc5:'succeeded'});
  assert.deepEqual(r.optionalSolver.stageTrace.map(x=>x.stage),['souffle','z3','cvc5']);
  assert.ok(r.optionalSolver.stageTrace.every((x,i,a)=>i===0 || a[i-1].closedMs<=x.startedMs));
  assert.ok(r.optionalSolver.eligibilityRules.includes('D2'));
});

test('incomplete locked graph returns Unknown without attempting a partial solve',async()=>{
  const files=revise((pkg,lock)=>{
    delete lock.packages['node_modules/beta'];
  });
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,false);
});

test('nested workspace confines source paths to requested package directory',async()=>{
  const files=fixture.files.map(f => ({...f,path:'apps/api/'+f.path}));
  files.push(...fixture.files.map(f => ({...f,path:'apps/web/'+f.path})));
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{
    enableTrilogy:true,workspace:'apps/api',
  });
  assert.equal(r.optionalSolver.status,'conflict',JSON.stringify(r.optionalSolver));
  assert.ok(r.optionalSolver.evidence.every(x=>x.file.startsWith('apps/api/')));
});

test('invalid resource budgets produce Unknown without attempting native process',async()=>{
  const r=await analyzeProjectWithOptionalTrilogy(input(),{enableTrilogy:true,workerRssLimitMiB:0});
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,false);
});

test('one self-contradictory root engines.node is cross-verified without Souffle',async()=>{
  const files=revise((pkg,lock)=>{
    pkg.engines.node='>=22 <21';
    delete lock.packages['node_modules/alpha'].engines;
    delete lock.packages['node_modules/beta'].engines;
  });
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(r.optionalSolver.status,'conflict',JSON.stringify(r.optionalSolver));
  assert.deepEqual(r.optionalSolver.stages,{souffle:'not-run',z3:'succeeded',cvc5:'succeeded'});
  assert.ok(r.optionalSolver.eligibilityRules.includes('D3'));
  assert.equal(r.optionalSolver.unsatCore.length,1);
});

test('no supported joint proof obligation starts no native solver',async()=>{
  const files=revise((pkg,lock)=>{
    delete lock.packages['node_modules/alpha'].engines;
    delete lock.packages['node_modules/beta'].engines;
  });
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(r.optionalSolver.status,'skipped');
  assert.equal(r.optionalSolver.attempted,false);
  assert.deepEqual(r.optionalSolver.stages,{souffle:'not-run',z3:'not-run',cvc5:'not-run'});
});

test('invalid supported-domain semver refuses partial solver proof before native startup',async()=>{
  const files=revise((pkg,lock)=>{
    lock.packages['node_modules/alpha'].engines.node='>=22.0.0-beta.1';
  });
  const r=await analyzeProjectWithOptionalTrilogy(input(files),{enableTrilogy:true});
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,false);
});

test('failed Souffle proof never starts Z3 or cvc5',async()=>{
  const r=await analyzeProjectWithOptionalTrilogy(input(),{
    enableTrilogy:true,souffleBinary:'/nonexistent/uce-souffle-test',
  });
  assert.equal(r.optionalSolver.status,'unknown');
  assert.equal(r.optionalSolver.attempted,true);
  assert.equal(r.optionalSolver.stages.z3,'not-run');
  assert.equal(r.optionalSolver.stages.cvc5,'not-run');
});

test('two simultaneous opt-in scans are serialized and do not change native scores',async()=>{
  const [a,b]=await Promise.all([
    analyzeProjectWithOptionalTrilogy(input(),{enableTrilogy:true}),
    analyzeProjectWithOptionalTrilogy(input(),{enableTrilogy:true}),
  ]);
  assert.equal(a.optionalSolver.status,'conflict',JSON.stringify(a.optionalSolver));
  assert.equal(b.optionalSolver.status,'conflict',JSON.stringify(b.optionalSolver));
  assert.equal(a.score.overall,b.score.overall);
  assert.deepEqual(a.issues,b.issues);
});
