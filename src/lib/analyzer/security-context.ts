import { tokenizer } from 'acorn';

interface Span { start: number; end: number; kind: 'comment' | 'literal'; }
export interface SecurityContext { spans: Span[]; }

/** Lexical context only: no execution, vulnerability proof, or trust-flow inference. */
export function securityContext(source: string, path: string): SecurityContext | undefined {
  if (/\.[cm]?[jt]sx?$/i.test(path)) {
    const spans: Span[] = [];
    try {
      const tokens = tokenizer(source, { ecmaVersion: 'latest', allowHashBang: true,
        onComment: (_block, _text, start, end) => spans.push({ start, end, kind: 'comment' }) });
      while (true) {
        const token = tokens.getToken();
        if (token.type.label === 'eof') break;
        if (['string', 'regexp', 'template', 'invalidTemplate'].includes(token.type.label)) spans.push({ start: token.start, end: token.end, kind: 'literal' });
      }
    } catch { /* Retain only verified prefix spans; unknown suffix stays reviewable. */ }
    return { spans: spans.sort((a, b) => a.start - b.start) };
  }
  if (!/\.(?:c|cc|cpp|h|hpp|java|go|rs|php)$/i.test(path)) return undefined;
  const spans: Span[] = [];
  for (let i = 0; i < source.length; i++) {
    const start = i;
    const cppRaw = /\.(?:cc|cpp|h|hpp)$/i.test(path) ? /^R"([^()\\\s]{0,16})\(/.exec(source.slice(i, i + 20)) : null;
    const rustRaw = /\.rs$/i.test(path) ? /^r(#{0,32})"/.exec(source.slice(i, i + 35)) : null;
    if (cppRaw || rustRaw) {
      const closing = cppRaw ? ')' + cppRaw[1] + '"' : '"' + rustRaw![1];
      const openingLength = (cppRaw ?? rustRaw)![0].length;
      const end = source.indexOf(closing, i + openingLength);
      i = end < 0 ? source.length : end + closing.length;
      spans.push({ start, end: i, kind: 'literal' }); i--;
    } else if (source.slice(i, i + 2) === '//') {
      while (i < source.length && source[i] !== '\n') i++;
      spans.push({ start, end: i, kind: 'comment' }); i--;
    } else if (source.slice(i, i + 2) === '/*') {
      const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2;
      spans.push({ start, end: i, kind: 'comment' }); i--;
    } else if (source[i] === '"' || source[i] === "'" || (/\.go$/i.test(path) && source[i] === '`')) {
      // A Rust lifetime is a code token rather than a quoted character.
      if (/\.rs$/i.test(path) && source[i] === "'" && /^'[A-Za-z_]\w*(?!')/.test(source.slice(i))) continue;
      const quote = source[i++];
      for (; i < source.length; i++) {
        if (source[i] === '\\' && quote !== '`') { i++; continue; }
        if (source[i] === quote) { i++; break; }
        if (source[i] === '\n' && quote === "'") break;
      }
      spans.push({ start, end: i, kind: 'literal' }); i--;
    }
  }
  return { spans };
}

export function matchIsProse(context: SecurityContext, source: string, start: number, end: number, allowLiteral: boolean): boolean {
  // Binary search avoids repeatedly walking every token for each rule match.
  let low = 0, high = context.spans.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1, span = context.spans[middle];
    if (start < span.start) high = middle - 1;
    else if (start >= span.end) low = middle + 1;
    else {
      if (span.kind === 'comment') return true;
      if (allowLiteral) return false;
      // A quoted object key is configuration syntax, not a prose example.
      const quotedKey = /^["']/.test(source[span.start]) && /^\s*:/.test(source.slice(span.end));
      return !(quotedKey && end > span.end);
    }
  }
  return false;
}
