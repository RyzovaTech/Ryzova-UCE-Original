#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { createZ3Session } from './solver.mjs';
import { compareRuntimeEvidence } from './evidence-comparison.mjs';

// Authored, explicitly labeled regression cases, NOT an independent blinded
// human-adjudicated real-world accuracy sample.
const file = (path, content) => ({ path, content, isDirectory: false, size: Buffer.byteLength(content) });
const pkg = (node, root = '') => file((root ? root + '/' : '') + 'package.json',
  JSON.stringify(node === null ? { name: 'fixture' } : { name: 'fixture', engines: { node } }));
const pin = (path, val, root = '') => file((root ? root + '/' : '') + path, val);
const fixture = (id, expected, files, workspace = '', legacyExpected = expected) =>
  ({ id, expected, files, workspace, legacyExpected });

export const fixtures = [
  fixture('engine-vs-pin-conflict', 'conflict', [pkg('>=22'), pin('.nvmrc', '20')]),
  fixture('engine-and-pin-overlap', 'satisfiable', [pkg('>=20.5'), pin('.node-version', '20')]),
  fixture('engine-and-exact-pin', 'satisfiable', [pkg('^22'), pin('.nvmrc', '22.3.1')]),
  fixture('engine-upper-bound-conflict', 'conflict', [pkg('<20'), pin('.node-version', '22')]),
  fixture('nested-workspace-conflict', 'conflict', [pkg('>=22', 'apps/api'), pin('.nvmrc', '20', 'apps/api')], 'apps/api'),
  fixture('nested-workspace-compatible', 'satisfiable', [pkg('>=22', 'apps/api'), pin('.nvmrc', '22', 'apps/api')], 'apps/api'),
  fixture('missing-engine', 'unknown', [pkg(null), pin('.nvmrc', '20')]),
  fixture('dynamic-pin', 'unknown', [pkg('>=22'), pin('.nvmrc', 'lts/*')]),
  fixture('dynamic-engine', 'unknown', [pkg('latest'), pin('.node-version', '22')]),
  fixture('malformed-package', 'unknown', [file('package.json', '{bad json'), pin('.nvmrc', '22')]),
  fixture('multiline-pin', 'unknown', [pkg('>=22'), pin('.nvmrc', '20\n22')]),
  fixture('sibling-only-pin', 'unknown', [pkg('>=22', 'apps/api'), pin('.nvmrc', '20', 'apps/web')], 'apps/api'),
  fixture('joint-only-conflict', 'conflict', [pkg('>=18'), pin('.nvmrc', '20'), pin('.node-version', '22')], '', 'satisfiable'),
  fixture('three-way-satisfiable', 'satisfiable', [pkg('>=20 <23'), pin('.nvmrc', '22'), pin('.node-version', '22')]),
  fixture('two-identical-pins', 'satisfiable', [pkg('20'), pin('.nvmrc', '20'), pin('.node-version', '20')]),
  fixture('caret-disagreement', 'conflict', [pkg('^22'), pin('.nvmrc', '20')]),
  fixture('commented-runtime-pin', 'satisfiable', [pkg('>=22'), pin('.nvmrc', '# used in CI\n22\n')]),
  fixture('test-folder-not-evidence', 'unknown', [pkg('>=22'), pin('tests/.nvmrc', '20')]),
  fixture('unsupported-prerelease', 'unknown', [pkg('>=22.0.0-rc.1'), pin('.nvmrc', '22')]),
  fixture('no-pin', 'unknown', [pkg('>=22')]),
];

export async function validateMatrix(session, cases = fixtures) {
  const results = [];
  for (const item of cases) {
    const before = performance.now();
    const found = await compareRuntimeEvidence(session, item.files, item.workspace);
    results.push({
      id: item.id, expected: item.expected, custom: found.customStatus,
      z3: found.z3Status, comparison: found.comparison, elapsedMs: Math.round((performance.now() - before) * 100) / 100,
      evidenceSources: found.evidenceSources,
      unsatExplanation: found.unsatExplanation,
      explanation: found.guidance,
      expectedLegacy: item.legacyExpected,
    });
  }
  const counts = { conflict: 0, satisfiable: 0, unknown: 0 };
  const failures = [];
  const disagreement = [];
  const falsePositives = { custom: 0, z3: 0 };
  const confusion = { custom: {}, z3: {} };
  for (const item of results) {
    counts[item.expected]++;
    for (const name of ['custom', 'z3']) {
      const key = item.expected + ' -> ' + item[name];
      confusion[name][key] = (confusion[name][key] ?? 0) + 1;
      if (item.expected !== 'conflict' && item[name] === 'conflict') falsePositives[name]++;
    }
    if (item.custom !== item.expectedLegacy || item.z3 !== item.expected) {
      failures.push({ id: item.id, expectedCustom: item.expectedLegacy, actualCustom: item.custom,
        expectedZ3: item.expected, actualZ3: item.z3 });
    }
    if (item.custom !== item.z3) disagreement.push({
      id: item.id, custom: item.custom, z3: item.z3, comparison: item.comparison,
      evidenceSources: item.evidenceSources,
    });
  }
  return {
    type: 'uce-z3-shared-evidence-authored-matrix-v1', total: results.length,
    labelCounts: counts, falsePositiveCounts: falsePositives,
    disagreement, failures, confusion, cases: results,
    limitation: 'Authored fixtures from real UCE extraction, not independent human-adjudicated real repository labels.',
  };
}

if (process.argv[1]?.endsWith('/validation.mjs')) {
  let session;
  try {
    session = await createZ3Session();
    const result = await validateMatrix(session);
    console.log(JSON.stringify(result, null, 2));
    if (result.failures.length || result.disagreement.some(x => x.comparison !== 'joint-constraint-gap')) {
      process.exitCode = 1;
    }
  } finally {
    if (session) await session.close();
  }
}
