import type { CategoryDefinition } from './types';

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'runtime',
    label: 'Runtime',
    description: 'Detected runtime version against expected baseline for the stack.',
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    description: 'Declared packages, lockfile health, and version pinning.',
  },
  {
    id: 'configuration',
    label: 'Configuration',
    description: 'Build, type, and environment configuration completeness.',
  },
  {
    id: 'structure',
    label: 'Project Structure',
    description: 'Expected files and folders for the detected framework.',
  },
  {
    id: 'environment',
    label: 'Environment',
    description: 'Required environment variables and container setup.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Secret exposure, vulnerable versions, and security policy checks.',
  },
  {
    id: 'deployment',
    label: 'Deployment',
    description: 'Kubernetes, Helm, Kustomize, and cloud provider configuration.',
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Bundle size, build optimization, and resource efficiency checks.',
  },
];
