import type { Language, ProjectFile } from './types';
import { isProjectEvidenceFile } from './project-scope';

const EXTENSIONS: Record<string, Language> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.rb': 'Ruby', '.ex': 'Elixir', '.exs': 'Elixir', '.dart': 'Dart', '.swift': 'Swift', '.scala': 'Scala', '.sbt': 'Scala',
  '.cs': 'C#', '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++', '.hh': 'C++',
  '.php': 'PHP', '.zig': 'Zig', '.ml': 'OCaml', '.mli': 'OCaml', '.hs': 'Haskell', '.lhs': 'Haskell', '.lua': 'Lua',
  '.jl': 'Julia', '.r': 'R', '.cr': 'Crystal', '.nim': 'Nim', '.sol': 'Solidity', '.v': 'V', '.pl': 'Perl', '.pm': 'Perl',
  '.erl': 'Erlang', '.hrl': 'Erlang',
};

export interface LanguageProfile {
  language: Language;
  bytes: number;
  files: number;
  percentage: number;
}

export function detectLanguageProfile(files: ProjectFile[]): LanguageProfile[] {
  const totals = new Map<Language, { bytes: number; files: number }>();
  for (const file of files) {
    if (!isProjectEvidenceFile(file)) continue;
    const lower = file.path.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) continue;
    const language = EXTENSIONS[lower.slice(dot)];
    if (!language) continue;
    const current = totals.get(language) ?? { bytes: 0, files: 0 };
    current.bytes += Math.max(0, file.size || 0);
    current.files += 1;
    totals.set(language, current);
  }

  const totalBytes = Array.from(totals.values()).reduce((sum, value) => sum + value.bytes, 0);
  if (totalBytes === 0) return [];

  return Array.from(totals.entries())
    .map(([language, value]) => ({
      language,
      bytes: value.bytes,
      files: value.files,
      percentage: Math.round((value.bytes / totalBytes) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}
