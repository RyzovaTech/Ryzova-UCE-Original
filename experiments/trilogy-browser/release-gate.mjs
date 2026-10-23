#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const vercel = JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
const controller=readFileSync(resolve(import.meta.dirname,'controller.mjs'),'utf8');
const worker=readFileSync(resolve(import.meta.dirname,'probe.worker.mjs'),'utf8');
const rootDeps={...pkg.dependencies,...pkg.devDependencies};
const leaked=['z3-solver','cvc5','souffle'].filter(k=>Object.hasOwn(rootDeps,k));
const importsNative=/from\s*['"][^'"]*(?:datalog-z3|z3-node)|\bimport\s*\(\s*['"][^'"]*(?:datalog-z3|z3-node)/;
const headers=(vercel.headers??[]).flatMap(e=>e.headers??[]);
const isolation=headers.some(h=>/cross-origin-(?:opener|embedder)-policy/i.test(h.key));
const result={
  gate:'uce-trilogy-browser-performance-prototype',
  status:'blocked',
  nativeRuntimeDependenciesLeaked:leaked,
  nativeSolverImportsInBrowserHarness:importsNative.test(controller)||importsNative.test(worker),
  productionIsolationHeadersChanged:isolation,
  realTrilogyBrowserBackendsValidated:false,
  peakWorkerRssMeasured:false,
  truthfulScope:'Real browser Worker overhead and termination only; NO Souffle+Z3+cvc5 browser solving.',
};
console.log(JSON.stringify(result,null,2));
if(leaked.length || result.nativeSolverImportsInBrowserHarness || isolation) process.exitCode=1;
