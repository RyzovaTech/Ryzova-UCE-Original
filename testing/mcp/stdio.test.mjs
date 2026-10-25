import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=path.join(root,'tools/mcp/server.mjs');
function talk(workspace,requests){
  const input=requests.map(x=>JSON.stringify(x)).join('\n')+'\n';
  const r=spawnSync(process.execPath,[server,'--root='+workspace],{
    cwd:root,encoding:'utf8',input,timeout:120000,maxBuffer:1024*1024});
  assert.equal(r.status,0,'server exited unexpectedly: '+r.stderr.slice(-500));
  assert.equal(r.stderr.trim(),'','server wrote unexpected diagnostics');
  return r.stdout.trim().split('\n').map(JSON.parse);
}
function req(id,method,params){return {jsonrpc:'2.0',id,method,params};}
test('MCP initialization, capabilities, local scan and read-only parity',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-test-'));
  try {
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({
      name:'mcp-test',version:'1.0.0',engines:{node:'>=22'},dependencies:{react:'^19.0.0'}}));
    fs.writeFileSync(path.join(dir,'.nvmrc'),'20.0.0\n');
    const items=talk(dir,[req(1,'initialize',{protocolVersion:'2025-06-18',
      capabilities:{},clientInfo:{name:'test',version:'1'}}),
      req(2,'tools/list',{}),
      req(3,'tools/call',{name:'uce_capabilities',arguments:{}}),
      req(4,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'.'}}),
      req(5,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'../private'}}),
      req(6,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'/etc'}}),
      req(7,'tools/call',{name:'uce_inspect_report',arguments:{reportPath:'../secret.json'}}),
      req(8,'tools/call',{name:'mystery',arguments:{}}),
    ]);
    assert.equal(items.length,8);
    assert.equal(items[0].result.protocolVersion,'2025-06-18');
    assert.ok(['uce_scan_project','uce_inspect_report','uce_capabilities',
      'uce_analyze_text_files','uce_begin_upload','uce_upload_chunk',
      'uce_finish_upload','uce_analyze_upload','uce_delete_upload','uce_upload_status']
      .every(name => items[1].result.tools.some(tool => tool.name === name)));
    assert.equal(items[2].result.structuredContent.permissions.sourceUpload,true);
    assert.equal(items[2].result.structuredContent.paywall,false);
    assert.equal(items[2].result.structuredContent.chatUploadRequired,false);
    assert.ok(items[1].result.tools.some(t=>t.name==='uce_scan_repository'));
    const result=items[3].result.structuredContent;
    assert.equal(result.engine,'UCE');
    assert.equal(result.verification,'not-run');
    assert.equal(result.quality.scoreParity,'preserved');
    assert.equal(result.quality.issueParity,'preserved');
    assert.equal(result.quality.humanAccuracy,'not-measured');
    assert.equal(items[3].result.isError,false);
    for(const ix of [4,5,6])assert.equal(items[ix].result.isError,true);
    assert.equal(items[7].error.code,-32602);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('MCP refuses symlinks, unknown args and malformed input without leakage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-unsafe-'));
 try{
   fs.symlinkSync(os.tmpdir(),path.join(dir,'outside'));
   const messages=talk(dir,[
     req(1,'initialize',{protocolVersion:'2024-11-05'}),
     req(2,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'outside'}}),
     req(3,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'.',command:'rm -rf /'}}),
     req(4,'tools/call',{name:'uce_scan_project',arguments:{projectPath:'.',maxIssues:1000}}),
   ]);
   assert.equal(messages[0].result.protocolVersion,'2024-11-05');
   assert.equal(messages[1].result.isError,true);
   assert.equal(messages[2].error.code,-32602);
   assert.equal(messages[3].result.isError,true);
   const missing=spawnSync(process.execPath,[server],{encoding:'utf8'});
   assert.notEqual(missing.status,0);
   assert.equal(missing.stdout,'');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('MCP inspect saved report with real UCE CLI and reject symlink JSON',()=> {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-saved-'));
  try {
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'sample',version:'1.0.0'}));
    const out=path.join(dir,'saved.json');
    const cli=spawnSync(process.execPath,[path.join(root,'scripts/uce-scan.mjs'),dir,'--output='+out,
      '--max-files=100','--max-bytes=1048576'],{cwd:root,encoding:'utf8',timeout:30000,
      maxBuffer:1024*1024});
    assert.equal(cli.status,0,cli.stderr.slice(-1000));
    const snapshot=createHash('sha256').update(fs.readFileSync(out)).digest('hex');
    const link=path.join(dir,'linked.json');fs.symlinkSync(out,link);
    const msg=talk(dir,[req(1,'initialize',{protocolVersion:'2025-06-18'}),
      req(2,'tools/call',{name:'uce_inspect_report',arguments:{reportPath:'saved.json',maxIssues:2}}),
      req(3,'tools/call',{name:'uce_inspect_report',arguments:{reportPath:'linked.json'}})]);
    assert.equal(msg[1].result.isError,false);
    assert.equal(msg[1].result.structuredContent.quality.issueParity,'preserved');
    assert.equal(msg[1].result.structuredContent.quality.humanAccuracy,'not-measured');
    assert.equal(msg[2].result.isError,true);
    assert.equal(createHash('sha256').update(fs.readFileSync(out)).digest('hex'),snapshot,
      'inspect must not mutate saved original UCE report');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
