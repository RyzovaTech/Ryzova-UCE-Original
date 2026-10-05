type Version = [number, number, number];
interface Interval { low: Version; high?: Version; lowInclusive: boolean; highInclusive: boolean; }
const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const any = (): Interval => ({ low: [0, 0, 0], lowInclusive: true, highInclusive: false });
function intersection(a: Interval, b: Interval): Interval | undefined {
  const lowOrder = compare(a.low, b.low);
  const low = lowOrder > 0 ? a.low : b.low;
  const lowInclusive = lowOrder === 0 ? a.lowInclusive && b.lowInclusive : lowOrder > 0 ? a.lowInclusive : b.lowInclusive;
  const highOrder = !a.high ? 1 : !b.high ? -1 : compare(a.high, b.high);
  const high = highOrder > 0 ? b.high : a.high;
  const highInclusive = highOrder === 0 ? a.highInclusive && b.highInclusive : highOrder > 0 ? b.highInclusive : a.highInclusive;
  if (high && (compare(low, high) > 0 || (compare(low, high) === 0 && !(lowInclusive && highInclusive)))) return undefined;
  return { low, high, lowInclusive, highInclusive };
}
function tokenInterval(token: string): Interval | undefined {
  if (/^(?:\*|x)$/i.test(token)) return any();
  const match = /^(>=|<=|>|<|=|\^|~)?v?(0|[1-9]\d*)(?:\.(0|[1-9]\d*|x|\*))?(?:\.(0|[1-9]\d*|x|\*))?$/i.exec(token);
  if (!match) return undefined;
  const [, operator = '', major, minor, patch] = match;
  const parts = [major, minor, patch];
  const count = parts.findIndex(part => part === undefined || /^[x*]$/i.test(part));
  const precision = count < 0 ? 3 : count;
  if (parts.slice(precision).some(part => part !== undefined && !/^[x*]$/i.test(part))) return undefined;
  const low = parts.map(part => part && !/^[x*]$/i.test(part) ? Number(part) : 0) as Version;
  if (low.some(value => !Number.isSafeInteger(value) || value > 1_000_000)) return undefined;
  const next = [...low] as Version; next[precision - 1]++; for (let i = precision; i < 3; i++) next[i] = 0;
  if (operator === '^' || operator === '~') {
    const index = operator === '~' ? (precision < 2 ? 0 : 1) : low[0] > 0 || precision === 1 ? 0 : low[1] > 0 || precision === 2 ? 1 : 2;
    const high = [...low] as Version; high[index]++; for (let i = index + 1; i < 3; i++) high[i] = 0;
    return { low, high, lowInclusive: true, highInclusive: false };
  }
  if (operator === '>=' || operator === '>') return { low: operator === '>' && precision < 3 ? next : low, lowInclusive: operator === '>=' || precision < 3, highInclusive: false };
  if (operator === '<=' || operator === '<') return { low: [0, 0, 0], high: operator === '<=' && precision < 3 ? next : low, lowInclusive: true, highInclusive: operator === '<=' && precision === 3 };
  return { low, high: precision === 3 ? low : next, lowInclusive: true, highInclusive: precision === 3 };
}
function intervals(range: string): Interval[] | undefined {
  if (!range.trim() || range.length > 256) return undefined;
  const alternatives = range.trim().split(/\s*\|\|\s*/);
  if (alternatives.length > 8) return undefined;
  const result: Interval[] = [];
  for (const alternative of alternatives) {
    const tokens = alternative.replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/);
    if (!alternative || tokens.length > 8) return undefined;
    let interval: Interval | undefined = any();
    for (const token of tokens) {
      const bound = tokenInterval(token); if (!bound) return undefined;
      if (interval) interval = intersection(interval, bound);
    }
    if (interval) result.push(interval);
  }
  // Empty or contradictory requirements are invalid metadata, not conflicts.
  return result.length ? result : undefined;
}
/** Bounded stable numeric npm-style ranges. Unsupported syntax remains unknown. */
export function versionRangesDisjoint(required: string, selected: string): boolean | undefined {
  const a = intervals(required), b = intervals(selected);
  if (!a || !b) return undefined;
  return !a.some(left => b.some(right => intersection(left, right)));
}

