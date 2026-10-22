import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCvc5SmtLib, solveWithCvc5 } from '../cvc5.mjs';
import { evaluateDatalogZ3Cvc5 } from '../triple.mjs';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../fixtures/conflict.json', import.meta.url), 'utf8'));
const f = (path, content) => ({ path, content, isDirectory: false, size: Buffer.byteLength(content) });
function withLockEdit(transform) {
  const files = fixture.files.map(x => ({ ...x }));
  const lockIndex = files.findIndex(x => x.path === 'package-lock.json');
  const lock = JSON.parse(files[lockIndex].content);
  transform(lock);
  files[lockIndex].content = JSON.stringify(lock);
  files[lockIndex].size = Buffer.byteLength(files[lockIndex].content);
  return files;
}
test('independent cvc5 detects a bounded semver conflict', async () => {
  const c = await solveWithCvc5([{range:'>=22'}, {range:'<21'}]);
  assert.equal(c.status,'conflict',c.reason);
});
test('independent cvc5 proves jointly satisfiable ranges', async () => {
  const c = await solveWithCvc5([{range:'>=20 <23'}, {range:'^22'}, {range:'22.1.x'}]);
  assert.equal(c.status,'satisfiable',c.reason);
});
test('cvc5 encodes disjunctions rather than flattening them', async () => {
  const sat=await solveWithCvc5([{range:'18 || >=22'}, {range:'^22'}]);
  const unsat=await solveWithCvc5([{range:'18 || >=22'}, {range:'20'}]);
  assert.equal(sat.status,'satisfiable',sat.reason);
  assert.equal(unsat.status,'conflict',unsat.reason);
});
test('all three pairwise intersections can exist while the joint conjunction is UNSAT', async () => {
  const c=await solveWithCvc5([{range:'20 || 22'}, {range:'20 || 23'}, {range:'22 || 23'}]);
  assert.equal(c.status,'conflict',c.reason);
});
test('unsupported, dynamic and prerelease constraints do not become formal evidence', async () => {
  for(const range of ['latest','workspace:*','20.1.2-rc.1','', 'npm:pkg@^20']) {
    const c=await solveWithCvc5([{range},{range:'22'}]);
    assert.equal(c.status,'unknown',range);
  }
});
test('cvc5 never receives raw project file text or SMT injection', () => {
  assert.equal(buildCvc5SmtLib([{range:'22'}, {range:'(assert false)'}]),null);
  const src=buildCvc5SmtLib([{range:'^22'}, {range:'22.1.0'}]);
  assert.ok(src.startsWith('(set-logic QF_LIA)'));
  assert.equal((src.match(/\(check-sat\)/g)||[]).length,1);
  assert.ok(!src.includes('package-lock.json'));
});
test('real Souffle+Z3+cvc5 confirm transitive dependency conflict and original evidence path', async () => {
  const r=await evaluateDatalogZ3Cvc5(fixture.files);
  assert.equal(r.status,'conflict',JSON.stringify(r));
  assert.equal(r.z3Status,'conflict');
  assert.equal(r.cvc5Status,'conflict');
  assert.equal(r.verification,'independent-smt-agreement');
  assert.ok(r.unsatCore.length>=2);
  assert.ok(r.paths.some(x=>x.dependencyPath.includes('node_modules/beta')));
});
test('unreachable contradictory dependencies are excluded from both SMT solvers', async () => {
  const files=withLockEdit(lock=>{
    lock.packages['node_modules/beta'].engines.node='>=22';
    lock.packages['node_modules/unused']={version:'1.0.0',engines:{node:'<10'}};
  });
  const r=await evaluateDatalogZ3Cvc5(files);
  assert.equal(r.status,'satisfiable',JSON.stringify(r));
  assert.equal(r.cvc5Status,'satisfiable');
  assert.equal(r.paths.length,0);
});
test('missing locked dependency evidence remains Unknown and cvc5 is skipped',async()=>{
  const files=withLockEdit(lock=>{delete lock.packages['node_modules/beta'];});
  const r=await evaluateDatalogZ3Cvc5(files);
  assert.equal(r.status,'unknown');
  assert.equal(r.cvc5Status,'not-run');
});
test('missing cvc5 executable cannot rubber-stamp a Z3 UNSAT',async()=>{
  const r=await evaluateDatalogZ3Cvc5(fixture.files,{cvc5Binary:'/nonexistent/uce-test-cvc5'});
  assert.equal(r.status,'unknown');
  assert.equal(r.cvc5Status,'unknown');
  assert.equal(r.unsatCore.length,0);
});
test('resource-invalid cvc5 config is Unknown',async()=>{
  const r=await evaluateDatalogZ3Cvc5(fixture.files,{cvc5SolverMs:0});
  assert.equal(r.status,'unknown');
  assert.equal(r.cvc5Status,'unknown');
});
test('independent SMT verdict parity on documented numeric ranges',async()=>{
  for(const [a,b,expected] of [
    ['>=22','20','conflict'], ['>=20','20','satisfiable'],
    ['^0.2.3','0.3.0','conflict'], ['^0.2.3','0.2.6','satisfiable'],
    ['>=20 <23','22.9.1','satisfiable'], ['>=20 <23','23','conflict'],
  ]) {
    const c=await solveWithCvc5([{range:a},{range:b}]);
    assert.equal(c.status,expected,a+' / '+b+': '+c.reason);
  }
});
test('nested workspace provenance remains independent',async()=>{
  const files=fixture.files.map(x=>({
    ...x,path:'apps/api/'+x.path,
  }));
  const r=await evaluateDatalogZ3Cvc5(files,{workspace:'apps/api'});
  assert.equal(r.status,'conflict',JSON.stringify(r));
  assert.ok(r.unsatCore.every(x=>x.source.startsWith('apps/api/')));
});
