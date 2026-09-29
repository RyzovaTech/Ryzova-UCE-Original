import type { AnalysisResult, LanguageProfile } from './types';

export interface ArchiveCheckpoint {
  version: 2;
  nextIndex: number;
  eligibleFiles: number;
  indexSignature: string;
  originalContentPaths: string[];
  originalContentBytes: number;
  additionalFilesWithContent: number;
  additionalBytesRead: number;
  unreadableTextFiles: number;
  additionalSecurityFiles: number;
  additionalBrowserFiles: number;
  securityFindingsOmitted: number;
  browserFindingsOmitted: number;
  languages: LanguageProfile[];
  result: AnalysisResult;
}

export interface ArchiveCheckpointStore {
  load(): Promise<ArchiveCheckpoint | null>;
  save(value: ArchiveCheckpoint): Promise<void>;
  clear(): Promise<void>;
}

/** Tie a checkpoint to the actual archive, without hashing a multi-gigabyte ZIP in RAM. */
export async function openArchiveCheckpoint(file: File): Promise<ArchiveCheckpointStore | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory || !crypto.subtle) return null;
  try {
    const sample = new Uint8Array(96 * 1024 + 8);
    sample.set(new Uint8Array(await file.slice(0, 32 * 1024).arrayBuffer()), 0);
    sample.set(new Uint8Array(await file.slice(Math.max(0, file.size - 64 * 1024)).arrayBuffer()), 32 * 1024);
    new DataView(sample.buffer).setBigUint64(sample.length - 8, BigInt(file.size), true);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', sample)), byte => byte.toString(16).padStart(2, '0')).join('');
    const root = await navigator.storage.getDirectory();
    const filename = `uce-checkpoint-v2-${hash}.json`;
    return {
      async load() {
        try {
          const saved = await (await root.getFileHandle(filename)).getFile();
          if (saved.size > 32 * 1024 * 1024) return null;
          const state: ArchiveCheckpoint = JSON.parse(await saved.text());
          if (state.version !== 2 || !Number.isSafeInteger(state.nextIndex) || !Number.isSafeInteger(state.eligibleFiles)
            || state.nextIndex < 0 || state.nextIndex > state.eligibleFiles
            || !Array.isArray(state.originalContentPaths) || state.originalContentPaths.some(path => typeof path !== 'string')
            || !Array.isArray(state.languages) || !Number.isSafeInteger(state.originalContentBytes) || state.originalContentBytes < 0
            || !/^[a-f0-9]{8}$/.test(state.indexSignature)
            || !state.result?.summary?.scanStats || !Array.isArray(state.result?.stack?.securityIntelligence?.findings)
            || (state.result.classification.isSoftware && (!state.result.stack.v3RulePlatform?.archiveSweep || !Number.isSafeInteger(state.result.stack.v3RulePlatform.archiveSweep.ruleFileVisits)))) return null;
          return state;
        } catch { return null; }
      },
      async save(value) {
        const serialized = JSON.stringify(value);
        if (new Blob([serialized]).size > 32 * 1024 * 1024) throw new Error('Archive checkpoint exceeds the local persistence budget.');
        const handle = await root.getFileHandle(filename, { create: true });
        const writer = await handle.createWritable();
        try { await writer.write(serialized); await writer.close(); }
        catch (error) { await writer.abort().catch(() => undefined); throw error; }
      },
      async clear() { await root.removeEntry(filename).catch(() => undefined); },
    };
  } catch { return null; }
}

export async function clearArchiveTemporaryStorage(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  // DirectoryHandle iteration exists in browsers even when DOM.Iterable typings are omitted.
  for await (const filename of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
    if (filename.startsWith('uce-checkpoint-v1-') || filename.startsWith('uce-checkpoint-v2-') || filename.startsWith('uce-archive-')) await root.removeEntry(filename).catch(() => undefined);
  }
}
