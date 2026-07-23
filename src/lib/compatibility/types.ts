import type { CategoryId, Issue, ProjectFile, TechnologyStack } from '../analyzer/types';

export interface RuleContext {
  files: ProjectFile[];
  detectedFiles: import('../analyzer/types').DetectedFile[];
  stack: TechnologyStack;
  projectName: string;
}

export interface CompatibilityRule {
  id: string;
  category: CategoryId;
  run: (ctx: RuleContext) => Issue[];
}

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  description: string;
}
