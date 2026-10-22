import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adjudicateBlindReview } from './independent-review-gate.mjs';

const corpus=JSON.parse(await readFile(new URL('./real-repository-intake-v1.json',import.meta.url),'utf8'));
const one={cases:[corpus.cases[0]]};
function vote(label='unknown', reviewerId='reviewer-a', role='primary') {
  const e=one.cases[0];
  return { caseId:e.id, repository:e.repository, commit:e.commit,
    manifestBlobSha:e.manifestBlobSha, lockfileBlobSha:e.lockfileBlobSha,
    workspace:e.workspace, reviewerId, role, label,
    blindedToSolverOutput:true, rationale:'Independently reviewed source-backed stable semver and locked graph.',
    reviewedAt:'2026-10-22T01:00:00Z' };
}
test('no human votes means no claim of independent accuracy',()=>{
  const result=adjudicateBlindReview(corpus,[]);
  assert.equal(result.ready,false);
  assert.equal(result.labels.length,0);
  assert.equal(result.reason,'missing-independent-primary-votes');
});
test('two distinct, blinded agreeing reviewer votes pass reference gate on test-only example',()=>{
  const a=vote(), b=vote('unknown','reviewer-b');
  const r=adjudicateBlindReview(one,[a,b]);
  assert.equal(r.ready,true);
  assert.deepEqual(r.labels,[{id:one.cases[0].id,label:'unknown'}]);
});
test('conflicting votes require a distinct third blinded reviewer',()=>{
  const votes=[vote('conflict'),vote('satisfiable','reviewer-b')];
  assert.equal(adjudicateBlindReview(one,votes).ready,false);
  const adjudicated=adjudicateBlindReview(one,[...votes,vote('unknown','reviewer-c','adjudicator')]);
  assert.equal(adjudicated.ready,true);
  assert.equal(adjudicated.labels[0].label,'unknown');
});
test('reject mislabeled evidence pins, unblinded votes and duplicate reviewers',()=>{
  const a=vote(),b=vote('unknown','reviewer-b');
  assert.equal(adjudicateBlindReview(one,[{...a,lockfileBlobSha:'forged'},b]).ready,false);
  assert.equal(adjudicateBlindReview(one,[a,{...b,blindedToSolverOutput:false}]).ready,false);
  assert.equal(adjudicateBlindReview(one,[a,vote()]).ready,false);
});
