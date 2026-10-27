import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bindT7LocalProvenance} from './study-integrity.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const c=(id)=>({id,repositoryAlias:'repo',commitSha:'a'.repeat(40),
 sourceEvidenceSha256:'b'.repeat(64),domain:'runtime',severity:'warning',ecosystem:'js-ts'});
const fixture=()=>{
 const manifest={schemaVersion:1,studyId:'frozen-v1',protocolSha256:'c'.repeat(64),
  samplingFrameSha256:'d'.repeat(64),cases:[c('finding-1'),c('finding-2')]};
 const audit={schemaVersion:1,phase:'Trilogy-T7-source-provenance',studyId:manifest.studyId,
  frozenCaseUniverseCount:manifest.cases.length,manifestSha256:hash(manifest),
  localRegistrySha256:'f'.repeat(64),localGitObjectChainsVerified:2,fullFileSourceSha256Verified:2,
  sourceReadOnly:true,caseTruthLabelsExamined:false,sourceFilesExecuted:false,
  localCheckoutTrustedAsExternalAuthority:false,independentlyAuthenticatedSourceRevisions:0,
  independentlyAuthenticatedHumanCases:0,measuredIndependentRealWorldAccuracy:null,
  overallReleaseReady:false,
  cases:manifest.cases.map(x=>({caseId:x.id,repositoryAlias:x.repositoryAlias,
   commitSha:x.commitSha,sourceEvidenceSha256:x.sourceEvidenceSha256,
   rootTreeSha:'e'.repeat(40),blobSha:'f'.repeat(40)}))};
 return {manifest,audit};
};
test('no preflight never implies source verification',()=>{
 assert.deepEqual(bindT7LocalProvenance(fixture().manifest,null),{
  status:'not-performed',localGitObjectChainsVerified:0,
  independentlyAuthenticatedSourceRevisions:0,independentlyAuthenticatedHumanCases:0,
  canCertifyRealWorldAccuracy:false});
});
test('matched local Git case universe is diagnostic, never certification',()=>{
 const x=fixture();const s=bindT7LocalProvenance(x.manifest,x.audit);
 assert.equal(s.localGitObjectChainsVerified,2);
 assert.equal(s.independentlyAuthenticatedSourceRevisions,0);
 assert.equal(s.canCertifyRealWorldAccuracy,false);
 assert.equal(s.frozenManifestSha256,hash(x.manifest));
});
test('source change after freeze or changed study ID fails',()=>{
 const x=fixture();x.manifest.cases[0].sourceEvidenceSha256='0'.repeat(64);
 assert.throws(()=>bindT7LocalProvenance(x.manifest,x.audit),/mismatched/);
 const y=fixture();y.audit.studyId='other';
 assert.throws(()=>bindT7LocalProvenance(y.manifest,y.audit),/mismatched/);
});
test('reused audit records cannot inflate the case denominator',()=>{
 const x=fixture();x.audit.cases[1]={...x.audit.cases[0]};
 assert.throws(()=>bindT7LocalProvenance(x.manifest,x.audit),/case universe/);
 const y=fixture();y.audit.cases.pop();
 assert.throws(()=>bindT7LocalProvenance(y.manifest,y.audit),/mismatched/);
});
test('wrong commit, source digest or repository alias is rejected',()=>{
 for(const [k,v] of [['commitSha','0'.repeat(40)],['sourceEvidenceSha256','1'.repeat(64)],
   ['repositoryAlias','other']]){
  const x=fixture();x.audit.cases[0][k]=v;
  assert.throws(()=>bindT7LocalProvenance(x.manifest,x.audit),/pin or identity/);
 }
});
test('tampered audit summary or claimed independent truth cannot promote release',()=>{
 for(const [k,v] of [['localGitObjectChainsVerified',1],['fullFileSourceSha256Verified',1],
  ['independentlyAuthenticatedSourceRevisions',2],['independentlyAuthenticatedHumanCases',2],
  ['overallReleaseReady',true],['measuredIndependentRealWorldAccuracy',100],
  ['localCheckoutTrustedAsExternalAuthority',true],['sourceFilesExecuted',true],
  ['caseTruthLabelsExamined',true]]){
  const x=fixture();x.audit[k]=v;
  assert.throws(()=>bindT7LocalProvenance(x.manifest,x.audit),/mismatched/);
 }
});
test('duplicate frozen case IDs reject instead of hiding observations',()=>{
 const x=fixture();x.manifest.cases[1].id='finding-1';
 x.audit.manifestSha256=hash(x.manifest);
 assert.throws(()=>bindT7LocalProvenance(x.manifest,x.audit),/duplicate/);
});
test('zero-case evidence is allowed as empty diagnostic but still cannot certify',()=>{
 const x=fixture();x.manifest.cases=[];x.audit.cases=[];
 x.audit.localGitObjectChainsVerified=0;x.audit.fullFileSourceSha256Verified=0;
 x.audit.frozenCaseUniverseCount=0;x.audit.manifestSha256=hash(x.manifest);
 const s=bindT7LocalProvenance(x.manifest,x.audit);
 assert.equal(s.localGitObjectChainsVerified,0);
 assert.equal(s.canCertifyRealWorldAccuracy,false);
});
