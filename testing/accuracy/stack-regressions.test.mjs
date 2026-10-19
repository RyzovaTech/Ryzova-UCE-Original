import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { detectStack } = load('src/lib/analyzer/detectors.ts');
const { parseFiles } = load('src/lib/analyzer/parser.ts');
const { fingerprintAnalysisInput, ANALYSIS_CACHE_VERSION } = load('src/lib/analyzer/execution.ts');

const file = (path, content) => ({
  path,
  content,
  size: Buffer.byteLength(content),
  isDirectory: false,
});
const stack = (...files) => detectStack(files, parseFiles(files));

test('Hardhat configuration is recognized as Hardhat, never Turbopack', () => {
  const result = stack(
    file('hardhat.config.ts', 'export default { solidity: "0.8.20" };'),
    file('contracts/Greeter.sol', 'pragma solidity ^0.8.20; contract Greeter {}'),
  );
  assert.equal(result.buildTool, 'Hardhat');
  assert.equal(result.language, 'Solidity');
});

test('sample Hardhat configuration does not override the primary project', () => {
  const result = stack(
    file('package.json', '{"dependencies":{"react":"18.3.1"}}'),
    file('src/App.jsx', 'export function App() { return null; }'),
    file('examples/hardhat-demo/hardhat.config.ts', 'export default {};'),
  );
  assert.equal(result.framework, 'React');
  assert.equal(result.buildTool, 'Unknown');
});

test('pyproject metadata plus uv.lock identifies uv without [tool.uv]', () => {
  const result = stack(
    file('pyproject.toml', '[project]\nname="app"\nversion="0.1.0"\n'),
    file('uv.lock', 'version = 1\n'),
    file('src/app.py', 'print("hello")\n'),
  );
  assert.equal(result.packageManager, 'uv');
});

test('Poetry 2 PEP 621 project with poetry.lock is Poetry', () => {
  const result = stack(
    file('pyproject.toml', '[project]\nname="app"\nversion="0.1.0"\n'),
    file('poetry.lock', '# generated lock\n'),
    file('app.py', 'print("hello")\n'),
  );
  assert.equal(result.packageManager, 'poetry');
});

test('explicit pyproject manager declaration takes precedence over unrelated lockfiles', () => {
  const result = stack(
    file('pyproject.toml', '[tool.poetry]\nname="app"\n'),
    file('uv.lock', 'version = 1\n'),
  );
  assert.equal(result.packageManager, 'poetry');
});

test('example TypeScript/Next manifests cannot override a Python root project', () => {
  const result = stack(
    file('pyproject.toml', '[project]\nname="backend"\n'),
    file('src/app.py', 'def run():\n    return True\n'),
    file('examples/demo/package.json', '{"dependencies":{"next":"15.0.0"}}'),
    file('examples/demo/tsconfig.json', '{"compilerOptions":{}}'),
    file('examples/demo/next.config.js', 'module.exports = {};'),
  );
  assert.equal(result.language, 'Python');
  assert.equal(result.framework, 'Unknown');
  assert.equal(result.packageManager, 'pip');
  assert.equal(result.buildTool, 'pip');
});

test('nested test-only TypeScript configs do not override production Python sources', () => {
  const result = stack(
    file('src/server.py', 'print("hello")\n'),
    file('packages/helper/tests/tsconfig.json', '{"compilerOptions":{}}'),
  );
  assert.equal(result.language, 'Python');
});

test('React is not evidence of Create React App without CRA-specific signals', () => {
  const result = stack(
    file('package.json', '{"dependencies":{"react":"18.3.1"}}'),
    file('src/App.jsx', 'export default function App() { return null; }'),
  );
  assert.equal(result.framework, 'React');
  assert.equal(result.buildTool, 'Unknown');
});

test('cache key changes when only the middle of a large file changes', () => {
  const shared = 'A'.repeat(2200);
  const ending = 'Z'.repeat(2200);
  const makeInput = (middle) => ({
    files: [file('src/main.ts', shared + middle + ending)],
    fileName: 'same-project',
    source: 'upload',
    scanStats: { projectSize: 5000, filesFound: 1, filesAnalyzed: 1, filesIgnored: 0, ignoredCategories: [] },
  });
  assert.equal(ANALYSIS_CACHE_VERSION, 23);
  assert.notEqual(fingerprintAnalysisInput(makeInput('alpha')), fingerprintAnalysisInput(makeInput('bravo')));
});
