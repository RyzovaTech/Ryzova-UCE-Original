#!/usr/bin/env node
// Safe read-only gate. Does not add COOP/COEP headers or inject Z3 into UCE.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const headerRules = config.headers ?? [];
const matches = headerRules.filter(item => item.source === '/:path*' || item.source === '/(.*)' || item.source === '/');
const headers = new Map();
for (const rule of matches) for (const { key, value } of rule.headers ?? []) headers.set(key.toLowerCase(), value);
const coop = headers.get('cross-origin-opener-policy');
const coep = headers.get('cross-origin-embedder-policy');
const isolatedHeaders = coop === 'same-origin' && ['require-corp', 'credentialless'].includes(coep);
const rootZ3Dependency = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).some(x => x === 'z3-solver');
const result = {
  gate: 'uce-browser-z3-integration-v1',
  status: 'blocked',
  checks: {
    crossOriginIsolationHeadersConfigured: isolatedHeaders,
    coop: coop ?? null,
    coep: coep ?? null,
    rootRuntimeHasZ3: rootZ3Dependency,
    actualBrowserWasmLoadingTestPassed: false,
    browserWorkerMemoryBenchmarkPassed: false,
    githubArchiveCrossOriginSmokeTestPassed: false,
    browserRegressionSuitePassed: false,
  },
  reason: 'Safe deployment requires actual browser-level Z3 worker/WASM, memory, CSP/COOP/COEP and GitHub archive cross-origin checks. Static headers alone are insufficient.',
  productionChangesMade: false,
  recommendation: 'Keep Node-only Z3 opt-in outside production bundles. Do not add COOP/COEP to production until a full browser smoke test validates ZIP import and GitHub codeload/rewrite traffic.',
};
console.log(JSON.stringify(result, null, 2));
// Fail the CI contract only when this experiment accidentally reaches root
// runtime dependencies. The browser gate itself remains a reported hold.
if (rootZ3Dependency) process.exitCode = 1;
