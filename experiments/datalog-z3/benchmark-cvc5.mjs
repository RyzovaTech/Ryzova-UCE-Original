#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { evaluateDatalogZ3Cvc5 } from './triple.mjs';
const data=JSON.parse(await readFile(new URL('./fixtures/conflict.json',import.meta.url),'utf8'));
const rss=()=>Math.round(process.memoryUsage().rss/1024/1024*100)/100;
const before=rss();
const times=[];
for(let i=0;i<3;i++){
  const t=performance.now();
  const result=await evaluateDatalogZ3Cvc5(data.files);
  if(result.status!=='conflict' || result.verification!=='independent-smt-agreement') throw Error('Triple-solver proof failed');
  times.push(Math.round((performance.now()-t)*100)/100);
}
console.log(JSON.stringify({suite:'souffle-z3-cvc5-ci-diagnostic',samples:times,meanMs:Math.round(times.reduce((a,b)=>a+b,0)/times.length*100)/100,rssBeforeMiB:before,rssAfterMiB:rss(),note:'3-run diagnostic with real native Souffle, Node/WASM Z3, and native cvc5; not peak multi-process RSS or real-project accuracy'},null,2));
