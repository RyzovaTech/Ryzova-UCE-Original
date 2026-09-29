import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Transpile only local trusted test modules in memory; never execute scanned code.
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
const nativeRequire = createRequire(import.meta.url);
export function load(file) {
  const resolved = path.resolve(root, file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = { default: JSON.parse(fs.readFileSync(resolved, 'utf8')) }; return module.exports; }
  const source = fs.readFileSync(resolved, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const requireLocal = (specifier) => {
    if (specifier === 'jszip') return { default: nativeRequire('jszip') };
    if (specifier.startsWith('@/')) return load(path.resolve(root, 'src', specifier.slice(2)) + '.ts');
    if (!specifier.startsWith('.')) return nativeRequire(specifier);
    const target = path.resolve(path.dirname(resolved), specifier);
    return load(path.extname(target) ? target : fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts'));
  };
  new Function('require', 'module', 'exports', outputText)(requireLocal, module, module.exports);
  return module.exports;
}
