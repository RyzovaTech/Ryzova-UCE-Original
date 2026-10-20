import { Parser } from 'acorn';
import * as jsxModule from 'acorn-jsx';
import tsPlugin from 'acorn-typescript';
import type { V3AstDetector, V3ProjectFile, V3RuleEvidence } from './v3-types';

/**
 * Syntax-only AST adapter for JS/JSX/TS/TSX using the lightweight Acorn
 * TypeScript plugin. Scanned project code is never executed or typechecked.
 */
const MAX_AST_FILE_CHARS = 256 * 1024;
const MAX_AST_NODES = 50_000;
// The plugin's AcornParseClass constructor declaration differs from Acorn's
// protected Parser constructor type; the documented runtime API is compatible.
// acorn-jsx is CommonJS: Vite ESM and the trusted Node test loaders expose
// its callable export via different interop shapes.
type JsxPluginFactory = () => (BaseParser: typeof Parser) => typeof Parser;
const jsx = (jsxModule as unknown as { default?: JsxPluginFactory }).default ??
  (jsxModule as unknown as JsxPluginFactory);
const TypedParser = Parser.extend(tsPlugin() as unknown as (BaseParser: typeof Parser) => typeof Parser);
const TsxParser = Parser.extend(jsx(), tsPlugin() as unknown as (BaseParser: typeof Parser) => typeof Parser);
const PlainJsxParser = Parser.extend(jsx());

interface AstNode {
  type: string;
  loc?: { start: { line: number } };
  [key: string]: unknown;
}
export interface AstScanResult { evidence: V3RuleEvidence[]; truncated: boolean; }

function isNode(value: unknown): value is AstNode {
  return !!value && typeof value === 'object' && typeof (value as AstNode).type === 'string';
}
function sourcePath(path: string): boolean {
  return /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i.test(path);
}
function identifier(node: unknown): string | undefined {
  return isNode(node) && node.type === 'Identifier' ? String(node.name) : undefined;
}
function literal(node: unknown): string | undefined {
  return isNode(node) && node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}
function expressionName(value: unknown): string | undefined {
  if (!isNode(value)) return undefined;
  if (value.type === 'Identifier') return identifier(value);
  if (value.type !== 'MemberExpression' || !isNode(value.object)) return undefined;
  const object = expressionName(value.object);
  const name = value.computed ? literal(value.property) : identifier(value.property);
  return object && name ? `${object}.${name}` : undefined;
}
function importSpecifier(node: AstNode): string | undefined {
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
    return literal(node.source);
  }
  if (node.type === 'TSImportEqualsDeclaration' && isNode(node.moduleReference) && node.moduleReference.type === 'TSExternalModuleReference') {
    return literal(node.moduleReference.expression);
  }
  if (node.type !== 'CallExpression' || !Array.isArray(node.arguments) || node.arguments.length !== 1) return undefined;
  if (!isNode(node.callee) || !['Import', 'Identifier'].includes(node.callee.type)) return undefined;
  if (node.callee.type === 'Identifier' && identifier(node.callee) !== 'require') return undefined;
  const arg = node.arguments[0];
  return literal(arg) ?? (isNode(arg) && arg.type === 'TemplateLiteral' && Array.isArray(arg.expressions) && arg.expressions.length === 0 &&
    Array.isArray(arg.quasis) && arg.quasis.length === 1 && isNode(arg.quasis[0]) ? String((arg.quasis[0].value as { cooked?: unknown })?.cooked) : undefined);
}
function observedName(node: AstNode, query: V3AstDetector['query']): string | undefined {
  if (query === 'import') return importSpecifier(node);
  if (query === 'call') return node.type === 'CallExpression' ? expressionName(node.callee) : undefined;
  if (query === 'assignment') {
    if (node.type !== 'AssignmentExpression' || node.operator !== '=') return undefined;
    const left = node.left;
    if (!isNode(left)) return undefined;
    if (left.type === 'Identifier') return identifier(left);
    if (left.type === 'MemberExpression') return left.computed ? literal(left.property) : identifier(left.property);
    return undefined;
  }
  if (query === 'jsx-attribute') {
    return node.type === 'JSXAttribute' ? identifier(node.name) : undefined;
  }
  if (query === 'declaration' && [
    'VariableDeclarator', 'FunctionDeclaration', 'ClassDeclaration', 'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration', 'TSEnumDeclaration', 'EnumDeclaration',
  ].includes(node.type)) return identifier(node.id);
  return undefined;
}

export function scanAstDetector(detector: V3AstDetector, file: V3ProjectFile, limit: number): AstScanResult {
  if (!sourcePath(file.path) || !file.content || limit <= 0) return { evidence: [], truncated: false };
  if (file.content.length > MAX_AST_FILE_CHARS) return { evidence: [], truncated: true };
  const names = new Set(detector.names);
  if (!detector.names.some(name => file.content!.includes(name.split('.').pop()!))) {
    return { evidence: [], truncated: false };
  }

  let root: AstNode | undefined;
  // Keep the TypeScript grammar separate from JSX. Composing parser plugins
  // can change tokenization even in .ts files without any JSX.
  const parsers = /\\.tsx$/i.test(file.path) ? [TsxParser, PlainJsxParser, TypedParser]
    : /\\.jsx$/i.test(file.path) ? [PlainJsxParser, TsxParser]
      : [TypedParser];
  for (const parser of parsers) {
    try {
      root = parser.parse(file.content, {
        ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true,
      }) as unknown as AstNode;
      break;
    } catch { /* Only a successful full parse may establish syntax evidence. */ }
  }
  if (!root) return { evidence: [], truncated: false };

  const pending: AstNode[] = [root];
  const evidence: V3RuleEvidence[] = [];
  let visited = 0;
  while (pending.length) {
    if (++visited > MAX_AST_NODES) return { evidence: [], truncated: true };
    const node = pending.pop()!;
    const name = observedName(node, detector.query);
    if (name && names.has(name)) {
      evidence.push({ detector: 'ast', file: file.path, line: node.loc?.start.line,
        detail: `${detector.query}:${name}` });
      if (evidence.length >= limit) break;
    }
    for (const value of Object.values(node)) {
      if (isNode(value)) pending.push(value);
      else if (Array.isArray(value)) for (const child of value) if (isNode(child)) pending.push(child);
    }
  }
  return { evidence: evidence.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)), truncated: false };
}
