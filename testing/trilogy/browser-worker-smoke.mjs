#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const playwright = process.env.UCE_PLAYWRIGHT_DIR
  ? await import(pathToFileURL(join(process.env.UCE_PLAYWRIGHT_DIR,'node_modules/playwright/index.mjs')).href)
  : await import('playwright');
const { chromium } = playwright;

function sampledChromiumDescendantsRssMiB() {
  // Linux-only diagnostic. Node launches Chromium as child process; sample
  // descendants in /proc, and subtract the Node coordinator's own RSS.
  // The result double-counts shared pages and is NOT per-worker heap/RSS.
  if(process.platform!=='linux') return null;
  const visited=new Set(), queue=[process.pid];
  let kb=0;
  while(queue.length && visited.size<128){
    const pid=queue.shift();
    if(visited.has(pid)) continue;
    visited.add(pid);
    try{
      const status=readFileSync('/proc/'+pid+'/status','utf8');
      const found=/^VmRSS:\s+(\d+)\s+kB/m.exec(status);
      if(found) kb+=Number(found[1]);
      const children=readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim();
      if(children) queue.push(...children.split(/\s+/).map(Number).filter(Number.isInteger));
    }catch{ /* Chromium process may exit during sampling. */ }
  }
  if(kb===0) return null;
  return Math.round(Math.max(0,kb/1024-process.memoryUsage().rss/1024/1024)*100)/100;
}

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
  const beforeBrowserRss=sampledChromiumDescendantsRssMiB();
  const browserRssSamples=beforeBrowserRss===null?[]:[beforeBrowserRss];
  const sampler=setInterval(()=>{
    const value=sampledChromiumDescendantsRssMiB();
    if(value!==null) browserRssSamples.push(value);
  },20);
  const before=await page.evaluate(()=>{window.gc?.();return window.trilogyWorkerTest.heap();});
  const first=await page.evaluate(()=>window.trilogyWorkerTest.run());
  assert.equal(first.result.status,'candidate',JSON.stringify(first));
  assert.equal(first.result.solverStatus,'not-run');
  assert.equal(first.result.nativeSolversAvailable,false);
  assert.equal(first.workerStarted,true);
  assert.equal(first.terminated,true);
  assert.equal(first.zeroCopyTransfer,true,'Large and small manifest buffers must be transferred, not copied');
  assert.ok(first.transferredBytes<4096);
  const samples=[first.elapsedMs];
  for(let i=0;i<19;i++){
    const r=await page.evaluate(()=>window.trilogyWorkerTest.run());
    assert.equal(r.result.status,'candidate',JSON.stringify(r));
    assert.equal(r.terminated,true);
    assert.equal(r.zeroCopyTransfer,true);
    samples.push(r.elapsedMs);
  }
  const heavy=await page.evaluate(()=>window.trilogyWorkerTest.heavy());
  assert.equal(heavy.result.status,'candidate');
  assert.equal(heavy.zeroCopyTransfer,true);
  assert.ok(heavy.transferredBytes>100*1024);
  const concurrent=await page.evaluate(()=>window.trilogyWorkerTest.concurrent());
  assert.equal(concurrent[0].result.status,'candidate');
  assert.equal(concurrent[1].result.status,'unknown');
  assert.equal(concurrent[1].workerStarted,false);
  const aborted=await page.evaluate(()=>window.trilogyWorkerTest.abortInFlight());
  assert.equal(aborted.result.status,'unknown');
  assert.equal(aborted.terminated,true);
  const timeout=await page.evaluate(()=>window.trilogyWorkerTest.deadline());
  assert.equal(timeout.workerStarted,true);
  assert.equal(timeout.terminated,true);
  assert.ok(['unknown','candidate'].includes(timeout.result.status));
  const final=await page.evaluate(()=>window.trilogyWorkerTest.run());
  assert.equal(final.result.status,'candidate','New worker must recover after cancellation/timeout');
  clearInterval(sampler);
  const afterBrowserRss=sampledChromiumDescendantsRssMiB();
  if(afterBrowserRss!==null) browserRssSamples.push(afterBrowserRss);
  if(process.platform==='linux') {
    assert.ok(browserRssSamples.length>=2,'Linux Chromium descendants RSS diagnostics unavailable');
  }
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
    browserProcessTreeRssBaselineMiB:beforeBrowserRss,
    browserProcessTreeRssMaxSampledMiB:browserRssSamples.length?Math.max(...browserRssSamples):null,
    browserProcessTreeRssAfterMiB:afterBrowserRss,
    browserProcessTreeRssSamples:browserRssSamples.length,
    externalRequests:external.length,
    payloadBytes:first.transferredBytes,
    testedZeroCopyTransfer:first.zeroCopyTransfer,
    heavyPayloadBytes:heavy.transferredBytes,
    concurrencyRejected:concurrent[1].workerStarted===false,
    nativeSolversLoaded:false,
    note:'Real Chromium dedicated-worker triage only. Linux browser descendant-process summed RSS includes shared pages/other Chromium services (double counting). NOT standalone Worker RSS, peak WASM heap, a hard memory bound, or Souffle/Z3/cvc5 performance.',
    totalSuiteMs:Math.round(performance.now()-started),
  },null,2));
}finally{
  await browser?.close();
  await server.close();
}
