export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number;
  elapsedSeconds: number;
  complete: boolean;
}

/** Read the response incrementally; never infer a size from repository metadata. */
export async function readArchiveDownload(response: Response, options: {
  signal: AbortSignal;
  maxBytes: number;
  /** Maximum time without a received chunk, not a total download deadline. */
  timeoutMs: number;
  onProgress: (progress: DownloadProgress) => void;
}): Promise<Blob> {
  const rawLength = Number(response.headers.get('content-length'));
  const encoding = response.headers.get('content-encoding');
  let totalBytes = !encoding && Number.isSafeInteger(rawLength) && rawLength > 0 ? rawLength : null;
  if (totalBytes !== null && totalBytes > options.maxBytes) throw new Error('Repository archive exceeds the browser download limit. Use the UCE CLI.');
  if (!response.body) throw new Error('This browser did not provide a readable download stream. Download the ZIP and use ZIP Upload.');
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
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
      chunks.push(value);
    }
    if (totalBytes !== null && receivedBytes !== totalBytes) throw new Error('Repository download was incomplete. Please retry.');
    emit(true);
    return new Blob(chunks, { type: 'application/zip' });
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearInterval(ticker);
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
