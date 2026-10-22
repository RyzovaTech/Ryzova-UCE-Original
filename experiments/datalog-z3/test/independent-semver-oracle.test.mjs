/**
 * Deterministic, bounded independent semantic tests for SMT-LIB encoding.
 * Oracle uses node-semver's actual satisfaction semantics over a deliberately
 * exhaustive finite version domain, never Z3/cvc5 outputs to set labels.
 * This does NOT constitute independent human-labelled real-repository accuracy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import semver from 'semver';
import { solveWithNativeZ3 } from '../native-z3.mjs';
import { solveWithCvc5 } from '../cvc5.mjs';

const UNIVERSE = [];
for(let major=0;major<=5;major++)
  for(let minor=0;minor<=4;minor++)
    for(let patch=0;patch<=4;patch++)
      UNIVERSE.push(`${major}.${minor}.${patch}`);

const operators=['>=','<','<=','>','='];
const versions=[];
for(let major=0;major<=3;major++)
  for(let minor=0;minor<=2;minor++)
    for(let patch=0;patch<=2;patch++)
      versions.push(`${major}.${minor}.${patch}`);

let state=0x0C3E23;
const next=()=>{
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state;
};
const pick=values=>values[next()%values.length];
const combinations=[
  ['>=2.0.0','<2.0.0'],
  ['>=2.0.0','<3.0.0'],
  ['<0.0.0','>=0.0.0'],
  ['>=2.0.0 <3.0.0','>=2.1.0 <2.2.0'],
  ['^1.2.0','>=2.0.0'],
  ['^1.2.0','>=1.2.1'],
  ['~3.1.0','>=3.2.0'],
  ['1.2.0 || 2.2.0','=2.2.0'],
  ['1.2.0 || 2.2.0','=3.2.0'],
  ['>=0.0.0','=0.0.0'],
  ['<1.0.0','>=0.0.0'],
];
for(let i=0;i<75;i++){
  const n=2+next()%3;
  combinations.push(Array.from({length:n},()=>pick(operators)+pick(versions)));
}
// Every generated comparator boundary is <=3.2.2. Every possible
// satisfying open upper/lower interval for these boundaries has a stable
// witness in the 0..5 x 0..4 x 0..4 finite lattice above.
const oracle=ranges=>UNIVERSE.some(v=>ranges.every(r=>semver.satisfies(v,r)));

test('Z3 CLI and cvc5 agree with an independent finite node-semver oracle', {
  timeout: 90000,
}, async()=>{
  let sat=0,unsat=0;
  for(let i=0;i<combinations.length;i++){
    const ranges=combinations[i];
    const expected=oracle(ranges)?'satisfiable':'conflict';
    const facts=ranges.map((range,j)=>({
      id:'oracle_'+i+'_'+j,source:'package.json#engines.node',range,
    }));
    const [z3,cvc5]=await Promise.all([
      solveWithNativeZ3(facts,{binary:'z3',wallMs:2500}),
      solveWithCvc5(facts,{binary:'cvc5',wallMs:2500,solverMs:2000}),
    ]);
    assert.equal(z3.status,expected,
      `native Z3 mismatch case ${i}: ${JSON.stringify({ranges,expected,z3})}`);
    assert.equal(cvc5.status,expected,
      `cvc5 mismatch case ${i}: ${JSON.stringify({ranges,expected,cvc5})}`);
    if(expected==='satisfiable'){
      assert.ok(semver.valid(z3.witness));
      assert.ok(ranges.every(r=>semver.satisfies(z3.witness,r)));
      sat++;
    }else{
      assert.deepEqual(z3.unsatCore.map(x=>x.range),ranges);
      unsat++;
    }
  }
  assert.ok(sat>0 && unsat>0,'oracle needs both SAT and UNSAT test cases');
});
