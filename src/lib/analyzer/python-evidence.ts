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

export interface PythonDependency { name: string; version: string; type: 'runtime' | 'development' | 'optional' }
export function pythonDependencies(source: string): PythonDependency[] {
  const output: PythonDependency[] = [];
  // Keep table boundaries so arbitrary documentation strings are not dependencies.
  let section = '';
  for (const block of source.split(/(?=^\s*\[[^\n]+\]\s*(?:#.*)?$)/m)) {
    const header = /^\s*\[([^\n]+)\]/.exec(block);
    if (header) section = header[1];
    const body = header ? block.slice(header[0].length) : block;
    const type = section === 'project' ? 'runtime' : section === 'project.optional-dependencies' ? 'optional' : 'development';
    if (section === 'project' || section === 'project.optional-dependencies' || section === 'dependency-groups' || section === 'build-system') {
      for (const array of body.matchAll(/^[ \t]*([\w-]+)\s*=\s*\[((?:"(?:\\.|[^"\\])*"|'[^']*'|#[^\n]*|[^\]"'])*)\]/gm)) {
        if (section === 'project' && array[1] !== 'dependencies') continue;
        if (section === 'build-system' && array[1] !== 'requires') continue;
        for (const quoted of array[2].replace(/\{[^}]*\}/g, '').replace(/#[^\n]*/g, '').matchAll(/["']([^"']+)["']/g)) {
          const match = /^([\w.-]+)(?:\[[^\]]+\])?\s*(.*)$/.exec(quoted[1]);
          if (match && !quoted[1].includes('include-group')) output.push({ name: match[1].toLowerCase().replace(/[-_.]+/g, '-'), version: match[2] || 'unspecified', type });
        }
      }
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
