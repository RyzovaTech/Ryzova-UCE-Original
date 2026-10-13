import { securityContext, matchIsProse } from '../../analyzer/security-context';
import { packageOwner } from '../../analyzer/javascript-import-evidence';
import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';
import { classifyProjectFileScope } from '../../analyzer/project-scope';

const FRAMEWORK_ENV_EXPECTATIONS: Record<string, string[]> = {
  'Next.js': ['NEXT_PUBLIC_API_URL'],
  'Nuxt': ['NUXT_PUBLIC_API_BASE'],
  'Remix': ['DATABASE_URL'],
  'Gatsby': ['GATSBY_API_URL'],
  'Django': ['SECRET_KEY', 'DEBUG'],
  'Flask': ['SECRET_KEY', 'FLASK_ENV'],
  'FastAPI': ['DATABASE_URL'],
  'Spring Boot': ['SPRING_DATASOURCE_URL'],
  'Rails': ['RAILS_MASTER_KEY', 'DATABASE_URL'],
  'Laravel': ['APP_KEY', 'DB_CONNECTION'],
  'Express': ['PORT'],
  'NestJS': ['PORT', 'DATABASE_URL'],
  'Fastify': ['PORT'],
  'Phoenix': ['SECRET_KEY_BASE', 'DATABASE_URL'],
};

export const configurationRules: CompatibilityRule[] = [
  {
    id: 'tsconfig-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript') return issues;
      if (!ctx.files.some(f => !f.isDirectory && /\.[cm]?tsx?$/i.test(f.path) && !/\.d\.[cm]?ts$/i.test(f.path) && classifyProjectFileScope(f.path) === 'production')) return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('tsconfig.json'))) {
        issues.push({
          id: 'tsconfig-missing',
          title: 'tsconfig.json missing for TypeScript project',
          category: 'configuration',
          severity: 'critical',
          description: 'A TypeScript project was detected but no tsconfig.json was found.',
          reason: 'Without tsconfig.json, the TypeScript compiler cannot type-check or emit correctly.',
          recommendation: 'Add a tsconfig.json with appropriate compiler options.',
          affectedFile: 'tsconfig.json',
          detected: 'missing',
          expected: 'tsconfig.json present',
          impact: 'Type checking and build will fail in CI.',
          suggestedAction: 'Create tsconfig.json (use tsc --init).',
        });
      }
      return issues;
    },
  },
  {
    id: 'env-example-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.architecture?.primary === 'Operating System Kernel') return issues;
      const evidenceFiles = ctx.files.filter(f => !f.isDirectory && ['production', 'configuration'].includes(classifyProjectFileScope(f.path)));
      const manifests = evidenceFiles.filter(f => /(?:^|\/)(?:package\.json|pyproject\.toml|pom\.xml|build\.gradle(?:\.kts)?)$/.test(f.path)).map(f => f.path);
      const owners = new Set<string>();
      for (const file of evidenceFiles) {
        if (classifyProjectFileScope(file.path) !== 'production') continue;
        const source = file.content ?? '';
        const pattern = /\.[cm]?[jt]sx?$/i.test(file.path) ? /\b(?:process\.env\.(?!NODE_ENV\b)|import\.meta\.env\.(?!MODE\b|DEV\b|PROD\b))[A-Za-z_$][\w$]*/g
          : /\.(?:java|kt|kts)$/i.test(file.path) ? /\bSystem\.getenv\s*\(/g : /\.py$/i.test(file.path) ? /\bos\.getenv\s*\(/g : undefined;
        if (!pattern) continue;
        const context = securityContext(source, /\.kts?$/i.test(file.path) ? file.path + ".java" : file.path);
        const used = [...source.matchAll(pattern)].some(m => {
          if (context) return !matchIsProse(context, source, m.index!, m.index! + m[0].length, false);
          return !source.slice(source.lastIndexOf('\n', m.index!) + 1, m.index).trimStart().startsWith('#');
        });
        if (used) owners.add(packageOwner(file.path, manifests));
      }
      for (const owner of owners) {
        const hasTemplate = evidenceFiles.some(f => packageOwner(f.path, manifests) === owner && /(?:^|\/)\.env(?:\.example)?$/.test(f.path));
        if (hasTemplate) continue;
        issues.push({
          id: 'env-example-missing',
          title: 'No .env.example file found',
          category: 'configuration',
          severity: 'info',
          description: 'The project does not include an .env.example template.',
          reason: 'Contributors need to know which environment variables the project expects.',
          recommendation: 'Add an .env.example file listing required variables with placeholder values.',
          affectedFile: owner + '.env.example',
          detected: 'missing',
          expected: '.env.example present',
          impact: 'Onboarding friction and misconfigured deployments.',
          suggestedAction: 'Create .env.example with required keys.',
        });
      }
      return issues;
    },
  },
  {
    id: 'missing-env-vars',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envExample = ctx.detectedFiles.find((f) => f.path.endsWith('.env.example'));
      if (!envExample) return issues;
      const content = readFile(ctx, '.env.example') ?? '';
      const declared = new Set(
        content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
          .map((l) => l.split('=')[0].trim())
      );
      if (declared.size === 0) {
        issues.push({
          id: 'env-example-empty',
          title: '.env.example is empty',
          category: 'configuration',
          severity: 'warning',
          description: '.env.example exists but declares no variables.',
          reason: 'An empty template gives no guidance on required configuration.',
          recommendation: 'Populate .env.example with the keys the application reads.',
          affectedFile: '.env.example',
          detected: 'empty',
          expected: 'at least one variable',
          impact: 'Contributors cannot reproduce the required environment.',
          suggestedAction: 'List required environment variables in .env.example.',
        });
      }
      return issues;
    },
  },
  {
    id: 'common-env-coverage',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envExample = ctx.detectedFiles.find((f) => f.path.endsWith('.env.example'));
      if (!envExample) return issues;
      const content = readFile(ctx, '.env.example') ?? '';
      const declared = new Set(
        content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
          .map((l) => l.split('=')[0].trim())
      );
      const expected = FRAMEWORK_ENV_EXPECTATIONS[ctx.stack.framework] ?? [];
      const missing = expected.filter((v) => !declared.has(v));
      if (missing.length > 0) {
        issues.push({
          id: 'env-coverage-framework',
          title: `Missing expected ${ctx.stack.framework} environment variables`,
          category: 'configuration',
          severity: 'warning',
          description: `.env.example is missing: ${missing.join(', ')}.`,
          reason: `${ctx.stack.framework} projects typically declare these environment variables.`,
          recommendation: 'Add the missing variables to .env.example with placeholder values.',
          affectedFile: '.env.example',
          detected: `${declared.size} declared`,
          expected: missing.join(', '),
          impact: 'Runtime configuration gaps in production.',
          suggestedAction: `Add ${missing.join(', ')} to .env.example.`,
        });
      }
      return issues;
    },
  },
];
