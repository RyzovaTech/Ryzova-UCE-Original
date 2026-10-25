import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = path.join(root, 'plugins/uce');
test('plugin manifest describes MPL-2.0 open-source UCE and valid local components', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ryzova-uce');
  assert.equal(manifest.license, 'MPL-2.0');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.apps, undefined, 'never invent an unregistered ChatGPT app ID');
  const servers = JSON.parse(fs.readFileSync(path.join(folder, '.mcp.json'), 'utf8'));
  assert.deepEqual(servers.mcp_servers['ryzova-uce'].args, ['./bin/launch.mjs']);
  assert.ok(fs.existsSync(path.join(folder,servers.mcp_servers['ryzova-uce'].args[0])),
    'launcher must resolve from standalone plugin folder, not repository root');
  assert.ok(fs.existsSync(path.join(folder, 'skills/analyze-repository/SKILL.md')));
});
test('local plugin denies implicit roots and symlink roots', () => {
  const script = path.join(folder, 'bin/launch.mjs');
  const forbidden = spawnSync(process.execPath, [script], {
    cwd:root,encoding:'utf8',env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:''},timeout:5000
  });
  assert.equal(forbidden.status, 2);
  assert.equal(forbidden.stdout, '');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-plugin-'));
  try {
    const shortcut = path.join(dir, 'link');
    fs.symlinkSync(dir, shortcut);
    const denied = spawnSync(process.execPath, [script], {
      cwd:root,encoding:'utf8',env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:shortcut},timeout:5000
    });
    assert.equal(denied.status, 2);
    assert.equal(denied.stdout, '');
    const badEngine=spawnSync(process.execPath,[script],{cwd:folder,encoding:'utf8',
      env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:dir,UCE_ENGINE_ROOT:'../bad-engine'},timeout:5000});
    assert.equal(badEngine.status,2,'relative engine location must be denied');
    assert.equal(badEngine.stdout,'');
    const missingEngine=spawnSync(process.execPath,[script],{cwd:folder,encoding:'utf8',
      env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:dir,UCE_ENGINE_ROOT:path.join(dir,'missing')},timeout:5000});
    assert.equal(missingEngine.status,2,'standalone plugin must require canonical engine checkout');
    assert.equal(missingEngine.stdout,'');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});


test('actual bundled plugin launches canonical UCE MCP, scans without executing source, compares reproducible findings and releases reports', {timeout:180000}, async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(), 'uce-plugin-live-'));
  const project=path.join(dir,'fixture');
  fs.mkdirSync(project);
  const source={name:'uce-plugin-fixture',version:'1.0.0',
    engines:{node:'>=22'},dependencies:{react:'^19.0.0'},
    scripts:{test:'node -e "require(\'fs\').writeFileSync(\'untrusted-executed\', \'NO\')"'}};
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify(source));
  fs.writeFileSync(path.join(project,'.nvmrc'),'20.0.0\n');
  const original=fs.readdirSync(project).sort();
  const cliPath=path.join(dir,'canonical-report.json');
  const cli=spawnSync(process.execPath,[path.join(root,'scripts/uce-scan.mjs'),
    project,'--output='+cliPath],{cwd:root,encoding:'utf8',timeout:45000});
  assert.equal(cli.status,0,cli.stderr.slice(-1300));
  const originalReport=JSON.parse(fs.readFileSync(cliPath,'utf8'));
  const pluginScript=path.join(folder,'bin/launch.mjs');
  const child=spawn(process.execPath,['./bin/launch.mjs'],{cwd:folder,stdio:['pipe','pipe','pipe'],
    env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:project,UCE_ENGINE_ROOT:root}});
  const lines=createInterface({input:child.stdout});
  const pending=new Map();
  let nextId=0,stderr='',unmatched=[];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',s=>{stderr+=s;});
  lines.on('line',line=>{
    try {
      const response=JSON.parse(line);
      const resolve=pending.get(response.id);
      if(resolve){pending.delete(response.id);resolve(response);}
      else unmatched.push(response);
    } catch(e){unmatched.push(String(e));}
  });
  child.on('exit',(code)=>{
    for(const resolve of pending.values())resolve({error:{code:-32000,message:'plugin exited '+code}});
    pending.clear();
  });
  async function send(method,params={}){
    const id=++nextId;
    const response=await Promise.race([
      new Promise((resolve,reject)=>{
        pending.set(id,resolve);
        child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n',error=>error&&reject(error));
      }),
      new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('plugin MCP call timed out: '+method+' '+stderr.slice(-400))),90000);t.unref();})
    ]);
    assert.equal(response.error,undefined,JSON.stringify(response));
    return response.result;
  }
  async function call(name,args={}){
    const response=await send('tools/call',{name,arguments:args});
    assert.equal(response.isError,false,name+': '+JSON.stringify(response).slice(0,1300));
    return response.structuredContent;
  }
  try{
    assert.equal((await send('initialize',{protocolVersion:'2025-06-18'})).serverInfo.name,'ryzova-uce-mcp');
    const names=(await send('tools/list')).tools.map(t=>t.name);
    for(const name of ['uce_rule_catalog','uce_scan_workspace','uce_rule_summary',
      'uce_get_findings','uce_compare_reports','uce_release_report'])
      assert.ok(names.includes(name),'bundled plugin missing '+name);
    const capabilities=await call('uce_capabilities');
    assert.equal(capabilities.paywall,false);
    assert.equal(capabilities.chatUploadRequired,false);
    const catalog=await call('uce_rule_catalog',{mode:'rules',limit:5});
    assert.ok(catalog.total>0,'real canonical rule catalog missing');
    const scan=await call('uce_scan_workspace',{projectPath:'.'});
    assert.equal(scan.summary.score,originalReport.score.overall,
      'plugin must preserve actual original CLI weighted score');
    assert.equal(scan.summary.originalIssueCount,originalReport.issues.length,
      'plugin must preserve original canonical UCE issue count');
    assert.equal(scan.summary.structuralParity.score,'preserved');
    assert.equal(scan.summary.structuralParity.issues,'preserved');
    assert.equal(scan.summary.humanAccuracy,'not-measured');
    assert.equal(scan.summary.nativeTrilogyExecuted,false);
    const pages=[];
    let offset=0;
    for(let page=0;page<100;page++){
      const answer=await call('uce_get_findings',{reportId:scan.reportId,offset,limit:7});
      pages.push(...answer.items);
      offset+=answer.items.length;
      if(!answer.hasMore)break;
      assert.ok(answer.items.length>0,'pagination must advance');
    }
    assert.equal(pages.length,scan.summary.evaluatedFindings,'all findings pages should be reachable');
    const repeated=await call('uce_scan_workspace',{projectPath:'.'});
    const diff=await call('uce_compare_reports',{beforeReportId:scan.reportId,afterReportId:repeated.reportId});
    assert.equal(diff.sameEngineVersion,true);
    assert.equal(diff.sameNormalizedFindings,true);
    assert.equal(diff.scoreDelta,0);
    await call('uce_release_report',{reportId:scan.reportId});
    await call('uce_release_report',{reportId:repeated.reportId});
    assert.deepEqual(fs.readdirSync(project).sort(),original,
      'plugin must not mutate or execute untrusted scanned project');
    assert.equal(fs.existsSync(path.join(project,'untrusted-executed')),false);
    assert.deepEqual(unmatched,[],'stdio protocol must not emit unsolicited text');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);setTimeout(resolve,2000).unref();});
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
