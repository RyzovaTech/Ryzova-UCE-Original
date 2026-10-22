/**
 * Best-effort termination of *all descendants in an isolated POSIX process
 * group*, rather than killing only the direct worker. Spawn callers MUST use
 * detached: process.platform !== 'win32' for this guarantee to apply.
 *
 * This is NOT a hard memory/process-tree isolation mechanism, and Windows
 * Job Object controls remain a separate platform release requirement.
 */
export function terminateSolverProcessTree(child) {
  if (!child || !Number.isInteger(child.pid) || child.pid <= 0) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch (error) {
      // When the child is not a group leader (nested Trilogy worker),
      // fall back to killing its direct PID. The outer isolated worker
      // owns the inherited group and will clean up remaining descendants.
    }
  }
  try {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  } catch { /* Already terminated or missing. */ }
}
