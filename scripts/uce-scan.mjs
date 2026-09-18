#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
const nativeRequire = createRequire(import.meta.url);
const target = path.resolve(process.argv[2] ?? '.');
const output = path.resolve(option('output', 'uce-report.json'));
const MAX_FILES = numberOption('max-files', 25_000);
const MAX_BYTES = numberOption('max-bytes', 96 * 1024 * 1024);
const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', '.next', '.nuxt', '.cache', '.venv', 'target']);

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  console.error('[UCE Scan] Provide a project directory.');
  process.exit(2);
}

const entries = [];
walk(target, '');
entries.sort((a, b) => priority(a.path) - priority(b.path) || a.size - b.size || a.path.localeCompare(b.path));
let bytes = 0;
let truncated = entries.length > MAX_FILES;
const files = [];
for (const entry of entries.slice(0, MAX_FILES)) {
  let content;
  if (isText(entry.path) && entry.size <= 2 * 1024 * 1024 && bytes + entry.size <= MAX_BYTES) {
    content = fs.readFileSync(entry.absolute, 'utf8');
    bytes += Buffer.byteLength(content);
  } else if (isText(entry.path)) truncated = true;
  files.push({ path: entry.path, size: entry.size, isDirectory: false, content });
}

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const report = analyzeProject({
  files,
  fileName: path.basename(target),
  source: 'upload',
  scanStats: { projectSize: entries.reduce((sum, item) => sum + item.size, 0), filesFound: entries.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [...ignored], sampled: entries.length > MAX_FILES, truncated, truncationReason: truncated ? `CLI budgets: ${MAX_FILES} files / ${MAX_BYTES} bytes` : undefined, contentBytesRead: bytes, contentByteLimit: MAX_BYTES },
});
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: path.relative(process.cwd(), output), filesFound: entries.length, filesAnalyzed: files.length, truncated, score: report.score.overall, issues: report.issues.length }));

function walk(absolute, relative) {
  for (const dirent of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (dirent.isSymbolicLink() || ignored.has(dirent.name)) continue;
    const childRelative = relative ? `${relative}/${dirent.name}` : dirent.name;
    const childAbsolute = path.join(absolute, dirent.name);
    if (dirent.isDirectory()) walk(childAbsolute, childRelative);
    else if (dirent.isFile()) entries.push({ path: childRelative.replace(/\\/g, '/'), absolute: childAbsolute, size: fs.statSync(childAbsolute).size });
  }
}
function isText(value) { return /(^|\/)(dockerfile|makefile|readme|license)(\.|$)|\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|swift|rb|php|cs|cpp|c|h|vue|svelte|astro|json|ya?ml|toml|xml|gradle|properties|md|txt|css|scss|html|env|lock|mod)$/i.test(value); }
function priority(value) { return /(^|\/)(package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|composer\.json|dockerfile|readme)/i.test(value) ? 0 : isText(value) ? 1 : 2; }
function option(name, fallback) { const item = process.argv.find((arg) => arg.startsWith(`--${name}=`)); return item ? item.slice(name.length + 3) : fallback; }
function numberOption(name, fallback) { const value = Number(option(name, fallback)); if (!Number.isFinite(value) || value < 1) throw new Error(`--${name} must be a positive number.`); return value; }

function load(file) {
  let resolved = path.resolve(root, file);
  if (!path.extname(resolved)) {
    if (fs.existsSync(`${resolved}.ts`)) resolved += '.ts';
    else resolved = path.join(resolved, 'index.ts');
  }
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  const source = fs.readFileSync(resolved, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const requireLocal = (specifier) => {
    if (specifier.startsWith('@/')) return load(path.join('src', specifier.slice(2)));
    if (!specifier.startsWith('.')) return nativeRequire(specifier);
    return load(path.resolve(path.dirname(resolved), specifier));
  };
  new Function('require', 'module', 'exports', outputText)(requireLocal, module, module.exports);
  return module.exports;
}
