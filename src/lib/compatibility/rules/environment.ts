import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const environmentRules: CompatibilityRule[] = [
  {
    id: 'dockerfile-present',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasDocker = ctx.detectedFiles.some((f) => f.path.endsWith('Dockerfile'));
      if (!hasDocker) {
        issues.push({
          id: 'dockerfile-missing',
          title: 'No Dockerfile found',
          category: 'environment',
          severity: 'info',
          description: 'The project does not include a Dockerfile.',
          reason: 'A Dockerfile makes environment parity between local and CI easier.',
          recommendation: 'Add a Dockerfile for reproducible deployments.',
          affectedFile: 'Dockerfile',
          detected: 'missing',
          expected: 'Dockerfile present',
          impact: 'Manual environment setup may diverge across machines.',
          suggestedAction: 'Add a minimal Dockerfile based on the detected runtime.',
        });
      }
      return issues;
    },
  },
  {
    id: 'docker-compose-present',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasCompose = ctx.detectedFiles.some(
        (f) => f.path.endsWith('docker-compose.yml') || f.path.endsWith('docker-compose.yaml')
      );
      const hasDb = ctx.stack.database === 'Detected';
      if (!hasCompose && hasDb) {
        issues.push({
          id: 'compose-missing-with-db',
          title: 'docker-compose missing despite detected database',
          category: 'environment',
          severity: 'warning',
          description: 'A database dependency was detected but no docker-compose file exists.',
          reason: 'Local development with a database is easier with a compose file.',
          recommendation: 'Add a docker-compose.yml defining the database service.',
          affectedFile: 'docker-compose.yml',
          detected: 'missing',
          expected: 'docker-compose.yml',
          impact: 'Contributors must provision a database manually.',
          suggestedAction: 'Add a docker-compose.yml with the database service.',
        });
      }
      return issues;
    },
  },
  {
    id: 'env-file-committed',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envFile = ctx.detectedFiles.find((f) => f.path === '.env' || f.path.endsWith('/.env'));
      if (envFile) {
        const content = readFile(ctx, '.env') ?? '';
        if (/SECRET|KEY|PASSWORD|TOKEN/i.test(content)) {
          issues.push({
            id: 'env-secrets-committed',
            title: 'Secrets detected in committed .env file',
            category: 'environment',
            severity: 'critical',
            description: 'A .env file containing potential secrets was found in the project.',
            reason: 'Committing secrets to a repository is a security risk.',
            recommendation: 'Remove .env from the project, rotate any exposed secrets, and add .env to .gitignore.',
            affectedFile: '.env',
            detected: 'secrets present',
            expected: '.env in .gitignore',
            impact: 'Credential leakage if the repository is shared or pushed.',
            suggestedAction: 'Delete .env and rotate exposed credentials.',
          });
        }
      }
      return issues;
    },
  },
];
