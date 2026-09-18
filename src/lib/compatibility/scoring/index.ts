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
  const find = (id: string) => categories.find((c) => c.id === id)?.score ?? 100;
  const runtime = find('runtime');
  const dependencies = find('dependencies');
  const configuration = find('configuration');
  const structure = find('structure');
  const environment = find('environment');
  const security = find('security');
  const deployment = find('deployment');
  const performance = find('performance');

  const overall = Math.round(
    runtime * COMPATIBILITY_SCORE_WEIGHTS.runtime +
      dependencies * COMPATIBILITY_SCORE_WEIGHTS.dependencies +
      configuration * COMPATIBILITY_SCORE_WEIGHTS.configuration +
      structure * COMPATIBILITY_SCORE_WEIGHTS.structure +
      environment * COMPATIBILITY_SCORE_WEIGHTS.environment +
      security * COMPATIBILITY_SCORE_WEIGHTS.security +
      deployment * COMPATIBILITY_SCORE_WEIGHTS.deployment +
      performance * COMPATIBILITY_SCORE_WEIGHTS.performance
  );

  return {
    runtime,
    dependencies,
    configuration,
    structure,
    environment,
    security,
    deployment,
    performance,
    overall,
  };
}
