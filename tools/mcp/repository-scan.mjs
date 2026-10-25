#!/usr/bin/env node
/**
 * UCE agent-first public Git repository scan.
 * No chat attachment, ZIP packaging or upload quota required.
 * No checked-out project code is executed. Git transport is HTTPS-only with
 * explicit host allowlist and disabled smudge/hooks/credential helpers.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const uceRoot=fileURLToPath(new URL('../../',import.meta.url));
const DEFAULT_HOSTS=['github.com','gitlab.com','codeberg.org'];
export function parseRepositoryUrl(value,hosts=DEFAULT_HOSTS) {
  if(typeof value!=='string'||value.length>350 || !value)throw Error('Invalid public Git URL');
  let url;
  if(/^[\w.-]+\/[\w.-]+$/.test(value))url=new URL('https://github.com/'+value);
  else url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||url.search||
      !hosts.includes(url.hostname.toLowerCase()) || url.hostname!==url.hostname.toLowerCase()||
      /[\x00-\x1f\\%]/.test(value))
    throw Error('Public Git URL must be HTTPS and on the configured allowed-host list');
  let p=url.pathname;
  if(p.endsWith('.git'))p=p.slice(0,-4);
  if(!/^\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+){1,5}$/.test(p)||
     p.split('/').some(s=>s==='..'||s==='.'))
    throw Error('Git repository path must be canonical owner/project path');
  return {url:url.origin+p+'.git',display:url.hostname+p};
}
export function validatedBudget(value,kind) {
  const limits={maxFiles:[25_000,100_000],maxBytes:[96*1024*1024,512*1024*1024]};
  const pair=limits[kind];
  if(!pair)throw Error('Invalid resource budget');
  if(value===undefined)return pair[0];
  if(!Number.isSafeInteger(value)||value<1||value>pair[1])
    throw Error(kind+' must be a positive integer at or under available machine policy');
  return value;
}
function gitCall(args,cwd,timeout=120_000) {
  const scratchHome=path.join(cwd,'git-home');
  fs.mkdirSync(scratchHome,{recursive:true,mode:0o700});
  const env={PATH:process.env.PATH,LANG:'C',HOME:scratchHome,
    GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
    GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/bin/false',GIT_LFS_SKIP_SMUDGE:'1',
    GIT_OPTIONAL_LOCKS:'0'};
  const flags=['-c','protocol.allow=never','-c','protocol.https.allow=always',
    '-c','http.followRedirects=false','-c','credential.helper=',
    '-c','core.hooksPath=/dev/null','-c','filter.lfs.process=',
    '-c','filter.lfs.smudge=','-c','filter.lfs.required=false',
    '-c','submodule.recurse=false'];
  const r=spawnSync('git',[...flags,...args],{cwd,env,encoding:'utf8',
    stdio:['ignore','pipe','pipe'],timeout,maxBuffer:1024*1024,shell:false,
    killSignal:'SIGKILL'});
  if(r.error||r.status!==0)throw Error('Public Git fetch/checkout failed within safety policy');
  return r.stdout.trim();
}
function runScan(projectDir,reportPath,maxFiles,maxBytes) {
  const args=[path.join(uceRoot,'scripts/uce-scan.mjs'),projectDir,
    '--output='+reportPath,'--max-files='+maxFiles,'--max-bytes='+maxBytes];
  const r=spawnSync(process.execPath,args,{
    cwd:uceRoot,stdio:['ignore','pipe','pipe'],encoding:'utf8',
    timeout:180000,maxBuffer:2*1024*1024,shell:false,killSignal:'SIGKILL'});
  if(r.error||r.status!==0)throw Error('Trusted UCE scan failed or exceeded execution budget');
  return JSON.parse(r.stdout);
}
export function scanRemoteRepository(args,reportPath) {
  const hosts=(process.env.UCE_MCP_GIT_HOSTS??DEFAULT_HOSTS.join(','))
    .split(',').map(x=>x.trim()).filter(x=>x&&/^[a-z0-9.-]+$/.test(x));
  const source=parseRepositoryUrl(args.repository,hosts);
  const ref=args.ref;
  if(ref!==undefined&&
    (typeof ref!=='string'||ref.length>120||
     !/^(?:[a-f0-9]{40}|[A-Za-z0-9][A-Za-z0-9._/-]{0,119})$/.test(ref)||
     ref.includes('..')||ref.startsWith('-')||ref.endsWith('/')||
     ref.split('/').some(x=>x==='.'||x==='..')))
    throw Error('Invalid Git branch/tag/commit');
  const files=validatedBudget(args.maxFiles,'maxFiles');
  const bytes=validatedBudget(args.maxBytes,'maxBytes');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-git-'));
  try {
    const dir=path.join(tmp,'project');
    fs.mkdirSync(dir,{mode:0o700});
    gitCall(['init','--quiet',dir],tmp);
    // Ref may be full SHA (where the provider permits a direct fetch).
    const fetchArgs=['-C',dir,'fetch','--quiet','--depth=1','--no-tags',
      source.url,...(ref?[ref]:['HEAD'])];
    gitCall(fetchArgs,tmp);
    gitCall(['-C',dir,'checkout','--quiet','--detach','FETCH_HEAD'],tmp);
    const commit=gitCall(['-C',dir,'rev-parse','HEAD'],tmp);
    if(ref&&/^[a-f0-9]{40}$/.test(ref)&&commit!==ref)
      throw Error('Git commit integrity check failed');
    const result=runScan(dir,reportPath,files,bytes);
    return {source:{type:'public-git-repository',repository:source.display,
      commit,requestedRef:ref??'HEAD',reproducibleCommit:true},
      coverage:{filesFound:result.filesFound,filesAnalyzed:result.filesAnalyzed,
        truncated:result.truncated,maxFiles:files,maxBytes:bytes},
      reportSha256:createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex')};
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
export function scanLocalProject(dir,reportPath,args={}) {
  const files=validatedBudget(args.maxFiles,'maxFiles');
  const bytes=validatedBudget(args.maxBytes,'maxBytes');
  const summary=runScan(dir,reportPath,files,bytes);
  return {source:{type:'authorized-local-checkout',
      label:path.basename(dir),commit:null,reproducibleCommit:false},
    coverage:{filesFound:summary.filesFound,filesAnalyzed:summary.filesAnalyzed,
      truncated:summary.truncated,maxFiles:files,maxBytes:bytes},
    reportSha256:createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex')};
}
