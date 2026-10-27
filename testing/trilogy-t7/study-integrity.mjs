/**
 * Join a frozen T7 study to a locally re-read Git source preflight.
 * Local object integrity is never independent truth, human review or accuracy.
 */
import {createHash} from 'node:crypto';
const SHA1=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const defaultSummary={
  status:'not-performed',localGitObjectChainsVerified:0,
  independentlyAuthenticatedSourceRevisions:0,
  independentlyAuthenticatedHumanCases:0,
  canCertifyRealWorldAccuracy:false,
};
export function bindT7LocalProvenance(manifest,audit){
 if(audit==null)return {...defaultSummary};
 if(!obj(manifest)||manifest.schemaVersion!==1||!ID.test(manifest.studyId??'')||
    !Array.isArray(manifest.cases)||manifest.cases.length>2000||
    !obj(audit)||audit.schemaVersion!==1||audit.phase!=='Trilogy-T7-source-provenance'||
    audit.studyId!==manifest.studyId||audit.manifestSha256!==hash(manifest)||
    !SHA256.test(audit.localRegistrySha256??'')||
    !Array.isArray(audit.cases)||audit.cases.length!==manifest.cases.length||
    audit.frozenCaseUniverseCount!==manifest.cases.length||
    audit.localGitObjectChainsVerified!==manifest.cases.length||
    audit.fullFileSourceSha256Verified!==manifest.cases.length||
    audit.sourceReadOnly!==true||audit.caseTruthLabelsExamined!==false||
    audit.sourceFilesExecuted!==false||audit.localCheckoutTrustedAsExternalAuthority!==false||
    audit.independentlyAuthenticatedSourceRevisions!==0||
    audit.independentlyAuthenticatedHumanCases!==0||
    audit.measuredIndependentRealWorldAccuracy!==null||
    audit.overallReleaseReady!==false)
  throw Error('T7 mismatched or overclaimed local Git provenance audit');
 const cases=new Map();
 for(const c of manifest.cases){
  if(!obj(c)||!ID.test(c.id??'')||cases.has(c.id)||
     !ID.test(c.repositoryAlias??'')||!SHA1.test(c.commitSha??'')||
     !SHA256.test(c.sourceEvidenceSha256??''))
   throw Error('T7 unpinned or duplicate frozen source case');
  cases.set(c.id,c);
 }
 const seen=new Set();
 for(const rec of audit.cases){
  if(!obj(rec)||!ID.test(rec.caseId??'')||seen.has(rec.caseId)||
     !cases.has(rec.caseId)||!SHA1.test(rec.rootTreeSha??'')||
     !SHA1.test(rec.blobSha??''))
   throw Error('T7 local source audit case universe mismatch');
  const c=cases.get(rec.caseId);
  if(rec.repositoryAlias!==c.repositoryAlias||rec.commitSha!==c.commitSha||
     rec.sourceEvidenceSha256!==c.sourceEvidenceSha256)
   throw Error('T7 local source audit pin or identity mismatch');
  seen.add(rec.caseId);
 }
 if(seen.size!==cases.size)throw Error('T7 incomplete local source audit');
 // Never convey independently verified status from self-submitted JSON.
 return {
  status:'local-git-object-integrity-diagnostic-only',
  frozenManifestSha256:audit.manifestSha256,
  localAuditArtifactSha256:hash(audit),
  localGitObjectChainsVerified:seen.size,
  independentlyAuthenticatedSourceRevisions:0,
  independentlyAuthenticatedHumanCases:0,
  canCertifyRealWorldAccuracy:false,
 };
}
