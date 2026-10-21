# UCE Trilogy Browser Worker Performance Experiment

This is a browser preflight, NOT real Soufflé + Z3 + cvc5 running inside the browser. Soufflé and cvc5 in the Trilogy prototype are native executables. Full browser porting would require separately reviewed WASM, CSP, cross-origin isolation and full ZIP/GitHub import regression testing.

## Performance work

The TypeScript browser candidate preflight examines same-workspace manifest and npm v2/v3 lockfile evidence only. It returns candidate, skip or unknown, never SAT/UNSAT or compatibility proof.

- Dedicated Vite module worker is LAZY: it starts only after explicit API invocation.
- Main thread selects only package.json and package-lock.json. Maximum 128 KiB for either and 256 KiB total transfer. No project source execution.
- Only one preflight runs concurrently per module. Worker is always terminated after response, error, AbortSignal or 1.5 second default deadline. No persistent worker pool or WASM heap.
- No Z3, cvc5 or Soufflé runtime dependency is added to the browser. No COOP/COEP production header changes.
- Existing synchronous analysis.worker.ts and ZIP/import flows are unchanged.

## Actual Chromium smoke

The isolated CI job builds the web app and installs test-only Playwright Chromium. It executes 20 consecutive Vite-hosted real Web Worker requests and measures startup-inclusive wall latency, mean and p95. It asserts every response is explicitly not a solver proof and the worker is terminated. It also tests Abort-before-start, oversized payload, 1ms forced timeout followed by recovery, and no cross-origin network requests.

Where Chromium exposes performance.memory, used MAIN-PAGE JavaScript heap is sampled after explicit garbage collection with a loose 48 MiB delta regression ceiling. This is NOT a measurement of the Web Worker heap or peak combined browser-process RSS; there is no portable API to hard-cap per-worker browser heap. Byte limits and explicit Worker.terminate provide payload/lifecycle bounds only.

This test is not representative of large real repositories or browser-native SMT solver performance. A 5,000ms tiny-fixture p95 gate merely flags severe regressions, not a production speed promise.

## Commands

    node --test testing/trilogy/browser-preflight.test.mjs

Run the Chromium smoke only after installing Playwright Chromium into the experiment environment:

    node testing/trilogy/browser-worker-smoke.mjs

## Release decision

Production browser Trilogy remains NO-GO. Only disabled-by-default preflight plumbing is eligible for technical review. Retain deterministic local UCE as fast default, and keep Soufflé + Z3 + cvc5 as a separately opted-in local Node analysis for advanced, evidence-complete Node dependency constraints. No native trio results appear in normal browser UCE reports.

## Zero-copy transfer hardening

The preflight client now rejects JavaScript source strings before encoding
if they exceed the 128 KiB per-file limit, preventing an accidental giant
TextEncoder allocation. It creates bounded transferable ArrayBuffers and
transfers ownership with Worker.postMessage(..., transferList), avoiding a
second cross-thread copy of evidence text. The Worker checks byte lengths
before TextDecoder or JSON.parse. Real Chromium smoke covers >100 KiB
payloads, verifies sender buffers were detached, tests one-active-worker
concurrency and abort-after-start, and confirms worker recovery after abort.
This is still **not** a native Soufflé/Z3/cvc5 browser solve or a portable
peak worker-memory bound.
