#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { createZ3Session, solveNodeConstraints } from './solver.mjs';

// Diagnostic-only, environment-dependent Node/WASM timings. No accuracy,
// throughput or production/browser guarantees are inferred from this sample.
const input = {
  workspace: '',
  constraints: [
    { id: 'engine', source: 'package.json#engines.node', range: '>=20 <23' },
    { id: 'build', source: '.node-version:1', range: '^22' },
    { id: 'deploy', source: 'Dockerfile:1', range: '22.1.x' },
  ],
};
const rssBefore = process.memoryUsage().rss;
const started = performance.now();
let session;
try {
  session = await createZ3Session();
  const initialized = performance.now();
  const first = await solveNodeConstraints(session, input);
  const coldDone = performance.now();
  if (first.status !== 'satisfiable') throw new Error('Cold Z3 check failed: ' + first.reason);
  const iterations = 10;
  for (let index = 0; index < iterations; index++) {
    const response = await solveNodeConstraints(session, input);
    if (response.status !== 'satisfiable' || !response.witness) {
      throw new Error('Warm Z3 check failed at iteration ' + index);
    }
  }
  const finished = performance.now();
  const mib = value => Math.round(value / 1024 / 1024 * 10) / 10;
  console.log(JSON.stringify({
    benchmark: 'z3-node-wasm-poc',
    initMs: Math.round(initialized - started),
    coldSolveMs: Math.round(coldDone - initialized),
    warmSolveAvgMs: Math.round((finished - coldDone) / iterations * 100) / 100,
    warmSamples: iterations,
    rssBeforeMiB: mib(rssBefore),
    rssAfterMiB: mib(process.memoryUsage().rss),
    status: 'passed',
    caveat: 'GitHub Node runner only; includes neither browser worker overhead nor whole-project accuracy',
  }));
} finally {
  if (session) await session.close();
}
