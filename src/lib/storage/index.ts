import type { AnalysisResult } from '@/lib/analyzer/types';
import type { ShareableReport } from '@/lib/report/sharing';

const HISTORY_KEY = 'uce:history';
const SETTINGS_KEY = 'uce:settings';

export interface HistoryEntry {
  id: string;
  createdAt: string;
  result: AnalysisResult;
}

export interface StoredSettings {
  theme: 'light' | 'dark';
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse<HistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
  } catch {
    return [];
  }
}

export function saveReportToHistory(result: AnalysisResult): HistoryEntry[] {
  const history = loadHistory().filter((h) => h.id !== result.id);
  const entry: HistoryEntry = { id: result.id, createdAt: result.createdAt, result };
  const next = [entry, ...history].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    for (let cap = 10; cap >= 1; cap--) {
      try {
        const trimmed = [entry, ...history].slice(0, cap);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        console.warn(`[UCE] Storage quota exceeded — history truncated to ${trimmed.length} entr${trimmed.length === 1 ? 'y' : 'ies'}.`);
        return trimmed;
      } catch {
        // continue to smaller cap
      }
    }
    console.warn('[UCE] Storage quota exceeded — could not save report to local history.');
    return history;
  }
}

export function deleteReportFromHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((h) => h.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore — may throw in private browsing
  }
}

export function getReport(id: string): AnalysisResult | null {
  return loadHistory().find((h) => h.id === id)?.result ?? null;
}

export function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') return { theme: 'light' };
  try {
    return safeParse<StoredSettings>(localStorage.getItem(SETTINGS_KEY), { theme: 'light' });
  } catch {
    return { theme: 'light' };
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore — may throw in private browsing
  }
}

export function clearAllLocalData(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // ignore — may throw in private browsing or restricted environments
  }
}

export function toShareableList(history: HistoryEntry[]): ShareableReport[] {
  return history.map((h) => {
    const stats = h.result.summary.scanStats;
    return {
      id: h.id,
      createdAt: h.createdAt,
      analysisVersion: h.result.analysisVersion,
      projectName: h.result.summary.name,
      projectType: h.result.classification?.type ?? 'Software Project',
      isSoftware: h.result.classification?.isSoftware ?? true,
      overallScore: h.result.score.overall,
      issueCount: h.result.issues.length,
      criticalCount: h.result.issues.filter((i) => i.severity === 'critical').length,
      warningCount: h.result.issues.filter((i) => i.severity === 'warning').length,
      infoCount: h.result.issues.filter((i) => i.severity === 'info').length,
      source: h.result.source,
      projectSize: stats?.projectSize ?? 0,
      filesFound: stats?.filesFound ?? 0,
      filesAnalyzed: stats?.filesAnalyzed ?? 0,
      filesIgnored: stats?.filesIgnored ?? 0,
    };
  });
}
