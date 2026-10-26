import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {verifyNativeTrilogy} from './native.mjs';
import {buildWholeProjectGraph} from '../trilogy-t2/graph.mjs';
import {load} from '../../scripts/trusted-module-loader.mjs';

const {analyzeProject}=load('src/lib/analyzer/analyzer.ts');
const file=(path,content)=>({path,content,isDirectory:false,size:Buffer.byteLength(content)});
const files=()=>[
 file('package.json',JSON.stringify({name:'fixture',engines:{node:'>=18'},
  dependencies:{alpha:'^1.0.0'}})),
 file('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{
  '':{name:'fixture',version:'1.0.0',dependencies:{alpha:'^1.0.0'}},
  'node_modules/alpha':{version:'1.1.0',engines:{node:'>=22'},
   dependencies:{beta:'^2.0.0'}},
  'node_modules/beta':{version:'2.1.0',engines:{node:'<21'}},
 }})),
 file('src/index.ts','export const ready = true;'),
];
function fixture(){
 const f=files();return {f,report:analyzeProject({
 fileName:'native-fixture',source:'upload',files:f,scanStats:{
 projectSize:f.reduce((n,x)=>n+x.size,0),filesFound:f.length,
 filesAnalyzed:f.length,filesIgnored:0,ignoredCategories:[]}})};
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const opts=(r,f)=>({
 enabled:true,nativeSolvers:true,inventoryComplete:true,
 expectedInventorySha256:buildWholeProjectGraph(r,f,{inventoryComplete:true}).suppliedInventorySha256,
 cgroupRoot:'/tmp',memoryMiB:512,wallMs:20000,
 binaries:{
 souffle:{path:process.execPath,sha256:'a'.repeat(64)},
 z3:{path:process.execPath,sha256:'a'.repeat(64)},
 cvc5:{path:process.execPath,sha256:'a'.repeat(64)},
 },
});
test('default and partial authorizations never spawn native solvers',async()=>{
 const {f,report:r}=fixture();
 for(const opt of [{}, {enabled:true}, {enabled:true,nativeSolvers:true},
  {enabled:true,nativeSolvers:true,inventoryComplete:true,cgroupRoot:'/tmp'}]){
  const x=await verifyNativeTrilogy(r,f,opt);
  assert.equal(x.status,'unknown');
  assert.equal(x.nativeSolversAttempted,false);
  assert.equal(x.originalCoreScore, r.score.overall);
  assert.equal(x.automaticFixAllowed,false);
 }
});
test('Windows or unsupported host fail closed before kernel/process work',async()=>{
 const {f,report:r}=fixture(),x=await verifyNativeTrilogy(r,f,opts(r,f));
 if(process.platform!=='linux')
  assert.equal(x.reason,'linux-hard-cgroup-required-windows-job-object-unimplemented');
 assert.equal(x.status,'unknown');
 assert.equal(x.nativeSolversAttempted,false);
});
test('source SHA mismatch prevents binary preflight and native execution',async()=>{
 const {f,report:r}=fixture();
 const x=await verifyNativeTrilogy(r,f,{...opts(r,f),
  expectedInventorySha256:'0'.repeat(64)});
 assert.equal(x.reason,process.platform==='linux'?'pinned-source-inventory-sha256-mismatch':
  'linux-hard-cgroup-required-windows-job-object-unimplemented');
 assert.equal(x.nativeSolversAttempted,false);
});
test('corrupted executable digest is not treated as trusted solver',async()=>{
 const {f,report:r}=fixture();
 const x=await verifyNativeTrilogy(r,f,opts(r,f));
 if(process.platform==='linux')assert.equal(x.reason,'native-binary-provenance-unverified');
 assert.equal(x.nativeSolversAttempted,false);
});
test('a fake ordinary filesystem cgroup is rejected even with trusted binary digest',async()=>{
 const {f,report:r}=fixture();
 const b=await readFile(process.execPath),digest=sha(b);
 const options=opts(r,f);
 for(const name of Object.keys(options.binaries))
  options.binaries[name].sha256=digest;
 const x=await verifyNativeTrilogy(r,f,options);
 assert.equal(x.status,'unknown');
 assert.equal(x.nativeSolversAttempted,false);
 if(process.platform==='linux')assert.match(x.reason,/cgroup-root-outside-kernel-mount/);
});
test('partial canonical scan blocks native solver even with supplied source digest',async()=>{
 const {f,report:r}=fixture();
 r.summary.scanStats.truncated=true;
 const x=await verifyNativeTrilogy(r,f,opts(r,f));
 assert.equal(x.status,'unknown');
 assert.equal(x.nativeSolversAttempted,false);
});
test('source inputs invalid/traversal/ambiguous cannot grant native authority',async()=>{
 const {f,report:r}=fixture();
 for(const selected of [[...f,f[0]],[
  ...f,{path:'../secret',content:'x'},
 ],[...f.slice(1)]]){
  const x=await verifyNativeTrilogy(r,selected,opts(r,f));
  assert.equal(x.status,'unknown');
  assert.equal(x.nativeSolversAttempted,false);
 }
});
test('no T3B response ever claims build/runtime success or patch safety',async()=>{
 const {f,report:r}=fixture();
 const before=JSON.stringify(r),x=await verifyNativeTrilogy(r,f,opts(r,f));
 assert.equal(JSON.stringify(r),before);
 assert.equal(x.actualBuildOrRuntimeVerified,false);
 assert.equal(x.issueCorrectnessVerified,false);
 assert.equal(x.securityVulnerabilityVerified,false);
 assert.equal(x.accuracyMetrics,null);
 assert.equal(x.automaticFixAllowed,false);
});
test('native worker invoked directly on an unisolated process refuses solver execution',()=>{
 const worker=new URL('./native-worker.mjs',import.meta.url);
 const run=spawnSync(process.execPath,[worker.pathname],{
  input:'{}',encoding:'utf8',timeout:10000,maxBuffer:16384});
 assert.equal(run.status,0);
 assert.equal(JSON.parse(run.stdout).reason,'kernel-native-isolation-unattested');
});
test('strict controller refuses symlink/unwritable and nonexistent delegated root',async()=>{
 const {f,report:r}=fixture();
 const opt=opts(r,f);
 for(const name of Object.keys(opt.binaries))opt.binaries[name].sha256=sha(await readFile(process.execPath));
 opt.cgroupRoot='/sys/fs/cgroup/not-a-delegated-root-987abc';
 const x=await verifyNativeTrilogy(r,f,opt);
 assert.equal(x.status,'unknown');
 assert.equal(x.nativeSolversAttempted,false);
});
test('real native Souffle/Z3/cvc5 conflict fixture under delegated strict cgroup', {
 skip:process.platform!=='linux'||!process.env.TRILOGY_T3B_CGROUP_ROOT||
  !process.env.TRILOGY_T3B_SOUFFLE||
  !process.env.TRILOGY_T3B_Z3||
  !process.env.TRILOGY_T3B_CVC5,
 timeout:60000,
},async()=>{
 const {f,report:r}=fixture();
 const opt=opts(r,f);
 opt.cgroupRoot=process.env.TRILOGY_T3B_CGROUP_ROOT;
 for(const [key,env] of [['souffle','TRILOGY_T3B_SOUFFLE'],
  ['z3','TRILOGY_T3B_Z3'],['cvc5','TRILOGY_T3B_CVC5']]){
   const p=process.env[env];
   opt.binaries[key]={path:p,sha256:sha(await readFile(p))};
 }
 const result=await verifyNativeTrilogy(r,f,opt);
 assert.equal(result.status,'modeled-conflict',JSON.stringify(result));
 assert.equal(result.strictProcessTreeIsolation,'enforced');
 assert.ok(['souffle','z3','cvc5'].every(k=>result.stages[k]==='succeeded'));
 assert.equal(result.nativeSolversAttempted,true);
 assert.equal(result.actualBuildOrRuntimeVerified,false);
 assert.equal(result.sourceSnapshotAuthenticated,false);
 assert.equal(result.automaticFixAllowed,false);
 assert.equal(result.hardOomKills,0);
});
