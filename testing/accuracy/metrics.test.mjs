import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionMetrics, wilson95, checkRegression } from './metrics.mjs';
const row = (id, expected, actual) => ({ id, expected, actual, passed: expected === actual });
test('mixed confusion counts and categorical labels remain separate', () => {
  const m = decisionMetrics([row('tp', true, true), row('fp', false, true), row('fn', true, false), row('tn', false, false), row('manager', 'cargo', 'npm')]);
  assert.deepEqual([m.tp, m.fp, m.fn, m.tn, m.precision, m.recall, m.decisionAccuracy, m.categoricalCases], [1, 1, 1, 1, 50, 50, 40, 1]);
});
test('empty and positive-only samples cannot imply false-positive performance', () => {
  assert.equal(decisionMetrics([]).precision, null);
  assert.equal(decisionMetrics([row('positive', true, true)]).falsePositiveRate, null);
  assert.equal(decisionMetrics([row('negative', false, false)]).recall, null);
  assert.equal(wilson95(0, 0), null);
  assert.ok(wilson95(10, 10)[0] < 95);
});
test('unknown labels and invalid actuals fail instead of being counted as negatives', () => {
  assert.throws(() => decisionMetrics([row('unknown', null, false)]), /Invalid decision/);
  assert.throws(() => decisionMetrics([row('invalid', true, undefined)]), /Invalid decision/);
});
test('regression gate permits known failures, rejects new failures and changed labels', () => {
  const base = { corpusSha256: 'frozen', results: [row('a', true, true), row('b', false, true)] };
  assert.doesNotThrow(() => checkRegression(base, base));
  assert.doesNotThrow(() => checkRegression(base, { ...base, results: [base.results[0], row('b', false, false)] }));
  assert.throws(() => checkRegression(base, { ...base, results: [row('a', true, false), base.results[1]] }), /regressions/);
  assert.throws(() => checkRegression(base, { ...base, results: [row('a', false, false), base.results[1]] }), /label changed/);
  assert.throws(() => checkRegression(base, { ...base, results: [base.results[0]] }), /IDs changed/);
  assert.throws(() => checkRegression(base, { ...base, corpusSha256: 'modified' }), /Corpus changed/);
});

test('regression gate rejects duplicate current IDs and forged pass flags', () => {
  const row = { id: 'a', expected: true, actual: true, passed: true };
  const base = { corpusSha256: 'fixed', results: [row, { ...row, id: 'b' }] };
  assert.throws(() => checkRegression(base, { ...base, results: [row, row] }), /Duplicate/);
  assert.throws(() => checkRegression(base, { ...base, results: [row, { ...row, id: 'b', actual: false }] }), /Invalid baseline/);
  assert.throws(() => checkRegression(base, { ...base, results: [row, { ...row, id: 'b', expected: null }] }), /Invalid baseline/);
});
