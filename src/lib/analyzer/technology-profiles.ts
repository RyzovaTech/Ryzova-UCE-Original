import type { DetectedFile, Framework, ProjectFile, Runtime, TechnologyDetection, TechnologyStack } from './types';
import { detectRegisteredTechnologies } from './technology-registry';

function primaryFirst<T>(values: T[], primary: T | 'Unknown'): T[] {
  const unique = [...new Set(values)];
  if (primary === 'Unknown') return unique;
  return [primary as T, ...unique.filter((value) => value !== primary)];
}

/**
 * Backward-compatible framework/runtime lists derived from the universal registry.
 * `detectedFiles` remains in the signature for callers using the v2 detector API.
 */
export function detectTechnologyProfiles(
  files: ProjectFile[],
  _detectedFiles: DetectedFile[],
  stack: TechnologyStack,
  registryDetections: TechnologyDetection[] = detectRegisteredTechnologies(files),
): { frameworks: Framework[]; runtimes: Runtime[] } {
  const frameworks = registryDetections.filter((item) => item.kind === 'framework').map((item) => item.name as Framework);
  const runtimes = registryDetections.filter((item) => item.kind === 'runtime').map((item) => item.name as Runtime);
  return {
    frameworks: primaryFirst(frameworks, stack.framework),
    runtimes: primaryFirst(runtimes, stack.runtime),
  };
}
