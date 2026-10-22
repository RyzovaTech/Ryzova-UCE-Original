import semver from 'semver';

const MAX_FILES = 32;
const MAX_PACKAGES = 96;
const MAX_EDGES = 192;
const MAX_DEPTH = 16;
const MAX_CHARS = 256 * 1024;
const PACKAGE_NAME = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
const VALID_PATH = /^[A-Za-z0-9_.@/-]+$/;

const unknown = reason => ({ status: 'unknown', reason, edges: [], constraints: [], packages: [], workspace: '' });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function depsOf(value) {
  if (!record(value)) return null;
  const result = Object.entries(value);
  if (result.length > MAX_PACKAGES || result.some(([name, range]) =>
    !PACKAGE_NAME.test(name) || typeof range !== 'string' ||
    range.length < 1 || range.length > 160 ||
    !semver.validRange(range, { loose: false }) || !semver.minVersion(range))) return null;
  return result;
}

function lockVersionAndDeps(data) {
  if (!record(data) || typeof data.version !== 'string' ||
      !semver.valid(data.version)) return null;
  const dependencies = data.dependencies === undefined ? [] : depsOf(data.dependencies);
  if (!dependencies) return null;
  const engine = data.engines === undefined ? null : data.engines;
  if (engine !== null && !record(engine)) return null;
  if (engine?.node !== undefined && typeof engine.node !== 'string') return null;
  return { dependencies, version: data.version, engine: engine?.node };
}

/**
 * Only package-lock v2/v3 hoisted, exact (not aliased/workspace/nested) npm
 * dependency edges are supported. A missing edge or ambiguous resolution is
 * UNKNOWN, never a partial, supposedly complete dependency graph.
 */
export function extractLockedDependencyGraph(files, workspace = '') {
  if (!Array.isArray(files) || files.length > MAX_FILES ||
      typeof workspace !== 'string' || workspace.length > 120 ||
      (workspace !== '' && (!VALID_PATH.test(workspace) || workspace.split('/').some(x => !x || x === '.' || x === '..')))) {
    return unknown('Invalid or over-budget workspace/file collection.');
  }
  const expected = name => (workspace ? workspace + '/' : '') + name;
  const map = new Map();
  for (const f of files) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string' ||
        f.isDirectory === true || !VALID_PATH.test(f.path) ||
        f.path.split('/').some(x => x === '.' || x === '..' || !x)) return unknown('Untrusted or noncanonical file path.');
    if (f.content.length > MAX_CHARS) return unknown('File size budget exceeded.');
    if (map.has(f.path)) return unknown('Duplicate project input path.');
    map.set(f.path, f.content);
  }
  const manifest = map.get(expected('package.json'));
  const lockedSource = map.get(expected('package-lock.json'));
  if (!manifest || !lockedSource) return unknown('Same-workspace manifest or lockfile absent.');
  let pkg, lock;
  try { pkg = JSON.parse(manifest); lock = JSON.parse(lockedSource); }
  catch { return unknown('Manifest or lockfile is not strict JSON.'); }
  if (!record(pkg) || !record(lock) || ![2, 3].includes(lock.lockfileVersion) ||
      !record(lock.packages) || !record(lock.packages[''])) {
    return unknown('Unsupported lockfile version or missing root lock metadata.');
  }
  const direct = pkg.dependencies === undefined ? [] : depsOf(pkg.dependencies);
  const lockDirect = lock.packages[''].dependencies === undefined ? [] : depsOf(lock.packages[''].dependencies);
  if (!direct || !lockDirect || direct.length !== lockDirect.length ||
      direct.some(([n, range]) => !lockDirect.some(([other, version]) => n === other && range === version))) {
    return unknown('Manifest and root lock dependencies do not match.');
  }
  if (!direct.length) return unknown('No direct production dependency edges in this workspace.');

  // Hoisted-only: nested package copies make bare-name dependency resolution
  // ambiguous; decline rather than guessing an installed dependency target.
  const entries = Object.entries(lock.packages);
  if (entries.length > MAX_PACKAGES + 1 ||
      entries.some(([key]) => key.startsWith('node_modules/') &&
        key.slice('node_modules/'.length).includes('/node_modules/'))) {
    return unknown('Package graph exceeds budget or contains nested installations.');
  }
  const declared = new Map();
  for (const [key, val] of entries) {
    if (key === '') continue;
    if (!key.startsWith('node_modules/')) return unknown('Unsupported lockfile package root/layout.');
    const name = key.slice('node_modules/'.length);
    if (!PACKAGE_NAME.test(name)) return unknown('Unsupported installed package reference.');
    const metadata = lockVersionAndDeps(val);
    if (!metadata) return unknown('Invalid installed package metadata: ' + key);
    declared.set(name, metadata);
  }
  const edges = [];
  const queue = [{ node: '__uce_root__', dependencies: direct, depth: 0 }];
  const visited = new Set();
  const included = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (item.depth >= MAX_DEPTH) return unknown('Dependency depth budget exceeded.');
    for (const [name, range] of item.dependencies) {
      const resolved = declared.get(name);
      if (!resolved || !semver.satisfies(resolved.version, range, { includePrerelease: false })) {
        return unknown('Missing or mismatched lock resolution for ' + name + '.');
      }
      const next = 'node_modules/' + name;
      edges.push([item.node, next]);
      if (edges.length > MAX_EDGES) return unknown('Dependency edge budget exceeded.');
      included.add(name);
      if (!visited.has(name)) {
        visited.add(name);
        queue.push({ node: next, dependencies: resolved.dependencies, depth: item.depth + 1 });
      }
    }
  }
  const constraints = [];
  if (pkg.engines !== undefined && !record(pkg.engines)) return unknown('Malformed project runtime engine declaration.');
  if (typeof pkg.engines?.node === 'string') constraints.push({
    id: 'root', source: expected('package.json') + '#engines.node',
    key: 'engines.node', range: pkg.engines.node,
    package: '__uce_root__',
  });
  for (const name of [...included].sort()) {
    const entry = declared.get(name);
    if (entry.engine !== undefined && entry.engine !== null) {
      constraints.push({
        id: 'package_' + constraints.length,
        source: expected('package-lock.json') + '#packages',
        key: 'packages["node_modules/' + name + '"].engines.node',
        package: 'node_modules/' + name,
        range: entry.engine,
      });
    }
  }
  return {
    status: 'ok', reason: '', workspace,
    packages: ['__uce_root__', ...[...included].sort().map(x => 'node_modules/' + x)],
    edges, constraints,
    evidence: [expected('package.json'), expected('package-lock.json')],
  };
}
