import JSZip from 'jszip';
import type { ProjectFile, ScanStats } from './types';
import { formatFileSize } from '@/lib/utils';

export interface ZipReadResult {
  files: ProjectFile[];
  name: string;
  scanStats: ScanStats;
}

// --- Intelligent limits (no hard 100MB block) ---
const MAX_FILES = 100_000;
const MAX_TOTAL_TEXT_CONTENT = 500 * 1024 * 1024; // 500MB total text content
const MAX_SINGLE_TEXT_FILE = 2 * 1024 * 1024; // 2MB per text file
const SKIP_LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // skip individual files > 25MB entirely
const MAX_COMPRESSED_SIZE = 2 * 1024 * 1024 * 1024; // 2GB compressed ZIP — hard limit to prevent browser OOM
const MAX_TOTAL_UNCOMPRESSED = 5 * 1024 * 1024 * 1024; // 5GB total uncompressed — ZIP bomb guard
const MAX_COMPRESSION_RATIO = 100; // if uncompressed/compressed > 100x, likely a ZIP bomb

// --- Junk directories and path prefixes ---
const IGNORED_PATH_PREFIXES = [
  '__MACOSX/',
  '.git/',
  'node_modules/',
  '.next/',
  '.nuxt/',
  '.svelte-kit/',
  '.turbo/',
  '.cache/',
  'dist/',
  'build/',
  'target/',
  '.gradle/',
  '.idea/',
  '.vscode/',
  'vendor/',
  '.terraform/',
  '.serverless/',
  '.docusaurus/',
  '.angular/',
  'coverage/',
  '.parcel-cache/',
  '.pytest_cache/',
  '.mypy_cache/',
  '.ruff_cache/',
  '__pycache__/',
  '.venv/',
  'venv/',
  'env/',
  '.tox/',
  '.eggs/',
  '.dart_tool/',
  '.pub-cache/',
  'Pods/',
  'Carthage/',
  '.build/',
  'DerivedData/',
  '.swiftpm/',
];

// --- Binary/media extensions to skip ---
const BINARY_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.ico', '.svg',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.tgz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj',
  '.iso', '.img', '.dmg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.wav', '.flac', '.aac', '.ogg',
  '.psd', '.ai', '.sketch', '.fig',
  '.class', '.jar', '.war', '.ear',
  '.wasm', '.dat', '.db', '.sqlite', '.mdb',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
];

// --- High-priority source extensions (read content even for larger files) ---
const PRIORITY_SOURCE_EXTENSIONS = [
  '.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.go', '.rs', '.java', '.kt', '.kts', '.swift',
  '.rb', '.ex', '.exs', '.dart', '.scala', '.sbt',
  '.cs', '.c', '.cpp', '.cc', '.h', '.hpp',
  '.php',
];

// --- High-priority manifest/config basenames (always read content) ---
const PRIORITY_FILES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt',
  'setup.py', 'setup.cfg', 'cargo.toml', 'go.mod', 'pom.xml',
  'gemfile', 'mix.exs', 'pubspec.yaml', 'package.swift', 'build.sbt',
  'composer.json', '.python-version', 'runtime.txt', '.ruby-version',
  '.nvmrc', '.node-version', 'pipfile', 'pipfile.lock',
  'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'nuxt.config.ts', 'nuxt.config.js',
  'svelte.config.js', 'svelte.config.mjs',
  'astro.config.mjs', 'astro.config.js',
  'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env', '.env.example', '.env.local', '.env.production',
  'makefile', 'cmakelists.txt',
]);

export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipReadError';
  }
}

function isIgnored(path: string): boolean {
  const normalized = path.replace(/^\.\//, '');
  return IGNORED_PATH_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized === prefix.replace(/\/$/, '')
  );
}

function getExtension(name: string): string {
  const lower = name.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  return dotIdx >= 0 ? lower.slice(dotIdx) : '';
}

function isBinaryFile(path: string): boolean {
  const ext = getExtension(path);
  return BINARY_EXTENSIONS.includes(ext);
}

function isPriorityFile(path: string): boolean {
  const base = path.split('/').pop()?.toLowerCase() ?? path.toLowerCase();
  if (PRIORITY_FILES.has(base)) return true;
  const ext = getExtension(path);
  return PRIORITY_SOURCE_EXTENSIONS.includes(ext);
}

const TEXT_BASENAMES = new Set([
  'dockerfile', '.env', '.env.example', '.env.local', '.env.production',
  'gemfile', 'gemfile.lock', 'rakefile', 'makefile', 'cmakelists.txt',
  'package.swift', 'license', 'license.md', 'readme.md', 'readme.txt', 'readme.rst',
  'changelog.md', 'contributing.md', '.nvmrc', '.node-version', '.python-version',
  '.ruby-version', 'runtime.txt', 'bunfig.toml', 'deno.json', 'deno.jsonc',
  '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc',
  '.babelrc', 'pipfile', 'pipfile.lock', 'requirements.txt', 'requirements-dev.txt',
  'setup.py', 'setup.cfg', 'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
  'gradle.properties', 'composer.json', 'composer.lock',
  'mix.exs', 'mix.lock', 'pubspec.yaml', 'pubspec.lock',
  'build.sbt', 'packages.config',
]);

const TEXT_EXTENSIONS = [
  '.json', '.yaml', '.yml', '.toml', '.txt', '.md', '.rst', '.env',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.kts',
  '.xml', '.gradle', '.mod', '.css', '.scss', '.html', '.svelte', '.vue', '.astro',
  '.ini', '.cfg', '.sh', '.bash', '.zsh', '.example',
  '.rb', '.ex', '.exs', '.dart', '.swift', '.scala', '.sbt', '.cmake', '.make',
  '.properties', '.lock', '.sum', '.prisma', '.gql', '.graphql',
  '.cs', '.c', '.cpp', '.cc', '.h', '.hpp', '.php',
];

const LARGE_LOCKFILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']);

function isLikelyText(name: string): boolean {
  const lower = name.toLowerCase();
  const base = lower.split('/').pop() ?? lower;

  if (LARGE_LOCKFILES.has(base)) return false;
  if (TEXT_BASENAMES.has(base)) return true;
  return TEXT_EXTENSIONS.some((ext) => base.endsWith(ext));
}

export async function readZip(file: File): Promise<ZipReadResult> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new ZipReadError('Unsupported file type. Please upload a .zip archive.');
  }
  if (file.size === 0) {
    throw new ZipReadError('The uploaded file is empty.');
  }
  if (file.size > MAX_COMPRESSED_SIZE) {
    throw new ZipReadError(
      `Archive is too large (${formatFileSize(file.size)}). Maximum supported compressed size is ${formatFileSize(MAX_COMPRESSED_SIZE)}.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (/encrypted|password/i.test(msg)) {
      throw new ZipReadError('This archive is password-protected or encrypted. UCE cannot analyze encrypted archives — remove the password and re-upload.');
    }
    if (/corrupt|invalid|crc|end of central|bad signature/i.test(msg)) {
      throw new ZipReadError('The ZIP archive appears to be corrupted or incomplete. Try re-downloading or re-exporting the archive.');
    }
    throw new ZipReadError('Could not read the archive. The ZIP file may be corrupted, incomplete, or password-protected.');
  }

  // --- Phase 1: Collect and classify entries ---
  const allEntries = Object.values(zip.files).filter((e) => !e.dir);
  const totalFilesFound = allEntries.length;

  if (totalFilesFound > MAX_FILES) {
    throw new ZipReadError(
      `Archive contains ${totalFilesFound.toLocaleString()} files. Maximum supported is ${MAX_FILES.toLocaleString()}.`
    );
  }

  // Classify entries
  const analyzableEntries: JSZip.JSZipObject[] = [];
  let ignoredCount = 0;
  const ignoredCategorySet = new Set<string>();

  for (const entry of allEntries) {
    if (entry.dir) continue;

    // Check junk directories
    if (isIgnored(entry.name)) {
      ignoredCount++;
      const topDir = entry.name.split('/')[0];
      ignoredCategorySet.add(topDir || 'junk paths');
      continue;
    }

    // Check binary/media files
    if (isBinaryFile(entry.name)) {
      ignoredCount++;
      ignoredCategorySet.add('binary/media files');
      continue;
    }

    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;

    // Skip individual files above threshold
    if (size > SKIP_LARGE_FILE_THRESHOLD) {
      ignoredCount++;
      ignoredCategorySet.add('oversized files (>25MB)');
      continue;
    }

    analyzableEntries.push(entry);
  }

  if (analyzableEntries.length === 0) {
    const dirEntries = Object.values(zip.files).filter((e) => e.dir);
    const hasOnlyDirs = allEntries.length === 0 && dirEntries.length > 0;
    if (allEntries.length === 0) {
      throw new ZipReadError(
        'The archive is empty — it contains no files or folders. Upload a project with source files.'
      );
    }
    if (hasOnlyDirs) {
      throw new ZipReadError(
        'The archive contains only empty directories and no files. Upload a project with source files.'
      );
    }
    const hasNestedArchive = allEntries.some((e) => /\.zip$|\.tar$|\.gz$|\.tgz$|\.7z$|\.rar$/i.test(e.name));
    if (hasNestedArchive) {
      const formats = new Set<string>();
      allEntries.forEach((e) => {
        const m = e.name.match(/\.(zip|tar|gz|tgz|7z|rar)$/i);
        if (m) formats.add(m[1].toLowerCase());
      });
      throw new ZipReadError(
        `Only nested ${Array.from(formats).join('/').toUpperCase()} archives were found. Extract the inner archive first, then upload the extracted project folder.`
      );
    }
    throw new ZipReadError(
      'No analyzable files found after filtering build artifacts, dependencies, and binary files. The archive may contain only media, binaries, or generated output.'
    );
  }

  // --- Path safety: reject invalid/illegal filenames ---
  for (const entry of analyzableEntries) {
    if (/[<>:"|?*\x00-\x1f]/.test(entry.name)) {
      throw new ZipReadError(
        `The archive contains a file with illegal characters in its path: "${entry.name.slice(0, 60)}". Clean the archive and re-upload.`
      );
    }
    if (entry.name.length > 4096) {
      throw new ZipReadError(
        'The archive contains a file with an extremely long path (>4096 chars), which may indicate a malformed archive.'
      );
    }
    if ((entry.name.match(/\//g) || []).length > 100) {
      throw new ZipReadError(
        'The archive contains a path nested more than 100 directories deep, which may indicate a malformed archive.'
      );
    }
  }

  // --- ZIP bomb detection: check total uncompressed size and compression ratio ---
  let totalUncompressed = 0;
  for (const entry of analyzableEntries) {
    const sz = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalUncompressed += sz;
  }
  if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
    throw new ZipReadError(
      `Archive decompresses to ${formatFileSize(totalUncompressed)}, exceeding the ${formatFileSize(MAX_TOTAL_UNCOMPRESSED)} safety limit.`
    );
  }
  if (file.size > 0 && totalUncompressed / file.size > MAX_COMPRESSION_RATIO) {
    throw new ZipReadError(
      'Archive has an unusually high compression ratio and may be a ZIP bomb. Aborting for safety.'
    );
  }

  // --- Phase 2: Sort by priority (source files first, then by size ascending) ---
  analyzableEntries.sort((a, b) => {
    const aPriority = isPriorityFile(a.name) ? 0 : 1;
    const bPriority = isPriorityFile(b.name) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aSize = (a as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    const bSize = (b as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    return aSize - bSize;
  });

  // --- Phase 3: Read files progressively with memory limits ---
  const files: ProjectFile[] = [];
  let totalTextContent = 0;
  let filesAnalyzed = 0;

  for (const entry of analyzableEntries) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;

    // Check total text content limit
    if (totalTextContent >= MAX_TOTAL_TEXT_CONTENT) {
      // We've hit the text content ceiling — still include file metadata, just don't read content
      files.push({ path: entry.name, size, isDirectory: false });
      filesAnalyzed++;
      continue;
    }

    // Yield to the browser periodically to keep the UI responsive
    if (filesAnalyzed > 0 && filesAnalyzed % 500 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    // Determine if we should read content
    let content: string | undefined;
    const isText = isLikelyText(entry.name);

    if (isText && size <= MAX_SINGLE_TEXT_FILE) {
      try {
        content = await entry.async('string');
        totalTextContent += content.length;
      } catch {
        content = undefined;
      }
    }

    files.push({ path: entry.name, size, isDirectory: false, content });
    filesAnalyzed++;
  }

  // --- Phase 4: Derive directory entries ---
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (!isIgnored(dir + '/')) dirs.add(dir);
    }
  }
  for (const d of dirs) {
    files.push({ path: d, size: 0, isDirectory: true });
  }

  const scanStats: ScanStats = {
    projectSize: file.size,
    filesFound: totalFilesFound,
    zipSize: file.size,
    filesAnalyzed,
    filesIgnored: ignoredCount,
    ignoredCategories: Array.from(ignoredCategorySet).sort(),
  };

  const baseName = file.name.replace(/\.zip$/i, '');

  return { files, name: baseName, scanStats };
}
