import { securityContext } from './security-context';

/** Exclude explicitly test-only inline modules while retaining source offsets. */
export function maskRustTestModules(source: string): string {
  const lexical = source.split('');
  for (const span of securityContext(source, 'source.rs')?.spans ?? []) {
    for (let i = span.start; i < span.end; i++) if (lexical[i] !== '\n' && lexical[i] !== '\r') lexical[i] = ' ';
  }
  const code = lexical.join('');
  const output = source.split('');
  const declarations = /#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\]\s*(?:#\s*\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?mod\s+[A-Za-z_]\w*\s*\{/g;
  for (const match of code.matchAll(declarations)) {
    let depth = 1, end = match.index + match[0].length;
    for (; end < code.length && depth > 0; end++) {
      if (code[end] === '{') depth++;
      else if (code[end] === '}') depth--;
    }
    // Incomplete syntax is uncertain: retain it for review.
    if (depth !== 0) continue;
    for (let i = match.index; i < end; i++) if (output[i] !== '\n' && output[i] !== '\r') output[i] = ' ';
  }
  return output.join('');
}
