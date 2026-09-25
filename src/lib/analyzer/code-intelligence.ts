import { isTypeCheckingImport, maskPythonText } from './python-evidence';
import type { ApiEndpoint, CallRelationship, CodeIntelligence, CodeSymbol, ComplexitySignal, DependencyEdge, DuplicateCodeSignal, ModuleBoundarySignal, ProjectFile } from './types';
import { API_ROUTE_RULES } from './api-knowledge';
import { isProjectEvidenceFile } from './project-scope';

type SymbolKind = CodeSymbol['kind'];

const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|go|rs|php|rb|ex|exs|dart|swift|scala|cs|c|cc|cpp|h|hpp|zig|lua|jl|r|cr|nim|sol|v|erl|hrl)$/i;
const IMPORT_RE = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(|import\s*\()(['"])([^'"]+)\1/g;
const SYMBOL_PATTERNS: Array<[SymbolKind, RegExp]> = [
  ['function', /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g], ['class', /\bclass\s+([A-Za-z_$][\w$]*)/g], ['interface', /\binterface\s+([A-Za-z_$][\w$]*)/g], ['type', /\btype\s+([A-Za-z_$][\w$]*)\s*=/g], ['enum', /\benum\s+([A-Za-z_$][\w$]*)/g], ['component', /\b(?:const|function)\s+([A-Z][A-Za-z0-9_$]*)/g],
];
function lineAt(source: string, offset: number): number { return source.slice(0, offset).split('\n').length; }
function isSource(file: ProjectFile): boolean { return !file.isDirectory && SOURCE_RE.test(file.path) && isProjectEvidenceFile(file); }
function normalizeRoute(route: string): string { const value = route.startsWith('/') ? route : `/${route}`; return value.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, ':$1').replace(/\/+/g, '/'); }
function blockEnd(source: string, offset: number): number | undefined { const open = source.indexOf('{', offset); if (open < 0 || open - offset > 300) return undefined; let depth = 0; let quote = ''; for (let index = open; index < source.length; index++) { const char = source[index]; if (quote) { if (char === quote && source[index - 1] !== '\\') quote = ''; continue; } if (char === '"' || char === "'" || char === '`') { quote = char; continue; } if (char === '{') depth++; else if (char === '}' && --depth === 0) return index; } return undefined; }
function parserFamily(path: string): string { const ext = path.toLowerCase().split('.').pop() ?? ''; if (['ts','tsx','js','jsx','mjs','cjs'].includes(ext)) return 'JavaScript/TypeScript'; if (ext === 'py') return 'Python'; if (['java','kt','kts','scala'].includes(ext)) return 'JVM'; if (['cs','fs','fsx'].includes(ext)) return '.NET'; if (['c','cc','cpp','h','hpp'].includes(ext)) return 'C/C++'; if (ext === 'go') return 'Go'; if (ext === 'rs') return 'Rust'; if (['rb','php','ex','exs','dart','swift'].includes(ext)) return ext.toUpperCase(); return 'Other'; }
function complexityFor(source: string, offset: number, end: number): { cyclomatic: number; cognitive: number } { const body = source.slice(offset, end); const branches = body.match(/\b(?:if|else\s+if|for|while|case|catch|when|match)\b|&&|\|\||\?/g) ?? []; const nesting = body.split('\n').reduce((score, line) => score + Math.max(0, (line.match(/^\s+/)?.[0].length ?? 0) / 4 - 1), 0); return { cyclomatic: 1 + branches.length, cognitive: Math.round(branches.length + Math.min(30, nesting / 3)) }; }
function callGraph(source: string, file: string, symbols: CodeSymbol[]): CallRelationship[] { const output: CallRelationship[] = []; const functions = symbols.filter((item) => item.file === file && (item.kind === 'function' || item.kind === 'component')); for (const caller of functions) { const start = source.split('\n').slice(0, caller.line - 1).join('\n').length; const end = blockEnd(source, start); if (end === undefined) continue; const body = source.slice(start, end); for (const match of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) { const callee = match[1]; if (callee === caller.name || /^(?:if|for|while|switch|catch|function)$/.test(callee)) continue; output.push({ caller: `${file}:${caller.name}`, callee, file, line: caller.line + body.slice(0, match.index).split('\n').length - 1, confidence: symbols.some((item) => item.name === callee) ? 85 : 55 }); } } return output; }
function duplicateSignals(files: ProjectFile[]): DuplicateCodeSignal[] { const blocks = new Map<string, Array<{ file: string; lines: number }>>(); for (const file of files) { const lines = (file.content ?? '').split('\n').map((line) => line.trim()).filter((line) => line.length > 8 && !/^(?:import|export|\/\/|#)/.test(line)); for (let index = 0; index + 5 < lines.length; index += 3) { const normalized = lines.slice(index, index + 6).join(' ').replace(/[A-Za-z_$][\w$]*/g, 'v').replace(/\d+/g, 'n'); if (normalized.length < 60) continue; const fingerprint = hash(normalized); (blocks.get(fingerprint) ?? blocks.set(fingerprint, []).get(fingerprint)!).push({ file: file.path, lines: 6 }); } } return [...blocks.entries()].filter(([, occurrences]) => new Set(occurrences.map((item) => item.file)).size > 1).slice(0, 30).map(([fingerprint, occurrences]) => ({ fingerprint, files: [...new Set(occurrences.map((item) => item.file))].slice(0, 8), lines: occurrences[0].lines })); }
function hash(value: string): string { let output = 2166136261; for (let index = 0; index < value.length; index++) { output ^= value.charCodeAt(index); output = Math.imul(output, 16777619); } return (output >>> 0).toString(16).padStart(8, '0'); }
function fileRoutes(file: ProjectFile, source: string): ApiEndpoint[] { const path = file.path.replace(/\\/g, '/'); const next = /(?:^|\/)app\/api\/(.+)\/route\.[cm]?[jt]s$/.exec(path); if (next) { const route = normalizeRoute('/api/' + next[1].replace(/\/(?:route)$/, '')); return [...source.matchAll(/\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map((match) => ({ method: match[1], route, file: file.path, line: lineAt(source, match.index), framework: 'Next.js App Router', confidence: 98 })); } const pages = /(?:^|\/)pages\/api\/(.+)\.[cm]?[jt]s$/.exec(path); return pages ? [{ method: 'ROUTE', route: normalizeRoute('/api/' + pages[1].replace(/\/index$/, '')), file: file.path, line: 1, framework: 'Next.js Pages Router', confidence: 94 }] : []; }
function normalizeTarget(from: string, target: string, files: ProjectFile[]): string | undefined {
  if (!target.startsWith('.')) return undefined; const base = from.split('/'); base.pop(); const raw = [...base, ...target.split('/')]; const parts: string[] = [];
  for (const part of raw) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); }
  const candidates = [parts.join('/'), ...['.ts','.tsx','.js','.jsx','.mjs','.cjs'].map((ext) => `${parts.join('/')}${ext}`), ...['index.ts','index.tsx','index.js','index.jsx'].map((name) => `${parts.join('/')}/${name}`)];
  return files.find((file) => candidates.includes(file.path) && !file.isDirectory)?.path;
}
function areaFor(file: string): string { const lower = file.toLowerCase(); if (/\b(api|route|routes|controller|controllers|server)\b/.test(lower)) return 'API'; if (/\b(component|components|pages|views|ui)\b/.test(lower)) return 'Frontend'; if (/\b(test|tests|spec|__tests__)\b/.test(lower)) return 'Testing'; if (/\b(config|configs|configuration)\b/.test(lower)) return 'Configuration'; if (/\b(lib|utils|utility|helpers|shared)\b/.test(lower)) return 'Shared'; if (/\b(service|services|domain|repository|repositories|backend)\b/.test(lower)) return 'Backend'; return 'Core'; }
function findCycles(edges: DependencyEdge[]): string[][] {
  const graph = new Map<string, Set<string>>(); const reverse = new Map<string, Set<string>>();
  for (const edge of edges) {
    (graph.get(edge.from) ?? graph.set(edge.from, new Set()).get(edge.from)!).add(edge.to);
    if (!graph.has(edge.to)) graph.set(edge.to, new Set());
    (reverse.get(edge.to) ?? reverse.set(edge.to, new Set()).get(edge.to)!).add(edge.from);
    if (!reverse.has(edge.from)) reverse.set(edge.from, new Set());
  }
  const visited = new Set<string>(); const finished: string[] = [];
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: Array<{ node: string; neighbors: string[]; next: number }> = [{ node: start, neighbors: [...graph.get(start)!], next: 0 }];
    while (stack.length) {
      const current = stack[stack.length - 1];
      if (current.next === current.neighbors.length) { finished.push(current.node); stack.pop(); continue; }
      const next = current.neighbors[current.next++];
      if (!visited.has(next)) { visited.add(next); stack.push({ node: next, neighbors: [...(graph.get(next) ?? [])], next: 0 }); }
    }
  }
  visited.clear(); const groups: string[][] = [];
  for (const start of finished.reverse()) {
    if (visited.has(start)) continue;
    visited.add(start); const members: string[] = []; const pending = [start];
    while (pending.length) {
      const node = pending.pop()!; members.push(node);
      for (const from of reverse.get(node) ?? []) if (!visited.has(from)) { visited.add(from); pending.push(from); }
    }
    if (members.length > 1 || (graph.get(start)?.has(start))) groups.push(members.sort());
  }
  return groups.slice(0, 20);
}
export function detectCodeIntelligence(files: ProjectFile[]): CodeIntelligence {
  const sourceFiles = files.filter(isSource); const symbols: CodeSymbol[] = []; const dependencyEdges: DependencyEdge[] = []; const apiEndpoints: ApiEndpoint[] = []; const architectureAreas: Record<string, string[]> = {}; const largeFiles: Array<{ file: string; lines: number }> = []; const largeFunctions: Array<{ file: string; name: string; line: number; lines?: number }> = []; const largeClasses: Array<{ file: string; name: string; line: number; lines: number }> = []; const complexity: ComplexitySignal[] = []; let todoCount = 0; let fixmeCount = 0;
  for (const file of sourceFiles) {
    const source = /\.py$/i.test(file.path) ? maskPythonText(file.content ?? '') : file.content ?? ''; const lines = source ? source.split('\n').length : 0; const area = areaFor(file.path); (architectureAreas[area] ??= []).push(file.path); if (lines >= 500) largeFiles.push({ file: file.path, lines });
    for (const [kind, regex] of (/\.py$/i.test(file.path) ? [['function', /^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)/gm], ['class', /^[ \t]*class[ \t]+([A-Za-z_]\w*)/gm]] as Array<[SymbolKind, RegExp]> : SYMBOL_PATTERNS)) { regex.lastIndex = 0; let match: RegExpExecArray | null; while ((match = regex.exec(source))) { const name = match[1]; if (kind === 'component' && symbols.some((s) => s.name === name && s.file === file.path)) continue; const before = source.slice(Math.max(0, match.index - 30), match.index); const exported = /\bexport\s*$/.test(before) || new RegExp(`\\bexport\\s+(?:default\\s+)?(?:async\\s+)?(?:function|class|const|interface|type|enum)\\s+${name}`).test(source); const line = lineAt(source, match.index); symbols.push({ name, kind, file: file.path, line, exported }); if (kind === 'function' || kind === 'class' || kind === 'component') { const end = /\.py$/i.test(file.path) ? undefined : blockEnd(source, match.index); const span = end === undefined ? undefined : lineAt(source, end) - line + 1; if (kind === 'class' && span && span >= 150) largeClasses.push({ file: file.path, name, line, lines: span }); else if (kind !== 'class' && span && span >= 80) largeFunctions.push({ file: file.path, name, line, lines: span }); if (end !== undefined) { const score = complexityFor(source, match.index, end); if (score.cyclomatic >= 10 || score.cognitive >= 12) complexity.push({ file: file.path, symbol: name, line, ...score }); } } } }
    IMPORT_RE.lastIndex = 0; let importMatch: RegExpExecArray | null; while ((importMatch = IMPORT_RE.exec(source))) { const target = normalizeTarget(file.path, importMatch[2], files); if (target) dependencyEdges.push({ from: file.path, to: target, kind: source.slice(importMatch.index, importMatch.index + 10).includes('require') ? 'require' : source.slice(importMatch.index, importMatch.index + 10).includes('import(') ? 'dynamic-import' : 'import' }); }
    if (/\.py$/i.test(file.path)) {
      for (const match of source.matchAll(/^[ \t]*(?:from[ \t]+([.\w]+)[ \t]+import[ \t]+([^\n]+)|import[ \t]+([\w.]+))/gm)) {
        if (isTypeCheckingImport(source, match.index)) continue;
        const module = match[1] ?? match[3];
        const dots = /^\.+/.exec(module)?.[0].length ?? 0;
        const base = file.path.split('/').slice(0, -1);
        if (dots) base.splice(Math.max(0, base.length - dots + 1));
        const name = module.slice(dots).replace(/\./g, '/');
        const roots = dots ? [base.join('/')] : ['', 'src'];
        for (const root of roots) {
          const path = [root, name].filter(Boolean).join('/');
          const candidates = [path + '.py', path + '/__init__.py'];
          if (match[2]) for (const item of match[2].split(',')) {
            const imported = /^\s*(\w+)/.exec(item)?.[1];
            if (imported) candidates.push(path + '/' + imported + '.py', path + '/' + imported + '/__init__.py');
          }
          for (const target of candidates) if (target !== file.path && files.some(f => f.path === target)) dependencyEdges.push({ from: file.path, to: target, kind: 'import' });
        }
      }
    }
    apiEndpoints.push(...fileRoutes(file, source));
    for (const rule of API_ROUTE_RULES) { const regex = new RegExp(rule.pattern.source, rule.pattern.flags); let match: RegExpExecArray | null; while ((match = regex.exec(file.content ?? ''))) { if (/\.py$/i.test(file.path) && !source.slice(match.index, match.index + 1).trim()) continue; const route = match[1]; if (!route) continue; apiEndpoints.push({ method: rule.method, route: normalizeRoute(route), file: file.path, line: lineAt(source, match.index), framework: rule.framework, confidence: rule.confidence }); } }
    todoCount += (source.match(/\bTODO\b/gi) ?? []).length; fixmeCount += (source.match(/\bFIXME\b/gi) ?? []).length;
  }
  const uniqueEdges = Array.from(new Map(dependencyEdges.map((edge) => [`${edge.from}|${edge.to}|${edge.kind}`, edge])).values());
  const entryPoints = sourceFiles.filter((file) => /(^|\/)(main|index|app|server|cli|start|__init__|__main__)\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt)$/i.test(file.path)).map((file) => file.path).slice(0, 20); const circularDependencies = findCycles(uniqueEdges);
  const uniqueEndpoints = Array.from(new Map(apiEndpoints.map((endpoint) => [`${endpoint.method}|${endpoint.route}|${endpoint.file}`, endpoint])).values());
  const referenced = new Set(uniqueEdges.map((edge) => edge.to));
  const unreferencedModules = sourceFiles.map((file) => file.path).filter((path) => /\.[cm]?[jt]sx?$/i.test(path) && !referenced.has(path) && !entryPoints.includes(path) && !/(?:^|\/)(?:vite|webpack|rollup|eslint|jest|vitest|playwright|cypress)\.config\./i.test(path)).slice(0, 100);
  const moduleBoundarySignals: ModuleBoundarySignal[] = uniqueEdges.flatMap((edge) => { const fromArea = areaFor(edge.from); const toArea = areaFor(edge.to); return (fromArea === 'Frontend' && toArea === 'Backend') || (fromArea === 'Core' && toArea === 'Testing') ? [{ from: edge.from, to: edge.to, fromArea, toArea }] : []; }).slice(0, 50);
  const callRelationships = sourceFiles.filter(file => /\.[cm]?[jt]sx?$/i.test(file.path)).flatMap((file) => callGraph(file.content ?? '', file.path, symbols)).slice(0, 3000);
  const duplicateCode = duplicateSignals(sourceFiles);
  const parserCoverage = sourceFiles.reduce<Record<string, number>>((result, file) => { const family = parserFamily(file.path); result[family] = (result[family] ?? 0) + 1; return result; }, {});
  const technicalDebtScore = Math.min(100, Math.round(todoCount * .25 + fixmeCount + circularDependencies.length * 5 + largeFiles.length * 2 + largeFunctions.length * 1.5 + largeClasses.length * 2 + complexity.length * 1.5 + duplicateCode.length * 2 + moduleBoundarySignals.length * 2));
  return { filesAnalyzed: sourceFiles.length, symbols: symbols.slice(0, 2000), dependencyEdges: uniqueEdges.slice(0, 3000), apiEndpoints: uniqueEndpoints.slice(0, 500), entryPoints, architectureAreas, callRelationships, parserCoverage, quality: { largeFiles: largeFiles.slice(0, 50), largeFunctions: largeFunctions.slice(0, 50), largeClasses: largeClasses.slice(0, 50), unreferencedModules, complexity: complexity.slice(0, 100), duplicateCode, moduleBoundarySignals, technicalDebtScore, todoCount, fixmeCount, circularDependencies }, frameworksCovered: [...new Set(uniqueEndpoints.map((endpoint) => endpoint.framework).filter((item): item is string => Boolean(item)))] };
}
