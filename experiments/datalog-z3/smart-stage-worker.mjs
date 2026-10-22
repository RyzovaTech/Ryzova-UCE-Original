// One process per verification engine, loaded lazily. The process exits
// and releases its own WASM/native allocations before the next stage starts.
const stage = process.argv[2];
let source = '';
try {
  for await (const chunk of process.stdin) {
    source += chunk;
    if (source.length > 700 * 1024) throw Error('input-budget');
  }
  const payload = JSON.parse(source);
  if (!payload || !['souffle', 'z3', 'cvc5'].includes(stage)) throw Error('invalid-stage');
  let result;
  if (stage === 'souffle') {
    const { deriveReachability } = await import('./datalog.mjs');
    result = await deriveReachability(payload.graph, {
      souffleBinary: payload.binary, timeoutMs: payload.timeoutMs,
    });
  } else if (stage === 'z3') {
    const { createZ3Session, solveNodeConstraints } = await import('../z3-node/solver.mjs');
    let session;
    try {
      session = await createZ3Session();
      result = await solveNodeConstraints(session, {
        workspace: payload.workspace, constraints: payload.constraints,
      }, payload.timeoutMs);
    } finally {
      if (session) await session.close();
    }
  } else {
    const { solveWithCvc5 } = await import('./cvc5.mjs');
    result = await solveWithCvc5(payload.constraints, {
      binary: payload.binary, wallMs: payload.timeoutMs,
      solverMs: Math.min(2000, payload.timeoutMs),
    });
  }
  process.stdout.write(JSON.stringify(result));
} catch {
  process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'stage-unavailable-or-failed' }));
}
