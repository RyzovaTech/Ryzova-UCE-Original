# UCE Trilogy: Browser Web Worker Performance

This real Web Worker experiment intentionally **does not run Souffle,
Z3 or cvc5**. Its purpose is to validate safe Worker scheduling,
transferable input and resource lifecycle in a browser. The complete
Trilogy remains Node-only pending native-to-WASM feasibility.

The normal production UCE analysis.worker.ts, ZIP path, GitHub import
path, Vercel headers and compatibility scores are not modified.

## Controls

A Worker is created only when explicitly requested by the performance
harness. Synthetic input is capped at 256 KiB and transferred without
copying the ArrayBuffer. Only one task may run at a time per tab.
Each task has a maximum wall-clock duration of 3 seconds. Abort,
bad protocol messages, failure, completion and timeout all terminate
the Worker and free the concurrency slot.

The browser Trilogy solver API **always returns Unknown, not-run**
because native Souffle and cvc5 have no validated browser-compatible
backends here. This is a genuine fail-closed release gate, not a
fabricated solver simulation.

## Memory limitation

256 KiB limits the transfer, NOT resident memory or a WASM solver heap.
Portable browser APIs cannot measure per-Worker peak RSS or guarantee
a hard solver memory limit. The benchmark reports these as unavailable.
Terminating a Worker bounds lifecycle but does not prove immediate
memory reclamation.

Before enabling full Trilogy, validate all three browser solver modules,
real peak process/WASM memory, actual SAT/UNSAT parity, cancellation and
memory pressure on desktop and mobile. Verify COOP/COEP, CSP, ZIP and
GitHub archive imports, offline operation, Safari and Firefox. Do not
add isolation headers globally until those tests pass.

## Tests

Node fake-Worker tests cover timeout, cancellation, malformed replies,
bounded payload, transfer, concurrency and closed release gate.
Real Chromium tests cover startup, zero-copy transferable handoff,
timeouts, cancellation and repeated cold Worker runs.

The benchmark is a **Worker overhead** measurement, not solver speed
or real-world compatibility accuracy. It runs with existing development
Vite server on localhost, without COOP/COEP.

Run with isolated Playwright dependency and installed Chromium:

    npm install --prefix experiments/trilogy-browser --no-audit --no-fund
    npm --prefix experiments/trilogy-browser run test:unit
    ./experiments/trilogy-browser/node_modules/.bin/playwright install chromium
    npm run dev -- --host 127.0.0.1 --port 4174 --strictPort
    npm --prefix experiments/trilogy-browser run test:browser

The browser tests need Vite running in another terminal. Native solver
code must NOT be imported by the new browser controller or Worker.
