import type { CompatibilityRule } from '../types';
import { runtimeRules } from './runtime';
import { dependencyRules } from './dependencies';
import { configurationRules } from './configuration';
import { structureRules } from './structure';
import { environmentRules } from './environment';
import { extendedRuntimeRules } from './extended-runtime';
import { extendedDependencyRules } from './extended-dependencies';
import { extendedConfigurationRules } from './extended-configuration';
import { extendedStructureRules } from './extended-structure';
import { extendedEnvironmentRules } from './extended-environment';
import { monorepoRules } from './monorepo';
import { kubernetesRules } from './kubernetes';
import { cloudProviderRules } from './cloud';
import { securityRules } from './security';
import { licenseRules } from './license';
import { performanceRules } from './performance';

export const ALL_RULES: CompatibilityRule[] = [
  ...runtimeRules,
  ...dependencyRules,
  ...configurationRules,
  ...structureRules,
  ...environmentRules,
  ...extendedRuntimeRules,
  ...extendedDependencyRules,
  ...extendedConfigurationRules,
  ...extendedStructureRules,
  ...extendedEnvironmentRules,
  ...monorepoRules,
  ...kubernetesRules,
  ...cloudProviderRules,
  ...securityRules,
  ...licenseRules,
  ...performanceRules,
];
