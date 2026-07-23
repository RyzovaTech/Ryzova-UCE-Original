import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const extendedEnvironmentRules: CompatibilityRule[] = [
  {
    id: 'dockerfile-expose-port',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/^FROM\s+/m.test(content) && !/EXPOSE\s+\d+/m.test(content)) {
        issues.push({
          id: 'dockerfile-no-expose',
          title: 'Dockerfile missing EXPOSE instruction',
          category: 'environment',
          severity: 'info',
          description: 'The Dockerfile does not declare an EXPOSE port.',
          reason: 'EXPOSE documents the port the container listens on.',
          recommendation: 'Add an EXPOSE instruction for the application port.',
          affectedFile: 'Dockerfile',
          detected: 'no EXPOSE',
          expected: 'EXPOSE <port>',
          impact: 'Port mapping is not documented.',
          suggestedAction: 'Add EXPOSE to the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-multi-stage',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      const fromCount = (content.match(/^FROM\s+/gm) || []).length;
      if (fromCount === 1 && ctx.stack.language !== 'Unknown') {
        issues.push({
          id: 'dockerfile-single-stage',
          title: 'Dockerfile uses a single stage',
          category: 'environment',
          severity: 'info',
          description: 'The Dockerfile has only one FROM instruction.',
          reason: 'Multi-stage builds reduce final image size by excluding build tools.',
          recommendation: 'Consider a multi-stage build for smaller production images.',
          affectedFile: 'Dockerfile',
          detected: 'single stage',
          expected: 'multi-stage build',
          impact: 'Final image may be larger than necessary.',
          suggestedAction: 'Split build and runtime into separate stages.',
        });
      }
      return issues;
    },
  },
  {
    id: 'docker-compose-version-field',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const compose = ctx.detectedFiles.find(
        (f) => f.path.endsWith('docker-compose.yml') || f.path.endsWith('docker-compose.yaml')
      );
      if (!compose) return issues;
      const content = readFile(ctx, compose.path.split('/').pop() ?? 'docker-compose.yml');
      if (!content) return issues;
      if (!/^version\s*:/m.test(content)) {
        issues.push({
          id: 'compose-version-missing',
          title: 'docker-compose.yml missing version field',
          category: 'environment',
          severity: 'info',
          description: 'The docker-compose file does not declare a version.',
          reason: 'The version field ensures compatibility with compose features.',
          recommendation: 'Add "version: \'3.8\'" or remove if using compose spec.',
          affectedFile: compose.path,
          detected: 'no version',
          expected: 'version field',
          impact: 'Compose behavior may vary across versions.',
          suggestedAction: 'Add a version to docker-compose.yml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'docker-compose-services-present',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const compose = ctx.detectedFiles.find(
        (f) => f.path.endsWith('docker-compose.yml') || f.path.endsWith('docker-compose.yaml')
      );
      if (!compose) return issues;
      const content = readFile(ctx, compose.path.split('/').pop() ?? 'docker-compose.yml');
      if (!content) return issues;
      if (!/^services\s*:/m.test(content)) {
        issues.push({
          id: 'compose-services-missing',
          title: 'docker-compose.yml missing services section',
          category: 'environment',
          severity: 'warning',
          description: 'The docker-compose file does not declare a services section.',
          reason: 'services is the top-level key for container definitions.',
          recommendation: 'Add a "services:" section with at least one service.',
          affectedFile: compose.path,
          detected: 'no services',
          expected: 'services section',
          impact: 'The compose file is invalid.',
          suggestedAction: 'Add a services section to docker-compose.yml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'env-local-committed',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envLocal = ctx.detectedFiles.find(
        (f) => f.path === '.env.local' || f.path.endsWith('/.env.local')
      );
      if (envLocal) {
        const content = readFile(ctx, '.env.local') ?? '';
        if (/SECRET|KEY|PASSWORD|TOKEN/i.test(content)) {
          issues.push({
            id: 'env-local-secrets-committed',
            title: 'Secrets detected in committed .env.local file',
            category: 'environment',
            severity: 'critical',
            description: 'A .env.local file containing potential secrets was found.',
            reason: 'Committing .env.local with secrets is a security risk.',
            recommendation: 'Remove .env.local and add it to .gitignore.',
            affectedFile: '.env.local',
            detected: 'secrets present',
            expected: '.env.local in .gitignore',
            impact: 'Credential leakage if the repository is shared.',
            suggestedAction: 'Delete .env.local and rotate exposed credentials.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'env-production-committed',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envProd = ctx.detectedFiles.find(
        (f) => f.path === '.env.production' || f.path.endsWith('/.env.production')
      );
      if (envProd) {
        const content = readFile(ctx, '.env.production') ?? '';
        if (/SECRET|KEY|PASSWORD|TOKEN/i.test(content)) {
          issues.push({
            id: 'env-production-secrets-committed',
            title: 'Secrets detected in committed .env.production file',
            category: 'environment',
            severity: 'critical',
            description: 'A .env.production file containing potential secrets was found.',
            reason: 'Production secrets should never be committed.',
            recommendation: 'Remove .env.production and use a secret manager.',
            affectedFile: '.env.production',
            detected: 'secrets present',
            expected: '.env.production not committed',
            impact: 'Production credential leakage.',
            suggestedAction: 'Delete .env.production and rotate all secrets.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'gitignore-covers-env-files',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const gitignore = readFile(ctx, '.gitignore');
      if (!gitignore) return issues;
      const envFiles = ctx.detectedFiles.filter((f) =>
        f.path === '.env' || f.path.endsWith('/.env') ||
        f.path === '.env.local' || f.path.endsWith('/.env.local') ||
        f.path === '.env.production' || f.path.endsWith('/.env.production')
      );
      if (envFiles.length > 0) {
        const coversEnv = /\.env(\.local|\.production)?(\.\*)?/m.test(gitignore) || /^\.env$/m.test(gitignore);
        if (!coversEnv) {
          issues.push({
            id: 'gitignore-env-incomplete',
            title: '.gitignore does not cover .env files',
            category: 'environment',
            severity: 'warning',
            description: 'Env files exist but .gitignore does not broadly exclude them.',
            reason: 'A broad .env* pattern prevents accidental secret commits.',
            recommendation: 'Add ".env*" to .gitignore (keep .env.example excluded from ignore).',
            affectedFile: '.gitignore',
            detected: 'incomplete .env ignore',
            expected: '.env* in .gitignore',
            impact: 'Secrets may be committed accidentally.',
            suggestedAction: 'Add .env* to .gitignore.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-pinned-base-image',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      const fromMatches = content.match(/^FROM\s+\S+:latest/gim);
      if (fromMatches && fromMatches.length > 0) {
        issues.push({
          id: 'dockerfile-latest-tag',
          title: 'Dockerfile uses :latest tag',
          category: 'environment',
          severity: 'warning',
          description: 'The Dockerfile uses a :latest tag for the base image.',
          reason: ':latest is non-reproducible and may change unexpectedly.',
          recommendation: 'Pin the base image to a specific version or digest.',
          affectedFile: 'Dockerfile',
          detected: ':latest tag',
          expected: 'pinned version tag',
          impact: 'Builds may break when the base image is updated.',
          suggestedAction: 'Replace :latest with a specific version tag.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-dumb-init',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (ctx.stack.runtime === 'Node.js' && !/dumb-init|tini/i.test(content)) {
        issues.push({
          id: 'dockerfile-no-init',
          title: 'Dockerfile does not use an init system',
          category: 'environment',
          severity: 'info',
          description: 'No dumb-init or tini found in the Dockerfile.',
          reason: 'An init system handles signals and zombie processes correctly.',
          recommendation: 'Add dumb-init or tini as the entrypoint.',
          affectedFile: 'Dockerfile',
          detected: 'no init',
          expected: 'dumb-init or tini',
          impact: 'Signal handling may not work correctly.',
          suggestedAction: 'Use dumb-init or tini in the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'docker-compose-env-file',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const compose = ctx.detectedFiles.find(
        (f) => f.path.endsWith('docker-compose.yml') || f.path.endsWith('docker-compose.yaml')
      );
      if (!compose) return issues;
      const content = readFile(ctx, compose.path.split('/').pop() ?? 'docker-compose.yml');
      if (!content) return issues;
      if (/env_file\s*:/m.test(content)) {
        if (/env_file\s*:\s*['"]?\.env['"]?/m.test(content)) {
          issues.push({
            id: 'compose-env-file-dotenv',
            title: 'docker-compose.yml references .env directly',
            category: 'environment',
            severity: 'warning',
            description: 'The compose file uses .env as an env_file.',
            reason: 'Using .env directly may expose secrets if the file is committed.',
            recommendation: 'Use .env.example for compose and keep .env gitignored.',
            affectedFile: compose.path,
            detected: '.env referenced',
            expected: '.env.example or secret manager',
            impact: 'Secrets may be exposed via the compose file.',
            suggestedAction: 'Use a non-committed env file for compose.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-copies-only-needed',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/COPY\s+\.\s+\//i.test(content) || /COPY\s+\.\s+\./i.test(content)) {
        issues.push({
          id: 'dockerfile-copy-all',
          title: 'Dockerfile copies entire project context',
          category: 'environment',
          severity: 'info',
          description: 'The Dockerfile uses "COPY . ." which copies everything.',
          reason: 'Copying everything may include unnecessary files and increase image size.',
          recommendation: 'Use a .dockerignore file or copy specific directories.',
          affectedFile: 'Dockerfile',
          detected: 'COPY . .',
          expected: 'targeted COPY',
          impact: 'Image may include unnecessary files.',
          suggestedAction: 'Add a .dockerignore or use targeted COPY.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerignore-present',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasDocker = ctx.detectedFiles.some((f) => f.path.endsWith('Dockerfile'));
      if (!hasDocker) return issues;
      const hasDockerignore = ctx.detectedFiles.some(
        (f) => f.path === '.dockerignore' || f.path.endsWith('/.dockerignore')
      );
      if (!hasDockerignore) {
        issues.push({
          id: 'dockerignore-missing',
          title: 'No .dockerignore file found',
          category: 'environment',
          severity: 'info',
          description: 'A Dockerfile exists but no .dockerignore was found.',
          reason: '.dockerignore excludes files from the build context.',
          recommendation: 'Add a .dockerignore file.',
          affectedFile: '.dockerignore',
          detected: 'missing',
          expected: '.dockerignore present',
          impact: 'Build context may include unnecessary files.',
          suggestedAction: 'Create a .dockerignore file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-no-sudo',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/sudo\s+/i.test(content)) {
        issues.push({
          id: 'dockerfile-sudo',
          title: 'Dockerfile uses sudo',
          category: 'environment',
          severity: 'warning',
          description: 'The Dockerfile contains sudo commands.',
          reason: 'sudo is typically unnecessary in Dockerfiles and may cause issues.',
          recommendation: 'Remove sudo and run commands as the appropriate user.',
          affectedFile: 'Dockerfile',
          detected: 'sudo used',
          expected: 'no sudo',
          impact: 'Build may fail or behave unexpectedly.',
          suggestedAction: 'Remove sudo from the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-apt-get-clean',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/apt-get\s+install/i.test(content) && !/apt-get\s+clean|rm\s+-rf\s+\/var\/lib\/apt/i.test(content)) {
        issues.push({
          id: 'dockerfile-apt-no-clean',
          title: 'Dockerfile installs apt packages without cleaning cache',
          category: 'environment',
          severity: 'info',
          description: 'apt-get install is used but the cache is not cleaned.',
          reason: 'Cleaning the apt cache reduces image size.',
          recommendation: 'Add "&& apt-get clean && rm -rf /var/lib/apt/lists/*" after install.',
          affectedFile: 'Dockerfile',
          detected: 'no cache cleanup',
          expected: 'apt-get clean',
          impact: 'Image is larger than necessary.',
          suggestedAction: 'Clean the apt cache in the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-workdir-set',
    category: 'environment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/^FROM\s+/m.test(content) && !/WORKDIR\s+/m.test(content)) {
        issues.push({
          id: 'dockerfile-no-workdir',
          title: 'Dockerfile missing WORKDIR',
          category: 'environment',
          severity: 'info',
          description: 'The Dockerfile does not set a WORKDIR.',
          reason: 'A WORKDIR avoids running commands in / which is messy.',
          recommendation: 'Add "WORKDIR /app" before COPY/RUN commands.',
          affectedFile: 'Dockerfile',
          detected: 'no WORKDIR',
          expected: 'WORKDIR set',
          impact: 'Files may be scattered in the container filesystem.',
          suggestedAction: 'Add a WORKDIR to the Dockerfile.',
        });
      }
      return issues;
    },
  },
];
