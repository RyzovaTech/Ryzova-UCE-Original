import { useCallback, useEffect, useState } from 'react';
import {
  loadHistory,
  deleteReportFromHistory,
  clearHistory,
  getReport,
  saveReportToHistory,
  type HistoryEntry,
} from '@/lib/storage';
import type { AnalysisResult } from '@/lib/analyzer/types';
import { clearLargeReports, deleteLargeReport, listLargeReports, persistLargeReport } from '@/lib/storage/large-reports';

async function allReports(): Promise<HistoryEntry[]> {
  const fromLocal = loadHistory();
  try {
    const fromDisk = await listLargeReports();
    const unique = new Map<string, HistoryEntry>();
    for (const entry of fromLocal) unique.set(entry.id, entry);
    for (const result of fromDisk) unique.set(result.id, { id: result.id, createdAt: result.createdAt, result });
    return [...unique.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20);
  } catch { return fromLocal; }
}

export function useReportEngine() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    setHistory(loadHistory());
    void allReports().then(reports => { if (active) setHistory(reports); });
    return () => { active = false; };
  }, []);

  const refresh = useCallback(() => {
    try {
      void allReports().then(setHistory);
    } catch {
      setHistory([]);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      try {
        setHistory(current => current.filter(entry => entry.id !== id));
        deleteReportFromHistory(id);
        void deleteLargeReport(id).catch(() => undefined).then(() => allReports().then(setHistory));
      } catch {
        setHistory([]);
      }
    },
    []
  );

  const clear = useCallback(() => {
    try {
      clearHistory();
      void clearLargeReports().catch(() => undefined).then(() => setHistory([]));
    } catch {
      // ignore — may throw in private browsing
    }
    setHistory([]);
  }, []);

  const getById = useCallback((id: string): AnalysisResult | null => {
    try {
      return history.find(entry => entry.id === id)?.result ?? getReport(id);
    } catch {
      return null;
    }
  }, [history]);

  const pin = useCallback((result: AnalysisResult) => {
    try {
      setHistory(saveReportToHistory(result));
      void persistLargeReport(result).then(() => allReports().then(setHistory)).catch(() => undefined);
    } catch {
      // ignore — may throw in private browsing
    }
  }, []);

  return { history, refresh, remove, clear, getById, pin };
}
