/** Bounded lexical readers. Scanned Python is never executed. */
export function maskPythonText(source: string): string {
  let output = ''; let quote = ''; let triple = false; let comment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (comment) { output += c === '\n' ? '\n' : ' '; if (c === '\n') comment = false; continue; }
    if (quote) {
      if (c === '\\') { output += ' '; if (i + 1 < source.length) output += source[++i] === '\n' ? '\n' : ' '; continue; }
      if (triple && source.slice(i, i + 3) === quote.repeat(3)) { output += '   '; i += 2; quote = ''; continue; }
      if (!triple && c === quote) quote = '';
      output += c === '\n' ? '\n' : ' '; continue;
    }
    if (c === '#') { comment = true; output += ' '; }
    else if (c === '"' || c === "'") { quote = c; triple = source.slice(i, i + 3) === c.repeat(3); output += triple ? '   ' : ' '; if (triple) i += 2; }
    else output += c;
  }
  return output;
}

/** Preserve executable literals while hiding comments and triple-quoted prose. */
export function maskPythonProse(source: string): string {
  let output = ''; let quote = ''; let triple = false; let comment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (comment) { output += c === '\n' ? '\n' : ' '; if (c === '\n') comment = false; continue; }
    if (quote) {
      if (c === '\\') { output += triple ? ' ' : c; if (i + 1 < source.length) { const next = source[++i]; output += triple && next !== '\n' ? ' ' : next; } continue; }
      if (triple && source.slice(i, i + 3) === quote.repeat(3)) { output += '   '; i += 2; quote = ''; triple = false; continue; }
      if (!triple && c === quote) quote = '';
      output += triple && c !== '\n' ? ' ' : c; continue;
    }
    if (c === '#') { comment = true; output += ' '; }
    else if (c === '"' || c === "'") { quote = c; triple = source.slice(i, i + 3) === c.repeat(3); output += triple ? '   ' : c; if (triple) i += 2; }
    else output += c;
  }
  return output;
}

/** Imports inside a TYPE_CHECKING block are only evaluated by type checkers. */
export function isTypeCheckingImport(source: string, offset: number): boolean {
  const preceding = source.slice(0, offset).split('\n');
  preceding.pop();
  const indent = source.slice(offset).match(/^[ \t]*/)?.[0].length ?? 0;
  if (indent === 0) return false;
  for (let index = preceding.length - 1; index >= 0; index--) {
    const line = preceding[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const outerIndent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (outerIndent >= indent) continue;
    return /^\s*if\s+(?:(?:t|typing)\.)?TYPE_CHECKING\s*:/.test(line);
  }
  return false;
}

export interface PythonDependency { name: string; version: string; type: 'runtime' | 'development' | 'optional' }
export function pythonDependencies(source: string): PythonDependency[] {
  const output: PythonDependency[] = [];
  let section = ''; let active = false; let quote = ''; let value = ''; let escaped = false; let objectDepth = 0;
  let type: PythonDependency['type'] = 'runtime';
  for (const raw of source.split(/\r?\n/)) {
    let line = raw;
    if (!active) {
      const header = /^\s*\[([^\]]+)\]/.exec(line);
      if (header) { section = header[1]; continue; }
      const assignment = /^\s*([\w-]+)\s*=\s*\[/.exec(line);
      if (!assignment) continue;
      if (section === 'project' && assignment[1] === 'dependencies') type = 'runtime';
      else if (section === 'project.optional-dependencies') type = 'optional';
      else if (section === 'dependency-groups' || (section === 'build-system' && assignment[1] === 'requires')) type = 'development';
      else continue;
      active = true; line = line.slice(assignment[0].length);
    }
    // A linear scan avoids regex backtracking on malformed/unclosed arrays.
    for (const char of line) {
      if (quote) {
        if (escaped) { value += char; escaped = false; continue; }
        if (char === '\\' && quote === '"') { escaped = true; continue; }
        if (char !== quote) { value += char; continue; }
        if (objectDepth === 0) {
          const item = /^([\w.-]+)(?:\[[^\]]+\])?\s*(.*)$/.exec(value);
          if (item) output.push({ name: item[1].toLowerCase().replace(/[-_.]+/g, '-'), version: item[2] || 'unspecified', type });
        }
        quote = ''; value = ''; continue;
      }
      if (char === '#') break;
      if (char === '"' || char === "'") { quote = char; value = ''; }
      else if (char === '{') objectDepth++;
      else if (char === '}') objectDepth = Math.max(0, objectDepth - 1);
      else if (char === ']' && objectDepth === 0) { active = false; break; }
    }
  }
  return [...new Map(output.map(item => [`${item.name}|${item.version}|${item.type}`, item])).values()];
}

export function pythonMetadataValue(source: string, table: string, key: string): string | undefined {
  let section = '';
  for (const raw of source.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]/.exec(raw);
    if (header) { section = header[1]; continue; }
    if (section !== table) continue;
    const assignment = /^\s*([\w-]+)\s*=\s*["']([^"']+)["']/.exec(raw);
    if (assignment?.[1] === key && assignment[2].trim()) return assignment[2];
  }
  return undefined;
}

export function pythonVersionRequirement(source: string): string | undefined {
  return pythonMetadataValue(source, 'project', 'requires-python') ?? pythonMetadataValue(source, 'tool.poetry.dependencies', 'python');
}
