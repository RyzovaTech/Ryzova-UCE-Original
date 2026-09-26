import JSZip from 'jszip';
import { ADDITIONAL_LANGUAGE_EXTENSIONS } from './language-knowledge';
import type { ProjectFile, ScanStats } from './types';
import { formatFileSize } from '@/lib/utils';
import { MAX_COMPRESSED_ARCHIVE_BYTES } from './archive-policy';
import { DEFAULT_ANALYSIS_BUDGET } from './execution';

export interface ZipReadResult {
  files: ProjectFile[];
  name: string;
  scanStats: ScanStats;
}

// --- Intelligent limits (no hard 100MB block) ---
const MAX_FILES = DEFAULT_ANALYSIS_BUDGET.maxFiles;
const MAX_TOTAL_TEXT_CONTENT = 96 * 1024 * 1024; // bounded content; remaining files keep metadata
const MAX_SINGLE_TEXT_FILE = 2 * 1024 * 1024; // 2MB per text file
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
const ROOT_IDENTITY_FILES = new Set([
  'makefile', 'kbuild', 'kconfig', 'cmakelists.txt',
  'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'pom.xml',
  'composer.json', 'gemfile', 'mix.exs', 'pubspec.yaml', 'package.swift', 'build.sbt',
  'readme', 'readme.md', 'readme.txt', 'readme.rst',
  'license', 'license.md', 'copying', 'maintainers', 'security.md',
  '.gitignore', '.editorconfig',
]);

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
  'makefile', 'kbuild', 'kconfig', 'cmakelists.txt',
  'readme', 'readme.md', 'readme.txt', 'readme.rst',
  'license', 'license.md', 'copying', 'maintainers', 'security.md',
  '.gitignore', '.editorconfig',
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
    (prefix) => normalized.startsWith(prefix) ||
      normalized.includes(`/${prefix}`) ||
      normalized === prefix.replace(/\/$/, '') ||
      normalized.endsWith(`/${prefix.replace(/\/$/, '')}`)
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

function priorityScore(path: string): number {
  const normalized = path.replace(/^\.\//, '');
  const parts = normalized.split('/').filter(Boolean);
  const base = parts[parts.length - 1]?.toLowerCase() ?? normalized.toLowerCase();
  const depthPenalty = Math.min(parts.length, 20) / 100;
  if (ROOT_IDENTITY_FILES.has(base)) return depthPenalty;
  if (PRIORITY_FILES.has(base)) return 1 + depthPenalty;
  const ext = getExtension(path);
  if (PRIORITY_SOURCE_EXTENSIONS.includes(ext)) return 2 + depthPenalty;
  return 3 + depthPenalty;
}

const TEXT_BASENAMES = new Set([
  'dockerfile', '.env', '.env.example', '.env.local', '.env.production',
  'gemfile', 'gemfile.lock', 'rakefile', 'makefile', 'kbuild', 'kconfig', 'cmakelists.txt',
  'package.swift', 'license', 'license.md', 'copying', 'readme', 'readme.md', 'readme.txt', 'readme.rst',
  'maintainers', 'security.md', 'changelog.md', 'contributing.md', '.nvmrc', '.node-version', '.python-version',
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
  ...Object.keys(ADDITIONAL_LANGUAGE_EXTENSIONS),
  '.json', '.yaml', '.yml', '.toml', '.txt', '.md', '.rst', '.env',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.kts',
  '.xml', '.gradle', '.mod', '.css', '.scss', '.html', '.svelte', '.vue', '.astro',
  '.ini', '.cfg', '.sh', '.bash', '.zsh', '.example',
  '.rb', '.ex', '.exs', '.dart', '.swift', '.scala', '.sbt', '.cmake', '.make',
  '.properties', '.lock', '.sum', '.prisma', '.gql', '.graphql',
  '.cs', '.c', '.cpp', '.cc', '.h', '.hpp', '.php',
];

function isLikelyText(name: string): boolean {
  const lower = name.toLowerCase();
  const base = lower.split('/').pop() ?? lower;

  if (/^(?:licen[cs]e|copying)(?:[-.][a-z0-9.-]+)?$/i.test(base)) return true;
  if (TEXT_BASENAMES.has(base)) return true;
  return TEXT_EXTENSIONS.some((ext) => base.endsWith(ext));
}

/** GitHub and other exporters commonly wrap a project in one top-level folder. */
function commonArchiveRoot(files: Array<{ path: string }>): string | null {
  if (files.length === 0) return null;
  const roots = new Set(files.map((file) => file.path.split('/')[0]).filter(Boolean));
  if (roots.size !== 1) return null;
  const [root] = [...roots];
  return files.every((file) => file.path.startsWith(`${root}/`)) ? root : null;
}

export async function readZip(file: File, onProgress?: (filesRead: number, filesSelected: number) => void): Promise<ZipReadResult> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new ZipReadError('Unsupported file type. Please upload a .zip archive.');
  }
  if (file.size === 0) {
    throw new ZipReadError('The uploaded file is empty.');
  }
  if (file.size > MAX_COMPRESSED_ARCHIVE_BYTES) {
    throw new ZipReadError(
      `Archive is too large for safe browser processing (${formatFileSize(file.size)}). The browser safety ceiling is ${formatFileSize(MAX_COMPRESSED_ARCHIVE_BYTES)}; use the UCE CLI for larger projects.`
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
  // Determine the wrapper before sampling/filtering can remove root-level evidence.
  const archiveRoot = commonArchiveRoot(allEntries.filter(entry => !entry.name.startsWith('__MACOSX/')).map(entry => ({ path: entry.name })));

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

    analyzableEntries.push(entry);
  }

  if (analyzableEntries.length === 0) {
    const dirEntries = Object.values(zip.files).filter((e) => e.dir);
    const hasOnlyDirs = allEntries.length === 0 && dirEntries.length > 0;
    if (allEntries.length === 0 && !hasOnlyDirs) {
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
    if (/\x00/.test(entry.name) || entry.name.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry.name) || (entry.unsafeOriginalName ?? entry.name).split(/[\\/]/).includes('..')) {
      throw new ZipReadError(
        `The archive contains a file with an unsafe absolute, traversal, or NUL-containing path: "${entry.name.slice(0, 60)}". Clean the archive and re-upload.`
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
    const priorityDelta = priorityScore(a.name) - priorityScore(b.name);
    if (priorityDelta !== 0) return priorityDelta;
    const aSize = (a as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    const bSize = (b as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    return aSize - bSize;
  });

  // Preserve manifests and source evidence while safely sampling very large
  // repositories instead of rejecting OS trees and monorepos outright.
  const filesSampled = analyzableEntries.length > MAX_FILES;
  if (filesSampled) {
    const sampledOut = analyzableEntries.length - MAX_FILES;
    analyzableEntries.length = MAX_FILES;
    ignoredCount += sampledOut;
    ignoredCategorySet.add(`files beyond ${MAX_FILES.toLocaleString()}-file analysis budget`);
  }

  // --- Phase 3: Read files progressively with memory limits ---
  const files: ProjectFile[] = [];
  let totalTextContent = 0;
  let filesAnalyzed = 0;
  let contentTruncated = false;

  for (const entry of analyzableEntries) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;

    // Check total text content limit
    if (totalTextContent >= MAX_TOTAL_TEXT_CONTENT) {
      // We've hit the text content ceiling — still include file metadata, just don't read content
      files.push({ path: entry.name, size, isDirectory: false });
      contentTruncated = true;
      filesAnalyzed++;
      if (filesAnalyzed % 250 === 0) onProgress?.(filesAnalyzed, analyzableEntries.length);
      continue;
    }

    // Yield to the browser periodically to keep the UI responsive
    if (filesAnalyzed > 0 && filesAnalyzed % 500 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    // Determine if we should read content
    let content: string | undefined;
    const isText = isLikelyText(entry.name);

    if (isText && size <= MAX_SINGLE_TEXT_FILE && totalTextContent + size <= MAX_TOTAL_TEXT_CONTENT) {
      try {
        content = await entry.async('string');
        totalTextContent += new TextEncoder().encode(content).byteLength;
      } catch {
        content = undefined;
        contentTruncated = true;
      }
    } else if (isText) {
      contentTruncated = true;
    }

    files.push({ path: entry.name, size, isDirectory: false, content });
    filesAnalyzed++;
    if (filesAnalyzed % 250 === 0) onProgress?.(filesAnalyzed, analyzableEntries.length);
  }
  onProgress?.(filesAnalyzed, analyzableEntries.length);

  // Analyze the project itself, rather than the arbitrary archive wrapper directory.
  if (archiveRoot) {
    for (const projectFile of files) projectFile.path = projectFile.path.slice(archiveRoot.length + 1);
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
    sampled: filesSampled,
    truncated: filesSampled || contentTruncated,
    truncationReason: filesSampled || contentTruncated
      ? [
        filesSampled ? `Repository exceeded the ${MAX_FILES.toLocaleString()}-file browser analysis budget; high-priority source and manifest files were sampled.` : '',
        contentTruncated ? `Some text content could not be read or exceeded the ${formatFileSize(MAX_TOTAL_TEXT_CONTENT)} total or ${formatFileSize(MAX_SINGLE_TEXT_FILE)} per-file read budget.` : '',
      ].filter(Boolean).join(' ')
      : undefined,
    contentBytesRead: totalTextContent,
    contentByteLimit: MAX_TOTAL_TEXT_CONTENT,
  };

  const baseName = file.name.replace(/\.zip$/i, '');

  return { files, name: baseName, scanStats };
}
