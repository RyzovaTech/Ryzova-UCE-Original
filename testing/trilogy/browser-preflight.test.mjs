import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { inspectTrilogyCandidate, TRILOGY_PREFLIGHT_LIMITS } =
  load('src/lib/symbolic/trilogy-preflight.ts');
const f=(path,content)=>({path,content,isDirectory:false});
const native=()=>{
 const pkg={name:'app',engines:{node:'>=20'},dependencies:{alpha:'^1.0.0'}};
 const lock={lockfileVersion:3,packages:{
   '':{name:'app',version:'1.0.0',dependencies:pkg.dependencies},
   'node_modules/alpha':{version:'1.1.0',engines:{node:'>=22'},dependencies:{beta:'^2.0.0'}},
   'node_modules/beta':{version:'2.2.0',engines:{node:'<21'}},
 }};
 return [f('package.json',JSON.stringify(pkg)),f('package-lock.json',JSON.stringify(lock))];
};
test('candidate is only a preflight, never a Trilogy solver proof',()=>{
 const r=inspectTrilogyCandidate(native());
 assert.equal(r.status,'candidate');
 assert.equal(r.nativeSolversAvailable,false);
 assert.equal(r.solverStatus,'not-run');
 assert.equal(r.candidateConstraints,3);
 assert.equal(r.transitiveHint,true);
});
test('preflight avoids work for two direct simple requirements',()=>{
 const files=native();const lock=JSON.parse(files[1].content);
 lock.packages['node_modules/alpha'].dependencies={};
 delete lock.packages['node_modules/beta'];
 files[1].content=JSON.stringify(lock);
 const r=inspectTrilogyCandidate(files);
 assert.equal(r.status,'skip');
 assert.equal(r.solverStatus,'not-run');
});
test('browser preflight respects relevant sibling package workspace',()=>{
 const files=native().map(x=>({...x,path:'apps/api/'+x.path}));
 const r=inspectTrilogyCandidate(files,'apps/api');
 assert.equal(r.status,'candidate');
 assert.equal(inspectTrilogyCandidate(files,'apps/web').status,'unknown');
});
test('untrusted path traversal workspace cannot influence evidence',()=>{
 assert.equal(inspectTrilogyCandidate(native(),'../root').status,'unknown');
 assert.equal(inspectTrilogyCandidate(native(),'apps//api').status,'unknown');
});
test('duplicate source paths fail closed',()=>{
 const files=native(); files[1]={...files[0]};
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
test('malformed JSON and unsupported lock versions fail closed',()=>{
 let files=native(); files[1].content='{broken';
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
 files=native(); const lock=JSON.parse(files[1].content);lock.lockfileVersion=4;
 files[1].content=JSON.stringify(lock);
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
test('nested hoisting ambiguity fails closed rather than a fake proof',()=>{
 const files=native();const lock=JSON.parse(files[1].content);
 lock.packages['node_modules/alpha/node_modules/beta']={version:'2.2.0'};
 files[1].content=JSON.stringify(lock);
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
test('stale manifest-to-lock root versions fail closed',()=>{
 const files=native();const lock=JSON.parse(files[1].content);
 lock.packages[''].dependencies.alpha='^3.0.0';
 files[1].content=JSON.stringify(lock);
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
test('max file budget blocks oversized content without setting any solver verdict',()=>{
 const files=native();files[1].content=' '.repeat(TRILOGY_PREFLIGHT_LIMITS.maxFileBytes+1);
 const r=inspectTrilogyCandidate(files);
 assert.equal(r.status,'unknown');assert.equal(r.solverStatus,'not-run');
});
test('large lock package count returns Unknown, without native import',()=>{
 const files=native();const lock=JSON.parse(files[1].content);
 for(let i=0;i<TRILOGY_PREFLIGHT_LIMITS.maxInstalledPackages;i++){
   lock.packages['node_modules/unused-'+i]={version:'1.0.0'};
 }
 files[1].content=JSON.stringify(lock);
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
test('missing lockfile cannot be assumed compatible',()=>{
 assert.equal(inspectTrilogyCandidate([native()[0]]).status,'unknown');
});
test('input collection is strictly capped',()=>{
 const files=native();files.push(f('readme.md','hi'));
 assert.equal(inspectTrilogyCandidate(files).status,'unknown');
});
