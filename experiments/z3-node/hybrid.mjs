import { spawn } from 'node:child_process';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { prepareSharedRuntimeEvidence } from './evidence-comparison.mjs';

/**
 * Opt-in Node/CLI-only UCE hybrid reasoner.
 *
 * The original production UCE decisions always remain available. Never let
 * Z3 silence a native conflict or turn unknown evidence into a proof.
 * The solver is spawned only when 3+ complete same-workspace facts exist.
 * No Z3 dependency is imported by the parent, browser or Vite worker.
 */
const WORKER_PATH = fileURLToPath(new URL('./hybrid-worker.mjs', import.meta.url));
const MAX_FACTS = 12;
const MAX_JSON = 16 * 1024;
const MAX_STDOUT = 32 * 1024;

function validateOptions(o) {
  const wallMs = o.wallMs ?? 5000;
  const rssLimitMiB = o.rssLimitMiB ?? 512;
  return Number.isInteger(wallMs) && wallMs >= 1 && wallMs <= 30000 &&
    Number.isInteger(rssLimitMiB) && rssLimitMiB >= 16 && rssLimitMiB <= 4096
    ? { wallMs, rssLimitMiB } : null;
}

async function linuxRssMiB(pid) {
  if (process.platform !== 'linux') return null;
  try {
    const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(await readFile('/proc/' + pid + '/status', 'utf8'));
    return match ? Number(match[1]) / 1024 : null;
  } catch { return null; }
}

function runIsolatedZ3(payload, { wallMs, rssLimitMiB }) {
  return new Promise(resolve => {
    const start = performance.now();
    let child;
    try {
      child = spawn(process.execPath, [WORKER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'], shell: false,
        env: solverProcessEnv({ UCE_Z3_EXPERIMENT: '1' }),
      });
    } catch {
      resolve({ result: null, failure: 'worker-spawn-failed', elapsedMs: 0, peakSampledRssMiB: null });
      return;
    }
    let settled = false;
    let stdout = '';
    let failure = null;
    let peak = 0;
    let samples = 0;
    const finish = (result = null, error = failure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(monitor);
      // A child that has completed must not persist across project scans.
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolve({
        result, failure: error,
        elapsedMs: Math.round((performance.now() - start) * 100) / 100,
        peakSampledRssMiB: samples ? Math.round(peak * 100) / 100 : null,
      });
    };
    const timer = setTimeout(() => { failure = 'wall-time-budget-exceeded'; child.kill('SIGKILL'); }, wallMs);
    let monitorBusy = false;
    const monitor = setInterval(async () => {
      if (settled || monitorBusy) return;
      monitorBusy = true;
      try {
        const rss = await linuxRssMiB(child.pid);
        if (settled) return;
        if (rss !== null) {
          samples++;
          peak = Math.max(peak, rss);
          if (rss > rssLimitMiB) {
            failure = 'sampled-rss-budget-exceeded';
            child.kill('SIGKILL');
          }
        }
      } finally { monitorBusy = false; }
    }, 25);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT) {
        failure = 'worker-output-budget-exceeded';
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', () => { /* Never echo potentially sensitive source metadata. */ });
    child.on('error', () => finish(null, 'worker-start-failed'));
    child.on('close', code => {
      if (failure) return finish(null, failure);
      if (code !== 0) return finish(null, 'worker-exited-' + code);
      try { finish(JSON.parse(stdout), null); }
      catch { finish(null, 'invalid-worker-output'); }
    });
    const input = JSON.stringify(payload);
    if (input.length > MAX_JSON) {
      failure = 'constraint-input-budget-exceeded';
      child.kill('SIGKILL');
    } else {
      child.stdin.on('error', () => { /* The exit handler records worker termination. */ });
      child.stdin.end(input);
    }
  });
}

/**
 * Returns the native base decisions and a separate opt-in diagnostic overlay.
 * Scores, base decision objects and the browser scan are never modified.
 */
export async function evaluateHybridNodeReasoning(files, options = {}) {
  const workspace = options.workspace ?? '';
  const prepared = prepareSharedRuntimeEvidence(files, workspace);
  const original = prepared.report;
  const base = prepared.customStatus;
  const standard = {
    version: 1, experimental: true,
    workspace,
    nativeStatus: base, effectiveStatus: base,
    base: original,
    z3Status: 'not-run', z3Attempted: false,
    fallbackUsed: true, reason: '', unsatExplanation: [],
    sourceFacts: prepared.evidenceSources,
    guidance: 'Production UCE evidence and scores remain authoritative; Z3 is an opt-in Node-only diagnostic.',
    diagnostic: null,
  };
  if (options.enableZ3 !== true) return { ...standard, reason: 'z3-opt-in-disabled' };
  if (!prepared.complete || prepared.constraints.length < 3 ||
      prepared.constraints.length > MAX_FACTS) {
    return { ...standard, reason: 'insufficient-or-unsupported-joint-evidence' };
  }
  const guards = validateOptions(options);
  if (!guards) return { ...standard, reason: 'invalid-resource-budgets' };
  const { result, failure, ...diagnostic } = await runIsolatedZ3({
    workspace, constraints: prepared.constraints,
  }, guards);
  if (failure || !result || !['conflict', 'satisfiable', 'unknown'].includes(result.status)) {
    return { ...standard, z3Attempted: true, reason: failure ?? 'solver-response-invalid', diagnostic };
  }
  if (result.status === 'unknown') {
    return { ...standard, z3Attempted: true, z3Status: 'unknown',
      reason: 'solver-unknown', diagnostic };
  }
  const originals = new Map(prepared.constraints.map(f => [f.source, f]));
  const explanation = result.status === 'conflict' && Array.isArray(result.unsatCore)
    ? result.unsatCore.filter(f => originals.has(f.source) &&
      originals.get(f.source).range === f.range).map(f => ({
        source: f.source, requirement: f.range, id: f.id,
      })) : [];
  if (result.status === 'conflict' && explanation.length < 2) {
    return { ...standard, z3Attempted: true, reason: 'unverified-unsat-provenance',
      z3Status: 'unknown', diagnostic };
  }
  const conflict = result.status === 'conflict' || base === 'conflict';
  const effectiveStatus = conflict ? 'conflict' : base === 'unknown' ? 'unknown' : 'satisfiable';
  return {
    ...standard,
    z3Attempted: true, fallbackUsed: false, z3Status: result.status,
    effectiveStatus,
    reason: result.status !== base ? 'modeled-solver-disagreement' : 'agreement',
    unsatExplanation: explanation, diagnostic,
    guidance: result.status === 'conflict'
      ? 'Joint Node declarations have no shared stable numeric version; review these source facts. This does not prove actual deployed runtime failure.'
      : 'The modeled Node requirements have a stable numeric witness; this does not prove installation or runtime compatibility.',
  };
}
