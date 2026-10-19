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


test('Cargo outranks metadata-only package.json in a native Rust project', () => {
  // Reproduces source layout of fathyb/carbonyl (pinned live benchmark).
  const result = stack(
    file('Cargo.toml', '[package]\\nname="carbonyl"\\nversion="0.0.3"\\n'),
    file('package.json', '{"name":"carbonyl","version":"0.0.3","license":"BSD-3-Clause"}'),
    file('src/lib.rs', 'pub fn run() {}\\n'),
  );
  assert.equal(result.packageManager, 'cargo');
});

test('a meaningful Node wrapper still uses npm alongside Cargo sources', () => {
  const result = stack(
    file('Cargo.toml', '[package]\\nname="native-addon"\\n'),
    file('package.json', '{"name":"wrapper","scripts":{"build":"node build.mjs"},"dependencies":{"express":"4"}}'),
    file('index.js', 'export const wrapper = true;'),
  );
  assert.equal(result.packageManager, 'npm');
});

test('root TypeScript source remains primary despite larger JavaScript build scripts', () => {
  // Reproduces the strong root tsconfig + production TS / JS tooling mixture
  // seen in inversify/InversifyJS. Report-level enrichment must not override it.
  const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
  const files = [
    file('tsconfig.json', '{"compilerOptions":{"strict":true}}'),
    file('package.json', '{"name":"example","scripts":{"build":"tsc"},"devDependencies":{"typescript":"5"}}'),
    file('src/container.ts', 'export const container: string = "ok";\\n'),
    file('src/index.ts', 'export * from "./container";\\n'),
    file('scripts/generate.js', 'function helper() { return 1; }\\n'.repeat(150)),
  ];
  const analysis = analyzeProject({ files, fileName: 'ts-project', source: 'upload', scanStats: {
    projectSize: files.reduce((sum, item) => sum + item.size, 0),
    filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0,
    ignoredCategories: [],
  } });
  assert.equal(analysis.stack.language, 'TypeScript');
  assert.equal(analysis.stack.primaryLanguage, 'TypeScript');
  assert.equal(analysis.stack.runtime, 'Node.js');
});

test('single root TypeScript entry point outranks JavaScript-only tooling', () => {
  const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
  const files = [
    file('tsconfig.json', '{"compilerOptions":{"rootDir":"src"}}'),
    file('package.json', '{"name":"ts-single-entry","scripts":{"build":"tsc"}}'),
    file('src/index.ts', 'export const entry: string = "ts";'),
    file('scripts/build.js', 'const build = true;'.repeat(500)),
  ];
  const result = analyzeProject({ files, fileName: 'ts-single-entry', source: 'upload', scanStats: {
    projectSize: files.reduce((total, item) => total + item.size, 0),
    filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [],
  } });
  assert.equal(result.stack.language, 'TypeScript');
  assert.equal(result.stack.primaryLanguage, 'TypeScript');
  assert.equal(result.stack.runtime, 'Node.js');
});

test('tsconfig without production TypeScript does not override JavaScript source', () => {
  const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
  const files = [
    file('tsconfig.json', '{"compilerOptions":{"allowJs":true}}'),
    file('src/main.js', 'export const js = true;\\n'),
  ];
  const analysis = analyzeProject({ files, fileName: 'js-project', source: 'upload', scanStats: {
    projectSize: files.reduce((sum, item) => sum + item.size, 0),
    filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0,
    ignoredCategories: [],
  } });
  assert.equal(analysis.stack.language, 'JavaScript');
});

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
