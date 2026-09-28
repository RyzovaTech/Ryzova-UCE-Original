export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number;
  elapsedSeconds: number;
  complete: boolean;
}

/** Archives above this size spill into the browser's private temporary storage when supported. */
export const ARCHIVE_MEMORY_THRESHOLD_BYTES = 64 * 1024 * 1024;

interface TemporaryArchive {
  writer: FileSystemWritableFileStream;
  handle: FileSystemFileHandle;
  cleanup: () => Promise<void>;
}

async function openTemporaryArchive(): Promise<TemporaryArchive | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const name = `uce-archive-${crypto.randomUUID()}.zip`;
    const handle = await root.getFileHandle(name, { create: true });
    try {
      const writer = await handle.createWritable();
      return { writer, handle, cleanup: () => root.removeEntry(name) };
    } catch (error) {
      await root.removeEntry(name).catch(() => undefined);
      throw error;
    }
  } catch {
    // Private storage may be unavailable. Keep the existing bounded memory path.
    return null;
  }
}

/** Read the response incrementally; never infer a size from repository metadata. */
export async function readArchiveDownload(response: Response, options: {
  signal: AbortSignal;
  maxBytes: number;
  /** Maximum time without a received chunk, not a total download deadline. */
  timeoutMs: number;
  onProgress: (progress: DownloadProgress) => void;
  /** Called only if the returned Blob lives in private temporary storage. Caller must clean it up after analysis. */
  onTemporaryArchive?: (cleanup: () => Promise<void>) => void;
  /** Internal override for small integration fixtures. */
  diskThresholdBytes?: number;
  /** An explicitly selected device file; writes are committed only on successful download. */
  destination?: FileSystemFileHandle;
}): Promise<Blob> {
  const rawLength = Number(response.headers.get('content-length'));
  const encoding = response.headers.get('content-encoding');
  let totalBytes = !encoding && Number.isSafeInteger(rawLength) && rawLength > 0 ? rawLength : null;
  if (totalBytes !== null && totalBytes > options.maxBytes) throw new Error('Repository archive exceeds the browser download limit. Use the UCE CLI.');
  if (!response.body) throw new Error('This browser did not provide a readable download stream. Download the ZIP and use ZIP Upload.');
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let temporary: TemporaryArchive | null = null;
  let selectedWriter: FileSystemWritableFileStream | null = null;
  let diskAttempted = false;
  const started = performance.now();
  let receivedBytes = 0;
  let abortError: DOMException | null = null;
  const emit = (complete = false) => {
    const elapsedSeconds = (performance.now() - started) / 1000;
    options.onProgress({ receivedBytes, totalBytes, elapsedSeconds, bytesPerSecond: elapsedSeconds > 0 ? receivedBytes / elapsedSeconds : 0, complete });
  };
  const abort = () => {
    abortError = new DOMException('Repository download aborted.', 'AbortError');
    void reader.cancel().catch(() => undefined);
  };
  options.signal.addEventListener('abort', abort, { once: true });
  const stalled = () => {
    abortError = new DOMException('Repository download stopped receiving data. Check your connection and retry, or download the ZIP directly from GitHub.', 'TimeoutError');
    void reader.cancel().catch(() => undefined);
  };
  let timer = setTimeout(stalled, options.timeoutMs);
  const resetIdleTimer = () => { clearTimeout(timer); timer = setTimeout(stalled, options.timeoutMs); };
  const ticker = setInterval(() => emit(), 500);
  try {
    if (options.signal.aborted) abort();
    if (options.destination) selectedWriter = await options.destination.createWritable();
    if (abortError) throw abortError;
    emit();
    while (true) {
      if (abortError) throw abortError;
      const { done, value } = await reader.read();
      if (abortError) throw abortError;
      if (done) break;
      if (value.byteLength > 0) resetIdleTimer();
      receivedBytes += value.byteLength;
      if (receivedBytes > options.maxBytes) throw new Error('Repository archive exceeds the browser download limit. Use the UCE CLI.');
      if (totalBytes !== null && receivedBytes > totalBytes) totalBytes = null;
      if (!selectedWriter && !diskAttempted && receivedBytes > (options.diskThresholdBytes ?? ARCHIVE_MEMORY_THRESHOLD_BYTES)) {
        diskAttempted = true;
        temporary = await openTemporaryArchive();
        if (temporary) {
          for (const chunk of chunks) await temporary.writer.write(chunk);
          chunks.length = 0;
        }
      }
      if (selectedWriter) {
        for (let at = 0; at < value.byteLength; at += 32 * 1024) await selectedWriter.write(value.subarray(at, at + 32 * 1024));
      } else if (temporary) await temporary.writer.write(value);
      else chunks.push(value);
    }
    if (totalBytes !== null && receivedBytes !== totalBytes) throw new Error('Repository download was incomplete. Please retry.');
    emit(true);
    if (selectedWriter) {
      await selectedWriter.close();
      selectedWriter = null;
      return options.destination!.getFile();
    }
    if (temporary) {
      await temporary.writer.close();
      const archive = await temporary.handle.getFile();
      options.onTemporaryArchive?.(temporary.cleanup);
      temporary = null;
      return archive;
    }
    return new Blob(chunks, { type: 'application/zip' });
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (selectedWriter) await selectedWriter.abort().catch(() => undefined);
    if (temporary) {
      await temporary.writer.abort().catch(() => undefined);
      await temporary.cleanup().catch(() => undefined);
    }
    throw error;
  } finally {
    clearInterval(ticker);
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
