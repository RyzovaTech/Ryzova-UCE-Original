import semver from 'semver';

const MAX_FILES = 64;
// Finite input/graph traversal budgets, not an arbitrary project-size
// eligibility heuristic: all mandatory reachable dependencies must fit.
const MAX_PACKAGES = 2048;
const MAX_REACHABLE_PACKAGES = 512;
const MAX_EDGES = 2048;
const MAX_DEPTH = 32;
const MAX_CHARS = 1024 * 1024;
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
 * npm package-lock v2/v3 mandatory production edges, including exact
 * nearest-ancestor nested and scoped installations. Aliases/workspaces,
 * peers, optional activation and conditional platform edges fail closed.
 * A missing edge or ambiguous resolution is UNKNOWN, never partial SAT.
 */
export function extractLockedDependencyGraph(files, workspace = '', options = {}) {
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
  // npm workspaces, root peer activation and conditional platforms need
  // independent scope proofs. Never claim the entire project in their presence.
  if (pkg.workspaces !== undefined ||
      (record(pkg.peerDependencies) && Object.keys(pkg.peerDependencies).length) ||
      (record(pkg.optionalDependencies) && Object.keys(pkg.optionalDependencies).length))
    return unknown('Unsupported root workspace/peer/optional activation semantics.');
  const direct = pkg.dependencies === undefined ? [] : depsOf(pkg.dependencies);
  const lockDirect = lock.packages[''].dependencies === undefined ? [] : depsOf(lock.packages[''].dependencies);
  if (!direct || !lockDirect || direct.length !== lockDirect.length ||
      direct.some(([n, range]) => !lockDirect.some(([other, version]) => n === other && range === version))) {
    return unknown('Manifest and root lock dependencies do not match.');
  }
  if (!direct.length) return unknown('No direct production dependency edges in this workspace.');

  // The historical v1 benchmark explicitly opts into its original
  // hoisted-only model; expanded nested resolution remains available to
  // the new Smart Verification path without changing frozen v1 labels.
  if (options.hoistedOnly === true && Object.keys(lock.packages).some(key =>
      key.startsWith('node_modules/') &&
      key.slice('node_modules/'.length).includes('/node_modules/')))
    return unknown('Historical hoisted-only graph does not model nested installations.');
  // npm resolves each required package from its requiring package's own
  // node_modules, then climbs to the nearest ancestor node_modules. A nested
  // copy can shadow a hoisted package, so bare-name lookup is unsound.
  const entries = Object.entries(lock.packages);
  if (entries.length > MAX_PACKAGES + 1)
    return unknown('Package lock entry budget exceeded.');
  const declared = new Map();
  for (const [key, val] of entries) {
    if (key === '') continue;
    if (!key.startsWith('node_modules/') || !record(val))
      return unknown('Unsupported lockfile package root/layout.');
    const nodes = key.split('/node_modules/');
    const names = [nodes[0].slice('node_modules/'.length), ...nodes.slice(1)];
    if (names.some(name => !PACKAGE_NAME.test(name)))
      return unknown('Invalid nested or scoped installed package reference.');
    declared.set(key, val);
  }
  const resolveInstalled = (issuer, name) => {
    let ancestor = issuer === '__uce_root__' ? '' : issuer;
    while (true) {
      const candidate = (ancestor ? ancestor + '/' : '') + 'node_modules/' + name;
      if (declared.has(candidate)) return candidate;
      if (!ancestor) return null;
      const index = ancestor.lastIndexOf('/node_modules/');
      ancestor = index < 0 ? '' : ancestor.slice(0, index);
    }
  };
  const edges = [];
  const queue = [{ node: '__uce_root__', dependencies: direct, depth: 0 }];
  const visited = new Set();
  const included = new Set();
  const metadata = new Map();
  let head = 0;
  while (head < queue.length) {
    const item = queue[head++];
    if (item.depth >= MAX_DEPTH) return unknown('Dependency depth budget exceeded.');
    for (const [name, range] of item.dependencies) {
      const next = resolveInstalled(item.node, name);
      if (!next) return unknown('Missing locked dependency resolution for ' + name + '.');
      let resolved = metadata.get(next);
      if (!resolved) {
        const source = declared.get(next);
        // A peerDependenciesMeta optional hint without any declared peer
        // requirement does not create an installation obligation. Actual
        // peerDependencies (even optional ones) still require npm resolution
        // semantics outside this bounded mandatory-production proof.
        const peers = source.peerDependencies;
        const meta = source.peerDependenciesMeta;
        const declaredPeers = peers !== undefined &&
          (!record(peers) || Object.keys(peers).length > 0);
        const badHints = meta !== undefined &&
          (!record(meta) || Object.values(meta).some(hint =>
            !record(hint) || hint.optional !== true));
        if (source.link === true || source.optional === true ||
            source.os !== undefined || source.cpu !== undefined ||
            source.libc !== undefined || declaredPeers || badHints) {
          return unknown('Reachable link/optional/platform/peer semantics require additional proof.');
        }
        resolved = lockVersionAndDeps(source);
        if (!resolved) return unknown('Invalid reachable package metadata: ' + next);
        metadata.set(next, resolved);
      }
      if (!semver.satisfies(resolved.version, range, { includePrerelease: false }))
        return unknown('Locked dependency version does not satisfy source range: ' + name + '.');
      edges.push([item.node, next]);
      if (edges.length > MAX_EDGES) return unknown('Mandatory dependency edge budget exceeded.');
      included.add(next);
      if (included.size > MAX_REACHABLE_PACKAGES)
        return unknown('Mandatory reachable package budget exceeded.');
      if (!visited.has(next)) {
        visited.add(next);
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
    const entry = metadata.get(name);
    if (entry.engine !== undefined && entry.engine !== null) {
      constraints.push({
        id: 'package_' + constraints.length,
        source: expected('package-lock.json') + '#packages',
        key: 'packages["' + name + '"].engines.node',
        package: name,
        range: entry.engine,
      });
    }
  }
  return {
    status: 'ok', reason: '', workspace,
    packages: ['__uce_root__', ...[...included].sort()],
    edges, constraints,
    evidence: [expected('package.json'), expected('package-lock.json')],
  };
}
