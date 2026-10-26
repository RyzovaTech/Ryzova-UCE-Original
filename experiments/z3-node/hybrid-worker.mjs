import { createZ3Session, solveNodeConstraints } from './solver.mjs';

// One request, one bounded solver session, one process; never reuse WASM
// across UCE projects. Parent enforces its own wall clock and sampled RSS.
let input = '';
for await (const part of process.stdin) {
  input += part;
  if (input.length > 16 * 1024) {
    process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'oversized-input' }));
    process.exit(0);
  }
}
let session;
try {
  const parsed = JSON.parse(input);
  session = await createZ3Session();
  const result = await solveNodeConstraints(session, parsed, 2000);
  process.stdout.write(JSON.stringify({
    status: result.status,
    unsatCore: Array.isArray(result.unsatCore) ? result.unsatCore : [],
    witness: result.witness ?? null,
  }));
} catch {
  process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'solver-error' }));
} finally {
  if (session) await session.close();
}
