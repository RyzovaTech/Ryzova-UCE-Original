import { spawn } from 'node:child_process';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { terminateSolverProcessTree } from '../solver-process-lifecycle.mjs';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { extractLockedDependencyGraph } from './graph.mjs';
import { dependencyPath } from './datalog.mjs';
import { inspectSmartEvidence } from './evidence-inspector.mjs';

// Node-only opt-in report adapter. The normal browser analyzer never imports
// this module, native solvers or Node builtins.
const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const WORKER = fileURLToPath(new URL('./optional-worker.mjs', import.meta.url));
const ENGINE = 'Souffle+Z3+cvc5';
const MAX_PAYLOAD = 700 * 1024;
const MAX_OUTPUT = 32 * 1024;

const defaultDiagnostic = (enabled, workspace) => ({
  version: 1, engine: ENGINE, enabled, attempted: false,
  workspace, status: enabled ? 'skipped' : 'disabled',
  verification: 'not-run', reason: enabled ? '' : 'Trilogy solver disabled by default.',
  evidence: [], unsatCore: [], witness: null,
  stages: { souffle: 'not-run', z3: 'not-run', cvc5: 'not-run' },
  eligibilityRules: [], evidenceDigest: null,
  runtimeMs: null, sampledNodeWorkerRssMiB: null,
  limitations: [
    'Modelled Node engine requirements only; real install/build/runtime and engine-strict enforcement are not proven.',
    'Runs only in an explicitly enabled local Node CLI; it never invokes a web API or changes UCE score/issues.',
  ],
});

function sourceFiles(files, workspace) {
  const p = workspace ? workspace + '/' : '';
  const expected = new Set([p + 'package.json', p + 'package-lock.json']);
  const candidates = files.filter(f => expected.has(f.path) && !f.isDirectory);
  return candidates;
}

async function processRssMiB(pid) {
  if (process.platform !== 'linux') return null;
  try {
    const body = await readFile('/proc/' + pid + '/status', 'utf8');
    const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(body);
    return match ? Number(match[1]) / 1024 : null;
  } catch { return null; }
}

function runWorker(files, workspace, config) {
  return new Promise(resolve => {
    const started = performance.now();
    let child;
    try {
      child = spawn(process.execPath, [WORKER], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        env: solverProcessEnv({ UCE_TRILOGY_EXPERIMENT: '1' }),
        shell: false,
        windowsHide: true,
      });
    } catch {
      resolve({ failure: 'worker-spawn-failed', result: null, runtimeMs: 0, sampledNodeWorkerRssMiB: null });
      return;
    }
    let finished = false, failure = null, output = '', peak = null;
    const killGroup = () => terminateSolverProcessTree(child);
    const finish = (result = null, error = failure) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      clearInterval(monitor);
      // Also reap any nested native descendants when Node exited cleanly.
      // They inherit this isolated group in optional mode.
      killGroup();
      resolve({
        failure: error, result,
        runtimeMs: Math.round((performance.now() - started) * 100) / 100,
        sampledNodeWorkerRssMiB: peak === null ? null : Math.round(peak * 100) / 100,
      });
    };
    const deadline = setTimeout(() => {
      failure = 'trilogy-worker-wall-timeout';
      killGroup();
    }, config.wallMs);
    let monitorBusy = false;
    const monitor = setInterval(async () => {
      if (finished || monitorBusy) return;
      monitorBusy = true;
      try {
        const rss = await processRssMiB(child.pid);
        if (finished) return;
        if (rss !== null) {
          peak = Math.max(peak ?? 0, rss);
          if (rss > config.workerRssLimitMiB) {
            failure = 'trilogy-node-worker-rss-budget-exceeded';
            killGroup();
          }
        }
      } finally { monitorBusy = false; }
    }, 25);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > MAX_OUTPUT) {
        failure = 'trilogy-worker-output-budget-exceeded';
        killGroup();
      }
    });
    child.stderr.on('data', () => { /* Do not echo potentially sensitive project paths. */ });
    child.on('error', () => finish(null, 'trilogy-worker-start-error'));
    child.on('close', code => {
      if (failure) return finish(null, failure);
      if (code !== 0) return finish(null, 'trilogy-worker-exit-' + code);
      try { finish(JSON.parse(output), null); }
      catch { finish(null, 'trilogy-invalid-worker-response'); }
    });
    const payload = JSON.stringify({ files, workspace, options: {
      souffleBinary: config.souffleBinary, cvc5Binary: config.cvc5Binary,
    } });
    if (payload.length > MAX_PAYLOAD) {
      failure = 'trilogy-input-budget-exceeded';
      killGroup();
    } else {
      child.stdin.on('error', () => { /* Worker close determines fallback. */ });
      child.stdin.end(payload);
    }
  });
}

function verifyResult(raw, graph) {
  if (!raw || !['conflict', 'satisfiable'].includes(raw.status) ||
      raw.z3Status !== raw.status || raw.cvc5Status !== raw.status ||
      raw.verification !== 'independent-smt-agreement') return null;
  const facts = new Map(graph.constraints.map(x => [x.id, x]));
  if (raw.status === 'satisfiable') {
    if (typeof raw.witness !== 'string' || !semver.valid(raw.witness) ||
        !graph.constraints.every(f => semver.satisfies(raw.witness, f.range))) return null;
    return { status: raw.status, verification: raw.verification,
      witness: raw.witness, unsatCore: [], evidence: [] };
  }
  if (!Array.isArray(raw.unsatCore) || raw.unsatCore.length < 1 ||
      raw.unsatCore.length > 12 || !Array.isArray(raw.paths) ||
      raw.paths.length !== raw.unsatCore.length) return null;
  const seen = new Set();
  const evidence = [];
  for (const marker of raw.unsatCore) {
    if (!marker || typeof marker.id !== 'string' || seen.has(marker.id)) return null;
    seen.add(marker.id);
    const fact = facts.get(marker.id);
    if (!fact || marker.source !== fact.source ||
        marker.range !== fact.range || marker.key !== fact.key) return null;
    const expectedPath = dependencyPath(graph, fact.package);
    const evidenceRow = raw.paths.find(row => row.package === fact.package &&
      row.field === fact.key && row.range === fact.range &&
      row.file === fact.source.split('#')[0] &&
      JSON.stringify(row.dependencyPath) === JSON.stringify(expectedPath));
    if (!expectedPath || !evidenceRow) return null;
    evidence.push({
      file: fact.source.split('#')[0], field: fact.key,
      range: fact.range, dependencyPath: expectedPath,
    });
  }
  return { status: raw.status, verification: raw.verification,
    witness: null, unsatCore: raw.unsatCore.map(x => ({ id: x.id, source: x.source, key: x.key, range: x.range })),
    evidence };
}

/**
 * Integrates the optional Trilogy as a typed diagnostic field in a real
 * UCE analysis report, but never changes native scores/categories/issues.
 * This is an asynchronous Node-only wrapper, deliberately NOT analyzeProject.
 */
export async function analyzeProjectWithOptionalTrilogy(input, options = {}) {
  const report = analyzeProject(input);
  const enabled = options.enableTrilogy === true;
  const workspace = options.workspace ?? '';
  const diagnostic = defaultDiagnostic(enabled, workspace);
  report.optionalSolver = diagnostic;
  if (!enabled) return report;
  if (!report.classification.isSoftware) {
    diagnostic.reason = 'Not a software project.';
    return report;
  }
  if (input.scanStats?.truncated || input.scanStats?.sampled || input.scanStats?.findingsLimited) {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'Original UCE scan is sampled, truncated or limited; no complete solver proof.';
    return report;
  }
  if (!Array.isArray(input.files) || input.files.length > 20000 ||
      typeof workspace !== 'string' || workspace.length > 120) {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'Input or workspace budget exceeded.';
    return report;
  }
  const relevant = sourceFiles(input.files, workspace);
  const graph = extractLockedDependencyGraph(relevant, workspace);
  if (graph.status !== 'ok') {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'No complete supported same-workspace npm lock graph: ' + graph.reason;
    return report;
  }
  // Evidence-driven activation; neither size nor native UCE verdict determines eligibility.
  const inspected = inspectSmartEvidence(relevant, workspace);
  diagnostic.eligibilityRules = inspected.rules;
  diagnostic.evidenceDigest = inspected.digest;
  if (!inspected.eligible) {
    diagnostic.status = inspected.status;
    diagnostic.reason = inspected.reason;
    return report;
  }
  const wallMs = options.wallMs ?? 15000;
  const workerRssLimitMiB = options.workerRssLimitMiB ?? 512;
  if (!Number.isInteger(wallMs) || wallMs < 1 || wallMs > 30000 ||
      !Number.isInteger(workerRssLimitMiB) || workerRssLimitMiB < 16 ||
      workerRssLimitMiB > 4096) {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'Invalid solver resource budget.';
    return report;
  }
  diagnostic.attempted = true;
  const { result, failure, runtimeMs, sampledNodeWorkerRssMiB } = await runWorker(
    relevant, workspace, {
      wallMs, workerRssLimitMiB,
      souffleBinary: options.souffleBinary,
      cvc5Binary: options.cvc5Binary,
      wallMs,
    },
  );
  diagnostic.runtimeMs = runtimeMs;
  if (result?.stages) diagnostic.stages = result.stages;
  if (Array.isArray(result?.eligibilityRules)) diagnostic.eligibilityRules = result.eligibilityRules;
  if (typeof result?.evidenceDigest === 'string') diagnostic.evidenceDigest = result.evidenceDigest;
  diagnostic.sampledNodeWorkerRssMiB = sampledNodeWorkerRssMiB;
  // Sampled RSS only covers the Node child process, not Soufflé/cvc5
  // descendants; timeouts kill the POSIX child process group.
  diagnostic.limitations.push('RSS sampling covers only Node worker; native solver children are outside this measurement.');
  if (failure) {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'Trilogy unavailable; native UCE analysis retained: ' + failure;
    return report;
  }
  const confirmed = verifyResult(result, graph);
  if (!confirmed) {
    diagnostic.status = 'unknown';
    diagnostic.reason = 'Trilogy solver returned Unknown, disagreed or produced unverifiable evidence.';
    return report;
  }
  Object.assign(diagnostic, confirmed);
  diagnostic.reason = confirmed.status === 'conflict'
    ? 'Three engines confirm that modeled Node requirements in reachable production dependencies have no shared stable version.'
    : 'Modeled Node requirements in the reachable dependency graph have a common stable numeric version.';
  report.notes.push('Optional Trilogy solver (Node-only, Soufflé + Z3 + cvc5): ' +
    confirmed.status + '. This is a declaration-only diagnostic; existing scores and issues are unchanged.');
  return report;
}
