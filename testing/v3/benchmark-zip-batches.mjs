#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { crc32 } from 'node:zlib';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const full = path.resolve(root, relative);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'jszip') return { default: nativeRequire('jszip') };
    if (name.startsWith('@/')) return load(path.join(root, 'src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) {
      const candidate = path.resolve(path.dirname(full), name);
      return load(path.extname(candidate) ? candidate : `${candidate}.ts`);
    }
    return nativeRequire(name);
  }, module, module.exports);
  return module.exports;
}
const count = Number(process.env.UCE_BENCH_ZIP_FILES ?? 96_000);
if (!Number.isSafeInteger(count) || count < 25_001 || count > 200_000) throw new Error('UCE_BENCH_ZIP_FILES must be 25,001–200,000.');
const source = Buffer.from('int kernel_fixture(void) { return 0; }\n');
const checksum = crc32(source);
const localChunks = []; const centralChunks = [];
let offset = 0;
for (let index = 0; index < count; index++) {
  const name = Buffer.from(`linux-main/drivers/fixture-${String(index).padStart(6, '0')}.c`);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(0x800, 6); local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(source.length, 18); local.writeUInt32LE(source.length, 22); local.writeUInt16LE(name.length, 26);
  localChunks.push(local, name, source);
  const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(0x800, 8); directory.writeUInt32LE(checksum, 16);
  directory.writeUInt32LE(source.length, 20); directory.writeUInt32LE(source.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
  centralChunks.push(directory, name);
  offset += local.length + name.length + source.length;
}
const directorySize = centralChunks.reduce((sum, item) => sum + item.length, 0);
const zip64 = Buffer.alloc(56); zip64.writeUInt32LE(0x06064b50, 0); zip64.writeBigUInt64LE(44n, 4);
zip64.writeBigUInt64LE(BigInt(count), 24); zip64.writeBigUInt64LE(BigInt(count), 32);
zip64.writeBigUInt64LE(BigInt(directorySize), 40); zip64.writeBigUInt64LE(BigInt(offset), 48);
const locator = Buffer.alloc(20); locator.writeUInt32LE(0x07064b50, 0); locator.writeBigUInt64LE(BigInt(offset + directorySize), 8); locator.writeUInt32LE(1, 16);
const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0xffff, 8); end.writeUInt16LE(0xffff, 10);
end.writeUInt32LE(0xffffffff, 12); end.writeUInt32LE(0xffffffff, 16);
const archive = new File([Buffer.concat([...localChunks, ...centralChunks, zip64, locator, end])], 'linux.zip');
localChunks.length = 0; centralChunks.length = 0;
const { readZip, scanZipBatches } = load('src/lib/analyzer/zip.ts');
const started = performance.now();
const initial = await readZip(archive);
let peakHeap = process.memoryUsage().heapUsed;
const alreadyRead = new Set(initial.files.filter(item => item.content !== undefined).map(item => item.path));
let batches = 0;
const progress = await scanZipBatches(archive, alreadyRead, async files => {
  assert.ok(files.length <= 128);
  batches++;
  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
});
assert.equal(progress.eligibleFiles, count);
assert.equal(initial.scanStats.filesAnalyzed, 25_000);
assert.equal(progress.filesWithContent + initial.scanStats.filesWithContent, count);
const elapsedMs = Math.round(performance.now() - started);
const heapMiB = Math.round(peakHeap / 1048576);
const maxRssMiB = Math.round(process.resourceUsage().maxRSS / 1024);
const status = heapMiB <= 512 && elapsedMs <= 150_000 ? 'passed' : 'failed';
console.log(JSON.stringify({ benchmark: 'linux-like-zip-batches', filesIndexed: progress.eligibleFiles, textFilesRead: count, compressedMiB: Math.round(archive.size / 1048576), batches, elapsedMs, peakHeapMiB: heapMiB, maxRssMiB, status }));
if (status === 'failed') process.exitCode = 1;
