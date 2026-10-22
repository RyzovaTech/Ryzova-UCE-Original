import { lstat, mkdtemp, readFile, realpath, rmdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// Strict mode requires a *delegated* cgroup-v2 parent with memory and pids
// controllers enabled. A normal GitHub hosted runner may not grant this.
// Never assert hard protection from /proc sampling or process.kill alone.
export async function createStrictSolverCgroup({ root, memoryMiB }) {
  if (process.platform !== 'linux') return { ok: false, reason: 'strict-platform-unsupported' };
  if (!Number.isInteger(memoryMiB) || memoryMiB < 16 || memoryMiB > 4096)
    return { ok: false, reason: 'invalid-hard-memory-budget' };
  if (typeof root !== 'string' || root.length > 300 || !isAbsolute(root) ||
      root.split('/').includes('..')) return { ok: false, reason: 'untrusted-cgroup-parent' };

  let location = null;
  const abort = async () => {
    if (!location) return;
    try { await rmdir(location); } catch { /* Report failure, never relax strict mode. */ }
  };
  try {
    const canonical = await realpath(root);
    // Never create ordinary filesystem directories and call them cgroups.
    if (canonical !== '/sys/fs/cgroup' && !canonical.startsWith('/sys/fs/cgroup/'))
      return { ok: false, reason: 'cgroup-root-outside-kernel-mount' };
    if ((await lstat(root)).isSymbolicLink()) return { ok: false, reason: 'cgroup-parent-symlink' };
    const controllers = (await readFile(join(canonical, 'cgroup.controllers'), 'utf8')).split(/\s+/);
    const enabled = (await readFile(join(canonical, 'cgroup.subtree_control'), 'utf8')).split(/\s+/);
    if (!['memory', 'pids'].every(x => controllers.includes(x) && enabled.includes(x)))
      return { ok: false, reason: 'memory-pids-controller-not-delegated' };

    location = await mkdtemp(join(canonical, 'uce-solver-'));
    await writeFile(join(location, 'memory.max'), String(memoryMiB * 1024 * 1024));
    await writeFile(join(location, 'memory.swap.max'), '0');
    await writeFile(join(location, 'memory.oom.group'), '1');
    await writeFile(join(location, 'pids.max'), '64');
    const limits = await Promise.all(['memory.max', 'memory.swap.max', 'pids.max'].map(
      x => readFile(join(location, x), 'utf8').then(v => v.trim()),
    ));
    if (limits[0] !== String(memoryMiB * 1024 * 1024) || limits[1] !== '0' ||
        limits[2] !== '64') throw Error('kernel-did-not-apply-cgroup-limits');
  } catch {
    await abort();
    return { ok: false, reason: 'strict-cgroup-unavailable-or-unwritable' };
  }

  let attached = false, destroyed = false;
  return {
    ok: true,
    async attach(pid) {
      if (attached || destroyed || !Number.isInteger(pid) || pid <= 0) return false;
      try {
        await writeFile(join(location, 'cgroup.procs'), String(pid));
        const pids = (await readFile(join(location, 'cgroup.procs'), 'utf8')).trim().split(/\s+/);
        attached = pids.includes(String(pid));
        return attached;
      } catch { return false; }
    },
    async destroy() {
      if (destroyed) return { verified: true, peakMiB: null, oomKills: 0 };
      let peakMiB = null, oomKills = 0;
      try {
        const peak = Number((await readFile(join(location, 'memory.peak'), 'utf8')).trim());
        if (Number.isFinite(peak)) peakMiB = Math.round(peak / 1048576 * 100) / 100;
        const events = await readFile(join(location, 'memory.events'), 'utf8');
        oomKills = Number(/^oom_kill\s+(\d+)/m.exec(events)?.[1] ?? 0);
      } catch { /* Counters are diagnostic, not the cleanup proof. */ }
      try { await writeFile(join(location, 'cgroup.kill'), '1'); }
      catch { /* An empty group or unsupported kill is checked below. */ }
      for (let i = 0; i < 60; i++) {
        try {
          const events = await readFile(join(location, 'cgroup.events'), 'utf8');
          const empty = /^populated\s+0$/m.test(events);
          if (empty) {
            await rmdir(location);
            destroyed = true;
            return { verified: true, peakMiB, oomKills };
          }
        } catch { /* Do not declare cleanup success without kernel proof. */ }
        await sleep(25);
      }
      return { verified: false, peakMiB, oomKills };
    },
  };
}
