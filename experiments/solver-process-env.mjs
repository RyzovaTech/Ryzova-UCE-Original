/**
 * Intentionally minimal environment for isolated local native-solver workers.
 * Do not forward credentials, NODE_OPTIONS, build tokens, or unrelated user vars.
 * Only trusted local tooling should configure executable paths.
 */
const ALLOWED = [
  'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR',
  'LANG', 'LC_ALL',
];

export function solverProcessEnv(extra = {}) {
  const env = {};
  for (const name of ALLOWED) {
    if (typeof process.env[name] === 'string') env[name] = process.env[name];
  }
  return { ...env, ...extra };
}
