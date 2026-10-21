// True dedicated browser Worker. No solver imports, network or project files.
let initialized = false;
self.onmessage = async event => {
  const {kind,requestId,data,stallMs} = event.data ?? {};
  if (!Number.isSafeInteger(requestId) || requestId < 1) return;
  if (kind === 'probe-init') {
    initialized = true;
    self.postMessage({kind:'probe-ready',requestId}); return;
  }
  if (kind !== 'probe-run' || !initialized || !(data instanceof ArrayBuffer) ||
      data.byteLength < 1 || data.byteLength > 256 * 1024 ||
      !Number.isInteger(stallMs) || stallMs < 0 || stallMs > 10000) return;
  const begin = performance.now();
  if (stallMs) await new Promise(resolve=>setTimeout(resolve,stallMs));
  const bytes = new Uint8Array(data);
  let checksum = 0;
  for(const b of bytes) checksum=(checksum+b)>>>0;
  self.postMessage({kind:'probe-complete',requestId,bytes:bytes.length,checksum,
    processingMs:Math.round((performance.now()-begin)*100)/100});
  initialized = false;
};
