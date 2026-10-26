import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { evaluateDeveloperSafety, canonicalEvidenceHash } from './safety.mjs';

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
function project() {
  const files=[file('package.json','{"name":"t0-test","version":"1.0.0"}'),
    file('src/index.ts','export const x = 1;')];
  return {files, fileName:'t0-test', source:'upload', scanStats:{
    projectSize:files.reduce((n,f)=>n+f.size,0), filesFound:files.length,
    filesAnalyzed:files.length, filesIgnored:0, ignoredCategories:[],
  }};
}
test('T0 never certifies accurate or safe-to-fix even on a high-scoring completed static scan',()=>{
  const data=project(),r=analyzeProject(data);
  const original=JSON.stringify(r);
  const assessed=evaluateDeveloperSafety(r,data.files.map(x=>x.path));
  assert.equal(JSON.stringify(r),original);
  assert.equal(assessed.assessment,'review-only-not-certified');
  assert.equal(assessed.independentAccuracy.globalAccuracy,null);
  assert.equal(assessed.independentAccuracy.precision,null);
  assert.equal(assessed.independentAccuracy.recall,null);
  assert.equal(assessed.independentAccuracy.recommendationCorrectness,null);
  assert.equal(assessed.verifiedFindingCount,0);
  assert.equal(assessed.automaticFixesAllowed,false);
  assert.equal(assessed.generatedFixes,0);
  assert.equal(assessed.rawCanonicalScore,r.score.overall);
  assert.equal(assessed.rawIssueCount,r.issues.length);
});
test('T0 fingerprint stable across timestamps/IDs, detects changed canonical issues',()=>{
  const data=project(),a=analyzeProject(data),b=structuredClone(a);
  b.createdAt='2099-01-01T00:00:00Z';
  b.id='unrelated-report-handle';
  b.summary.scanStats.scanTimeMs=99999;
  assert.equal(canonicalEvidenceHash(a),canonicalEvidenceHash(b));
  b.issues=[...b.issues,{id:'unverified-claim',title:'Review',category:'runtime',
    severity:'critical',description:'Unverified',reason:'Unverified',recommendation:'Inspect',
    affectedFile:'src/index.ts'}];
  assert.notEqual(canonicalEvidenceHash(a),canonicalEvidenceHash(b));
});
test('Truncated 100-score report cannot claim readiness or developer safe fixes',()=>{
  const r=analyzeProject(project());
  r.summary.scanStats.truncated=true;
  if(r.summary.analysisCoverage)r.summary.analysisCoverage.status='partial';
  r.score.overall=100;
  const s=evaluateDeveloperSafety(r,['package.json','src/index.ts']);
  assert.equal(s.projectCoverage,'incomplete');
  assert.equal(s.displayScore,null);
  assert.equal(s.rawCanonicalScore,100);
  assert.ok(s.flags.includes('incomplete-coverage'));
  assert.equal(s.automaticFixesAllowed,false);
});
test('Rule crashes and V3 budget breaches never become positive evidence',()=>{
  const r=analyzeProject(project());
  r.summary.scanStats.ruleFailures=[{ruleId:'synthetic-exception',category:'runtime',kind:'exception'}];
  const status=evaluateDeveloperSafety(r,['package.json']);
  assert.ok(status.flags.includes('rule-execution-failure'));
  assert.equal(status.displayScore,null);
  r.summary.scanStats.ruleFailures=[];
  r.stack.v3RulePlatform={metrics:[{ruleId:'budget-exceeded',truncated:true}],findings:[]};
  const limited=evaluateDeveloperSafety(r,['package.json']);
  assert.ok(limited.flags.includes('v3-budget-exceeded'));
  assert.equal(limited.displayScore,null);
});
test('Referenced file names are not proof; invalid paths are not trusted evidence',()=>{
  const r=analyzeProject(project());
  r.issues=[
    {id:'valid',title:'review source',affectedFile:'src/index.ts:1',
      severity:'warning',category:'runtime',reason:'static evidence only',recommendation:'review'},
    {id:'invalid',title:'untrusted path',affectedFile:'../secret.txt',
      severity:'critical',category:'security',reason:'untrusted',recommendation:'review'},
  ];
  const s=evaluateDeveloperSafety(r,['package.json','src/index.ts','../secret.txt']);
  assert.equal(s.issueProvenance.referenced,1);
  assert.equal(s.issueProvenance.unlinked,1);
  assert.equal(s.verifiedFindingCount,0);
  assert.equal(s.unverifiedFindings,2);
  assert.equal(s.rawIssueCount,2);
  assert.ok(s.flags.includes('unlinked-issue-provenance'));
  assert.ok(!JSON.stringify(s).includes('../secret.txt'));
});
test('Noncanonical reports and corrupt source inventory fail without fabricating results',()=>{
  assert.throws(()=>evaluateDeveloperSafety({issues:[],score:{overall:100}}));
  const r=analyzeProject(project());
  assert.throws(()=>evaluateDeveloperSafety(r,['good',{}]));
});
