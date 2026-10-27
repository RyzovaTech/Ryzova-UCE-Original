import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyT7SourceSnapshots} from './source-provenance.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trilogy-t7-git-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8'}).trim();
 git('init','-q');
 fs.mkdirSync(path.join(dir,'src'));
 fs.writeFileSync(path.join(dir,'src','example.js'),'export const supported = true;\n');
 git('add','src/example.js');
 git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixed fixture');
 const commitSha=git('rev-parse','HEAD');
 const treeSha=git('rev-parse','HEAD^{tree}');
 const blobSha=git('rev-parse','HEAD:src/example.js');
 const c={id:'real-snapshot-001',repositoryAlias:'test-local-source',commitSha,
  sourceEvidenceSha256:hash(fs.readFileSync(path.join(dir,'src','example.js'))),
  domain:'runtime',severity:'warning',ecosystem:'js-ts'};
 const manifest={schemaVersion:1,studyId:'t7-local-source-contract',
  protocolSha256:'a'.repeat(64),samplingFrameSha256:'b'.repeat(64),cases:[c]};
 const s={caseId:c.id,repositoryAlias:c.repositoryAlias,commitSha,treeSha,blobSha,
  repositoryDirectory:dir,sourcePath:'src/example.js'};
 const registry={schemaVersion:1,studyId:manifest.studyId,cases:[s]};
 return {dir,git,c,manifest,s,registry};
}
test('real Git commit/tree/blob full-file SHA-256 verifies without human accuracy claims',t=>{
 const x=fixture(t),out=verifyT7SourceSnapshots(x.manifest,x.registry);
 assert.equal(out.localGitObjectChainsVerified,1);
 assert.equal(out.fullFileSourceSha256Verified,1);
 assert.equal(out.independentlyAuthenticatedHumanCases,0);
 assert.equal(out.independentlyAuthenticatedSourceRevisions,0);
 assert.equal(out.measuredIndependentRealWorldAccuracy,null);
 assert.equal(out.overallReleaseReady,false);
});
test('uncommitted working tree mutation cannot change pinned blob evidence',t=>{
 const x=fixture(t);fs.writeFileSync(path.join(x.dir,'src','example.js'),'uncommitted edit');
 assert.equal(verifyT7SourceSnapshots(x.manifest,x.registry).localGitObjectChainsVerified,1);
});
test('stale digest, forged Git blob or root tree fails closed',t=>{
 const x=fixture(t);x.manifest.cases[0].sourceEvidenceSha256='f'.repeat(64);
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/SHA-256/);
 x.manifest.cases[0].sourceEvidenceSha256=x.c.sourceEvidenceSha256;
 x.s.blobSha='1'.repeat(40);
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/blob ID mismatch/);
 x.s.blobSha=x.git('rev-parse','HEAD:src/example.js');
 x.s.treeSha='2'.repeat(40);
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/root tree SHA mismatch/);
});
test('wrong commit and path cannot be silently substituted',t=>{
 const x=fixture(t);x.s.commitSha='0'.repeat(40);
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/identity/);
 x.s.commitSha=x.c.commitSha;x.s.sourcePath='src/not-here.js';
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/missing/);
});
test('rejects missing, extraneous or duplicated case evidence before running Git',t=>{
 const x=fixture(t);x.registry.cases=[];
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/universe/);
 x.registry.cases=[x.s,{...x.s,caseId:'alien'}];
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/universe/);
 x.manifest.cases.push({...x.c,id:'real-snapshot-002'});
 x.registry.cases=[x.s,{...x.s}];
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/identity/);
});
test('path traversal and foreign repository aliases are refused',t=>{
 const x=fixture(t);x.s.sourcePath='../outside.js';
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/path mismatch/);
 x.s.sourcePath='src/example.js';x.s.repositoryAlias='pretend-other-repo';
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/identity/);
});
test('symlinks are not accepted as full-file source evidence',t=>{
 const x=fixture(t);
 try{fs.symlinkSync('example.js',path.join(x.dir,'src','link.js'));}
 catch {t.skip('OS prohibits symlink creation');return;}
 x.git('add','src/link.js');x.git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','link fixture');
 x.c.commitSha=x.git('rev-parse','HEAD');x.s.commitSha=x.c.commitSha;
 x.s.treeSha=x.git('rev-parse','HEAD^{tree}');
 x.s.blobSha=x.git('rev-parse','HEAD:src/link.js');
 x.s.sourcePath='src/link.js';
 x.c.sourceEvidenceSha256=hash('example.js');
 assert.throws(()=>verifyT7SourceSnapshots(x.manifest,x.registry),/symlink/);
});
