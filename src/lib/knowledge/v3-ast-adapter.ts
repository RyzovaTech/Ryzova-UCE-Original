import * as ts from 'typescript';
import type { V3AstDetector, V3ProjectFile, V3RuleEvidence } from './v3-types';

/**
 * Synchronous, syntax-only adapter for JS/JSX/TS/TSX V3 AST rules.
 * No source is executed, no modules resolved, and no type-flow claims are made.
 *
 * A bounded parser is intentional: unsupported languages, malformed source, or
 * over-budget files produce no evidence, never a regex-based AST "match".
 */
const MAX_AST_FILE_CHARS = 256 * 1024;
const MAX_AST_NODES = 50_000;

export interface AstScanResult {
  evidence: V3RuleEvidence[];
  truncated: boolean;
}

function scriptKind(path: string): ts.ScriptKind | undefined {
  const ext = path.toLowerCase().split('.').pop();
  switch (ext) {
    case 'js': case 'mjs': case 'cjs': return ts.ScriptKind.JS;
    case 'jsx': return ts.ScriptKind.JSX;
    case 'ts': case 'mts': case 'cts': return ts.ScriptKind.TS;
    case 'tsx': return ts.ScriptKind.TSX;
    default: return undefined;
  }
}

/** Syntactic property chain only; aliases and data flow are deliberately not inferred. */
function expressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = expressionName(expression.expression);
    return owner ? `${owner}.${expression.name.text}` : undefined;
  }
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression)) {
    const owner = expressionName(expression.expression);
    return owner ? `${owner}.${expression.argumentExpression.text}` : undefined;
  }
  return undefined;
}

function exactIdentifier(expression: ts.Node): string | undefined {
  return ts.isIdentifier(expression) ? expression.text : undefined;
}

function importSpecifier(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const specifier = node.moduleSpecifier;
    return specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    const specifier = node.moduleReference.expression;
    return specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined;
  }
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) return undefined;
  const expression = node.expression;
  if (expression.kind !== ts.SyntaxKind.ImportKeyword && exactIdentifier(expression) !== 'require') return undefined;
  const argument = node.arguments[0];
  return ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument) ? argument.text : undefined;
}

function observedName(node: ts.Node, query: V3AstDetector['query']): string | undefined {
  switch (query) {
    case 'call':
      return ts.isCallExpression(node) ? expressionName(node.expression) : undefined;
    case 'import':
      return importSpecifier(node);
    case 'assignment':
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return ts.isIdentifier(node.left) ? node.left.text :
          ts.isPropertyAccessExpression(node.left) ? node.left.name.text :
            ts.isElementAccessExpression(node.left) && node.left.argumentExpression && ts.isStringLiteral(node.left.argumentExpression)
              ? node.left.argumentExpression.text : undefined;
      }
      return undefined;
    case 'jsx-attribute':
      return ts.isJsxAttribute(node) ? node.name.getText() : undefined;
    case 'declaration':
      if (ts.isVariableDeclaration(node)) return exactIdentifier(node.name);
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node)) return node.name?.text;
      return undefined;
  }
}

export function scanAstDetector(detector: V3AstDetector, file: V3ProjectFile, limit: number): AstScanResult {
  const kind = scriptKind(file.path);
  if (kind === undefined || !file.content || limit <= 0) return { evidence: [], truncated: false };
  if (file.content.length > MAX_AST_FILE_CHARS) return { evidence: [], truncated: true };

  const names = new Set(detector.names);
  // Cheap pre-filter saves AST allocations on source files without target identifiers.
  if (!detector.names.some(name => file.content!.includes(name.split('.').pop()!))) {
    return { evidence: [], truncated: false };
  }

  // TypeScript's parser supports JS/JSX/TS/TSX without executing or typechecking.
  // Parse errors are not valid AST evidence; do not attempt a regex fallback.
  const root = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, kind);
  if (root.parseDiagnostics.length) return { evidence: [], truncated: false };

  const stack: ts.Node[] = [root];
  const matches: V3RuleEvidence[] = [];
  let visited = 0;
  while (stack.length) {
    if (++visited > MAX_AST_NODES) return { evidence: [], truncated: true };
    const node = stack.pop()!;
    const found = observedName(node, detector.query);
    if (found && names.has(found)) {
      const line = root.getLineAndCharacterOfPosition(node.getStart(root)).line + 1;
      matches.push({ detector: 'ast', file: file.path, line, detail: `${detector.query}:${found}` });
      if (matches.length >= limit) return { evidence: matches, truncated: false };
    }
    ts.forEachChild(node, child => { stack.push(child); });
  }
  return { evidence: matches, truncated: false };
}
