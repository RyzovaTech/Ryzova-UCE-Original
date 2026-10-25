#!/usr/bin/env node
/**
 * Phase 5.6A production smoke: the public UCE demo only. No private project
 * files, credentials, source uploads, or native solver execution.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const browserPath=process.env.UCE_PLAYWRIGHT_ENTRY;
if(!browserPath) throw Error('Pinned isolated Playwright runner required');
const {chromium}=await import(pathToFileURL(browserPath).href);
const base=new URL(process.env.UCE_LIVE_URL ?? 'https://uce.ryzova.com');
assert.equal(base.protocol,'https:');
assert.equal(base.hostname,'uce.ryzova.com');
assert.equal(base.pathname,'/');
let browser;
const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:false});
  page.on('pageerror',e=>errors.push(e.message.slice(0,250)));
  const response=await page.goto(new URL('/analyze?demo=1',base).href,{
    waitUntil:'domcontentloaded',timeout:45_000,
  });
  assert.ok(response && response.ok(),'production demo route HTTP response was not successful');
  await page.waitForURL(/\/report\/[^/?]+/,{timeout:120_000});
  const nav=page.getByRole('navigation',{name:'Report sections'});
  await nav.waitFor({state:'visible',timeout:20_000});
  const tab=nav.getByRole('button',{name:'Root Causes'});
  await tab.waitFor({state:'visible',timeout:10_000});
  await tab.click();
  const panel=page.getByRole('region',{name:'Experimental Unified Intelligence'});
  await panel.getByRole('heading',{name:'Unified Project Intelligence'})
    .waitFor({state:'visible',timeout:15_000});
  await panel.getByText('Root Cause First — investigation clusters')
    .waitFor({state:'visible',timeout:15_000});
  const quality=page.getByRole('region',{name:'Phase 5.5 intelligence quality evaluation'});
  await quality.getByText('Intelligence quality & symbolic reasoning')
    .waitFor({state:'visible',timeout:12_000});
  const parity=quality.getByText('preserved',{exact:true});
  assert.ok(await parity.count()>=2,'saved demo score/issue parity not visibly preserved');
  await quality.getByRole('button',{name:/Inspect review candidates/}).click();
  assert.equal(await quality.getByRole('button',{name:'Hide review queue'})
    .getAttribute('aria-expanded'),'true');
  await panel.getByRole('button',{name:'Inspect original issues'}).click();
  assert.equal(await panel.getByRole('button',{name:'Hide original issues'})
    .getAttribute('aria-expanded'),'true');
  assert.equal(await panel.getByRole('button',{name:'Generate Fix Proposal'}).isDisabled(),true,
    'proposal generation must require user-supplied source and explicit request');
  assert.deepEqual(errors,[],'uncaught production browser runtime errors');
  const output={
    phase:'5.6A',site:base.origin,scope:'public production demo only',
    result:'browser-smoke-passed',deploymentCommitExpected:'72b85a5127b78da993971c32c625ff989715e3c7',
    checks:['HTTPS demo-to-report','Root Causes navigation','Unified report evidence',
      'read-only quality score/issue parity','review expansion','original issue visibility',
      'developer-only Generate disabled without input','no uncaught browser errors'],
    notes:[
      'A successful UI smoke does not independently authenticate the served deployment SHA',
      'No screen-reader manual acceptance, real repo accuracy or native Trilogy proof is inferred',
    ],
  };
  const outputPath=process.env.UCE_PHASE56_LIVE_OUTPUT;
  if(outputPath){fs.mkdirSync(path.dirname(path.resolve(outputPath)),{recursive:true});
    fs.writeFileSync(path.resolve(outputPath),JSON.stringify(output,null,2)+'\n');}
  console.log(JSON.stringify(output));
} finally {
  await browser?.close();
}
