import type { ProjectFile } from './types';

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'component' | 'export';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  exported: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  kind: 'import' | 'require' | 'dynamic-import';
}

export interface ApiEndpoint {
  method: string;
  route: string;
  file: string;
  line: number;
  framework?: string;
}

export interface CodeQualitySignals {
  largeFiles: Array<{ file: string; lines: number }>;
  largeFunctions: Array<{ file: string; name: string; line: number }>;
  todoCount: number;
  fixmeCount: number;
  circularDependencies: string[][];
}

export interface CodeIntelligence {
  filesAnalyzed: number;
  symbols: CodeSymbol[];
  dependencyEdges: DependencyEdge[];
  apiEndpoints: ApiEndpoint[];
  entryPoints: string[];
  architectureAreas: Record<string, string[]>;
  quality: CodeQualitySignals;
}

const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|py|java|kt|kts|go|rs|php|rb|ex|exs|dart|swift|scala|cs|c|cc|cpp|h|hpp|zig|lua|jl|r|cr|nim|sol|v|erl|hrl)$/i;
const IMPORT_RE = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(|import\s*\()(['"])([^'"]+)\1/g;
const SYMBOL_PATTERNS: Array<[SymbolKind, RegExp]> = [
  ['function', /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g],
  ['class', /\bclass\s+([A-Za-z_$][\w$]*)/g],
  ['interface', /\binterface\s+([A-Za-z_$][\w$]*)/g],
  ['type', /\btype\s+([A-Za-z_$][\w$]*)\s*=/g],
  ['enum', /\benum\s+([A-Za-z_$][\w$]*)/g],
  ['component', /\b(?:const|function)\s+([A-Z][A-Za-z0-9_$]*)/g],
];

// API detection is intentionally strict. Generic `.get(...)` calls are not
// routes: they are commonly HTTP headers, maps, DOM APIs, or arbitrary data
// access. A route must look like an actual path and be attached to a known
// server/router object, or use a framework-specific decorator.
const API_PATTERNS: Array<[string, RegExp]> = [
  ['GET', /\b(?:app|router|server|api|fastify)\s*\.\s*get\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['POST', /\b(?:app|router|server|api|fastify)\s*\.\s*post\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['PUT', /\b(?:app|router|server|api|fastify)\s*\.\s*put\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['PATCH', /\b(?:app|router|server|api|fastify)\s*\.\s*patch\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['DELETE', /\b(?:app|router|server|api|fastify)\s*\.\s*delete\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['OPTIONS', /\b(?:app|router|server|api|fastify)\s*\.\s*options\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['HEAD', /\b(?:app|router|server|api|fastify)\s*\.\s*head\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['ROUTE', /\b(?:app|router|server|api)\s*\.\s*route\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['GET', /@(?:app|router)\.(?:get)\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['POST', /@(?:app|router)\.(?:post)\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['PUT', /@(?:app|router)\.(?:put)\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['DELETE', /@(?:app|router)\.(?:delete)\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
  ['GET', /@(app|router)\.(?:route)\s*\(\s*[`'\"](\/[^`'\"]*)[`'\"]/gi],
];

function lineAt(source: string, offset: number): number { return source.slice(0, offset).split('\n').length; }
function isSource(file: ProjectFile): boolean { return !file.isDirectory && SOURCE_RE.test(file.path); }
function normalizeTarget(from: string, target: string, files: ProjectFile[]): string | undefined {
  if (!target.startsWith('.')) return undefined;
  const base = from.split('/'); base.pop();
  const raw = [...base, ...target.split('/')];
  const parts: string[] = [];
  for (const part of raw) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); }
  const candidates = [parts.join('/'), ...['.ts','.tsx','.js','.jsx','.mjs','.cjs'].map((ext) => `${parts.join('/')}${ext}`), ...['index.ts','index.tsx','index.js','index.jsx'].map((name) => `${parts.join('/')}/${name}`)];
  return files.find((file) => candidates.includes(file.path) && !file.isDirectory)?.path;
}

function areaFor(file: string): string {
  const lower = file.toLowerCase();
  if (/\b(api|route|routes|controller|controllers|server)\b/.test(lower)) return 'API';
  if (/\b(component|components|pages|views|ui)\b/.test(lower)) return 'Frontend';
  if (/\b(test|tests|spec|__tests__)\b/.test(lower)) return 'Testing';
  if (/\b(config|configs|configuration)\b/.test(lower)) return 'Configuration';
  if (/\b(lib|utils|utility|helpers|shared)\b/.test(lower)) return 'Shared';
  if (/\b(service|services|domain|repository|repositories|backend)\b/.test(lower)) return 'Backend';
  return 'Core';
}

function findCycles(edges: DependencyEdge[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const edge of edges) { if (!graph.has(edge.from)) graph.set(edge.from, []); if (!graph.has(edge.to)) graph.set(edge.to, []); graph.get(edge.from)!.push(edge.to); }
  const cycles: string[][] = []; const seen = new Set<string>();
  const visit = (start: string, node: string, path: string[]) => {
    const next = graph.get(node) ?? [];
    for (const target of next) {
      if (target === start && path.length > 1) { const cycle = [...path]; const key = [...cycle].sort().join('|'); if (!seen.has(key)) { seen.add(key); cycles.push(cycle); } }
      else if (!path.includes(target) && path.length < 8) visit(start, target, [...path, target]);
    }
  };
  for (const node of graph.keys()) visit(node, node, [node]);
  return cycles.slice(0, 20);
}

export function detectCodeIntelligence(files: ProjectFile[]): CodeIntelligence {
  const sourceFiles = files.filter(isSource);
  const symbols: CodeSymbol[] = [];
  const dependencyEdges: DependencyEdge[] = [];
  const apiEndpoints: ApiEndpoint[] = [];
  const architectureAreas: Record<string, string[]> = {};
  const largeFiles: Array<{ file: string; lines: number }> = [];
  const largeFunctions: Array<{ file: string; name: string; line: number }> = [];
  let todoCount = 0; let fixmeCount = 0;

  for (const file of sourceFiles) {
    const source = file.content ?? '';
    const lines = source ? source.split('\n').length : 0;
    const area = areaFor(file.path); (architectureAreas[area] ??= []).push(file.path);
    if (lines >= 500) largeFiles.push({ file: file.path, lines });
    for (const [kind, regex] of SYMBOL_PATTERNS) {
      regex.lastIndex = 0; let match: RegExpExecArray | null;
      while ((match = regex.exec(source))) {
        const name = match[1];
        if (kind === 'component' && symbols.some((s) => s.name === name && s.file === file.path)) continue;
        const before = source.slice(Math.max(0, match.index - 30), match.index);
        const exported = /\bexport\s*$/.test(before) || new RegExp(`\\bexport\\s+(?:default\\s+)?(?:async\\s+)?(?:function|class|const|interface|type|enum)\\s+${name}`).test(source);
        symbols.push({ name, kind, file: file.path, line: lineAt(source, match.index), exported });
        if (kind === 'function' && lines >= 250) largeFunctions.push({ file: file.path, name, line: lineAt(source, match.index) });
      }
    }
    IMPORT_RE.lastIndex = 0; let importMatch: RegExpExecArray | null;
    while ((importMatch = IMPORT_RE.exec(source))) {
      const target = normalizeTarget(file.path, importMatch[2], files);
      if (target) dependencyEdges.push({ from: file.path, to: target, kind: source.slice(importMatch.index, importMatch.index + 10).includes('require') ? 'require' : source.slice(importMatch.index, importMatch.index + 10).includes('import(') ? 'dynamic-import' : 'import' });
    }
    for (const [method, regex] of API_PATTERNS) {
      regex.lastIndex = 0; let match: RegExpExecArray | null;
      while ((match = regex.exec(source))) {
        // Decorator patterns may have an extra receiver capture; the route is
        // always the final capture group. This also keeps language names such
        // as C and C++ from being mistaken for endpoints.
        const route = match[match.length - 1];
        if (!route || !route.startsWith('/')) continue;
        apiEndpoints.push({ method, route, file: file.path, line: lineAt(source, match.index) });
      }
    }
    todoCount += (source.match(/\bTODO\b/gi) ?? []).length;
    fixmeCount += (source.match(/\bFIXME\b/gi) ?? []).length;
  }

  const entryPoints = sourceFiles.filter((file) => /(^|\/)(main|index|app|server|cli|start)\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt)$/i.test(file.path)).map((file) => file.path).slice(0, 20);
  const circularDependencies = findCycles(dependencyEdges);
  return {
    filesAnalyzed: sourceFiles.length,
    symbols: symbols.slice(0, 2000),
    dependencyEdges: dependencyEdges.slice(0, 3000),
    apiEndpoints: apiEndpoints.slice(0, 500),
    entryPoints,
    architectureAreas,
    quality: { largeFiles: largeFiles.slice(0, 50), largeFunctions: largeFunctions.slice(0, 50), todoCount, fixmeCount, circularDependencies },
  };
}
