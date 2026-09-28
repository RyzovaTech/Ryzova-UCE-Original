/** Seekable ZIP reader. Only a 32 KiB slice of the archive is resident per read. */
export const ZIP_CHUNK_BYTES = 32 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
const fail = (reason: string): never => { throw new Error(`Invalid or unsupported ZIP: ${reason}`); };
const safe = (value: bigint): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return fail('offset exceeds safe integer range');
  return Number(value);
};
const u64 = (view: DataView, at: number) => safe(view.getBigUint64(at, true));

export interface StreamZipEntry {
  name: string;
  dir: boolean;
  unsafeOriginalName: string;
  _data: { uncompressedSize: number };
  async: (kind: 'string') => Promise<string>;
}

export async function openStreamZip(blob: Blob): Promise<StreamZipEntry[]> {
  // The central directory and ZIP64 locator are at the end of the archive.
  const tailStart = Math.max(0, blob.size - (65535 + 22 + 20 + 56));
  const tail = new Uint8Array(blob.size - tailStart);
  for (let at = 0; at < tail.length; at += ZIP_CHUNK_BYTES) {
    tail.set(new Uint8Array(await blob.slice(tailStart + at, tailStart + Math.min(at + ZIP_CHUNK_BYTES, tail.length)).arrayBuffer()), at);
  }
  const end = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (end.getUint32(i, true) === 0x06054b50 && i + 22 + end.getUint16(i + 20, true) === tail.length) { eocd = i; break; }
  }
  if (eocd < 0) return fail('end of central directory missing');
  if (end.getUint16(eocd + 4, true) !== 0 || end.getUint16(eocd + 6, true) !== 0) return fail('multi-disk archives');
  let count = end.getUint16(eocd + 10, true);
  let directorySize = end.getUint32(eocd + 12, true);
  let directoryOffset = end.getUint32(eocd + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || end.getUint32(locator, true) !== 0x07064b50) return fail('ZIP64 locator missing');
    if (end.getUint32(locator + 4, true) !== 0 || end.getUint32(locator + 16, true) !== 1) return fail('multi-disk ZIP64');
    const zip64Offset = u64(end, locator + 8);
    const zip64 = new DataView(await blob.slice(zip64Offset, zip64Offset + 56).arrayBuffer());
    if (zip64.byteLength < 56 || zip64.getUint32(0, true) !== 0x06064b50 || zip64.getUint32(16, true) !== 0 || zip64.getUint32(20, true) !== 0) return fail('ZIP64 record');
    count = u64(zip64, 32);
    directorySize = u64(zip64, 40);
    directoryOffset = u64(zip64, 48);
  }
  if (directoryOffset + directorySize > tailStart + eocd || directoryOffset + directorySize > blob.size) return fail('central directory outside archive');
  if (count > 1_000_000 || directorySize > 512 * 1024 * 1024) return fail('central directory safety budget');
  let cachedAt = -1;
  let cached = new Uint8Array(0);
  const read = async (at: number, length: number): Promise<Uint8Array> => {
    if (!Number.isSafeInteger(at) || length > 65535 || at < 0 || at + length > blob.size) return fail('entry outside archive');
    if (at >= cachedAt && at + length <= cachedAt + cached.length) return cached.subarray(at - cachedAt, at - cachedAt + length);
    cachedAt = at;
    cached = new Uint8Array(await blob.slice(at, Math.min(blob.size, at + Math.max(ZIP_CHUNK_BYTES, length))).arrayBuffer());
    return cached.subarray(0, length);
  };
  const entries: StreamZipEntry[] = [];
  let position = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (position + 46 > directoryOffset + directorySize) return fail('truncated central directory');
    const header = new DataView((await read(position, 46)).slice().buffer);
    if (header.getUint32(0, true) !== 0x02014b50) return fail('central directory signature');
    const flags = header.getUint16(8, true);
    const method = header.getUint16(10, true);
    if (flags & 1 || flags & 0x40) return fail('encrypted entry');
    const crc = header.getUint32(16, true);
    let compressed = header.getUint32(20, true);
    let expanded = header.getUint32(24, true);
    const nameSize = header.getUint16(28, true);
    const extraSize = header.getUint16(30, true);
    const commentSize = header.getUint16(32, true);
    let offset = header.getUint32(42, true);
    const endEntry = position + 46 + nameSize + extraSize + commentSize;
    if (endEntry > directoryOffset + directorySize) return fail('truncated central entry');
    const variable = new Uint8Array(nameSize + extraSize);
    if (nameSize) variable.set(await read(position + 46, nameSize));
    if (extraSize) variable.set(await read(position + 46 + nameSize, extraSize), nameSize);
    let name: string;
    try { name = decoder.decode(variable.subarray(0, nameSize)); }
    catch { return fail('filename is not UTF-8'); }
    if (!name || name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(name) || name.split(/[\\/]/).includes('..') || name.includes('\\') || name.length > 4096 || name.split('/').length > 101) return fail('unsafe path');
    if (compressed === 0xffffffff || expanded === 0xffffffff || offset === 0xffffffff) {
      let extraAt = nameSize;
      let found = false;
      while (extraAt + 4 <= variable.length) {
        const id = variable[extraAt] | variable[extraAt + 1] << 8;
        const size = variable[extraAt + 2] | variable[extraAt + 3] << 8;
        extraAt += 4;
        if (extraAt + size > variable.length) return fail('malformed extra field');
        if (id === 1) {
          const zip64 = new DataView(variable.buffer, variable.byteOffset + extraAt, size);
          let field = 0;
          if (expanded === 0xffffffff) { if (field + 8 > size) return fail('ZIP64 size missing'); expanded = u64(zip64, field); field += 8; }
          if (compressed === 0xffffffff) { if (field + 8 > size) return fail('ZIP64 compressed size missing'); compressed = u64(zip64, field); field += 8; }
          if (offset === 0xffffffff) { if (field + 8 > size) return fail('ZIP64 offset missing'); offset = u64(zip64, field); }
          found = true;
          break;
        }
        extraAt += size;
      }
      if (!found) return fail('ZIP64 entry metadata missing');
    }
    if (offset + 30 + compressed > directoryOffset || (method !== 0 && method !== 8)) return fail('entry data or compression method');
    const filename = name;
    const compressedSize = compressed;
    const uncompressedSize = expanded;
    const localOffset = offset;
    entries.push({ name: filename, unsafeOriginalName: filename, dir: filename.endsWith('/'), _data: { uncompressedSize },
      async: async () => {
        const local = new DataView(await blob.slice(localOffset, localOffset + 30).arrayBuffer());
        if (local.byteLength < 30 || local.getUint32(0, true) !== 0x04034b50 || local.getUint16(8, true) !== method) return fail('local entry header');
        const localNameLength = local.getUint16(26, true);
        const localName = new Uint8Array(await blob.slice(localOffset + 30, localOffset + 30 + localNameLength).arrayBuffer());
        if (localNameLength > 4096 || decoder.decode(localName) !== filename) return fail('local and central filenames differ');
        const start = localOffset + 30 + localNameLength + local.getUint16(28, true);
        if (start + compressedSize > directoryOffset) return fail('compressed data overlaps directory');
        let cursor = start;
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            if (cursor >= start + compressedSize) { controller.close(); return; }
            const next = Math.min(cursor + ZIP_CHUNK_BYTES, start + compressedSize);
            const bytes = new Uint8Array(await blob.slice(cursor, next).arrayBuffer());
            if (bytes.length !== next - cursor) { controller.error(new Error('Truncated ZIP data')); return; }
            cursor = next;
            controller.enqueue(bytes);
          },
        }, { highWaterMark: 1 });
        const output = method === 8 ? stream.pipeThrough(new DecompressionStream('deflate-raw')) : stream;
        const reader = output.getReader();
        const textDecoder = new TextDecoder();
        let text = '';
        let bytesRead = 0;
        let checksum = 0xffffffff;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesRead += value.length;
            if (bytesRead > uncompressedSize || bytesRead > 2 * 1024 * 1024) return fail('entry exceeded declared size or text budget');
            for (const byte of value) checksum = table[(checksum ^ byte) & 255] ^ (checksum >>> 8);
            text += textDecoder.decode(value, { stream: true });
          }
          text += textDecoder.decode();
          if (bytesRead !== uncompressedSize || (checksum ^ 0xffffffff) >>> 0 !== crc) return fail('entry length or CRC32 mismatch');
          return text;
        } finally { await reader.cancel().catch(() => undefined); }
      },
    });
    position = endEntry;
    if (index % 1000 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return entries;
}
