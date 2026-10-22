import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load=async name=>JSON.parse(await readFile(new URL(name, import.meta.url),'utf8'));
const [source,screen]=await Promise.all([
  load('real-repository-intake-v1.json'),
  load('real-repository-preflight-v1.json'),
]);

test('Phase 4 preflight retains exact frozen case identities and no fabricated accuracy claims',()=>{
  assert.equal(screen.schema,'uce-real-repo-preflight-v1');
  assert.equal(screen.sampleSize,source.cases.length);
  assert.equal(screen.humanGroundTruthCases,0);
  assert.equal(screen.claims.modelCoverageEvaluated,false);
  assert.equal(screen.claims.accuracyMeasured,false);
  assert.equal(screen.claims.realWorldCompatibilityProven,false);
  assert.equal(source.provenance.labelsComplete,false);
  for(const item of source.cases) {
    const facts=screen.preflight.filter(x=>x.id===item.id);
    assert.equal(facts.length,1);
    assert.equal(facts[0].repository,item.repository);
    assert.equal(item.label,null);
    assert.ok(Number.isSafeInteger(facts[0].manifestBytes)&&facts[0].manifestBytes>0);
    if(item.lockfile===null){
      assert.equal(facts[0].lockBytes,null);
      assert.equal(facts[0].status,'unsupported-missing-root-lock');
    }else{
      assert.ok(Number.isSafeInteger(facts[0].lockBytes)&&facts[0].lockBytes>0);
      assert.notEqual(facts[0].status,'unsupported-missing-root-lock');
    }
  }
});
test('file byte budgets indicate screening risks, not a solver verdict or human label',()=>{
  assert.equal(screen.modelPerFileCharLimit,256*1024);
  for(const row of screen.preflight.filter(x=>x.status==='unsupported-input-char-limit'))
    assert.ok(row.lockBytes>screen.modelPerFileCharLimit);
  assert.equal(screen.preflight.filter(x=>x.status==='unsupported-input-char-limit').length,3);
  assert.equal(screen.preflight.filter(x=>x.status==='unsupported-graph-capability').length,1);
  assert.equal(screen.screenedCount,7);
  assert.equal(screen.potentiallySupportedCount,0);
  assert.equal(screen.claims.capabilityScreened,true);
  assert.equal(screen.claims.modelCoverageEvaluated,false);
});
