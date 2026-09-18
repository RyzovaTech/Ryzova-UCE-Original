import type { AnalysisResult } from './types';

const CACHE_PREFIX = 'uce:analysis-cache:v1:';
const CACHE_INDEX = 'uce:analysis-cache-index:v1';
const MAX_ENTRIES = 5;
const MAX_SERIALIZED_BYTES = 4 * 1024 * 1024;
const memory = new Map<string, AnalysisResult>();

export function loadCachedAnalysis(key: string): AnalysisResult | null {
  const hot = memory.get(key);
  if (hot) return structuredCloneSafe(hot);
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisResult;
    memory.set(key, parsed);
    touch(key);
    return structuredCloneSafe(parsed);
  } catch { return null; }
}

export function saveCachedAnalysis(key: string, result: AnalysisResult): void {
  memory.set(key, structuredCloneSafe(result));
  while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
  if (typeof sessionStorage === 'undefined') return;
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_SERIALIZED_BYTES) return;
    sessionStorage.setItem(CACHE_PREFIX + key, serialized);
    touch(key);
  } catch { /* Cache failure must never fail analysis. */ }
}

export function clearAnalysisCache(): void {
  memory.clear();
  if (typeof sessionStorage === 'undefined') return;
  try {
    for (const key of readIndex()) sessionStorage.removeItem(CACHE_PREFIX + key);
    sessionStorage.removeItem(CACHE_INDEX);
  } catch { /* restricted storage */ }
}

function touch(key: string): void {
  const next = [key, ...readIndex().filter((item) => item !== key)].slice(0, MAX_ENTRIES);
  try {
    sessionStorage.setItem(CACHE_INDEX, JSON.stringify(next));
    for (const stale of readIndex().filter((item) => !next.includes(item))) sessionStorage.removeItem(CACHE_PREFIX + stale);
  } catch { /* restricted storage */ }
}
function readIndex(): string[] { try { return JSON.parse(sessionStorage.getItem(CACHE_INDEX) ?? '[]') as string[]; } catch { return []; } }
function structuredCloneSafe<T>(value: T): T { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T; }
