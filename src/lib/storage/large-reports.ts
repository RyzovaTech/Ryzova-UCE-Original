import type { AnalysisResult } from '@/lib/analyzer/types';

const DATABASE = 'uce-report-history';
const STORE = 'reports';

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Report database could not open.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (value: T) => { settled = true; resolve(value); };
    const fail = (error: Error) => { settled = true; reject(error); };
    const transaction = db.transaction(STORE, mode);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); if (!settled) reject(transaction.error ?? new Error('Report storage transaction failed.')); };
    transaction.onabort = () => { db.close(); if (!settled) reject(transaction.error ?? new Error('Report storage transaction aborted.')); };
    action(transaction.objectStore(STORE), done, fail);
  });
}

export async function persistLargeReport(result: AnalysisResult): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(result);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Report could not be stored.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Report storage was aborted.')); };
  });
}

export async function readLargeReport(id: string): Promise<AnalysisResult | null> {
  return transact('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as AnalysisResult | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not load report.'));
  });
}

export async function listLargeReports(): Promise<AnalysisResult[]> {
  return transact('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as AnalysisResult[]);
    request.onerror = () => reject(request.error ?? new Error('Could not list reports.'));
  });
}

export async function deleteLargeReport(id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not delete report.')); };
  });
}

export async function clearLargeReports(): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not clear reports.')); };
  });
}
