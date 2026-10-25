#!/usr/bin/env node
/**
 * Phase 5.6B bounded FULL-WORKTREE observational scan of two independently
 * developed public projects at historical immutable commits.
 *
 * Never install dependencies or execute scripts from cloned projects.
 * Pinned SHA is checked after fetch; source tree discarded afterward.
 * Output is sanitized metadata only, not a security/accuracy certification.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { buildUnifiedBrowserReport } = load('src/lib/report/unified-intelligence.ts');
const { evaluateBrowserQuality } = load('src/lib/report/phase5-quality.ts');
const root = path.resolve(import.meta.dirname,'../..');
const samples = [
  { repository: 'pallets/click', commit: '2247b35ea1c47c727d7a06e51fa280e12a863ff6' },
  { repository: 'typicode/lowdb', commit: '8a6fce9b72f769b22533f0979fbc2e73180f8112' },
];
function run(command,args,timeout=90_000) {
  const res=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:5*1024*1024,
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
  if (res.error || res.status!==0) throw Error(command+' failed: '+(res.error?.message??res.stderr).slice(-1100));
  return res.stdout.trim();
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uce-phase56-pinned-'));
const rows=[];
try {
  for (let i=0;i<samples.length;i++) {
    const item=samples[i];
    assert.match(item.commit,/^[a-f0-9]{40}$/);
    assert.match(item.repository,/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
    const sourceDir=path.join(temp,'source-'+i);
    fs.mkdirSync(sourceDir);
    run('git',['init','--quiet',sourceDir]);
    run('git',['-C',sourceDir,'fetch','--quiet','--depth=1','--no-tags',
      'https://github.com/'+item.repository+'.git',item.commit],150_000);
    run('git',['-C',sourceDir,'-c','core.hooksPath=/dev/null',
      'checkout','--quiet','--detach','FETCH_HEAD']);
    const actualCommit=run('git',['-C',sourceDir,'rev-parse','HEAD']);
    assert.equal(actualCommit,item.commit,'source commit changed');
    const reportPath=path.join(temp,'report-'+i+'.json');
    run(process.execPath,['scripts/uce-scan.mjs',sourceDir,'--output='+reportPath,
      '--max-files=4000','--max-bytes=16777216'],180_000);
    const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
    const before=JSON.stringify(report);
    const unified=buildUnifiedBrowserReport(report);
    const quality=evaluateBrowserQuality(report,unified);
    assert.equal(JSON.stringify(report),before,'report mutated by presentation logic');
    assert.equal(quality.scoreParity,'preserved');
    assert.equal(quality.originalIssueParity,'preserved');
    assert.equal(quality.accuracy.falsePositiveRate,null);
    assert.equal(quality.accuracy.falseMergeRate,null);
    assert.ok(unified.findings.every(f=>f.verification==='not-run'));
    assert.ok(unified.rootGroups.every(g=>g.findingIds.every(id=>unified.findings.some(f=>f.id===id))));
    rows.push({
      repository:item.repository,commit:item.commit,
      scope:'bounded entire checked-out repository tree (4,000 files / 16 MiB content)',
      nativeScore:report.score.overall,rawIssueCount:report.issues.length,
      derivedCount:unified.findings.length,clusterCount:unified.rootGroups.length,
      candidateCount:quality.counts.candidatesTotal,
      scoreParity:quality.scoreParity,issueParity:quality.originalIssueParity,
      qualityStatus:quality.status,graphCoverage:quality.graphCoverage,
      structuralFlags:[...new Set(quality.flags.map(f=>f.code))],
      scanStats:{filesFound:report.summary?.scanStats?.filesFound??null,
        filesAnalyzed:report.summary?.scanStats?.filesAnalyzed??null,
        sampled:report.summary?.scanStats?.sampled??null,
        truncated:report.summary?.scanStats?.truncated??null},
    });
    console.log(JSON.stringify({repository:item.repository,commit:item.commit,
      scoreParity:quality.scoreParity,issueParity:quality.originalIssueParity,
      status:quality.status,counts:{issues:report.issues.length,clusters:unified.rootGroups.length}}));
    fs.rmSync(sourceDir,{recursive:true,force:true});
    fs.rmSync(reportPath,{force:true});
  }
  const result={
    phase:'5.6B',scope:'two SHA-pinned real full-worktree bounded scans',
    repositoriesAttempted:samples.length,repositoriesScanned:rows.length,
    humanReviewedProjects:0,precision:null,recall:null,
    falsePositiveRate:null,falseMergeRate:null,recommendationCorrectness:null,
    sourceFilesUploaded:false,thirdPartyProjectCodeExecuted:false,
    limitations:[
      '2 deliberately selected repositories are insufficient for representative accuracy',
      'Bounded scans may omit data: see individual sampled/truncated fields',
      'Source-reference paths are not independently adjudicated or re-hashed',
      'Root cause grouping is category correlation, not a proven causal link',
      'No executable runtime tests, dependency install, or formal Trilogy verification',
      'Human accuracy labels require independent reviewers and adjudication',
    ],rows,
  };
  const output=process.env.UCE_PHASE56_FULL_OUTPUT;
  if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
    fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify({phase:'5.6B',scanned:rows.length,scope:result.scope,
    accuracy:'not-measured'}));
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
