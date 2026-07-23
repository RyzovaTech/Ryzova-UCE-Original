import type { CategoryResult, CompatibilityScore } from '../../analyzer/types';

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

  const weights = {
    runtime: 0.18,
    dependencies: 0.15,
    configuration: 0.13,
    structure: 0.12,
    environment: 0.10,
    security: 0.14,
    deployment: 0.10,
    performance: 0.08,
  };

  const overall = Math.round(
    runtime * weights.runtime +
      dependencies * weights.dependencies +
      configuration * weights.configuration +
      structure * weights.structure +
      environment * weights.environment +
      security * weights.security +
      deployment * weights.deployment +
      performance * weights.performance
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
