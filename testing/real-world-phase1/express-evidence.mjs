#!/usr/bin/env node
/**
 * Read-only Express pilot follow-up. Published fields are UNVERIFIED UCE
 * report metadata and cryptographically pinned source-file presence only.
 * Target project source is NEVER evaluated, imported, built or executed.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=x=>createHash('sha256').update(x).digest('hex');
const GIT_SHA=/^[0-9a-f]{40}$/;
const SAFE=/^[A-Za-z0-9_.@/-]{1,512}$/;
const opts=new Map();
for(const arg of process.argv.slice(2)){
 const m=/^--(report|checkout|sha|output)=(.+)$/.exec(arg);
 if(!m||opts.has(m[1]))throw Error('Express study invalid or duplicate argument');
 opts.set(m[1],m[2]);
}
for(const k of ['report','checkout','sha','output'])
 if(!opts.has(k))throw Error('Express study requires --'+k);
if(!GIT_SHA.test(opts.get('sha')))throw Error('Express study requires immutable commit SHA');
const checkout=path.resolve(opts.get('checkout'));
const reportFile=path.resolve(opts.get('report'));
const target=path.resolve(opts.get('output'));
if(!fs.statSync(checkout).isDirectory()||fs.statSync(reportFile).size>5*1024*1024)
 throw Error('Express study input budget exceeded');
const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
if(!report||!Array.isArray(report.issues)||report.issues.length>5000||
 !Number.isFinite(report.score?.overall))
 throw Error('Express study malformed original report');
const env={...process.env,GIT_NO_LAZY_FETCH:'1',GIT_ALLOW_PROTOCOL:'',
 GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',
 GIT_CONFIG_GLOBAL:os.devNull,GIT_TERMINAL_PROMPT:'0'};
for(const k of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR',
 'GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES',
 'GIT_CONFIG_COUNT','GIT_CONFIG_PARAMETERS'])delete env[k];
function git(args){
 return execFileSync('git',['--no-optional-locks','-C',checkout,...args],
  {env,encoding:'buffer',timeout:7000,maxBuffer:1024*1024,
   stdio:['ignore','pipe','pipe']});
}
const head=git(['rev-parse','--verify','HEAD']).toString().trim();
if(head!==opts.get('sha'))throw Error('Express study wrong source revision');
const known=new Set(),rows=[];
const repo='expressjs/express';
for(const issue of report.issues){
 if(!issue||typeof issue.id!=='string'||issue.id.length<1||issue.id.length>256||
 known.has(issue.id))throw Error('Express study duplicate/invalid finding');
 known.add(issue.id);
 const raw=issue.affectedFile;
 const match=typeof raw==='string'&&/^(.+?)(?::(\d+)|#L(\d+))?$/.exec(raw);
 const sourcePath=match?.[1];
 let status='not-source-pinned',sourceSha256=null,sourceUrl=null;
 if(typeof sourcePath==='string'&&SAFE.test(sourcePath)&&
   !sourcePath.startsWith('/')&&sourcePath.split('/').every(x=>x&&x!=='.'&&x!=='..')){
  // Cross-check checkout bytes with the exact immutable Git blob; never read links.
  try {
   let cursor=checkout,blocked=false;
   for(const part of sourcePath.split('/')){
    cursor=path.join(cursor,part);
    if(fs.lstatSync(cursor).isSymbolicLink()){blocked=true;break}
   }
   if(!blocked){
    const stat=fs.statSync(cursor);
    if(stat.isFile()&&stat.size<=256*1024){
     const local=fs.readFileSync(cursor);
     const pinned=git(['show',head+':'+sourcePath]);
     if(local.equals(pinned)){
      status='pinned-file-bytes-match';
      sourceSha256=sha(local);
      sourceUrl='https://github.com/'+repo+'/blob/'+head+'/'+
       sourcePath.split('/').map(encodeURIComponent).join('/')+
       (match[2]||match[3]?'#L'+(match[2]||match[3]):'');
     } else status='checkout-does-not-match-pinned-blob';
    }else status='source-file-over-budget-or-nonregular';
   } else status='symlink-excluded';
  } catch {status='source-file-not-verified'}
 }
 rows.push({
  idSha256:sha(Buffer.from(issue.id)),
  // Titles describe a detector signal, not a proven defect.
  reportedTitle:typeof issue.title==='string'?
   issue.title.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,160):null,
  severity:['critical','warning','info'].includes(issue.severity)?issue.severity:'unknown',
  category:typeof issue.category==='string'?issue.category.slice(0,60):'unknown',
  sourceStatus:status,sourceUrl,sourceSha256,
  independentlyConfirmedDefect:false,verifiedIssueCorrectness:false,
 });
}
const artifact={
 schemaVersion:1,study:'Express-unreviewed-source-evidence-follow-up',
 pinnedRepository:repo,pinnedCommit:head,
 originalUCEReportedScore:report.score.overall,
 originalUCEIssueCount:report.issues.length,
 issueSeverityCounts:Object.fromEntries(['critical','warning','info'].map(s=>
  [s,report.issues.filter(i=>i.severity===s).length])),
 sourceLinkedFindingCount:rows.filter(x=>x.sourceStatus==='pinned-file-bytes-match').length,
 reportDoesNotContainIndependentHumanGroundTruth:true,
 allSourceLinksAreGitCommitPinned:true,
 originalReportMutated:false, 
 independentlyConfirmedDefectCount:0,independentRealWorldAccuracy:null,
 measuredUCEvsTrilogyImprovement:null,releaseReady:false,
 note:'Git object presence verifies file bytes only, never the correctness of any compatibility finding. Source missing/over budget and unknown are not negative evidence. Do not call any issue a proven upstream bug.',
 findings:rows,
};
fs.writeFileSync(target,JSON.stringify(artifact,null,2)+'\n',
 {flag:'wx',mode:0o600});
console.log(JSON.stringify({pinnedCommit:head,score:artifact.originalUCEReportedScore,
 issues:rows.length,sourceLinked:artifact.sourceLinkedFindingCount,
 verifiedDefects:0,independentAccuracy:null}));
