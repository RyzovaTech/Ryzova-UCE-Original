import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import semver from 'semver';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { dependencyPath } from './datalog.mjs';
import { inspectSmartEvidence } from './evidence-inspector.mjs';

const WORKER = fileURLToPath(new URL('./smart-stage-worker.mjs', import.meta.url));
const MAX_OUTPUT = 32 * 1024;
const stageState = () => ({ souffle: 'not-run', z3: 'not-run', cvc5: 'not-run' });

// Resolves ONLY after the specific stage worker has emitted 'close'.
// On any abnormal termination, orchestration returns Unknown and never starts
// the next stage. All workers inherit the outer isolated POSIX process group.
function runStage(stage, input, timeoutMs = 4000, rssBudgetMiB = 512, z3HeapLimitMiB = null) {
  return new Promise(resolve => {
    let child;
    try {
      const argv = stage === 'z3' && z3HeapLimitMiB !== null
        ? ['--max-old-space-size=' + z3HeapLimitMiB, '--optimize-for-size', WORKER, stage]
        : [WORKER, stage];
      child = spawn(process.execPath, argv, {
        shell: false, detached: false, windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: solverProcessEnv({ UCE_TRILOGY_EXPERIMENT: '1' }),
      });
    } catch { resolve({ status: 'unknown', reason: 'stage-spawn-failed' }); return; }
    let output = '', failure = null, completed = false;
    let sampledPeak = null, monitorBusy = false;
    const deadline = setTimeout(() => {
      failure = 'stage-time-budget';
      child.kill('SIGKILL');
    }, timeoutMs);
    // Soft, sampled Linux-only stage guard (not an OS-enforced tree limit).
    const memoryMonitor = setInterval(async () => {
      if (completed || monitorBusy || process.platform !== 'linux') return;
      monitorBusy = true;
      try {
        const body = await readFile('/proc/' + child.pid + '/status', 'utf8');
        if (completed) return;
        const found = /^VmRSS:\s+(\d+)\s+kB/m.exec(body);
        if (found) {
          const mib = Number(found[1]) / 1024;
          sampledPeak = Math.max(sampledPeak ?? 0, mib);
          if (mib > rssBudgetMiB) {
            failure = 'stage-sampled-rss-budget';
            child.kill('SIGKILL');
          }
        }
      } catch { /* Exited between sampling and read; close is authoritative. */ }
      finally { monitorBusy = false; }
    }, 25);
    const finish = data => {
      if (completed) return;
      completed = true;
      clearTimeout(deadline);
      clearInterval(memoryMonitor);
      resolve({ ...data, sampledWorkerPeakRssMiB: sampledPeak });
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > MAX_OUTPUT) {
        failure = 'stage-output-budget';
        child.kill('SIGKILL');
      }
    });
    let stderrSize = 0;
    child.stderr.on('data', chunk => {
      stderrSize += chunk.length;
      if (stderrSize > 4096) {
        failure = 'stage-stderr-budget';
        child.kill('SIGKILL');
      }
    });
    // Exit is not sufficient; 'close' confirms stdio handles also closed.
    child.on('error', () => { failure = 'stage-spawn-error'; });
    child.on('close', code => {
      if (failure || code !== 0) return finish({ status: 'unknown', reason: failure || 'stage-exit' });
      try { finish(JSON.parse(output)); }
      catch { finish({ status: 'unknown', reason: 'invalid-stage-output' }); }
    });
    try {
      const bytes = JSON.stringify(input);
      if (bytes.length > 700 * 1024) {
        failure = 'stage-input-budget';
        child.kill('SIGKILL');
      } else {
        child.stdin.on('error', () => {});
        child.stdin.end(bytes);
      }
    } catch {
      failure = 'invalid-stage-payload';
      child.kill('SIGKILL');
    }
  });
}

/** Node-only, no original scoring changes, no simultaneous solver stage workers. */
export async function evaluateSmartSequential(files, options = {}) {
  const plan = inspectSmartEvidence(files, options.workspace ?? '');
  const stages = stageState();
  const stageTrace = [];
  const unknown = reason => ({
    engine: 'Souffle+Z3+cvc5 (sequential)', status: 'unknown',
    reason, verification: 'incomplete', stages, stageTrace, eligibilityRules: plan.rules,
    evidenceDigest: plan.digest, witness: null, unsatCore: [], paths: [],
    z3Status: stages.z3, cvc5Status: stages.cvc5,
  });
  if (!plan.eligible) return unknown(plan.reason);
  const graph = plan.graph;
  const deadlineMs = options.wallMs ?? 14000;
  const workerRssBudgetMiB = options.workerRssLimitMiB ?? 512;
  // Benchmark-only opt-in: never applied to user verification by default.
  const z3HeapLimitMiB = options.z3HeapLimitMiB ?? null;
  if (z3HeapLimitMiB !== null && ![96, 128, 192, 256].includes(z3HeapLimitMiB))
    return unknown('unsupported-z3-heap-experiment');
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30000)
    return unknown('invalid-total-deadline');
  const start = performance.now();
  const remaining = () => Math.min(4000, Math.max(0, Math.floor(deadlineMs - (performance.now() - start) - 100)));
  const stage = async (name, payload) => {
    const ms = remaining();
    if (ms < 100) { stages[name] = 'unknown'; return { status: 'unknown', reason: 'end-to-end-deadline' }; }
    const began = performance.now();
    const r = await runStage(name, { ...payload, timeoutMs: ms }, ms + 50,
      workerRssBudgetMiB, z3HeapLimitMiB);
    const closed = performance.now();
    stageTrace.push({ stage: name, startedMs: Math.round(began-start),
      closedMs: Math.round(closed-start),
      sampledWorkerPeakRssMiB: r.sampledWorkerPeakRssMiB });
    stages[name] = r.status === 'unknown' ? 'unknown' : 'succeeded';
    return r;
  };
  let reachable = new Set(['__uce_root__']);
  if (plan.needsSouffle) {
    const r = await stage('souffle', { graph, binary: options.souffleBinary });
    if (r.status !== 'ok' || !Array.isArray(r.reachable)) return unknown('souffle: ' + (r.reason || 'unknown'));
    reachable = new Set(r.reachable);
    if (graph.packages.some(p => !reachable.has(p))) return unknown('incomplete-source-backed-reachability');
  }
  const constraints = graph.constraints.filter(c => reachable.has(c.package));
  if (constraints.length !== graph.constraints.length) return unknown('unreachable-requirement');
  const facts = constraints.map(c => ({ id: c.id, source: c.source, range: c.range }));
  const z3 = await stage('z3', { workspace: graph.workspace, constraints: facts });
  if (!['conflict', 'satisfiable'].includes(z3.status)) return unknown('z3: ' + (z3.reason || 'unknown'));
  // Z3 witness/provenance must be source-backed before starting cvc5.
  let core = [];
  let paths = [];
  if (z3.status === 'conflict') {
    const mapped = new Map(graph.constraints.map(c => [c.id, c]));
    if (!Array.isArray(z3.unsatCore) || z3.unsatCore.length < 1) return unknown('missing-z3-unsat-core');
    core = z3.unsatCore.map(c => mapped.get(c.id));
    if (core.some((c, i) => !c || c.source !== z3.unsatCore[i].source ||
        c.range !== z3.unsatCore[i].range)) return unknown('invalid-z3-unsat-source');
    paths = core.map(c => ({ file: c.source.split('#')[0], field: c.key,
      range: c.range, package: c.package, dependencyPath: dependencyPath(graph, c.package) }));
    if (paths.some(p => !p.dependencyPath)) return unknown('missing-dependency-path');
  } else if (typeof z3.witness !== 'string' || !semver.valid(z3.witness) ||
      !constraints.every(c => semver.satisfies(z3.witness, c.range))) {
    return unknown('invalid-z3-sat-witness');
  }
  const cvc5 = await stage('cvc5', { constraints: facts, binary: options.cvc5Binary });
  if (cvc5.status !== z3.status) return unknown('independent-smt-disagreement-or-unavailable');
  return {
    engine: 'Souffle+Z3+cvc5 (sequential)', status: z3.status,
    reason: 'Independent same-scope SMT agreement after serial stage exit.',
    verification: 'independent-smt-agreement',
    witness: z3.status === 'satisfiable' ? z3.witness : null,
    unsatCore: core.map(c => ({ id: c.id, source: c.source, key: c.key, range: c.range })),
    paths, stages, stageTrace, eligibilityRules: plan.rules, evidenceDigest: plan.digest,
    z3Status: z3.status, cvc5Status: cvc5.status,
  };
}
