#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const started=performance.now();
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;
try {
  await server.listen();
  const url=new URL('testing/trilogy/browser-worker-fixture.html',server.resolvedUrls.local[0]).href;
  browser=await chromium.launch({headless:true,args:['--js-flags=--expose-gc']});
  const page=await browser.newPage();
  const external=[];
  page.on('request',r=>{
    if(!r.url().startsWith(new URL(url).origin)) external.push(r.url());
  });
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.trilogyWorkerTest));
  const pre=await page.evaluate(()=>window.trilogyWorkerTest.cancel());
  assert.equal(pre.result.status,'unknown');
  assert.equal(pre.workerStarted,false);
  const oversized=await page.evaluate(()=>window.trilogyWorkerTest.oversized());
  assert.equal(oversized.result.status,'unknown');
  assert.equal(oversized.workerStarted,false);
  const before=await page.evaluate(()=>{window.gc?.();return window.trilogyWorkerTest.heap();});
  const first=await page.evaluate(()=>window.trilogyWorkerTest.run());
  assert.equal(first.result.status,'candidate',JSON.stringify(first));
  assert.equal(first.result.solverStatus,'not-run');
  assert.equal(first.result.nativeSolversAvailable,false);
  assert.equal(first.workerStarted,true);
  assert.equal(first.terminated,true);
  assert.ok(first.transferredBytes<4096);
  const samples=[first.elapsedMs];
  for(let i=0;i<19;i++){
    const r=await page.evaluate(()=>window.trilogyWorkerTest.run());
    assert.equal(r.result.status,'candidate',JSON.stringify(r));
    assert.equal(r.terminated,true);
    samples.push(r.elapsedMs);
  }
  const timeout=await page.evaluate(()=>window.trilogyWorkerTest.deadline());
  assert.equal(timeout.workerStarted,true);
  assert.equal(timeout.terminated,true);
  assert.ok(['unknown','candidate'].includes(timeout.result.status));
  const final=await page.evaluate(()=>window.trilogyWorkerTest.run());
  assert.equal(final.result.status,'candidate','New worker must recover after cancellation/timeout');
  const after=await page.evaluate(()=>{window.gc?.();return window.trilogyWorkerTest.heap();});
  const sorted=[...samples].sort((a,b)=>a-b);
  const p95=sorted[Math.ceil(sorted.length*0.95)-1];
  assert.ok(p95<5000,'Preflight workers should not take 5 seconds for tiny manifest data');
  const heapIncreaseMiB=before!==null&&after!==null?Math.round((after-before)/1024/1024*100)/100:null;
  // Browser exposes only the PAGE heap, not per-worker or solver memory.
  if(heapIncreaseMiB!==null){
    assert.ok(heapIncreaseMiB<48,'Main-page heap after 20 terminated workers should not grow by 48MiB');
  }
  assert.deepEqual(external,[],'Local-first preflight must make no external HTTP requests');
  console.log(JSON.stringify({
    type:'trilogy-browser-preflight-only-chromium-smoke',
    iterations:20,p95Ms:p95,
    meanMs:Math.round(samples.reduce((a,b)=>a+b,0)/samples.length*100)/100,
    beforePageHeapMiB:before===null?null:Math.round(before/1024/1024*100)/100,
    afterPageHeapMiB:after===null?null:Math.round(after/1024/1024*100)/100,
    pageHeapDeltaMiB:heapIncreaseMiB,
    externalRequests:external.length,
    payloadBytes:first.transferredBytes,
    nativeSolversLoaded:false,
    note:'Real Chromium dedicated-worker triage only, NOT Souffle/Z3/cvc5 WASM solver memory or performance.',
    totalSuiteMs:Math.round(performance.now()-started),
  },null,2));
}finally{
  await browser?.close();
  await server.close();
}
