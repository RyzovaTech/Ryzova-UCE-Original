import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createZ3Session, solveNodeConstraints, MAX_CONSTRAINTS } from '../solver.mjs';
import { load } from '../../../scripts/trusted-module-loader.mjs';

const { versionRangesDisjoint } = load('src/lib/analyzer/version-constraints.ts');
let session;
before(async () => { session = await createZ3Session(); });
after(async () => { if (session) await session.close(); });
const fact = (id, range, source = 'package.json#engines.node') => ({ id, source, range });
const run = (...constraints) => solveNodeConstraints(session, { workspace: '', constraints });

test('Z3 reports SAT and a validated stable witness for three overlapping ranges', async () => {
  const r = await run(fact('project', '>=20 <23'), fact('build', '^22'), fact('deploy', '22.1.x'));
  assert.equal(r.status, 'satisfiable');
  assert.match(r.witness, /^22\.1\./);
  assert.deepEqual(r.unsatCore, []);
});

test('Z3 detects UNSAT spanning multiple sources and identifies a contributing unsat core', async () => {
  const r = await solveNodeConstraints(session, {
    workspace: 'apps/api', constraints: [
      fact('engines', '>=20 <23', 'apps/api/package.json#engines.node'),
      fact('ci', '22', 'apps/api/.nvmrc:1'),
      fact('docker', '18', 'apps/api/Dockerfile:1'),
    ],
  });
  assert.equal(r.status, 'conflict');
  assert.equal(r.witness, null);
  assert.ok(r.unsatCore.some(f => f.id === 'docker'));
  assert.ok(r.unsatCore.some(f => f.id === 'engines' || f.id === 'ci'));
  assert.ok(r.unsatCore.every(f => f.source.startsWith('apps/api/')));
});


// Pairwise ranges can all overlap while the complete OR-constrained system
// cannot. This is a real multi-constraint case that motivates SMT reasoning.
test('three OR constraints can be jointly UNSAT despite every pair overlapping', async () => {
  const ranges = ['20 || 22', '20 || 23', '22 || 23'];
  for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
    assert.equal(versionRangesDisjoint(ranges[i], ranges[j]), false,
      'Every pair must overlap: ' + ranges[i] + ' / ' + ranges[j]);
  }
  const result = await run(
    fact('project', ranges[0], 'package.json#engines.node'),
    fact('ci', ranges[1], '.nvmrc:1'),
    fact('deployment', ranges[2], 'Dockerfile:1'),
  );
  assert.equal(result.status, 'conflict');
  assert.equal(result.witness, null);
  assert.deepEqual(new Set(result.unsatCore.map(f => f.id)),
    new Set(['project', 'ci', 'deployment']));
});

test('alternative ranges retain OR logic, rather than flattening into a contradiction', async () => {
  const sat = await run(fact('allowed', '18 || >=22'), fact('chosen', '^22.0.0'));
  assert.equal(sat.status, 'satisfiable');
  assert.equal(sat.witness.startsWith('22.'), true);
  const unsat = await run(fact('allowed', '18 || >=22'), fact('chosen', '20'));
  assert.equal(unsat.status, 'conflict');
});

test('inequalities and caret-zero-major ranges use semver, not floating-point approximations', async () => {
  assert.equal((await run(fact('a', '^0.2.3'), fact('b', '0.3.0'))).status, 'conflict');
  assert.equal((await run(fact('a', '^0.2.3'), fact('b', '0.2.6'))).status, 'satisfiable');
  assert.equal((await run(fact('a', '>20'), fact('b', '<21'))).status, 'conflict');
});

test('pairwise pilot answers agree with the existing bounded numeric comparator', async () => {
  for (const [a, b] of [
    ['>=22', '20'],
    ['>=20.5', '20'],
    ['^18.2.0', '18.3.0'],
    ['^18.2.0', '19.0.0'],
    ['18 || >=22', '20'],
    ['18 || >=22', '22'],
    ['^0.2.3', '0.3.0'],
    ['>=20 <23', '22.9.1'],
    ['>=20 <23', '23.0.0'],
  ]) {
    const legacy = versionRangesDisjoint(a, b);
    const solved = await run(fact('a', a), fact('b', b));
    assert.notEqual(legacy, undefined, a + ' vs ' + b);
    assert.equal(solved.status, legacy ? 'conflict' : 'satisfiable', a + ' vs ' + b);
  }
});

test('missing unsupported and prerelease constraints never claim a formal result', async () => {
  for (const range of ['latest', 'workspace:^', 'npm:react@^18', '20.0.0-rc.1', '', '>=20 || broken', 'git+https://x']) {
    const r = await run(fact('bad', range));
    assert.equal(r.status, 'unknown', range);
    assert.equal(r.unsatCore.length, 0);
  }
});

test('mixed known/unknown facts cannot produce a partial proof', async () => {
  assert.equal((await run(fact('a', '>=22'), fact('b', '20'), fact('dynamic', 'lts/*'))).status, 'unknown');
});

test('workspace isolation rejects sibling paths before reaching the solver', async () => {
  const r = await solveNodeConstraints(session, { workspace: 'apps/api',
    constraints: [fact('sibling', '18', 'apps/web/.nvmrc:1')] });
  assert.equal(r.status, 'unknown');
  assert.match(r.reason, /outside/);
});

test('bounded inputs, duplicate names, and arbitrary metadata are rejected', async () => {
  assert.equal((await run(...Array.from({ length: MAX_CONSTRAINTS + 1 }, (_, i) =>
    fact('pin' + i, '>=20')))).status, 'unknown');
  assert.equal((await run(fact('same', '>=20'), fact('same', '<20'))).status, 'unknown');
  assert.equal((await run(fact('bad', '>=20', '../outside/package.json'))).status, 'unknown');
  assert.equal((await run(fact('bad', '>=20', 'apps/../../secret'))).status, 'unknown');
});

test('solver time budget is bounded and malformed inputs are unknown', async () => {
  assert.equal((await solveNodeConstraints(session, { workspace: '', constraints: [fact('a', '22')] }, 0)).status, 'unknown');
  assert.equal((await solveNodeConstraints(session, { workspace: '', constraints: [] })).status, 'unknown');
});

test('a conflict is a modeled contradiction, never evidence that project source executed', async () => {
  const r = await run(fact('declared', '>=22'), fact('selected', '<20'));
  assert.equal(r.status, 'conflict');
  assert.match(r.reason, /modeled/);
  assert.equal(r.witness, null);
});

test('root workspace is not a wildcard that accepts another package runtime', async () => {
  // An unsat pair across package boundaries must never be reported as a
  // real runtime conflict for the project root.
  const result = await solveNodeConstraints(session, {
    workspace: '',
    constraints: [
      fact('root-engine', '>=22', 'package.json#engines.node'),
      fact('other-app-pin', '18', 'apps/other/.nvmrc:1'),
    ],
  });
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /outside/);
  assert.deepEqual(result.unsatCore, []);
});

test('nested workspaces exclude deeper descendants and similar-name siblings', async () => {
  for (const source of [
    'apps/api/src/another-package/.nvmrc:1',
    'apps/api-v2/.nvmrc:1',
    'apps/other/.nvmrc:1',
    'apps/api2/package.json#engines.node',
  ]) {
    const result = await solveNodeConstraints(session, {
      workspace: 'apps/api', constraints: [fact('foreign', '<20', source)],
    });
    assert.equal(result.status, 'unknown', source);
    assert.deepEqual(result.unsatCore, []);
  }
});

test('noncanonical paths, absolute paths and ambiguous evidence references are unknown', async () => {
  for (const workspace of ['/apps/api', './apps/api', 'apps//api', 'apps/api/', 'apps/../api', 'apps\\api']) {
    const result = await solveNodeConstraints(session, {
      workspace,
      constraints: [fact('engine', '>=22', 'apps/api/package.json#engines.node')],
    });
    assert.equal(result.status, 'unknown', workspace);
  }
  for (const source of [
    '../package.json#engines.node',
    './package.json#engines.node',
    '/package.json#engines.node',
    'apps/../package.json#engines.node',
    'apps//api/package.json#engines.node',
    'C:/package.json',
    'package.json:dynamic-line',
    'https://example.test/package.json',
  ]) {
    assert.equal((await run(fact('bad-origin', '>=22', source))).status, 'unknown', source);
  }
});

test('canonical root and canonical package-local facts still solve normally', async () => {
  assert.equal((await run(
    fact('engine', '>=22', 'package.json#engines.node'),
    fact('local-pin', '20', '.nvmrc:1'))).status, 'conflict');
  assert.equal((await solveNodeConstraints(session, {
    workspace: 'apps/api',
    constraints: [
      fact('engine', '>=22', 'apps/api/package.json#engines.node'),
      fact('local-pin', '22', 'apps/api/.nvmrc:1'),
    ],
  })).status, 'satisfiable');
});
