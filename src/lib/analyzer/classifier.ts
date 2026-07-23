import type { ProjectFile, DetectedFile, ProjectClassification } from './types';

export const NON_SOFTWARE_MESSAGE =
  'This project was classified as a non-software archive. Compatibility scoring is only available for software engineering projects.';

const SOFTWARE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.php',
  '.rb', '.cs', '.cpp', '.c', '.h', '.swift', '.scala', '.clj', '.ex', '.exs',
  '.elm', '.fs', '.vb', '.m', '.mm', '.dart', '.lua', '.pl', '.r', '.jl',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.vue', '.svelte', '.astro', '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.xml', '.sql', '.graphql', '.gql', '.proto', '.thrift',
  '.dockerfile', '.gitignore', '.gitattributes', '.editorconfig',
  '.lock', '.wasm', '.so', '.dll', '.dylib', '.a', '.lib',
]);

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico',
  '.psd', '.ai', '.sketch', '.fig', '.raw', '.heic',
]);

const DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv', '.tsv',
  '.epub', '.mobi', '.azw', '.azw3', '.fb2',
  '.md', '.rst', '.tex', '.org',
]);

// Specific game-engine file extensions / basenames only.
// Substring matches against full paths, so entries must be unambiguous —
// generic words like 'controller', 'scene', or 'asset' collide with non-game
// projects (e.g. Linux kernel has drivers/.../controller paths).
const GAME_INDICATORS = [
  '.unity', '.prefab', '.asset', '.controller.meta', // Unity-specific
  '.uproject', '.umap', '.uasset', // Unreal
  '.godot', '.tscn', '.tres', // Godot
  '.yyp', '.gmx', '.gms2', // GameMaker
  '.phaser', '.cocos', '.love', // phaser/cocos/love2d project files
  'bevy_assets',
];

function countByExtension(files: ProjectFile[]): { software: number; media: number; document: number; total: number } {
  let software = 0;
  let media = 0;
  let document = 0;

  for (const file of files) {
    if (file.isDirectory) continue;
    const ext = file.path.substring(file.path.lastIndexOf('.')).toLowerCase();
    if (SOFTWARE_EXTENSIONS.has(ext)) software++;
    else if (MEDIA_EXTENSIONS.has(ext)) media++;
    else if (DOCUMENT_EXTENSIONS.has(ext)) document++;
  }

  return { software, media, document, total: files.filter(f => !f.isDirectory).length };
}

function hasGameIndicators(files: ProjectFile[], detectedFiles: DetectedFile[]): boolean {
  // Match against the basename only, not the full path, to avoid false positives
  // from directories that happen to share a name with a game engine.
  const basenames = new Set<string>();
  for (const f of files) {
    if (f.isDirectory) continue;
    const base = f.path.split('/').pop() ?? f.path;
    basenames.add(base.toLowerCase());
  }
  for (const d of detectedFiles) {
    const base = d.path.split('/').pop() ?? d.path;
    basenames.add(base.toLowerCase());
  }
  return GAME_INDICATORS.some(indicator =>
    Array.from(basenames).some(b => b === indicator.slice(1) || b.endsWith(indicator))
  );
}

export function classifyProject(files: ProjectFile[], detectedFiles: DetectedFile[]): ProjectClassification {
  const counts = countByExtension(files);
  const total = counts.total || 1;

  const softwareRatio = counts.software / total;
  const mediaRatio = counts.media / total;
  const documentRatio = counts.document / total;

  if (hasGameIndicators(files, detectedFiles)) {
    return {
      type: 'Game Project',
      isSoftware: true,
      reason: 'Game engine or game framework files detected.',
    };
  }

  if (softwareRatio >= 0.15) {
    return {
      type: 'Software Project',
      isSoftware: true,
      reason: `${counts.software} source/config files detected (${(softwareRatio * 100).toFixed(0)}% of total).`,
    };
  }

  if (mediaRatio > 0.5) {
    return {
      type: 'Media Archive',
      isSoftware: false,
      reason: `${counts.media} media files detected (${(mediaRatio * 100).toFixed(0)}% of total). No significant source code found.`,
    };
  }

  if (documentRatio > 0.5) {
    return {
      type: 'Document Archive',
      isSoftware: false,
      reason: `${counts.document} document files detected (${(documentRatio * 100).toFixed(0)}% of total). No significant source code found.`,
    };
  }

  return {
    type: 'Unknown Archive',
    isSoftware: false,
    reason: 'No significant software, media, or document files detected.',
  };
}
