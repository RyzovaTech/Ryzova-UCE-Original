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

export function useReportEngine() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      setHistory(loadHistory());
    } catch {
      setHistory([]);
    }
  }, []);

  const refresh = useCallback(() => {
    try {
      setHistory(loadHistory());
    } catch {
      setHistory([]);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      try {
        setHistory(deleteReportFromHistory(id));
      } catch {
        setHistory([]);
      }
    },
    []
  );

  const clear = useCallback(() => {
    try {
      clearHistory();
    } catch {
      // ignore — may throw in private browsing
    }
    setHistory([]);
  }, []);

  const getById = useCallback((id: string): AnalysisResult | null => {
    try {
      return getReport(id);
    } catch {
      return null;
    }
  }, []);

  const pin = useCallback((result: AnalysisResult) => {
    try {
      setHistory(saveReportToHistory(result));
    } catch {
      // ignore — may throw in private browsing
    }
  }, []);

  return { history, refresh, remove, clear, getById, pin };
}
