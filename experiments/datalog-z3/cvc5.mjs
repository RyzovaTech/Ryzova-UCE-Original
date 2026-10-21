import semver from 'semver';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// Independent SMT-LIB encoding for the *same semver requirements* sent to Z3.
// This runs the real cvc5 native executable on an opt-in Node/CI path only.
const MAX_FACTS = 12;
const MAX_INPUT_CHARS = 16384;
const MAX_OUTPUT_CHARS = 1024;
const MAX_BOUND = 1000000;
const COMPARISONS = new Set(['', '=', '>', '>=', '<', '<=']);
const numeric = value => String(value);

function parsedRange(source) {
  if (typeof source !== 'string' || !source.trim() || source.length > 160 ||
      /\d+\.\d+\.\d+-[0-9A-Za-z]/.test(source)) return null;
  try {
    const range = new semver.Range(source, { loose: false, includePrerelease: false });
    if (range.set.length > 8 || range.set.some(disjunction => disjunction.length > 8)) return null;
    for (const set of range.set) for (const item of set) {
      if (item.value === '') continue;
      if (!COMPARISONS.has(item.operator) || typeof item.semver !== 'object') return null;
      const v = item.semver;
      if ([v.major, v.minor, v.patch].some(n => !Number.isSafeInteger(n) || n < 0 || n > MAX_BOUND) ||
          v.prerelease.length && !(v.prerelease.length === 1 && v.prerelease[0] === 0)) return null;
    }
    return range;
  } catch { return null; }
}

function and(items) {
  return items.length === 0 ? 'true' : items.length === 1 ? items[0] : '(and ' + items.join(' ') + ')';
}
function or(items) {
  return items.length === 0 ? 'false' : items.length === 1 ? items[0] : '(or ' + items.join(' ') + ')';
}
function comparison(comparator) {
  if (comparator.value === '') return 'true';
  const v = comparator.semver;
  const eq = and([
    '(= major ' + numeric(v.major) + ')',
    '(= minor ' + numeric(v.minor) + ')',
    '(= patch ' + numeric(v.patch) + ')',
  ]);
  const less = or([
    '(< major ' + numeric(v.major) + ')',
    and(['(= major ' + numeric(v.major) + ')', '(< minor ' + numeric(v.minor) + ')']),
    and(['(= major ' + numeric(v.major) + ')', '(= minor ' + numeric(v.minor) + ')',
      '(< patch ' + numeric(v.patch) + ')']),
  ]);
  const greater = or([
    '(> major ' + numeric(v.major) + ')',
    and(['(= major ' + numeric(v.major) + ')', '(> minor ' + numeric(v.minor) + ')']),
    and(['(= major ' + numeric(v.major) + ')', '(= minor ' + numeric(v.minor) + ')',
      '(> patch ' + numeric(v.patch) + ')']),
  ]);
  if (comparator.operator === '>') return greater;
  if (comparator.operator === '>=') return or([greater, eq]);
  if (comparator.operator === '<') return less;
  if (comparator.operator === '<=') return or([less, eq]);
  return eq;
}

/**
 * Build SMT-LIB only from strictly parsed numeric semver comparators.
 * Never splice raw project/lockfile strings or paths into SMT-LIB.
 */
export function buildCvc5SmtLib(constraints) {
  if (!Array.isArray(constraints) || constraints.length < 2 || constraints.length > MAX_FACTS) return null;
  const requirements = [];
  for (const item of constraints) {
    if (!item || typeof item !== 'object') return null;
    const range = parsedRange(item.range);
    if (!range) return null;
    requirements.push(or(range.set.map(set => and(set.map(comparison)))));
  }
  const lines = [
    '(set-logic QF_LIA)',
    '(declare-const major Int)',
    '(declare-const minor Int)',
    '(declare-const patch Int)',
    '(assert (and (<= 0 major) (<= major 1000000)))',
    '(assert (and (<= 0 minor) (<= minor 1000000)))',
    '(assert (and (<= 0 patch) (<= patch 1000000)))',
    ...requirements.map(expr => '(assert ' + expr + ')'),
    '(check-sat)',
  ];
  const program = lines.join('\n') + '\n';
  return program.length <= MAX_INPUT_CHARS ? program : null;
}

function unknown(reason, elapsedMs = 0) {
  return { status: 'unknown', engine: 'cvc5', reason, elapsedMs };
}

/**
 * cvc5 SAT/UNSAT is a second independent solver decision, NOT an unsat core
 * or application-level compatibility claim. Z3 remains responsible for
 * an evidence-linked UNSAT subset if both solvers agree.
 */
export async function solveWithCvc5(constraints, options = {}) {
  const script = buildCvc5SmtLib(constraints);
  if (!script) return unknown('Unsupported/over-budget numeric constraints.');
  const executable = options.binary ?? 'cvc5'; // trusted experiment config only
  const wallMs = options.wallMs ?? 4000;
  const solverMs = options.solverMs ?? 2000;
  if (typeof executable !== 'string' || !executable || executable.length > 256 ||
      !Number.isInteger(wallMs) || wallMs < 1 || wallMs > 30000 ||
      !Number.isInteger(solverMs) || solverMs < 100 || solverMs > 5000) {
    return unknown('Invalid cvc5 binary/resource settings.');
  }
  const started = performance.now();
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(executable, ['--lang=smt2', '--tlimit=' + solverMs, '-'], {
        stdio: ['pipe', 'pipe', 'pipe'], shell: false,
      });
    } catch { resolve(unknown('cvc5 process could not start.')); return; }
    let stdout = '', stderrBytes = 0, failure = null, finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolve({
        ...result, elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      });
    };
    const timer = setTimeout(() => {
      failure = 'cvc5 process wall-clock timeout.';
      child.kill('SIGKILL');
    }, wallMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_CHARS) {
        failure = 'cvc5 output exceeds budget.';
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.length;
      if (stderrBytes > 4096) { failure = 'cvc5 stderr exceeds budget.'; child.kill('SIGKILL'); }
    });
    child.on('error', () => finish(unknown('cvc5 executable unavailable.')));
    child.on('close', code => {
      if (failure) return finish(unknown(failure));
      if (code !== 0) return finish(unknown('cvc5 exited nonzero.'));
      const answer = stdout.trim();
      if (answer === 'sat') return finish({ status: 'satisfiable', engine: 'cvc5',
        reason: 'The SMT-LIB constraint conjunction is SAT.' });
      if (answer === 'unsat') return finish({ status: 'conflict', engine: 'cvc5',
        reason: 'The SMT-LIB constraint conjunction is UNSAT.' });
      return finish(unknown('cvc5 produced unknown or unexpected output.'));
    });
    child.stdin.on('error', () => { /* close/error determines unknown; no source data leaked */ });
    child.stdin.end(script);
  });
}
