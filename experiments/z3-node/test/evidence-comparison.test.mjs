import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createZ3Session } from '../solver.mjs';
import { compareRuntimeEvidence, prepareSharedRuntimeEvidence } from '../evidence-comparison.mjs';
import { fixtures, validateMatrix } from '../validation.mjs';

let session;
before(async () => { session = await createZ3Session(); });
after(async () => { if (session) await session.close(); });

test('20 shared real-UCE fact-extraction cases match authored Z3 evidence expectations', async () => {
  const summary = await validateMatrix(session);
  assert.equal(summary.total, 20);
  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.falsePositiveCounts, { custom: 0, z3: 0 });
  assert.deepEqual(summary.disagreement.map(x => [x.id, x.comparison]),
    [['joint-only-conflict', 'joint-constraint-gap']]);
  assert.equal(summary.labelCounts.unknown, 9);
});

test('Z3 source-linked unsat explanations contain only actual UCE extracted provenance', async () => {
  const item = fixtures.find(x => x.id === 'joint-only-conflict');
  const compared = await compareRuntimeEvidence(session, item.files, item.workspace);
  assert.equal(compared.customStatus, 'satisfiable');
  assert.equal(compared.z3Status, 'conflict');
  assert.equal(compared.comparison, 'joint-constraint-gap');
  assert.equal(compared.unsatExplanation.length, 2);
  assert.deepEqual(new Set(compared.unsatExplanation.map(x => x.source)),
    new Set(['.nvmrc:1', '.node-version:1']));
  assert.ok(compared.unsatExplanation.every(x =>
    compared.evidenceSources.includes(x.source) && typeof x.requirement === 'string'));
  assert.match(compared.guidance, /not proof/);
});

test('no full proof is asserted after unknown or incomplete native evidence', async () => {
  for (const id of ['missing-engine', 'dynamic-pin', 'multiline-pin', 'malformed-package', 'sibling-only-pin']) {
    const item = fixtures.find(x => x.id === id);
    const prep = prepareSharedRuntimeEvidence(item.files, item.workspace);
    assert.equal(prep.complete, false, id);
    const compared = await compareRuntimeEvidence(session, item.files, item.workspace);
    assert.equal(compared.z3Status, 'unknown', id);
    assert.deepEqual(compared.unsatExplanation, [], id);
  }
});

test('same-workspace evidence stays correctly scoped in nested package', async () => {
  const item = fixtures.find(x => x.id === 'nested-workspace-conflict');
  const compared = await compareRuntimeEvidence(session, item.files, 'apps/api');
  assert.equal(compared.z3Status, 'conflict');
  assert.ok(compared.unsatExplanation.every(x => x.source.startsWith('apps/api/')));
  const rootCompared = await compareRuntimeEvidence(session, item.files, '');
  assert.equal(rootCompared.z3Status, 'unknown');
});
