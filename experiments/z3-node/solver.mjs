import semver from 'semver';
import { init, killThreads } from 'z3-solver';

/**
 * Experimental Node.js-only Z3 binding. No imports from the production analyzer,
 * no project-code execution, and no edits to production scoring or worker bundles.
 *
 * Inputs must be explicit, local, same-workspace runtime constraints. Do not
 * infer that an installed runtime obeys a declaration merely because a
 * mathematically satisfying version exists.
 */
export const MAX_CONSTRAINTS = 12;
export const DEFAULT_TIMEOUT_MS = 2000;

export async function createZ3Session() {
  const api = await init();
  let closed = false;
  return {
    Context: api.Context,
    async close() {
      if (!closed) {
        closed = true;
        await killThreads(api.em);
      }
    },
  };
}

function unsupported(problem) {
  return { status: 'unknown', engine: 'Z3', reason: problem, witness: null, unsatCore: [] };
}

function parsedRange(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160) return null;
  // This pilot only models stable numeric releases. Arbitrary tags, aliases,
  // prereleases, git URLs, and workspace protocols have unknown semantics here.
  if (/\d+\.\d+\.\d+-[0-9A-Za-z]/.test(value)) return null;
  try {
    const range = new semver.Range(value, { loose: false, includePrerelease: false });
    if (range.set.length > 8 || range.set.some(set => set.length > 8)) return null;
    for (const set of range.set) {
      for (const c of set) {
        if (c.value === '') continue;
        if (!['', '=', '>', '>=', '<', '<='].includes(c.operator)) return null;
        const v = c.semver;
        if (typeof v !== 'object' || !Number.isSafeInteger(v.major) ||
            !Number.isSafeInteger(v.minor) || !Number.isSafeInteger(v.patch) ||
            Math.max(v.major, v.minor, v.patch) > 1000000 ||
            (v.prerelease.length && !(v.prerelease.length === 1 && v.prerelease[0] === 0))) {
          return null;
        }
      }
    }
    return range;
  } catch {
    return null;
  }
}

function semverExpression(ctx, coords, operator, v) {
  const { major, minor, patch } = coords;
  const exact = ctx.And(major.eq(v.major), minor.eq(v.minor), patch.eq(v.patch));
  const less = ctx.Or(
    major.lt(v.major),
    ctx.And(major.eq(v.major), minor.lt(v.minor)),
    ctx.And(major.eq(v.major), minor.eq(v.minor), patch.lt(v.patch)),
  );
  const greater = ctx.Or(
    major.gt(v.major),
    ctx.And(major.eq(v.major), minor.gt(v.minor)),
    ctx.And(major.eq(v.major), minor.eq(v.minor), patch.gt(v.patch)),
  );
  if (operator === '>' ) return greater;
  if (operator === '>=') return ctx.Or(greater, exact);
  if (operator === '<' ) return less;
  if (operator === '<=') return ctx.Or(less, exact);
  return exact;
}

function rangeExpression(ctx, coords, range) {
  return ctx.Or(...range.set.map(set => ctx.And(...set.map(c =>
    c.value === '' ? coords.major.ge(0) : semverExpression(ctx, coords, c.operator, c.semver)
  ))));
}

/**
 * Solve the conjunction of independently sourced Node version requirements.
 * Tracking symbols yield a subset of conflicting inputs, not necessarily a
 * smallest explanation. Does not create/report an application compatibility
 * score and does not run source code.
 */
export async function solveNodeConstraints(session, input, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!input || typeof input !== 'object' || typeof input.workspace !== 'string' ||
      typeof input.constraints !== 'object' || !Array.isArray(input.constraints) ||
      input.constraints.length < 1 || input.constraints.length > MAX_CONSTRAINTS ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5000) {
    return unsupported('Input or bounded solver options invalid.');
  }
  const names = new Set();
  const requirements = [];
  for (const item of input.constraints) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,60}$/.test(item.id) ||
        names.has(item.id) || typeof item.source !== 'string' || !item.source ||
        item.source.length > 256) return unsupported('Invalid, missing or repeated evidence identifiers.');
    names.add(item.id);
    const range = parsedRange(item.range);
    if (!range) return unsupported('Unsupported, dynamic, prerelease, or overly complex constraint: ' + item.id);
    requirements.push({ ...item, range });
  }

  const ctx = new session.Context('uce_node');
  const { Solver, Int } = ctx;
  const solver = new Solver();
  solver.set('timeout', timeoutMs);
  const coords = {
    major: Int.const('node_major'),
    minor: Int.const('node_minor'),
    patch: Int.const('node_patch'),
  };
  // Z3 reasons over arbitrary integers; constrain the modeled version domain.
  solver.add(coords.major.ge(0), coords.minor.ge(0), coords.patch.ge(0));
  solver.add(coords.major.le(1000000), coords.minor.le(1000000), coords.patch.le(1000000));
  const sourceByTracking = new Map();
  for (let i = 0; i < requirements.length; i++) {
    const item = requirements[i];
    const marker = 'uce_fact_' + i;
    solver.addAndTrack(rangeExpression(ctx, coords, item.range), marker);
    sourceByTracking.set(marker, { id: item.id, source: item.source, range: item.range.raw });
  }

  const checked = await solver.check();
  if (checked === 'unsat') {
    const core = [...solver.unsatCore().values()].map(item => sourceByTracking.get(item.toString()))
      .filter(Boolean);
    return {
      status: 'conflict', engine: 'Z3', reason: 'No stable numeric Node version satisfies all modeled constraints.',
      witness: null, unsatCore: core,
    };
  }
  if (checked !== 'sat') return unsupported('Z3 returned unknown or exceeded its time/resource budget.');
  const model = solver.model();
  const version = [
    model.eval(coords.major).toString(),
    model.eval(coords.minor).toString(),
    model.eval(coords.patch).toString(),
  ].join('.');
  // Defense in depth: never report a satisfying witness that semver rejects.
  if (!semver.valid(version) ||
      !requirements.every(item => semver.satisfies(version, item.range))) {
    return unsupported('Z3 model could not be validated against the original semver declarations.');
  }
  return {
    status: 'satisfiable', engine: 'Z3',
    reason: 'A modeled stable numeric Node version satisfies all explicit constraints; real runtime behavior was not tested.',
    witness: version, unsatCore: [],
  };
}
