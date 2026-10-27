import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { adjudicateEvidence } from './evidence.mjs';

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const hash = s => createHash('sha256').update(s).digest('hex');
const source = 'export const enabled = true;\nexport const target = "web";\n';
const project = () => {
  const files = [
    {path:'package.json',content:'{"name":"t1-example","version":"1.0.0"}',size:39,isDirectory:false},
    {path:'src/demo.ts',content:source,size:Buffer.byteLength(source),isDirectory:false},
  ];
  return {files,fileName:'t1-example',source:'upload',scanStats:{
    projectSize:files.reduce((s,x)=>s+x.size,0),filesFound:2,filesAnalyzed:2,
    filesIgnored:0,ignoredCategories:[],
  }};
};
function report(issues) {
  const p=project(),r=analyzeProject(p);
  r.issues=issues.map(([id,path])=>({id,title:'T1 authored audit fixture',severity:'warning',
    category:'runtime',affectedFile:path,description:'Not a proven compatibility issue',
    reason:'Example only',recommendation:'Manual review required'}));
  return {p,r};
}
const claim=(id, fragment='enabled = true', opts={})=>({
  findingId:id,file:'src/demo.ts',line:1,
  predicate:'literal-source-fragment-at-line',fragment,
  sourceSha256:hash(source),...opts,
});
test('T1 checks only an exact pinned literal predicate and keeps UCE issues and score intact',()=>{
  const {p,r}=report([['evidence-a','src/demo.ts:1']]);
  const before=JSON.stringify(r),res=adjudicateEvidence(r,p.files,[claim('evidence-a')]);
  assert.equal(JSON.stringify(r),before);
  assert.equal(res.counts['independently-checked-in-scope'],1);
  assert.equal(res.findings[0].checkedPredicate,'literal-source-fragment-at-line');
  assert.equal(res.findings[0].compatibilityVerified,false);
  assert.equal(res.findings[0].findingCorrectnessVerified,false);
  assert.equal(res.verifiedCompatibilities,0);
  assert.equal(res.verifiedVulnerabilities,0);
  assert.equal(res.recommendationAutoApply,false);
  assert.equal(res.originalRawScore,r.score.overall);
  assert.equal(res.originalIssueCount,1);
  assert.equal(res.independentTrilogyDetector,'not-run');
  assert.ok(!JSON.stringify(res).includes('enabled = true'));
});
test('Same-title findings with distinct IDs and conflicting anchored bytes cannot merge',()=>{
  const {p,r}=report([['one','src/demo.ts:1'],['two','src/demo.ts:1']]);
  const v=adjudicateEvidence(r,p.files,[claim('one'),claim('two','enabled = false')]);
  assert.deepEqual([v.counts['independently-checked-in-scope'],v.counts.disputed],[1,1]);
  assert.equal(v.findings.length,2);
  assert.ok(v.findings.every(x=>x.automaticFixAllowed===false));
});
test('Existing file without independent literal proof remains source-referenced',()=>{
  const {p,r}=report([['exists','src/demo.ts']]);
  const v=adjudicateEvidence(r,p.files);
  assert.equal(v.findings[0].status,'source-referenced');
  assert.equal(v.findings[0].checkedPredicate,null);
});
test('Missing, traversal and unreadable files become Unknown, not a positive claim',()=>{
  const {p,r}=report([['missing','src/missing.ts'],['escape','../secret.txt'],
    ['unread','src/demo.ts:1']]);
  p.files[1]={...p.files[1],content:undefined};
  const v=adjudicateEvidence(r,p.files,[claim('unread')]);
  assert.equal(v.counts.unknown,3);
  assert.equal(v.verifiedCompatibilities,0);
  assert.ok(!JSON.stringify(v).includes('../secret.txt'));
});
test('A stale hash is Unknown rather than a disputed finding or a verified check',()=>{
  const {p,r}=report([['stale','src/demo.ts:1']]);
  const v=adjudicateEvidence(r,p.files,[claim('stale','enabled = true',
    {sourceSha256:hash('another revision')})]);
  assert.equal(v.findings[0].status,'unknown');
  assert.equal(v.findings[0].reason,'source-snapshot-hash-mismatch');
});
test('Malformed evidence and incompatible source line cannot be accepted as independent proof',()=>{
  const {p,r}=report([['bad','src/demo.ts:1'],['wrong-line','src/demo.ts:1']]);
  const v=adjudicateEvidence(r,p.files,[claim('bad','enabled = true',{line:2}),
    claim('wrong-line','enabled = true',{predicate:'vulnerability-confirmed'})]);
  assert.equal(v.counts.unknown,2);
});
test('Partial scans, rule exceptions or incomplete V3 budgets cannot promote checks',()=>{
  for(const set of [
    r=>{r.summary.scanStats.truncated=true;},
    r=>{r.summary.scanStats.ruleFailures=[{ruleId:'crash',category:'runtime',kind:'exception'}];},
    r=>{r.stack.v3RulePlatform={metrics:[{ruleId:'limit',truncated:true}],findings:[]};},
  ]){
    const {p,r}=report([['a','src/demo.ts:1']]);
    set(r);
    const v=adjudicateEvidence(r,p.files,[claim('a')]);
    assert.equal(v.counts['independently-checked-in-scope'],0);
    assert.equal(v.findings[0].status,'source-referenced');
    assert.equal(v.scope,'partial');
  }
});
test('Duplicate issues, duplicate files and duplicate assertions cannot launder verification',()=>{
  let {p,r}=report([['x','src/demo.ts:1']]);
  assert.throws(()=>adjudicateEvidence(r,[...p.files,p.files[1]],[claim('x')]));
  r.issues=[r.issues[0],r.issues[0]];
  assert.throws(()=>adjudicateEvidence(r,p.files,[claim('x')]));
});
test('Duplicate evidence assertions are fail-closed Unknown without losing the original finding',()=>{
  const {p,r}=report([['x','src/demo.ts:1']]);
  const v=adjudicateEvidence(r,p.files,[claim('x'),claim('x')]);
  assert.equal(v.originalIssueCount,1);
  assert.equal(v.counts.unknown,1);
  assert.equal(v.findings[0].reason,'ambiguous-evidence-assertions');
});
test('Strict source and predicate resource budgets cannot silently truncate verified evidence',()=>{
  const {p,r}=report([['x','src/demo.ts:1']]);
  assert.throws(()=>adjudicateEvidence(r,Array.from({length:5001},(_,i)=>({
    path:'src/f'+i+'.ts',content:'',isDirectory:false}))));
  assert.throws(()=>adjudicateEvidence(r,p.files,Array.from({length:5001},(_,i)=>({
    findingId:'case-'+i}))));
  const over=[...p.files];over[1]={path:'src/demo.ts',content:'a'.repeat(262145)};
  const v=adjudicateEvidence(r,over,[claim('x')]);
  assert.equal(v.counts.unknown,1);
});
test('Independent source evidence output stays deterministic and reports orphan records',()=>{
  const {p,r}=report([['a','src/demo.ts:1'],['b','src/demo.ts:1']]);
  const a=adjudicateEvidence(r,p.files,[claim('a'),claim('b','missing'),claim('orphan')]);
  const b=adjudicateEvidence(r,[...p.files].reverse(),[claim('orphan'),claim('b','missing'),claim('a')]);
  assert.deepEqual(a,b);
  assert.equal(a.orphanEvidenceRecords,1);
  assert.equal(a.findings.length,2);
});
