import { RegExpParser } from '@eslint-community/regexpp';

/** A deterministic syntax witness for smoke testing legacy regex definitions.
 * These generated strings are NOT independently curated real-project fixtures.
 */
export function syntaxWitness(pattern, flags = '') {
  const ast = new RegExpParser().parsePattern(pattern, 0, pattern.length, flags.includes('u'));
  for (let variant = 0; variant < 8; variant++) {
    const sample = emit(ast, variant);
    if (new RegExp(pattern, flags).test(sample)) return sample;
  }
  throw Error('No generated witness for ' + pattern);
}
function emit(node, variant) {
  switch (node.type) {
    case 'Pattern':
    case 'Group':
    case 'CapturingGroup':
      return emit(node.alternatives[variant % node.alternatives.length], variant);
    case 'Alternative': return node.elements.map(element => emit(element, variant)).join('');
    case 'Character': return String.fromCodePoint(node.value);
    case 'CharacterSet':
    case 'CharacterClass': {
      for (const candidate of ['a', '0', 'x', ' ', '_', '.', '-', ':', '"', '/', 'A', '1', '\n']) {
        try { if (new RegExp('^(?:' + node.raw + ')$', 'u').test(candidate)) return candidate; } catch { /* try plain mode */ }
        try { if (new RegExp('^(?:' + node.raw + ')$').test(candidate)) return candidate; } catch { /* next */ }
      }
      throw Error('No character for ' + node.raw);
    }
    case 'Quantifier': return Array.from({ length: node.min || (variant % 2) }, () => emit(node.element, variant)).join('');
    case 'Assertion': return node.kind === 'lookahead' && !node.negate ? emit(node.alternatives[0], variant) : '';
    case 'Backreference': return 'a';
    default: throw Error('Unsupported regex AST node ' + node.type);
  }
}
