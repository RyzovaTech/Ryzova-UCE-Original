/**
 * Trilogy T2 — independent, bounded read-only local relationship discovery.
 * Uses the TypeScript parser on supplied source strings, never executes them.
 * "Source-supported" verifies syntactic relationships only. This is not
 * runtime/build proof, independent ground truth or a solver result.
 */
import ts from 'typescript';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalEvidenceHash } from '../trilogy-t0/safety.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const sha = value => createHash('sha256').update(value).digest('hex');
const validPath = s => typeof s === 'string' && s.length <= 512 &&
  /^[a-zA-Z0-9_.@/-]+$/.test(s) && !s.startsWith('/') &&
  s.split('/').every(x => x && x !== '.' && x !== '..');
const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const LIMITS = Object.freeze({files:5000, packages:64, sourceBytes:4*1024*1024,
  fileBytes:256*1024, edges:4000, decisions:1000, specifierChars:240});

function cleanOptions(opt) {
  if (opt === undefined) return {inventoryComplete:false};
  if (!opt || typeof opt !== 'object' || Array.isArray(opt) ||
      (opt.inventoryComplete !== undefined && typeof opt.inventoryComplete !== 'boolean'))
    throw Error('T2 invalid inventory completeness assertion');
  return {inventoryComplete:opt.inventoryComplete===true};
}
function sanitizedSource(files) {
  if (!Array.isArray(files) || files.length > LIMITS.files)
    throw Error('T2 file inventory budget exceeded or invalid');
  const found = new Map();
  let readableBytes=0, unavailable=0;
  for (const f of files) {
    if (!f || !validPath(f.path) || f.isDirectory === true || found.has(f.path))
      throw Error('T2 file path invalid, duplicated or ambiguous');
    const size = typeof f.content === 'string' ? Buffer.byteLength(f.content) : null;
    if (size !== null && size <= LIMITS.fileBytes) {
      readableBytes += size;
      if (readableBytes > LIMITS.sourceBytes) throw Error('T2 source byte budget exceeded');
    } else unavailable++;
    found.set(f.path, {content:size!==null && size<=LIMITS.fileBytes ? f.content : null});
  }
  return {found,readableBytes,unavailable};
}
function parseSource(file, content) {
  const ext=path.posix.extname(file);
  const kind = ext==='.tsx'||ext==='.jsx' ? ts.ScriptKind.TSX :
    ext==='.ts'||ext==='.mts'||ext==='.cts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,kind);
  if (ast.parseDiagnostics?.length) return {imports:[],failed:true};
  const imports=[];
  const capture=(spec,node,kind)=>{
    if (typeof spec !== 'string' || !spec || spec.length>LIMITS.specifierChars) return;
    const start=ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1;
    imports.push({specifier:spec,line:start,kind});
  };
  const visit=node=>{
    if ((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      capture(node.moduleSpecifier.text,node,'static-module-reference');
    if (ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)&&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression))
      capture(node.moduleReference.expression.text,node,'import-equals');
    if (ts.isCallExpression(node)&&node.arguments.length===1 &&
        ts.isStringLiteral(node.arguments[0])) {
      const call = node.expression;
      if (call.kind===ts.SyntaxKind.ImportKeyword)
        capture(node.arguments[0].text,node,'dynamic-import-literal');
      else if (ts.isIdentifier(call)&&call.text==='require')
        capture(node.arguments[0].text,node,'require-literal');
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  return {imports,failed:false};
}
function targetCandidates(origin,spec) {
  if (!/^\.{1,2}\//.test(spec) || /[?#\\\x00-\x1f\x7f]/.test(spec)) return null;
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(origin),spec));
  if (!validPath(target)) return null;
  const hasExt=path.posix.extname(target)!=='';
  const candidates=new Set([target]);
  if (!hasExt) {
    for(const ext of ['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs','.json'])
      candidates.add(target+ext);
    for(const ext of ['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs'])
      candidates.add(target+'/index'+ext);
  } else if (/\.(?:js|mjs|cjs)$/i.test(target)) {
    const prefix=target.replace(/\.(?:js|mjs|cjs)$/i,'');
    for(const ext of ['.ts','.tsx','.mts','.cts']) candidates.add(prefix+ext);
  }
  return [...candidates];
}
function runtimePin(content) {
  if (typeof content!=='string') return null;
  const active=content.split(/\r\n|\r|\n/)
    .map(l=>l.replace(/\s*#.*$/,'').trim()).filter(Boolean);
  return active.length===1 && /^v?(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,4})){0,2}$/.test(active[0])
    ? Number(active[0].replace(/^v/,'').split('.')[0]) : null;
}
function restrictedNodeRange(value,pinMajor) {
  if (typeof value!=='string'||!Number.isSafeInteger(pinMajor)) return 'unknown';
  // Conservative subset only; unsupported range syntax is never assumed false.
  const compact=value.trim();
  const exact=/^v?(\d{1,3})(?:\.\d+(?:\.\d+)?)?$/.exec(compact);
  if(exact) return Number(exact[1])===pinMajor?'modeled-overlap':'modeled-disjoint';
  const lower=/^>=\s*(\d{1,3})$/.exec(compact);
  if(lower) return pinMajor<Number(lower[1])?'modeled-disjoint':'modeled-overlap';
  const upper=/^<\s*(\d{1,3})$/.exec(compact);
  if(upper) return pinMajor>=Number(upper[1])?'modeled-disjoint':'modeled-overlap';
  // Avoid overclaiming semver interpretation or pre-release compatibility.
  return 'unknown';
}
function sorted(values) {return [...values].sort((a,b)=>a<b?-1:a>b?1:0);}
function fact(type,source,target,detail,reason,kind,line=null) {
  return {
    id:sha([type,source,target,detail,kind,line].join('\0')),
    type,kind,status:reason,fromSha256:sha(source),
    toSha256:target===null?null:sha(target), evidenceSha256:sha(detail),
    sourceLine:line, originalSource:'supplied-local-snapshot',
    verifiedCompatibility:false, verifiedRootCause:false,
    safeAutoFix:false,
  };
}
/**
 * The report and snapshots should refer to the same revision; T2 cannot
 * authenticate that provenance. No network requests or project execution.
 */
export function buildWholeProjectGraph(report,sourceFiles,options) {
  const before=JSON.stringify(report);
  const beforeInputs=JSON.stringify(sourceFiles);
  const projection=canonicalEvidenceHash(report);
  const opts=cleanOptions(options);
  const {found,readableBytes,unavailable}=sanitizedSource(sourceFiles);
  const paths=sorted(found.keys());
  const partial=describeReportReadiness(report).partial ||
    report.classification?.isSoftware===false;
  const missingReviewAllowed=opts.inventoryComplete && !partial && unavailable===0;
  const edges=[],decisions=[];
  let skippedDynamic=0,parseFailures=0,limitReached=false,packageProblems=0;
  let packages=0;
  const packagesByName=new Map();
  const push=(collection,value,max)=>{
    if(collection.length>=max){limitReached=true;return false}
    collection.push(value);return true;
  };
  for(const file of paths.filter(p=>/(^|\/)package\.json$/.test(p))) {
    packages++;
    if(packages>LIMITS.packages){limitReached=true;break}
    const record=found.get(file);
    if(record.content===null){packageProblems++;continue}
    let data;
    try {data=JSON.parse(record.content)}catch{packageProblems++;continue}
    if(!data||typeof data!=='object'||Array.isArray(data)){packageProblems++;continue}
    const name=data.name;
    if(typeof name==='string' && /^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]{1,100}$/.test(name)){
      const prior=packagesByName.get(name);
      if(prior) packagesByName.set(name,null);
      else if(!packagesByName.has(name)) packagesByName.set(name,file);
    }
    const directory=path.posix.dirname(file)==='.'?'':path.posix.dirname(file)+'/';
    const required=data.engines?.node;
    if(typeof required!=='string')continue;
    for(const pinFile of ['.nvmrc','.node-version']) {
      const p=directory+pinFile;
      if(!found.has(p))continue;
      const content=found.get(p).content;
      const version=runtimePin(content);
      const decision=restrictedNodeRange(required,version);
      const facts=sha(JSON.stringify([required,content]));
      const status=decision==='modeled-disjoint'?'review-required':
        decision==='modeled-overlap'?'source-supported':'unknown';
      push(decisions, fact('runtime-pin-vs-engine',file,p,facts,status,decision),LIMITS.decisions);
    }
  }
  for(const file of paths.filter(p=>SOURCE.test(p))) {
    const content=found.get(file).content;
    if(content===null){parseFailures++;continue}
    const parsed=parseSource(file,content);
    if(parsed.failed){parseFailures++;continue}
    for(const item of parsed.imports) {
      if(edges.length>=LIMITS.edges){limitReached=true;break}
      const spec=item.specifier;
      const relative=/^\.{1,2}\//.test(spec);
      if(relative){
        const candidates=targetCandidates(file,spec);
        const existing=candidates?.filter(p=>found.has(p))??[];
        // Ambiguous candidates cannot be represented as a single proven link.
        const target=existing.length===1?existing[0]:null;
        const status=!candidates?'unknown':
          existing.length>1?'unknown':
          existing.length===1 ? 'source-supported':
          missingReviewAllowed?'review-required':'unknown';
        edges.push(fact('relative-source-import',file,target,
          JSON.stringify([spec,candidates?.length??0,existing.length]),status,item.kind,item.line));
      } else if (!/^(?:node:|https?:|file:)/i.test(spec)) {
        const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];
        const located=packagesByName.get(name);
        if (typeof located==='string'&&located!==file) edges.push(fact(
          'workspace-package-reference',file,located,name,
          'source-supported',item.kind,item.line));
        else skippedDynamic++;
      } else skippedDynamic++;
    }
    if(limitReached)break;
  }
  edges.sort((a,b)=>a.id.localeCompare(b.id));
  decisions.sort((a,b)=>a.id.localeCompare(b.id));
  const counts={relationships:edges.length,sourceSupported:edges.filter(x=>x.status==='source-supported').length,
    reviewRequired:edges.filter(x=>x.status==='review-required').length,
    unknown:edges.filter(x=>x.status==='unknown').length,
    runtimeDecisions:decisions.length,runtimeReviewRequired:decisions.filter(x=>x.status==='review-required').length,
    parseOrUnreadableFiles:parseFailures,manifestReadFailures:packageProblems,
    unmodeledPackageImports:skippedDynamic};
  const result={
    schemaVersion:1,stage:'Trilogy-T2',mode:'read-only-independent-source-graph',
    canonicalEvidenceSha256:projection,
    suppliedInventorySha256:sha(JSON.stringify(paths.map(p=>[p,
      found.get(p).content===null?null:sha(found.get(p).content)]))),
    sourceSnapshotAuthenticated:false,
    inputScope:partial?'partial-UCE-report':opts.inventoryComplete?'caller-asserted-inventory':'inventory-not-established',
    coverage:{
      filesListed:paths.length,filesReadable:paths.length-unavailable,readableBytes,
      truncatedByBudget:limitReached,parseFailures,
      negativeAbsenceEligible:missingReviewAllowed&&!limitReached&&parseFailures===0&&packageProblems===0,
    },
    counts,edges,decisions,
    originalCoreScore:report.score.overall,originalIssueCount:report.issues.length,
    modifiedCanonicalReport:false,
    verifiedCompatibilityCount:0,verifiedVulnerabilityCount:0,
    independentlyAdjudicatedAccuracy:null,recall:null,precision:null,
    falsePositiveRate:null,falseNegativeRate:null,
    automaticPatchesAllowed:false,generatedPatches:0,
    limitations:[
      'AST import declarations are syntax observations; their resolution candidates do not prove a build or runtime import succeeds.',
      'Missing relative targets remain review signals even when inventory is caller-asserted complete; generated modules, tsconfig aliases, bundler rules and external dependencies may resolve them.',
      'Workspace-name import links indicate possible relationships, not authoritative dependency installation.',
      'Runtime comparisons model only explicit same-directory Node major pins with a restricted range subset; even an overlap is not proof of execution.',
      'Source bytes are caller supplied, not authenticated by T2 against the original UCE scanned revision.',
      'No source code is executed; no original UCE scores/issues are changed and no fixes are applied.',
      'Synthetic contract tests are not independently adjudicated real-world accuracy measurements.',
    ],
  };
  if(JSON.stringify(report)!==before || JSON.stringify(sourceFiles)!==beforeInputs)
    throw Error('T2 mutated canonical report or source inventory');
  return result;
}
