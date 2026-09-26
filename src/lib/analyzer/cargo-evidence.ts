/** Bounded Cargo table reader. Does not resolve dependencies or execute Cargo. */
export function cargoTable(source: string, target: string): string {
  let section = ''; const lines: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) { section = header[1]; continue; }
    if (section === target) lines.push(line);
  }
  return lines.join('\n');
}
export function isVirtualCargoWorkspace(source: string): boolean {
  return /^\s*\[workspace\]\s*(?:#.*)?$/m.test(source) && !/^\s*\[package\]\s*(?:#.*)?$/m.test(source);
}
export function cargoPackageHas(source: string, key: string): boolean {
  return cargoTable(source, 'package').split(/\r?\n/).some(line => {
    const match = /^\s*([\w-]+)(?:\.workspace)?\s*=/.exec(line);
    return match?.[1] === key;
  }) || /^\s*workspace\s*=\s*true\s*(?:#.*)?$/m.test(cargoTable(source, `package.${key}`));
}
