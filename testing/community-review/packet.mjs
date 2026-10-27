/**
 * Phase 3: produce blinded, source-pinned question packets.
 * Never include UCE/Trilogy predictions, scores, labels or provisional truth.
 * Packet preparation is NOT independent adjudication.
 */
import {createHash} from 'node:crypto';

const ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SOURCE=/^[A-Za-z0-9_.@/+~-]{1,512}$/;
const DOMAINS=new Set(['runtime','security','browser','dependencies','deployment','framework','other']);
const SEVERITIES=new Set(['critical','warning','info','other']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const only=(v,keys)=>Object.keys(v).every(k=>keys.includes(k));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pathOk=s=>typeof s==='string'&&SOURCE.test(s)&&!s.startsWith('/')&&
 s.split('/').every(v=>v&&v!=='.'&&v!=='..')&&!s.includes('//');
const MANIFEST=['schemaVersion','studyId','protocolSha256','samplingFrameSha256','cases'];
const CASE=['id','repositoryAlias','commitSha','sourceEvidenceSha256','domain','severity','ecosystem'];
const CLAIM=['caseId','repositoryAlias','repository','sourcePath','claimText'];

export function prepareBlindedCasePacket(manifest,claimRegistry){
 if(!obj(manifest)||!only(manifest,MANIFEST)||manifest.schemaVersion!==1||
  !ID.test(manifest.studyId??'')||!SHA64.test(manifest.protocolSha256??'')||
  !SHA64.test(manifest.samplingFrameSha256??'')||
  !Array.isArray(manifest.cases)||manifest.cases.length<1||manifest.cases.length>2000)
  throw Error('Phase3 invalid or non-frozen T7 manifest');
 if(!obj(claimRegistry)||!only(claimRegistry,['schemaVersion','studyId','claims'])||
  claimRegistry.schemaVersion!==1||claimRegistry.studyId!==manifest.studyId||
  !Array.isArray(claimRegistry.claims)||claimRegistry.claims.length!==manifest.cases.length)
  throw Error('Phase3 claim universe mismatch');
 const cases=new Map();
 for(const c of manifest.cases){
  if(!obj(c)||!only(c,CASE)||!ID.test(c.id??'')||cases.has(c.id)||
   !ID.test(c.repositoryAlias??'')||!ID.test(c.ecosystem??'')||
   !SHA40.test(c.commitSha??'')||!SHA64.test(c.sourceEvidenceSha256??'')||
   !DOMAINS.has(c.domain)||!SEVERITIES.has(c.severity))
   throw Error('Phase3 leaked truth field, duplicate case or invalid frozen source');
  cases.set(c.id,c);
 }
 const seen=new Set(),packetCases=[];
 for(const q of claimRegistry.claims){
  if(!obj(q)||!only(q,CLAIM)||!ID.test(q.caseId??'')||
   !cases.has(q.caseId)||seen.has(q.caseId)||
   q.repositoryAlias!==cases.get(q.caseId).repositoryAlias||
   !REPO.test(q.repository??'')||q.repository.includes('..')||
   !pathOk(q.sourcePath)||typeof q.claimText!=='string'||
   q.claimText.length<20||q.claimText.length>600||
   /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(q.claimText)||
   /\b(?:UCE|Trilogy)\b/i.test(q.claimText))
   throw Error('Phase3 invalid, biased or mismatched neutral claim');
  seen.add(q.caseId);
  const c=cases.get(q.caseId);
  packetCases.push({
   caseId:c.id,domain:c.domain,ecosystem:c.ecosystem,
   question:q.claimText,
   source:{repository:q.repository,path:q.sourcePath,
    commitSha:c.commitSha,sourceEvidenceSha256:c.sourceEvidenceSha256,
    pinnedUrl:'https://github.com/'+q.repository+'/blob/'+c.commitSha+'/'+q.sourcePath},
  });
 }
 packetCases.sort((a,b)=>a.caseId<b.caseId?-1:a.caseId>b.caseId?1:0);
 return {
  schemaVersion:1,mode:'blinded-claim-review',studyId:manifest.studyId,
  frozenManifestSha256:hash(manifest),claimRegistrySha256:hash(claimRegistry),
  caseUniverseCount:cases.size,
  noPredictionsOrProvisionalLabelsIncluded:true,
  externalSourceIdentityVerified:false,
  humanReviewPerformedByThisTool:false,
  questions:'For the pinned snapshot only, decide whether the neutral claim is supported (positive), contradicted (negative), or insufficiently evidenced (unknown).',
  cases:packetCases,
 };
}
