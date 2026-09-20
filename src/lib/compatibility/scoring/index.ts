import type { CategoryResult, CompatibilityScore } from '../../analyzer/types';

export const COMPATIBILITY_SCORE_WEIGHTS = {
  runtime: 0.18,
  dependencies: 0.15,
  configuration: 0.13,
  structure: 0.12,
  environment: 0.10,
  security: 0.14,
  deployment: 0.10,
  performance: 0.08,
} as const;

export function computeScore(categories: CategoryResult[]): CompatibilityScore {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const find = (id: keyof typeof COMPATIBILITY_SCORE_WEIGHTS) => byId.get(id)?.score ?? 0;
  const runtime = find('runtime');
  const dependencies = find('dependencies');
  const configuration = find('configuration');
  const structure = find('structure');
  const environment = find('environment');
  const security = find('security');
  const deployment = find('deployment');
  const performance = find('performance');

  const applicable = categories.filter((category) => category.status !== 'unknown');
  const weightTotal = applicable.reduce((sum, category) => sum + (COMPATIBILITY_SCORE_WEIGHTS[category.id] ?? 0), 0);
  const weighted = applicable.reduce((sum, category) => sum + category.score * (COMPATIBILITY_SCORE_WEIGHTS[category.id] ?? 0), 0);
  const overall = weightTotal > 0 ? Math.round(weighted / weightTotal) : 0;

  return { runtime, dependencies, configuration, structure, environment, security, deployment, performance, overall, applicableCategories: applicable.map((category) => category.id) };
}
