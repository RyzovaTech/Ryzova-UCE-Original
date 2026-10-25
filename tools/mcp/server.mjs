#!/usr/bin/env node
/**
 * RYZOVA UCE MCP V1 — local stdio only. The model is not trusted as a shell,
 * path resolver, or permission system. Users must explicitly select a root.
 *
 * MCP 2025-06-18 JSON-RPC 2.0 newline-delimited messages; stdout is protocol
 * only. No HTTP listener, cloud uploads, native Trilogy or patch apply.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const rootArg = process.argv.find(a => a.startsWith('--root='))?.slice(7);
if (!rootArg || !path.isAbsolute(rootArg)) {
  process.stderr.write('UCE MCP: supply explicit absolute --root=<authorized local directory>\n');
  process.exit(2);
}
let root;
try {
  if (fs.lstatSync(rootArg).isSymbolicLink()) throw Error('symlink root refused');
  root = fs.realpathSync(rootArg);
  if (!fs.statSync(root).isDirectory()) throw Error('not a directory');
} catch {
  process.stderr.write('UCE MCP: authorized root must exist and be a non-symlink directory\n');
  process.exit(2);
}

const protocol = '2025-06-18';
const MAX_LINE = 64 * 1024;
let initialized = false;
function resolveAuthorized(relative, kind) {
  if (typeof relative !== 'string' || relative.length > 256 || !relative ||
      relative.includes('\\') || relative.includes('\0') ||
      path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative))
    throw Error('Invalid relative path; only authorized local paths are accepted.');
  const parts = relative === '.' ? [] : relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..'))
    throw Error('Path traversal and empty components are refused.');
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Symlinks are not allowed.');
  }
  const full = fs.realpathSync(cursor);
  if (full !== root && !full.startsWith(root + path.sep))
    throw Error('Requested path escapes authorized root.');
  const info = fs.statSync(full);
  if (kind === 'dir' && !info.isDirectory()) throw Error('Expected a project directory.');
  if (kind === 'file' && !info.isFile()) throw Error('Expected an existing report file.');
  if (kind === 'file' && (info.size > 8 * 1024 * 1024 || !full.endsWith('.json')))
    throw Error('Report must be a JSON file of at most 8 MiB.');
  return full;
}
const tools = [
  { name:'uce_scan_project', title:'Analyze local project with UCE',
    description:'Read-only bounded UCE analysis of a project underneath the explicitly authorized root. Runs only the trusted UCE scanner, not project scripts. Returns score, issues, Root Cause clusters, evidence and honest Unknown status; no native Trilogy.',
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
    inputSchema:{type:'object',additionalProperties:false,
      properties:{projectPath:{type:'string',description:'Relative path inside authorized root; use "." for root itself',minLength:1,maxLength:256},
        maxIssues:{type:'integer',minimum:1,maximum:30,description:'Maximum summary issues (default 12)'}},
      required:['projectPath']}},
  { name:'uce_inspect_report',title:'Inspect saved UCE report',
    description:'Read-only structural parity, evidence and Root Cause inspection of a saved UCE JSON report inside the authorized root. No accuracy claim and no solver run.',
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
    inputSchema:{type:'object',additionalProperties:false,
      properties:{reportPath:{type:'string',minLength:1,maxLength:256,description:'Relative path to a saved UCE JSON report'},
        maxIssues:{type:'integer',minimum:1,maximum:30}},required:['reportPath']}},
  { name:'uce_capabilities',title:'UCE MCP capabilities',
    description:'Inspect local tool limits, consent and safety boundary; performs no file scan.',
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
    inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
function boundedCount(value) {
  if (value === undefined) return 12;
  if (!Number.isInteger(value) || value < 1 || value > 30) throw Error('maxIssues must be an integer from 1 to 30');
  return value;
}
function runTrusted(script,args,timeout) {
  const result = spawnSync(process.execPath,[path.join(repoRoot,script),...args],{
    cwd:repoRoot,encoding:'utf8',timeout,killSignal:'SIGKILL',
    maxBuffer:1024*1024,stdio:['ignore','pipe','pipe'],shell:false,
    env:{...process.env,NO_COLOR:'1'}
  });
  if (result.error || result.status !== 0) throw Error(
    result.error?.code === 'ETIMEDOUT' ? 'Trusted UCE analysis timed out.' :
    'Trusted UCE scanner could not complete within its safety limits.');
  return result.stdout;
}
function inspect(reportPath,maxIssues) {
  let result;
  try { result=JSON.parse(runTrusted('tools/mcp/report-worker.mjs',[reportPath,String(maxIssues)],20000)); }
  catch(e) {
    if(e instanceof SyntaxError) throw Error('UCE analysis output is not valid bounded JSON.');
    throw e;
  }
  return result;
}
function scan(args) {
  const target=resolveAuthorized(args.projectPath,'dir');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-'));
  try {
    const reportPath=path.join(tmp,'report.json');
    runTrusted('scripts/uce-scan.mjs',[target,'--output='+reportPath,
      '--max-files=4000','--max-bytes=16777216'],60000);
    if(fs.statSync(reportPath).size>8*1024*1024)
      throw Error('Scanner report exceeds the MCP 8 MiB limit.');
    return inspect(reportPath,boundedCount(args.maxIssues));
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
}
function capabilities() {
  return {server:'ryzova-uce-mcp',version:'0.1.0',mode:'local-stdio-only',
    workspace:'explicit-root-only',tools:['uce_scan_project','uce_inspect_report','uce_capabilities'],
    limits:{files:4000,contentBytes:16777216,reportBytes:8*1024*1024,
      maxIssues:30,scanTimeoutMs:60000},
    permissions:{networkListener:false,sourceUpload:false,projectCodeExecution:false,
      nativeTrilogy:false,patchApply:false,scoringChanges:false},
    caveats:['No OS-enforced memory cap; process timeout and input budgets are software limits.',
      'Structural findings are not independently human adjudicated or runtime-proven.',
      'Run only for trusted local projects under a consciously chosen authorized root.']};
}
function respond(message) { process.stdout.write(JSON.stringify(message)+'\n'); }
function error(id,code,message) { respond({jsonrpc:'2.0',id,error:{code,message}}); }
function handle(req) {
  const id=req && typeof req==='object' && Object.hasOwn(req,'id') ? req.id : undefined;
  if (!req || typeof req!=='object' || Array.isArray(req) || req.jsonrpc!=='2.0' ||
      typeof req.method!=='string' || (id!==undefined && !(typeof id==='string'||typeof id==='number'||id===null))) {
    error(null,-32600,'Invalid JSON-RPC request.'); return;
  }
  if (id === undefined) return; // notifications including notifications/initialized
  if (req.method==='initialize') {
    initialized=true;
    const version=['2025-06-18','2024-11-05'].includes(req.params?.protocolVersion)
      ? req.params.protocolVersion : protocol;
    respond({jsonrpc:'2.0',id,result:{protocolVersion:version,
      capabilities:{tools:{listChanged:false}},
      serverInfo:{name:'ryzova-uce-mcp',version:'0.1.0'}}});return;
  }
  if (req.method==='ping') {respond({jsonrpc:'2.0',id,result:{}});return;}
  if (!initialized) {error(id,-32000,'Initialize MCP before calling tools.');return;}
  if(req.method==='tools/list'){
    if(req.params?.cursor) {error(id,-32602,'Unexpected tools pagination cursor.');return;}
    respond({jsonrpc:'2.0',id,result:{tools}});return;
  }
  if(req.method==='tools/call'){
    const name=req.params?.name, args=req.params?.arguments??{};
    if(!tools.some(t=>t.name===name)){error(id,-32602,'Unknown UCE tool.');return;}
    if(!args || typeof args!=='object'||Array.isArray(args)){
      error(id,-32602,'Tool arguments must be an object.');return;
    }
    const allowed = name==='uce_scan_project'?['projectPath','maxIssues']:
      name==='uce_inspect_report'?['reportPath','maxIssues']:[];
    if(Object.keys(args).some(key=>!allowed.includes(key))){
      error(id,-32602,'Unexpected tool argument.');return;
    }
    try {
      const result=name==='uce_capabilities'?capabilities():
        name==='uce_scan_project'?scan(args):
        inspect(resolveAuthorized(args.reportPath,'file'),boundedCount(args.maxIssues));
      respond({jsonrpc:'2.0',id,result:{
        content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false}});
    }catch(e){
      // Avoid disclosing absolute paths, private source, environment variables,
      // command output and stack traces to an untrusted MCP client.
      const safe = typeof e?.message==='string' &&
        /^(Invalid relative|Path traversal|Symlinks|Requested path escapes|Expected |Report must|Scanner report exceeds|maxIssues must|Trusted UCE|UCE analysis output)/.test(e.message)
        ? e.message : 'UCE read-only inspection failed; check the authorized root and source limits.';
      respond({jsonrpc:'2.0',id,result:{content:[{type:'text',text:safe}],isError:true}});
    }return;
  }
  error(id,-32601,'MCP method not implemented.');
}
let buffer=Buffer.alloc(0),discard=false;
process.stdin.on('data',chunk=>{
  buffer=Buffer.concat([buffer,chunk]);
  while(true){
    const next=buffer.indexOf(10);
    if(next<0){if(buffer.length>MAX_LINE){discard=true;buffer=Buffer.alloc(0);error(null,-32700,'MCP input exceeds 64 KiB.');}break;}
    const line=buffer.subarray(0,next),rem=buffer.subarray(next+1);buffer=rem;
    if(discard){discard=false;continue;}
    if(line.length>MAX_LINE){error(null,-32700,'MCP input exceeds 64 KiB.');continue;}
    if(!line.length) continue;
    try{handle(JSON.parse(line.toString('utf8')));}
    catch{error(null,-32700,'Malformed MCP JSON message.');}
  }
});
