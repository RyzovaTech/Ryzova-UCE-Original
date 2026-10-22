import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { solveWithNativeZ3 } from '../native-z3.mjs';
import { evaluateSmartSequential } from '../smart-sequential.mjs';

const data=JSON.parse(await readFile(new URL('../fixtures/conflict.json',import.meta.url),'utf8'));
const mk=(id,range)=>({id,source:'package.json#engines.node',range});

test('native Z3 is optional and missing executable returns Unknown',async()=>{
  const r=await solveWithNativeZ3([mk('root','>=20')],{
    binary:'/nonexistent/uce-z3-native-missing',wallMs:600,
  });
  assert.equal(r.status,'unknown');
});

test('native Z3 returns a semver-checked satisfiable witness on supported facts',async()=>{
  const r=await solveWithNativeZ3([mk('a','>=20 <23'),mk('b','>=22')],{
    binary:'z3',wallMs:3500,
  });
  assert.equal(r.status,'satisfiable',JSON.stringify(r));
  assert.match(r.witness,/^22\./);
});

test('native Z3 unsatisfiable source set is independently checked by cvc5',async()=>{
  const r=await evaluateSmartSequential(data.files,{nativeZ3Binary:'z3',wallMs:12000});
  assert.equal(r.status,'conflict',JSON.stringify(r));
  assert.equal(r.verification,'independent-smt-agreement');
  assert.equal(r.unsatCore.length>0,true);
  assert.deepEqual(r.stageTrace.map(x=>x.stage),['souffle','z3','cvc5']);
  assert.ok(r.stageTrace.every((x,i,a)=>i===0||a[i-1].closedMs<=x.startedMs));
});

test('native Z3 option cannot be accidentally combined with WASM heap flags',async()=>{
  const r=await evaluateSmartSequential(data.files,{
    nativeZ3Binary:'z3',z3HeapLimitMiB:128,
  });
  assert.equal(r.status,'unknown');
});
