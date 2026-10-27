#!/usr/bin/env node
/**
 * Public-repository source-only Phase 1 pilot.
 * Reads a pinned checkout and its precomputed unmodified UCE report, re-derives
 * T2/T4 source evidence from a bounded inventory, NEVER executes target code.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {load} from '../../scripts/trusted-module-loader.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {fuseAccuracyEvidence} from '../trilogy-t4/fusion.mjs';
import {validatePublicPilotRegistry,summarizePilot} from './protocol.mjs';

const ignored=new Set(['.git','node_modules','dist','build','coverage','vendor','.next','.nuxt','.cache','.venv','target']);
const textSource=/(?:\.(?:[cm]?[jt]sx?|json|py|rs|toml|ya?ml|html?|css|md)|(?:^|\/)(?:Dockerfile|\.nvmrc|\.node-version|\.python-version))$/i;
const validPath=s=>s.length<=512&&/^[a-zA-Z0-9_.@/-]+$/.test(s)&&
 !s.startsWith('/')&&s.split('/').every(x=>x&&x!=='.'&&x!=='..');
const MAX_ALL_FILES=25000,MAX_SELECTED=5000,MAX_SOURCE_BYTES=4*1024*1024,MAX_FILE_BYTES=256*1024;
const options=new Map();
for(const item of process.argv.slice(2)){
 const m=/^--(registry|case|checkout|uce-report|output)=(.+)$/.exec(item);
 if(!m||options.has(m[1]))throw Error('Phase1 invalid or duplicate CLI option');
 options.set(m[1],m[2]);
}
for(const key of ['registry','case','checkout','uce-report','output'])
 if(!options.has(key))throw Error('Phase1 requires --'+key);
const readJson=file=>{
 const s=fs.statSync(file);
 if(!s.isFile()||s.size>6*1024*1024)throw Error('Phase1 bounded JSON file required');
 return JSON.parse(fs.readFileSync(file,'utf8'));
};
const registry=readJson(options.get('registry'));
const records=validatePublicPilotRegistry(registry);
const entry=records.find(x=>x.id===options.get('case'));
if(!entry)throw Error('Phase1 unregistered case');
const checkout=path.resolve(options.get('checkout'));
if(!fs.statSync(checkout).isDirectory())throw Error('Phase1 source checkout absent');
const observedHead=execFileSync('git',['-C',checkout,'rev-parse','--verify','HEAD'],
 {encoding:'utf8',timeout:7000,stdio:['ignore','pipe','pipe']}).trim();
if(observedHead!==entry.commitSha)throw Error('Phase1 checkout does not match frozen SHA');
const report=readJson(options.get('uce-report'));
const original=JSON.stringify(report);
const files=[],nonSourceFiles=[];
let seen=0;
function collect(absolute,relative){
 const rows=fs.readdirSync(absolute,{withFileTypes:true});
 rows.sort((a,b)=>a.name.localeCompare(b.name,'en'));
 for(const row of rows){
  if(ignored.has(row.name)||row.isSymbolicLink())continue;
  const rel=relative?relative+'/'+row.name:row.name;
  if(row.isDirectory())collect(path.join(absolute,row.name),rel);
  else if(row.isFile()){
   seen++;
   if(seen>MAX_ALL_FILES)throw Error('Phase1 file inventory exceeds bounded scan scope');
   if(textSource.test(rel)&&validPath(rel))files.push({
     path:rel,absolute:path.join(absolute,row.name),size:fs.statSync(path.join(absolute,row.name)).size});
   else nonSourceFiles.push(rel);
  }
 }
}
collect(checkout,'');
files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const selected=files.slice(0,MAX_SELECTED);
let availableSourceBytes=0,unreadableSelectedFiles=0;
const inventory=selected.map(f=>{
 let content;
 if(f.size<=MAX_FILE_BYTES&&availableSourceBytes+f.size<=MAX_SOURCE_BYTES){
  content=fs.readFileSync(f.absolute,'utf8');
  availableSourceBytes+=Buffer.byteLength(content);
 }else unreadableSelectedFiles++;
 return {path:f.path,size:f.size,isDirectory:false,content};
});
const graph=buildWholeProjectGraph(report,inventory,{inventoryComplete:false});
const fusion=fuseAccuracyEvidence(report,inventory,{
 inventoryComplete:false,expectedInventorySha256:graph.suppliedInventorySha256});
if(JSON.stringify(report)!==original)throw Error('Phase1 mutated canonical report');
const artifact=summarizePilot(entry,observedHead,report,graph,fusion,{
 selectedFiles:inventory.length,availableSourceBytes,unreadableSelectedFiles,
 unselectedOrOverBudgetFiles:nonSourceFiles.length+files.length-selected.length+unreadableSelectedFiles,
});
artifact.inventory.repoFilesSeen=seen;
artifact.inventory.selectedSourceFilesTruncated=files.length>MAX_SELECTED;
artifact.uce.reportSelfDescribedScopeOnly=true;
const target=path.resolve(options.get('output'));
fs.writeFileSync(target,JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({caseId:artifact.caseId,pinnedGitCommit:observedHead,
 originalUCEIssues:artifact.uce.originalIssueCount,sourceCandidates:artifact.trilogy.candidateObservations,
 hasIndependentAccuracy:false,reportFile:target}));
