import test from 'node:test';
import assert from 'node:assert/strict';
import { solverProcessEnv } from '../../solver-process-env.mjs';

test('solver subprocess env excludes unrelated parent secrets and injected Node flags', () => {
  const secretKey = 'UCE_TEST_PROCESS_SECRET_DO_NOT_FORWARD';
  const old = process.env[secretKey];
  const oldOptions = process.env.NODE_OPTIONS;
  try {
    process.env[secretKey] = 'never-send-to-native-verifier';
    process.env.NODE_OPTIONS = '--inspect';
    const actual = solverProcessEnv({ UCE_Z3_EXPERIMENT: '1' });
    assert.equal(actual[secretKey], undefined);
    assert.equal(actual.NODE_OPTIONS, undefined);
    assert.equal(actual.UCE_Z3_EXPERIMENT, '1');
    if (process.env.PATH) assert.equal(actual.PATH, process.env.PATH);
  } finally {
    if (old === undefined) delete process.env[secretKey];
    else process.env[secretKey] = old;
    if (oldOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = oldOptions;
  }
});
