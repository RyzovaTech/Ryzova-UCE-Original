import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLockedDependencyGraph } from '../graph.mjs';
import { deriveReachability } from '../datalog.mjs';
import { evaluateDatalogZ3 } from '../hybrid.mjs';

const f = (path, content) => ({ path, content, isDirectory: false, size: Buffer.byteLength(content) });
function fixture({ rootEngine = '>=18', direct = { alpha: '^1.0.0' }, packages, path = '' } = {}) {
  const prefix = path ? path + '/' : '';
  const root = { name: 'app', engines: { node: rootEngine }, dependencies: direct };
  const lock = { lockfileVersion: 3, packages: {
    '': { name: 'app', version: '1.0.0', dependencies: direct },
    'node_modules/alpha': { version: '1.2.0', engines: { node: '>=22' }, dependencies: { beta: '^2.0.0' } },
    'node_modules/beta': { version: '2.1.0', engines: { node: '<21' } },
    ...packages,
  } };
  return [f(prefix + 'package.json', JSON.stringify(root)),
    f(prefix + 'package-lock.json', JSON.stringify(lock))];
}
test('real Souffle recursion reaches a transitive package, then Z3 detects joint engine contradiction', async () => {
  const result = await evaluateDatalogZ3(fixture());
  assert.equal(result.status, 'conflict', JSON.stringify(result));
  assert.equal(result.reachedPackages, 3);
  assert.deepEqual(new Set(result.paths.map(x => x.package)),
    new Set(['node_modules/alpha', 'node_modules/beta']));
  const beta = result.paths.find(x => x.package === 'node_modules/beta');
  assert.deepEqual(beta.dependencyPath,
    ['__uce_root__', 'node_modules/alpha', 'node_modules/beta']);
  assert.match(result.warning, /NOT proof/);
});

test('an unreachable, incompatible lock entry never becomes a constraint', async () => {
  const result = await evaluateDatalogZ3(fixture({ packages: {
    'node_modules/alpha': { version: '1.2.0', engines: { node: '>=22' } },
    'node_modules/unused': { version: '8.1.0', engines: { node: '<10' } },
  } }));
  assert.equal(result.status, 'satisfiable', JSON.stringify(result));
  assert.equal(result.reachedPackages, 2);
});
test('missing exact locked transitive resolution is unknown, not a partial proof', async () => {
  const r = await evaluateDatalogZ3(fixture({ packages: {
    'node_modules/alpha': { version: '1.2.0', engines: { node: '>=22' }, dependencies: { absent: '1.0.0' } },
  } }));
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'graph');
});
test('invalid package alias/range is unknown', async () => {
  const r = await evaluateDatalogZ3(fixture({ direct: { alpha: 'workspace:*' } }));
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'graph');
});
test('nested lock installation is conservatively unknown', async () => {
  const r = await evaluateDatalogZ3(fixture({ packages: {
    'node_modules/alpha/node_modules/beta': { version: '3.0.0' },
  } }));
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'graph');
});
test('same-workspace package facts never mix with a sibling lockfile', async () => {
  const input = fixture({ path: 'apps/api' });
  input.push(...fixture({ path: 'apps/web', rootEngine: '<10' }));
  const r = await evaluateDatalogZ3(input, { workspace: 'apps/api' });
  assert.equal(r.status, 'conflict', JSON.stringify(r));
  assert.ok(r.unsatCore.every(x => x.source.startsWith('apps/api/')));
});
test('unexpected root lock drift is unknown, not a manufactured edge', async () => {
  const data = fixture({ direct: { alpha: '^9.0.0' } });
  const r = await evaluateDatalogZ3(data);
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'graph');
});
test('missing Souffle executable is explicit unknown rather than Z3-only fallback', async () => {
  const r = await evaluateDatalogZ3(fixture(), { souffleBinary: '/nonexistent/uce-souffle' });
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'datalog');
});
test('bounded recursion terminates on a dependency cycle', async () => {
  const data = fixture({ packages: {
    'node_modules/beta': { version: '2.1.0', engines: { node: '>=22' },
      dependencies: { alpha: '^1.0.0' } },
  } });
  const graph = extractLockedDependencyGraph(data);
  assert.equal(graph.status, 'ok');
  const reach = await deriveReachability(graph);
  assert.equal(reach.status, 'ok'); assert.equal(reach.reachable.length, 3);
  const result = await evaluateDatalogZ3(data);
  assert.equal(result.status, 'satisfiable', JSON.stringify(result));
});
test('optionalDependencies do not create production edges in the pilot', async () => {
  const data = fixture({ packages: {
    'node_modules/alpha': { version: '1.2.0', engines: { node: '>=22' },
      optionalDependencies: { beta: '^2.0.0' } },
  } });
  const r = await evaluateDatalogZ3(data);
  assert.equal(r.status, 'satisfiable', JSON.stringify(r));
  assert.equal(r.reachedPackages, 2);
});
test('unsupported prerelease or environment substitution produces Z3 unknown', async () => {
  const data = fixture({ rootEngine: 'latest' });
  const r = await evaluateDatalogZ3(data);
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'z3');
});
test('workspace isolation rejects traversal and conflicting input aliases', async () => {
  const r = await evaluateDatalogZ3(fixture(), { workspace: '../outside' });
  assert.equal(r.status, 'unknown'); assert.equal(r.stage, 'graph');
});
