import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHybridNodeReasoning } from '../hybrid.mjs';

const f = (path, content) => ({
  path, content, isDirectory: false, size: Buffer.byteLength(content),
});
const pkg = range => f('package.json', JSON.stringify({ engines: { node: range } }));
const conflicting = [pkg('>=18'), f('.nvmrc', '20'), f('.node-version', '22')];

test('Z3 stays off by default; original report preserved', async () => {
  const r = await evaluateHybridNodeReasoning(conflicting);
  assert.equal(r.nativeStatus, 'satisfiable');
  assert.equal(r.effectiveStatus, 'satisfiable');
  assert.equal(r.z3Status, 'not-run');
  assert.equal(r.z3Attempted, false);
  assert.equal(r.fallbackUsed, true);
  assert.equal(r.base.counts.satisfiable, 2);
});

test('opt-in joint runtime proof detects gap and retains original decisions', async () => {
  const r = await evaluateHybridNodeReasoning(conflicting, { enableZ3: true });
  assert.equal(r.z3Status, 'conflict');
  assert.equal(r.nativeStatus, 'satisfiable');
  assert.equal(r.effectiveStatus, 'conflict');
  assert.equal(r.fallbackUsed, false);
  assert.equal(r.base.counts.satisfiable, 2);
  assert.deepEqual(new Set(r.unsatExplanation.map(x => x.source)),
    new Set(['.nvmrc:1', '.node-version:1']));
  assert.ok(r.diagnostic.elapsedMs > 0);
});

test('simple cases stay on native reasoner, even with opt-in', async () => {
  const r = await evaluateHybridNodeReasoning([pkg('>=22'), f('.nvmrc', '20')], { enableZ3: true });
  assert.equal(r.nativeStatus, 'conflict');
  assert.equal(r.effectiveStatus, 'conflict');
  assert.equal(r.z3Attempted, false);
  assert.equal(r.fallbackUsed, true);
});

test('unsupported provenance or dynamic pins skip Z3 rather than asserting a partial conflict', async () => {
  const r = await evaluateHybridNodeReasoning([pkg('>=18'), f('.nvmrc', '22'), f('.node-version', 'lts/*')], { enableZ3: true });
  assert.equal(r.nativeStatus, 'unknown');
  assert.equal(r.z3Attempted, false);
  assert.equal(r.z3Status, 'not-run');
  assert.deepEqual(r.unsatExplanation, []);
});

test('a forced deadline kills the worker and preserves original native status', async () => {
  const r = await evaluateHybridNodeReasoning(conflicting, { enableZ3: true, wallMs: 1 });
  assert.equal(r.nativeStatus, 'satisfiable');
  assert.equal(r.effectiveStatus, 'satisfiable');
  assert.equal(r.fallbackUsed, true);
  assert.equal(r.z3Attempted, true);
  assert.match(r.reason, /wall-time-budget-exceeded|worker-exited/);
});

test('a tiny sampled worker RSS ceiling returns fallback without a false conflict', async () => {
  const r = await evaluateHybridNodeReasoning(conflicting, { enableZ3: true, rssLimitMiB: 16 });
  assert.equal(r.effectiveStatus, r.nativeStatus);
  assert.equal(r.z3Attempted, true);
  assert.equal(r.fallbackUsed, true);
  assert.equal(r.z3Status, 'not-run');
  assert.match(r.reason, /sampled-rss-budget-exceeded|worker-exited/);
});

test('nested package constraints cannot combine with sibling workspaces', async () => {
  const nested = [
    f('apps/api/package.json', JSON.stringify({ engines: { node: '>=18' } })),
    f('apps/api/.nvmrc', '20'),
    f('apps/web/.node-version', '22'),
  ];
  const r = await evaluateHybridNodeReasoning(nested, { enableZ3: true, workspace: 'apps/api' });
  assert.equal(r.z3Attempted, false);
  assert.equal(r.fallbackUsed, true);
});
