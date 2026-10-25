#!/usr/bin/env node
/**
 * Real Chromium UX flow on original /analyze page. Provider HTTP responses
 * are intercepted so CI is deterministic and does not depend on rate limits.
 * This is a browser UI contract, not live-provider acceptance.
 */
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const pw=await import(process.env.UCE_PLAYWRIGHT_ENTRY
  ? pathToFileURL(process.env.UCE_PLAYWRIGHT_ENTRY).href : 'playwright');
const browserName=process.env.UCE_BROWSER??'chromium';
const HOST='http://127.0.0.1:4187';
const server=spawn(process.execPath,
  ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4187','--strictPort'],
  {stdio:'ignore',shell:false,env:{...process.env,CI:'true'}});
let browser;
async function ready(){
  for(let i=0;i<150;i++){
    if(server.exitCode!==null)throw Error('Vite server crashed');
    try{const response=await fetch(HOST+'/analyze',{signal:AbortSignal.timeout(1500)});
      if(response.ok)return;}catch{}
    await delay(200);
  }
  throw Error('Vite browser test server did not start');
}
const zip=new JSZip();
zip.file('project-main/package.json',JSON.stringify({name:'provider-fixture',
  version:'1.0.0',engines:{node:'>=22'},dependencies:{react:'^19.0.0'}}));
zip.file('project-main/.nvmrc','20.0.0\n');
zip.file('project-main/README.md','# Provider test\n');
const zipBytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});

async function runCase(provider,url,expectArchive,meta){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],archives=[],metadata=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/\/api\/repository\/metadata\?/,async route=>{
    metadata.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(meta)});
  });
  await page.route('https://api.github.com/repos/**',async route=>{
    metadata.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(meta)});
  });
  await page.route(/\/api\/(github|gitlab|codeberg)\/archive\//,async route=>{
    archives.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/zip',body:zipBytes});
  });
  try {
    await page.goto(HOST+'/analyze',{waitUntil:'domcontentloaded'});
    await page.getByRole('tab',{name:/Git Repository/}).click();
    const buttons=page.getByRole('group',{name:'Repository provider'});
    for(const label of ['GitHub','GitLab','Codeberg'])
      assert.equal(await buttons.getByRole('button',{name:label,exact:true}).count(),1);
    const preferred=buttons.getByRole('button',{name:provider,exact:true});
    await preferred.click();
    assert.equal(await preferred.getAttribute('aria-pressed'),'true');
    const input=page.getByRole('textbox',{name:'Public repository URL'});
    assert.equal(await input.isVisible(),true);
    assert.equal((await input.getAttribute('placeholder')).toLowerCase()
      .includes(provider==='GitLab'?'gitlab.com':provider==='Codeberg'?'codeberg.org':'github.com'),true);
    // Never attempt a network request for invalid URL/credentials.
    await input.fill('https://evil.example/owner/repo');
    assert.equal(await page.getByRole('button',{name:'Analyze repository'}).isDisabled(),true);
    assert.equal(await page.locator('#repository-url-validation').innerText()
      .then(v=>v.toLowerCase().includes('only public https')),true);
    assert.equal(metadata.length,0);
    await input.fill(url);
    assert.equal(await page.getByRole('button',{name:'Analyze repository'}).isEnabled(),true);
    assert.match(await page.locator('#repository-url-validation').innerText(),
      /Valid public .* repository URL/);
    await input.press('Enter');
    await page.waitForURL(/\/report\/[^/?]+/,{timeout:90000});
    assert.equal(metadata.length,1,'Metadata lookup must hit the intended fixed public provider');
    assert.equal(archives.length,1,'Only one archive request should run');
    assert.equal(archives[0].includes(expectArchive),true,
      'Wrong provider archive relay: '+archives[0]);
    assert.deepEqual(errors,[],'No browser page errors');
    const documentWidth=await page.evaluate(()=>
      ({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
    assert.ok(documentWidth.scroll<=documentWidth.width+3,
      'Mobile overflow: '+JSON.stringify(documentWidth));
    process.stdout.write(provider+' provider UI → UCE report PASS\n');
  } finally {await page.close();}
}
try{
 await ready();
 browser=await pw[browserName].launch({headless:true,
   ...(browserName==='chromium'?{args:['--no-sandbox']}: {})});
 await runCase('GitHub','https://github.com/example/project',
   '/api/github/archive/example/project/main',{default_branch:'main'});
 await runCase('GitLab','https://gitlab.com/example/team/project',
   '/api/gitlab/archive/187?sha=main',{default_branch:'main',id:187});
 await runCase('Codeberg','https://codeberg.org/example/project',
   '/api/codeberg/archive/example/project/main.zip',{default_branch:'main'});
} finally{
 await browser?.close().catch(()=>undefined);
 server.kill('SIGTERM');
}
