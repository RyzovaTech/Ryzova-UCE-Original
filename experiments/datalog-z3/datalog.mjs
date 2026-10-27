import { spawnNativeSolver } from '../solver-safe-spawn.mjs';
import { solverProcessEnv } from '../solver-process-env.mjs';
import { terminateSolverProcessTree } from '../solver-process-lifecycle.mjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const RULES = fileURLToPath(new URL('./rules/reachability.dl', import.meta.url));

export async function deriveReachability(graph, options = {}) {
  if (graph.status !== 'ok') return { status: 'unknown', reason: graph.reason, reachable: [] };
  const binary = options.souffleBinary ?? 'souffle';
  const timeoutMs = options.timeoutMs ?? 4000;
  if (typeof binary !== 'string' || !binary || binary.length > 256 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    return { status: 'unknown', reason: 'Invalid Souffle subprocess budget.', reachable: [] };
  }
  const dir = await mkdtemp(join(tmpdir(), 'uce-souffle-'));
  try {
    await writeFile(join(dir, 'Edge.facts'), graph.edges.map(edge => edge.join('\t')).join('\n') + '\n');
    await writeFile(join(dir, 'Root.facts'), '__uce_root__\n');
    const solved = await new Promise(resolve => {
      let child;
      try { child = spawnNativeSolver('souffle',binary, ['-F', dir, '-D', dir, RULES], {
        stdio: ['ignore', 'ignore', 'pipe'], shell: false, // In the optional worker, inherit its isolated process group so the
        // outer deadline can kill all nested native descendants together.
        detached: process.platform !== 'win32' && process.env.UCE_TRILOGY_EXPERIMENT !== '1',
        env: solverProcessEnv(),
      }); }
      catch { return resolve({ error: 'Souffle executable unavailable.' }); }
      let finished = false;
      let errLength = 0;
      let timeout = false;
      const timer = setTimeout(() => { timeout = true; terminateSolverProcessTree(child); }, timeoutMs);
      const end = result => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      };
      child.stderr.on('data', chunk => {
        errLength += chunk.length;
        if (errLength > 8192) terminateSolverProcessTree(child);
      });
      child.on('error', () => end({ error: 'Souffle executable unavailable or could not start.' }));
      child.on('close', code => {
        terminateSolverProcessTree(child);
        end(timeout || code !== 0 || errLength > 8192
        ? { error: timeout ? 'Souffle timeout.' : 'Souffle execution failed.' }
        : { ok: true });
      });
    });
    if (!solved.ok) return { status: 'unknown', reason: solved.error, reachable: [] };
    const output = await readFile(join(dir, 'Reach.csv'), 'utf8');
    const entries = [...new Set(output.trim().split(/\r?\n/).filter(Boolean))].sort();
    if (entries.length > 513 || entries.some(x => !graph.packages.includes(x))) {
      return { status: 'unknown', reason: 'Unexpected or oversized Souffle output.', reachable: [] };
    }
    if (!entries.includes('__uce_root__')) {
      return { status: 'unknown', reason: 'Root missing from logic proof.', reachable: [] };
    }
    return { status: 'ok', reason: '', reachable: entries };
  } catch {
    return { status: 'unknown', reason: 'Souffle I/O failure.', reachable: [] };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function dependencyPath(graph, target) {
  const next = new Map();
  for (const [a, b] of graph.edges) {
    if (!next.has(a)) next.set(a, []);
    next.get(a).push(b);
  }
  const q = [['__uce_root__']];
  const seen = new Set();
  while (q.length) {
    const path = q.shift();
    const curr = path[path.length - 1];
    if (curr === target) return path;
    if (seen.has(curr)) continue;
    seen.add(curr);
    for (const node of next.get(curr) ?? []) {
      if (!seen.has(node)) q.push([...path, node]);
    }
  }
  return null;
}
