#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { createZ3Session, solveNodeConstraints } from './solver.mjs';
import { validateMatrix } from './validation.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Experimental, single-run process-level diagnostic only. Samples are NOT a
// statistically stable browser benchmark or independent accuracy audit.
const MiB = bytes => Math.round(bytes / (1024 * 1024) * 100) / 100;
const memory = () => ({
  rssMiB: MiB(process.memoryUsage().rss),
  heapUsedMiB: MiB(process.memoryUsage().heapUsed),
  externalMiB: MiB(process.memoryUsage().external),
  arrayBuffersMiB: MiB(process.memoryUsage().arrayBuffers),
});
const input = { workspace: '', constraints: [
  { id: 'engine', source: 'package.json#engines.node', range: '>=20 <23' },
  { id: 'build', source: '.node-version:1', range: '^22' },
  { id: 'docker', source: 'Dockerfile:1', range: '22.1.x' },
] };
const output = resolve(import.meta.dirname, 'metrics/latest-audit.json');
const start = performance.now();
const samples = { before: memory() };
let session;
try {
  session = await createZ3Session();
  const boot = performance.now();
  samples.afterInit = memory();
  const first = await solveNodeConstraints(session, input);
  const firstFinished = performance.now();
  samples.afterFirstSolve = memory();
  if (first.status !== 'satisfiable') throw Error('First solve failed: ' + first.status);
  const warm = [];
  for (let i = 0; i < 10; i++) {
    const s = performance.now();
    const result = await solveNodeConstraints(session, input);
    warm.push(performance.now() - s);
    if (result.status !== 'satisfiable') throw Error('Warm solver regression');
  }
  samples.afterWarmSolves = memory();
  const matrix = await validateMatrix(session);
  const matrixFinished = performance.now();
  samples.afterMatrix = memory();
  // A syntactically invalid budget returns unknown, proving input enforcement;
  // NOT an observed solver-timeout event.
  const invalidBudget = await solveNodeConstraints(session, input, 0);
  if (invalidBudget.status !== 'unknown') throw Error('Budget guard regression');
  const actualTimeoutObserved = matrix.cases.some(c => c.z3 === 'unknown' && c.expected !== 'unknown');
  const metrics = {
    type: 'uce-z3-ci-diagnostic-v2',
    environment: {
      runtime: process.version, platform: process.platform, arch: process.arch,
      ci: process.env.CI === 'true',
      commit: process.env.GITHUB_SHA ?? null,
    },
    timingMs: {
      initialization: Math.round((boot - start) * 100) / 100,
      firstSolve: Math.round((firstFinished - boot) * 100) / 100,
      warmMean: Math.round(warm.reduce((a, b) => a + b, 0) / warm.length * 100) / 100,
      warmMin: Math.round(Math.min(...warm) * 100) / 100,
      warmMax: Math.round(Math.max(...warm) * 100) / 100,
      fullAuthoredMatrix: Math.round((matrixFinished - firstFinished - warm.reduce((a,b)=>a+b,0)) * 100) / 100,
    },
    memory: {
      ...samples,
      rssIncreaseAfterMatrixMiB: Math.round((samples.afterMatrix.rssMiB - samples.before.rssMiB) * 100) / 100,
      note: 'Whole Node process memory (WASM, Node, JIT, GC); cannot attribute the delta solely to Z3.',
    },
    solver: {
      maxBudgetMs: 5000,
      normalBudgetMs: 2000,
      invalidBudgetReturnsUnknown: invalidBudget.status === 'unknown',
      actualSolverTimeoutObserved: actualTimeoutObserved,
      timeoutLatencyMeasured: false,
      note: 'A genuine forced Z3 timeout has not been demonstrated, and timeout is not a hard pre-emptive wall-clock process deadline.',
    },
    accuracy: {
      authoredCases: matrix.total,
      expectedLabels: matrix.labelCounts,
      falsePositiveCounts: matrix.falsePositiveCounts,
      unknownCases: matrix.labelCounts.unknown,
      customVsZ3Disagreements: matrix.disagreement,
      resultVsAuthoredLabelFailures: matrix.failures,
      confusion: matrix.confusion,
      caveat: 'Authored tests only; not a blind human-labelled holdout. Do not infer global precision or false-positive rate.',
    },
    status: !matrix.failures.length && matrix.disagreement.every(d => d.comparison === 'joint-constraint-gap') ? 'pass' : 'fail',
  };
  mkdirSync(resolve(import.meta.dirname, 'metrics'), { recursive: true });
  writeFileSync(output, JSON.stringify(metrics, null, 2) + '\n');
  console.log(JSON.stringify(metrics, null, 2));
  if (metrics.status === 'fail') process.exitCode = 1;
} finally {
  if (session) await session.close();
}
