#!/usr/bin/env node
// Evidence-level evaluation only. Labels are agent-provisional, NOT independently human adjudicated.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { decisionMetrics, groupMetrics } from './metrics.mjs';

const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const { detectBrowserCompatibility } = load('src/lib/analyzer/browser-compatibility.ts');
const sourcePath = new URL('./corpus.json', import.meta.url);
const raw = fs.readFileSync(sourcePath, 'utf8');
const cases = JSON.parse(raw).cases.filter(row => row.area === 'security');
if (cases.length < 20) throw Error('Security source excerpt evidence corpus missing or unexpectedly small');
const security = cases.map(item => {
  if (typeof item.expected !== 'boolean' || typeof item.rule !== 'string' || !item.rationale || !item.labelReview) throw Error('Invalid security case ' + item.id);
  const files = item.files.map(file => ({...file, isDirectory:false, size:Buffer.byteLength(file.content)}));
  const actual = detectSecurityIntelligence(files).findings.some(f => f.ruleId === item.rule);
  return {id:item.id, area:'security',kind:item.source.kind, repository:item.source.repository??null, rule:item.rule,
    expected:item.expected,actual,passed:item.expected===actual, rationale:item.rationale, review:item.labelReview};
});
const browserCases = [
  ['webgpu-old','src/main.js','navigator.gpu.requestAdapter()', 'webgpu', 'chrome 80',true],
  ['webgpu-new','src/main.js','navigator.gpu.requestAdapter()', 'webgpu', 'chrome 130',false],
  ['transition-old','src/main.js','document.startViewTransition(() => {})','view-transitions','chrome 80',true],
  ['transition-new','src/main.js','document.startViewTransition(() => {})','view-transitions','chrome 130',false],
  ['has-old','src/styles.css','div:has(>p){display:block}','css-has','chrome 80',true],
  ['has-new','src/styles.css','div:has(>p){display:block}','css-has','chrome 130',false],
  ['container-old','src/styles.css','@container (min-width:300px){.x{color:red}}','container-queries','chrome 80',true],
  ['container-new','src/styles.css','@container (min-width:300px){.x{color:red}}','container-queries','chrome 130',false],
  ['clone-old','src/app.js','structuredClone(value)', 'structured-clone', 'chrome 80',true],
  ['clone-new','src/app.js','structuredClone(value)', 'structured-clone', 'chrome 130',false],
  ['bluetooth-firefox','src/app.js','navigator.bluetooth.requestDevice({})','web-bluetooth','firefox 125',true],
  ['bluetooth-chrome','src/app.js','navigator.bluetooth.requestDevice({})','web-bluetooth','chrome 130',false],
  ['optional-old','src/app.js','const x = a?.b;', 'optional-chaining','chrome 70',true],
  ['optional-new','src/app.js','const x = a?.b;', 'optional-chaining','chrome 130',false],
  ['comment-webgpu-old','src/app.js','// navigator.gpu is unsupported here', 'webgpu','chrome 80',false],
  ['string-webgpu-old','src/app.js','const doc = "navigator.gpu.requestAdapter()";','webgpu','chrome 80',false],
  ['css-comment-has','src/styles.css','/* :has(.example) */', 'css-has','chrome 80',false],
];
const browser = browserCases.map(([id,filePath,source,feature,target,expected]) => {
  const files=[{path:filePath,content:source,size:Buffer.byteLength(source),isDirectory:false},
    {path:'.browserslistrc',content:target,size:target.length,isDirectory:false}];
  const observed=detectBrowserCompatibility(files).findings;
  const actual=observed.some(item => item.id === feature);
  return {id,area:'browser-compatibility',kind:'authored-control',feature,target,expected,actual,passed:actual===expected,
    review:'agent-authored diagnostic; independent human review pending'};
});
const securityMetrics=decisionMetrics(security), browserMetrics=decisionMetrics(browser);
const report={
  schemaVersion:1,benchmark:'UCE evidence-level source excerpt + browser compatibility diagnostic',
  generatedAt:new Date().toISOString(),
  securityCorpusSha256:createHash('sha256').update(raw).digest('hex'),
  reviewStatus:'agent-provisional',humanReviewedCases:0,globalAccuracy:null,
  scope:'25 security rule decisions from pinned public source excerpts and synthetic tests, plus 17 agent-authored browser compatibility positive and negative controls. NOT a full 1000 repository security or compatibility adjudication.',
  modules:{security:securityMetrics,'browser-compatibility':browserMetrics},
  securityKinds:groupMetrics(security,'kind'),
  failures:[...security,...browser].filter(x=>!x.passed),
  results:{security,browser},
  limitations:['Human-adjudicated labels: 0. Not independently validated.', 'Not a vulnerability exploitability verdict.',
    'Browser controls use rule-defined feature-version truth assumptions and do not measure live browsers.',
    'No true negatives can be inferred from unreviewed public repository scans.',
    'This is NOT project-level security or compatibility accuracy.'],
};
const output=path.resolve(process.env.UCE_EVIDENCE_OUTPUT ?? 'benchmark-output/evidence-evaluation.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('UCE_EVIDENCE_SUMMARY='+JSON.stringify({status:report.reviewStatus,humanReviewed:0,security:securityMetrics,browser:browserMetrics,failures:report.failures.map(x=>x.id)}));
