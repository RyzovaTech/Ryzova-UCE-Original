import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const cli=fileURLToPath(new URL('./run.mjs',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
function study(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t7-paired-source-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const repo=path.join(dir,'repo');fs.mkdirSync(repo);
 const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
 git('init','-q');
 const source=Buffer.from('export const support = true;\n');
 fs.writeFileSync(path.join(repo,'rule.js'),source);
 git('add','rule.js');
 git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid',
  'commit','-qm','immutable fixture');
 const commitSha=git('rev-parse','HEAD'),treeSha=git('rev-parse','HEAD^{tree}');
 const blobSha=git('rev-parse','HEAD:rule.js'),sourceEvidenceSha256=hash(source);
 const id='case-1',studyId='t7-test-no-humans';
 const manifest={schemaVersion:1,studyId,protocolSha256:'a'.repeat(64),
  samplingFrameSha256:'b'.repeat(64),cases:[{
   id,repositoryAlias:'local-fixture',commitSha,sourceEvidenceSha256,
   domain:'runtime',severity:'warning',ecosystem:'js-ts'}]};
 const reviewer=(alias)=>({reviewerAlias:alias,blindToPredictions:true,
  decision:'positive',evidenceSha256:'c'.repeat(64),rationaleSha256:'d'.repeat(64)});
 const reviews={schemaVersion:1,studyId,cases:[{caseId:id,
  reviewers:[reviewer('fixture-first'),reviewer('fixture-second')]}]};
 const prediction={caseId:id,decision:'positive',scanComplete:true,
  commitSha,sourceEvidenceSha256};
 const registry={schemaVersion:1,studyId,cases:[{caseId:id,
  repositoryAlias:'local-fixture',repositoryDirectory:repo,
  commitSha,treeSha,blobSha,sourcePath:'rule.js'}]};
 const write=(name,data)=>{
  const file=path.join(dir,name+'.json');fs.writeFileSync(file,JSON.stringify(data));return file;
 };
 const args=[
  '--manifest='+write('manifest',manifest),
  '--reviews='+write('reviews',reviews),
  '--baseline='+write('baseline',[prediction]),
  '--augmented='+write('augmented',[prediction]),
  '--registry='+write('registry',registry)
 ];
 return {dir,args,registry,write};
}
test('CLI verifies the exact local Git object chain and never certifies human truth',t=>{
 const x=study(t);
 const result=spawnSync(process.execPath,[cli,...x.args],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 assert.equal(report.localSourceProvenance.localGitObjectChainsVerified,1);
 assert.equal(report.localSourceProvenance.canCertifyRealWorldAccuracy,false);
 assert.equal(report.independentlyAuthenticatedHumanCases,0);
 assert.equal(report.measuredIndependentRealWorldAccuracy,null);
 assert.equal(report.overallReleaseReady,false);
 assert.equal(result.stdout.includes(x.registry.cases[0].repositoryDirectory),false);
});
test('CLI refuses overwriting the original evaluation evidence',t=>{
 const x=study(t),target=path.join(x.dir,'paired.json');
 const args=[cli,...x.args,'--output='+target];
 const first=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.equal(first.status,0,first.stderr);
 const original=fs.readFileSync(target);
 const second=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.notEqual(second.status,0);
 assert.deepEqual(fs.readFileSync(target),original);
});
test('no real study still yields explicit missing local source preflight',()=>{
 const r=spawnSync(process.execPath,[cli],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const j=JSON.parse(r.stdout);
 assert.equal(j.localSourceProvenance.status,'not-performed');
 assert.equal(j.localSourceProvenance.localGitObjectChainsVerified,0);
 assert.equal(j.measuredIndependentRealWorldAccuracy,null);
});
