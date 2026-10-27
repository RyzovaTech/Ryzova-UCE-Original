/**
 * T7 read-only LOCAL Git object provenance checker. This verifies an exact
 * commit -> tree(s) -> regular-file blob chain and its source SHA-256, never
 * the external authenticity of the Git checkout, reviewers, or case labels.
 * No checkout, hooks, source execution, network access or file modifications.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const SHA1=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const MAX_CASES=2000;
const MAX_OBJECT_BYTES=1024*1024;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const digest=(algorithm,buf)=>createHash(algorithm).update(buf).digest('hex');
const gitDigest=(kind,buf)=>digest('sha1',Buffer.concat([
 Buffer.from(kind+' '+buf.length),Buffer.from([0]),buf]));
function sourcePath(value){
 return typeof value==='string'&&value.length>0&&value.length<=512&&
  !value.startsWith('/')&&!value.includes('\\')&&!/[\u0000-\u001f\u007f]/.test(value)&&
  value.split('/').every(part=>part.length>0&&part!=='.'&&part!=='..')&&
  !value.startsWith(':');
}
function git(repo,args){
 // Isolation from caller-level Git redirection, replaces, global configuration.
 const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',
  GIT_ALLOW_PROTOCOL:'',GIT_CONFIG_NOSYSTEM:'1',
  GIT_CONFIG_GLOBAL:os.devNull,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'};
 for(const k of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG_COUNT',
  'GIT_CONFIG_PARAMETERS'])delete env[k];
 try {
  return execFileSync('git',['--no-optional-locks','-C',repo,'cat-file',...args],
   {env,encoding:'buffer',maxBuffer:MAX_OBJECT_BYTES+8192,timeout:7000,
    stdio:['ignore','pipe','pipe']});
 }catch{
  throw Error('T7 source Git object missing, oversized, invalid or unavailable');
 }
}
function gitObject(repo,type,oid){
 if(!SHA1.test(oid))throw Error('T7 invalid Git object ID');
 const object=git(repo,[type,oid]);
 if(object.length>MAX_OBJECT_BYTES)throw Error('T7 Git object exceeds byte budget');
 if(gitDigest(type,object)!==oid)
  throw Error('T7 Git object digest mismatch (replace/corruption/format)');
 return object;
}
function treeEntry(bytes,target){
 let cursor=0,match=null;
 while(cursor<bytes.length){
  const split=bytes.indexOf(0x20,cursor);
  const end=bytes.indexOf(0,split+1);
  if(split<cursor||end<split||end+21>bytes.length)
   throw Error('T7 malformed Git tree');
  const mode=bytes.toString('ascii',cursor,split);
  const name=bytes.toString('utf8',split+1,end);
  const sha=bytes.subarray(end+1,end+21).toString('hex');
  if(!/^(100644|100755|120000|160000|40000)$/.test(mode))
   throw Error('T7 unsupported Git tree entry mode');
  if(name===target){
   if(match)throw Error('T7 duplicate Git tree names');
   match={mode,sha};
  }
  cursor=end+21;
 }
 return match;
}
function verifyCase(c,s){
 if(!path.isAbsolute(s.repositoryDirectory)||!fs.statSync(s.repositoryDirectory).isDirectory())
  throw Error('T7 source registry repositoryDirectory must be an existing absolute directory');
 const repo=s.repositoryDirectory;
 const commit=gitObject(repo,'commit',c.commitSha);
 const firstLine=commit.toString('utf8').split('\n',1)[0];
 const commitTree=/^tree ([0-9a-f]{40})$/.exec(firstLine);
 if(!commitTree||commitTree[1]!==s.treeSha)
  throw Error('T7 commit root tree SHA mismatch');
 let oid=s.treeSha;
 const parts=s.sourcePath.split('/');
 for(let i=0;i<parts.length;i++){
  const tree=gitObject(repo,'tree',oid);
  const entry=treeEntry(tree,parts[i]);
  if(!entry)throw Error('T7 source path missing from pinned Git commit');
  if(i<parts.length-1){
   if(entry.mode!=='40000')throw Error('T7 source parent is not a Git tree');
   oid=entry.sha;
  }else{
   if(!['100644','100755'].includes(entry.mode))
    throw Error('T7 symlink, submodule or special source not eligible');
   if(entry.sha!==s.blobSha)throw Error('T7 expected Git blob ID mismatch');
   const content=gitObject(repo,'blob',entry.sha);
   if(digest('sha256',content)!==c.sourceEvidenceSha256)
    throw Error('T7 source bytes SHA-256 differs from frozen case');
  }
 }
 return {caseId:c.id,repositoryAlias:c.repositoryAlias,commitSha:c.commitSha,
  rootTreeSha:s.treeSha,blobSha:s.blobSha,sourceEvidenceSha256:c.sourceEvidenceSha256};
}
/** Every manifest case needs exactly one full-file provenance entry. */
export function verifyT7SourceSnapshots(manifest,registry){
 if(!plain(manifest)||manifest.schemaVersion!==1||!ID.test(manifest.studyId??'')||
  !Array.isArray(manifest.cases)||manifest.cases.length>MAX_CASES||
  !plain(registry)||registry.schemaVersion!==1||registry.studyId!==manifest.studyId||
  !Array.isArray(registry.cases)||registry.cases.length!==manifest.cases.length)
  throw Error('T7 source manifest/registry universe mismatch');
 const byCase=new Map();
 for(const c of manifest.cases){
  if(!plain(c)||!ID.test(c.id??'')||byCase.has(c.id)||
   !ID.test(c.repositoryAlias??'')||!SHA1.test(c.commitSha??'')||
   !SHA256.test(c.sourceEvidenceSha256??''))
   throw Error('T7 invalid, duplicate or unpinned manifest case');
  byCase.set(c.id,c);
 }
 const seen=new Set(),records=[];
 for(const s of registry.cases){
  if(!plain(s)||!ID.test(s.caseId??'')||seen.has(s.caseId)||
   !byCase.has(s.caseId)||!ID.test(s.repositoryAlias??'')||
   s.repositoryAlias!==byCase.get(s.caseId).repositoryAlias||
   s.commitSha!==byCase.get(s.caseId).commitSha||
   !SHA1.test(s.treeSha??'')||!SHA1.test(s.blobSha??'')||
   !sourcePath(s.sourcePath)||typeof s.repositoryDirectory!=='string')
   throw Error('T7 source provenance identity, case universe or path mismatch');
  seen.add(s.caseId);
  records.push(verifyCase(byCase.get(s.caseId),s));
 }
 if(seen.size!==byCase.size)throw Error('T7 missing source provenance case');
 records.sort((a,b)=>a.caseId.localeCompare(b.caseId,'en'));
 return {
  schemaVersion:1,phase:'Trilogy-T7-source-provenance',studyId:manifest.studyId,
  frozenCaseUniverseCount:byCase.size,
  manifestSha256:digest('sha256',Buffer.from(JSON.stringify(manifest))),
  localRegistrySha256:digest('sha256',Buffer.from(JSON.stringify(registry))),
  localGitObjectChainsVerified:records.length,
  fullFileSourceSha256Verified:records.length,
  sourceReadOnly:true,caseTruthLabelsExamined:false,sourceFilesExecuted:false,
  localCheckoutTrustedAsExternalAuthority:false,
  independentlyAuthenticatedSourceRevisions:0,
  independentlyAuthenticatedHumanCases:0,
  measuredIndependentRealWorldAccuracy:null,
  overallReleaseReady:false,
  note:'Local Git SHA-1 object-chain and SHA-256 full-file concordance only. Checkout origin, independent sampling and external repository identity require separate audit.',
  cases:records,
 };
}
