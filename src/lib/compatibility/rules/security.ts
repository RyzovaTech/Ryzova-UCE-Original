import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

const KNOWN_VULNERABLE_VERSIONS: Record<string, string[]> = {
  'lodash': ['4.17.19', '4.17.20', '4.17.4', '4.17.5', '4.17.10', '4.17.11', '4.17.14', '4.17.15'],
  'axios': ['0.21.0', '0.21.1', '0.20.0', '0.20.1', '0.19.0', '0.19.1', '0.18.0', '0.18.1'],
  'minimist': ['0.0.10', '0.0.8', '1.2.5', '1.2.4', '1.2.3', '1.2.0', '1.2.2'],
  'handlebars': ['4.7.6', '4.7.5', '4.7.4', '4.7.3', '4.7.2', '4.7.1', '4.7.0'],
  'ws': ['7.4.5', '7.4.4', '7.4.3', '7.4.2', '7.4.1', '7.4.0', '8.0.0', '8.0.1'],
  'node-forge': ['0.10.0', '0.10.1', '0.10.2', '0.10.3', '0.10.4'],
  'marked': ['4.0.9', '4.0.8', '4.0.7', '4.0.6', '4.0.5', '4.0.4', '4.0.3', '4.0.2', '4.0.1', '4.0.0'],
  'validator': ['13.6.0', '13.5.0', '13.4.0', '13.3.0', '13.2.0'],
};

const WEAK_SECRET_PATTERNS: RegExp[] = [
  /^(password|secret|key|token)\s*=\s*['"]?(password|secret|key|123456|admin|test|demo|example|changeme|placeholder|todo|xxx+|your_)/i,
  /^(password|secret|key|token)\s*=\s*['"]?[\w-]{0,8}['"]?$/im,
  /api[_-]?key\s*=\s*['"]?(test|demo|example|your_key|xxx+|placeholder)/i,
];

const EXPOSED_KEY_PATTERNS: RegExp[] = [
  /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /xox[baprs]-[a-zA-Z0-9-]+/,
  /AIza[a-zA-Z0-9_-]{35}/,
];

export const securityRules: CompatibilityRule[] = [
  {
    id: 'security-md-present',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasSecurityMd = ctx.detectedFiles.some(
        (f) => f.path === 'SECURITY.md' || f.path.endsWith('/SECURITY.md')
      );
      if (!hasSecurityMd) {
        issues.push({
          id: 'security-md-missing',
          title: 'No SECURITY.md policy found',
          category: 'security',
          severity: 'info',
          description: 'The project does not include a SECURITY.md file.',
          reason: 'A security policy documents how to report vulnerabilities.',
          recommendation: 'Add a SECURITY.md with disclosure and contact info.',
          affectedFile: 'SECURITY.md',
          detected: 'missing',
          expected: 'SECURITY.md present',
          impact: 'No documented vulnerability reporting process.',
          suggestedAction: 'Create a SECURITY.md file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'known-vulnerable-versions',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const allDeps = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>;
        for (const [name, range] of Object.entries(allDeps)) {
          const vulnVersions = KNOWN_VULNERABLE_VERSIONS[name];
          if (!vulnVersions) continue;
          const m = range.match(/(\d+\.\d+\.\d+)/);
          if (m && vulnVersions.includes(m[1])) {
            issues.push({
              id: `vulnerable-${name}`,
              title: `${name} ${m[1]} has known vulnerabilities`,
              category: 'security',
              severity: 'critical',
              description: `${name} is pinned to ${m[1]}, which has known security advisories.`,
              reason: 'This version contains publicly disclosed vulnerabilities.',
              recommendation: `Upgrade ${name} to the latest patched version.`,
              affectedFile: 'package.json',
              detected: `${name}@${m[1]}`,
              expected: 'latest patched version',
              impact: 'Known vulnerabilities may be exploitable.',
              suggestedAction: `npm install ${name}@latest`,
            });
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'weak-secrets-in-env',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envFiles = ctx.detectedFiles.filter(
        (f) => f.path === '.env' || f.path.endsWith('/.env') ||
              f.path === '.env.local' || f.path.endsWith('/.env.local') ||
              f.path === '.env.production' || f.path.endsWith('/.env.production')
      );
      for (const envFile of envFiles) {
        const content = readFile(ctx, envFile.path.split('/').pop() ?? '.env') ?? '';
        for (const pattern of WEAK_SECRET_PATTERNS) {
          if (pattern.test(content)) {
            issues.push({
              id: `weak-secret-${envFile.path}`,
              title: 'Weak or placeholder secret detected',
              category: 'security',
              severity: 'critical',
              description: `${envFile.path} contains a weak or placeholder secret value.`,
              reason: 'Weak secrets are easily guessable or publicly known.',
              recommendation: 'Replace with a strong, randomly generated secret.',
              affectedFile: envFile.path,
              detected: 'weak secret',
              expected: 'strong random secret',
              impact: 'Application security is compromised.',
              suggestedAction: 'Generate a strong secret and rotate it.',
            });
            break;
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'exposed-api-keys',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const sourceFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content &&
          /\.(ts|js|tsx|jsx|py|rb|go|rs|java|kt|php|env|yaml|yml|json|toml)$/i.test(f.path) &&
          !f.path.includes('node_modules/') && !f.path.includes('.d.ts')
      );
      for (const file of sourceFiles) {
        if (!file.content) continue;
        for (const pattern of EXPOSED_KEY_PATTERNS) {
          if (pattern.test(file.content)) {
            issues.push({
              id: `exposed-key-${file.path}`,
              title: 'Exposed API key detected in source',
              category: 'security',
              severity: 'critical',
              description: `${file.path} contains what appears to be a live API key.`,
              reason: 'Hardcoded API keys in source are a critical security risk.',
              recommendation: 'Move the key to an environment variable and rotate it immediately.',
              affectedFile: file.path,
              detected: 'API key pattern',
              expected: 'no hardcoded keys',
              impact: 'Credential leakage if the repository is accessible.',
              suggestedAction: 'Remove the key and rotate it immediately.',
            });
            break;
          }
        }
        if (issues.length >= 20) break;
      }
      return issues;
    },
  },
  {
    id: 'npm-audit-baseline',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasPkgLock = ctx.detectedFiles.some((f) => f.path.endsWith('package-lock.json'));
      const hasPnpmLock = ctx.detectedFiles.some((f) => f.path.endsWith('pnpm-lock.yaml'));
      const hasYarnLock = ctx.detectedFiles.some((f) => f.path.endsWith('yarn.lock'));
      if (!hasPkgLock && !hasPnpmLock && !hasYarnLock) return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const hasAuditScript = p.scripts?.audit;
        if (!hasAuditScript) {
          issues.push({
            id: 'no-audit-script',
            title: 'No npm audit script in package.json',
            category: 'security',
            severity: 'info',
            description: 'A lockfile exists but no audit script is defined.',
            reason: 'Running npm audit in CI catches vulnerable dependencies.',
            recommendation: 'Add "audit": "npm audit" to scripts.',
            affectedFile: 'package.json',
            detected: 'no audit script',
            expected: 'audit script',
            impact: 'Vulnerabilities may go undetected.',
            suggestedAction: 'Add an audit script to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'deps-without-lockfile',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const depCount = Object.keys({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>).length;
        if (depCount > 0) {
          const hasLock = ctx.detectedFiles.some(
            (f) => f.path.endsWith('package-lock.json') || f.path.endsWith('pnpm-lock.yaml') || f.path.endsWith('yarn.lock')
          );
          if (!hasLock) {
            issues.push({
              id: 'deps-no-lockfile',
              title: 'Dependencies declared without a lockfile',
              category: 'security',
              severity: 'warning',
              description: `${depCount} dependencies in package.json but no lockfile found.`,
              reason: 'Without a lockfile, dependency integrity cannot be verified.',
              recommendation: 'Run npm install and commit the lockfile.',
              affectedFile: 'package.json',
              detected: `${depCount} deps, no lock`,
              expected: 'lockfile present',
              impact: 'Supply chain risk from unverified dependencies.',
              suggestedAction: 'Generate and commit a lockfile.',
            });
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'cors-wildcard-config',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const configFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content &&
          /(next\.config|vite\.config|nuxt\.config|app\.ts|app\.js|server\.ts|server\.js|index\.ts|index\.js)$/i.test(f.path)
      );
      for (const file of configFiles) {
        if (!file.content) continue;
        if (/Access-Control-Allow-Origin.*\*/.test(file.content) || /cors.*\*.*origin/i.test(file.content)) {
          issues.push({
            id: `cors-wildcard-${file.path}`,
            title: 'CORS wildcard origin detected',
            category: 'security',
            severity: 'warning',
            description: `${file.path} appears to set CORS to allow all origins (*).`,
            reason: 'Wildcard CORS allows any website to make requests to the API.',
            recommendation: 'Restrict CORS to known origins.',
            affectedFile: file.path,
            detected: 'Access-Control-Allow-Origin: *',
            expected: 'specific origins',
            impact: 'Cross-origin attacks from any website.',
            suggestedAction: 'Configure CORS with specific allowed origins.',
          });
          break;
        }
      }
      return issues;
    },
  },
  {
    id: 'hardcoded-database-url',
    category: 'security',
    run: (ctx) => {
      const issues: Issue[] = [];
      const sourceFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content &&
          /\.(ts|js|tsx|jsx|py|rb|go|rs|java|kt|php)$/i.test(f.path) &&
          !f.path.includes('node_modules/')
      );
      for (const file of sourceFiles) {
        if (!file.content) continue;
        if (/postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"]+@/i.test(file.content) ||
            /mongodb(?:\+srv)?:\/\/[^\s'"]+:[^\s'"]+@/i.test(file.content) ||
            /mysql:\/\/[^\s'"]+:[^\s'"]+@/i.test(file.content)) {
          issues.push({
            id: `hardcoded-db-url-${file.path}`,
            title: 'Hardcoded database URL with credentials detected',
            category: 'security',
            severity: 'critical',
            description: `${file.path} contains a database URL with embedded credentials.`,
            reason: 'Database credentials in source are a critical security risk.',
            recommendation: 'Use environment variables for database URLs.',
            affectedFile: file.path,
            detected: 'DB URL with credentials',
            expected: 'environment variable reference',
            impact: 'Database access if the repository is exposed.',
            suggestedAction: 'Move database URL to environment variables.',
          });
          if (issues.length >= 20) break;
        }
      }
      return issues;
    },
  },
];
