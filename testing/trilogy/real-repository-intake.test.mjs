import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data=JSON.parse(await readFile(new URL('./real-repository-intake-v1.json',import.meta.url),'utf8'));
test('phase4 real repository intake is pinned, verified-provenance and deliberately unlabeled',()=>{
  assert.equal(data.schema,'uce-trilogy-real-repo-intake-v1');
  assert.equal(data.provenance.humanReviewed,false);
  assert.equal(data.provenance.independentlyAdjudicated,false);
  assert.equal(data.provenance.labelsComplete,false);
  assert.ok(data.cases.length>=4);
  const ids=new Set();
  for(const c of data.cases){
    assert.match(c.id,/^RR[0-9]{2,}$/);
    assert.ok(!ids.has(c.id));
    ids.add(c.id);
    assert.match(c.repository,/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
    assert.match(c.commit,/^[0-9a-f]{40}$/);
    assert.match(c.manifestBlobSha,/^[0-9a-f]{40}$/);
    if(c.lockfile!==null) assert.match(c.lockfileBlobSha,/^[0-9a-f]{40}$/);
    assert.equal(c.label,null,'do not invent human ground-truth labels');
  }
});
