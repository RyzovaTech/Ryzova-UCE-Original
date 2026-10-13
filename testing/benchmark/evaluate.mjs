import { createHash } from 'node:crypto';
import { decisionMetrics, groupMetrics } from '../accuracy/metrics.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function evaluate(corpus, run) {
  if (corpus.schemaVersion !== 1 || corpus.split !== 'development' || !corpus.cases?.length) throw Error('Invalid development corpus');
  const ids = new Set(), groups = new Map();
  // Validate the complete collection before running any detector.
  for (const c of corpus.cases) {
    if (!c.id || ids.has(c.id) || !c.family || !c.ecosystem || !c.module || !c.rule || !c.finding || !['bug','fixed','negative'].includes(c.variant) || typeof c.expected !== 'boolean' || c.labelStatus !== 'agent-provisional' || !c.rationale?.trim() || !c.files?.length || !c.evidence?.length) throw Error('Invalid case: '+c.id);
    ids.add(c.id);
    const paths=new Set();
    for (const f of c.files) {
      if (!f.path || /(^\/|\\|:)/.test(f.path) || f.path.split('/').some(p=>!p || p==='.' || p==='..') || paths.has(f.path) || typeof f.content !== 'string') throw Error('Invalid evidence file');
      paths.add(f.path);
    }
    for(const e of c.evidence) {
      const f=c.files.find(f=>f.path===e.path);
      if(!f || !Number.isInteger(e.line) || e.line<1 || f.content.split('\n')[e.line-1]!==e.text || !e.text) throw Error('Evidence line mismatch: '+c.id);
    }
    if((c.variant==='bug')!==c.expected) throw Error('Variant label mismatch');
    const group=groups.get(c.family)??[];group.push(c);groups.set(c.family,group);
  }
  for(const group of groups.values()) {
    if(!['bug','fixed','negative'].every(v=>group.some(c=>c.variant===v)) || new Set(group.map(c=>c.rule+':'+c.finding)).size!==1) throw Error('Incomplete or inconsistent case family');
  }
  const results=corpus.cases.map(c=>{
    const findings=run(c);if(!Array.isArray(findings))throw Error('Invalid detector output');
    const actual=findings.some(f=>f.id===c.finding);
    return {...c,contentSha256:hash(c.files),actual,passed:actual===c.expected,actualFindings:findings.map(f=>({id:f.id,file:f.affectedFile,severity:f.severity}))};
  });
  const metrics=decisionMetrics(results);
  const byRule=groupMetrics(results,'rule');
  const priorities=Object.entries(byRule).map(([rule,m])=>({rule,fp:m.fp,fn:m.fn,cases:m.cases,precision:m.precision,recall:m.recall})).filter(m=>m.fp+m.fn>0).sort((a,b)=>(b.fp+b.fn)-(a.fp+a.fn)||a.rule.localeCompare(b.rule));
  const intervalsMeetTarget=Object.values(byRule).every(m=>m.precisionWilson95?.[0]>=95 && m.recallWilson95?.[0]>=95);
  return {schemaVersion:1,scope:'Selected compatibility rule/context contracts; other emitted findings are retained but not labeled or scored.',split:corpus.split,labelStatus:'agent-provisional',corpusSha256:hash(corpus),globalAccuracy:null,metrics,byRule,byEcosystem:groupMetrics(results,'ecosystem'),priorities,failures:results.filter(r=>!r.passed),results,
    claim:{status:'not-established',targets:{precision:95,recall:95},perRuleWilsonLowerBoundsMeetTarget:intervalsMeetTarget,blockers:['Development cases are not a blind holdout','Labels require independent adjudication','Rule contexts do not establish full-engine or whole-repository recall',...(!intervalsMeetTarget?['Insufficient per-rule evidence for 95% lower confidence bounds']:[])]}};
}
