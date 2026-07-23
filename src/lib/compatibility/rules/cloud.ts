import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const cloudProviderRules: CompatibilityRule[] = [
  {
    id: 'vercel-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasVercel = ctx.detectedFiles.some(
        (f) => f.path === 'vercel.json' || f.path.endsWith('/vercel.json')
      );
      if (!hasVercel) return issues;
      const content = readFile(ctx, 'vercel.json');
      if (content) {
        try {
          const v = JSON.parse(content);
          if (!v.version && !v.framework && !v.builds && !v.routes && !v.functions) {
            issues.push({
              id: 'vercel-config-empty',
              title: 'vercel.json is effectively empty',
              category: 'deployment',
              severity: 'info',
              description: 'vercel.json exists but has no meaningful configuration.',
              reason: 'An empty config does not customize the deployment.',
              recommendation: 'Add framework, builds, or routes configuration.',
              affectedFile: 'vercel.json',
              detected: 'no config keys',
              expected: 'framework or routes',
              impact: 'Vercel uses defaults which may not match the project.',
              suggestedAction: 'Configure vercel.json with framework and routes.',
            });
          }
        } catch {
          // ignore
        }
      }
      return issues;
    },
  },
  {
    id: 'netlify-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasNetlify = ctx.detectedFiles.some(
        (f) => f.path === 'netlify.toml' || f.path.endsWith('/netlify.toml')
      );
      if (!hasNetlify) return issues;
      const content = readFile(ctx, 'netlify.toml');
      if (content && !/\[build\]/i.test(content)) {
        issues.push({
          id: 'netlify-no-build-section',
          title: 'netlify.toml missing [build] section',
          category: 'deployment',
          severity: 'info',
          description: 'netlify.toml does not declare a [build] section.',
          reason: 'The build section configures the publish directory and build command.',
          recommendation: 'Add a [build] section with publish and command.',
          affectedFile: 'netlify.toml',
          detected: 'no [build]',
          expected: '[build] section',
          impact: 'Netlify uses default build settings.',
          suggestedAction: 'Add a [build] section to netlify.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'railway-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasRailway = ctx.detectedFiles.some(
        (f) => f.path === 'railway.json' || f.path.endsWith('/railway.json') ||
              f.path === 'railway.toml' || f.path.endsWith('/railway.toml')
      );
      if (!hasRailway) return issues;
      return issues;
    },
  },
  {
    id: 'flyio-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasFly = ctx.detectedFiles.some(
        (f) => f.path === 'fly.toml' || f.path.endsWith('/fly.toml')
      );
      if (!hasFly) return issues;
      const content = readFile(ctx, 'fly.toml');
      if (content && !/app\s*=/i.test(content)) {
        issues.push({
          id: 'flyio-no-app',
          title: 'fly.toml missing app name',
          category: 'deployment',
          severity: 'warning',
          description: 'fly.toml does not declare an app name.',
          reason: 'The app name is required for Fly.io deployments.',
          recommendation: 'Add "app = \\"my-app\\"" to fly.toml.',
          affectedFile: 'fly.toml',
          detected: 'no app name',
          expected: 'app field',
          impact: 'Deployment may fail.',
          suggestedAction: 'Add an app name to fly.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'render-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasRender = ctx.detectedFiles.some(
        (f) => f.path === 'render.yaml' || f.path.endsWith('/render.yaml')
      );
      if (!hasRender) return issues;
      const content = readFile(ctx, 'render.yaml');
      if (content && !/services\s*:/i.test(content)) {
        issues.push({
          id: 'render-no-services',
          title: 'render.yaml missing services section',
          category: 'deployment',
          severity: 'info',
          description: 'render.yaml does not declare a services section.',
          reason: 'Services define what Render should deploy.',
          recommendation: 'Add a "services:" section to render.yaml.',
          affectedFile: 'render.yaml',
          detected: 'no services',
          expected: 'services section',
          impact: 'Render does not know what to deploy.',
          suggestedAction: 'Add services to render.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'cloudflare-config-present',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasWrangler = ctx.detectedFiles.some(
        (f) => f.path === 'wrangler.toml' || f.path.endsWith('/wrangler.toml') ||
              f.path === 'wrangler.json' || f.path.endsWith('/wrangler.json')
      );
      if (!hasWrangler) return issues;
      const content = readFile(ctx, 'wrangler.toml') ?? readFile(ctx, 'wrangler.json');
      if (content && !/name\s*=/i.test(content) && !/"name"\s*:/i.test(content)) {
        issues.push({
          id: 'cloudflare-no-name',
          title: 'wrangler config missing worker name',
          category: 'deployment',
          severity: 'warning',
          description: 'The wrangler config does not declare a name.',
          reason: 'The name is required for Cloudflare Workers deployment.',
          recommendation: 'Add "name = \\"my-worker\\"" to wrangler.toml.',
          affectedFile: 'wrangler.toml',
          detected: 'no name',
          expected: 'name field',
          impact: 'Deployment may fail.',
          suggestedAction: 'Add a name to wrangler config.',
        });
      }
      return issues;
    },
  },
  {
    id: 'cloud-provider-env-vars',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasVercel = ctx.detectedFiles.some((f) => f.path === 'vercel.json' || f.path.endsWith('/vercel.json'));
      const hasNetlify = ctx.detectedFiles.some((f) => f.path === 'netlify.toml' || f.path.endsWith('/netlify.toml'));
      if (!hasVercel && !hasNetlify) return issues;
      const envExample = ctx.detectedFiles.find((f) => f.path.endsWith('.env.example'));
      if (!envExample) {
        issues.push({
          id: 'cloud-no-env-example',
          title: 'Cloud deployment detected but no .env.example',
          category: 'deployment',
          severity: 'info',
          description: 'A cloud config was found but .env.example is missing.',
          reason: 'Cloud platforms need environment variables documented.',
          recommendation: 'Add an .env.example with required variables.',
          affectedFile: '.env.example',
          detected: 'missing',
          expected: '.env.example',
          impact: 'Deployment configuration is incomplete.',
          suggestedAction: 'Create .env.example with required env vars.',
        });
      }
      return issues;
    },
  },
  {
    id: 'flyio-regions-config',
    category: 'deployment',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasFly = ctx.detectedFiles.some(
        (f) => f.path === 'fly.toml' || f.path.endsWith('/fly.toml')
      );
      if (!hasFly) return issues;
      const content = readFile(ctx, 'fly.toml');
      if (content && !/primary_region\s*=/i.test(content)) {
        issues.push({
          id: 'flyio-no-region',
          title: 'fly.toml missing primary_region',
          category: 'deployment',
          severity: 'info',
          description: 'fly.toml does not specify a primary_region.',
          reason: 'The region determines where the app runs.',
          recommendation: 'Add "primary_region = \\"sjc\\"".',
          affectedFile: 'fly.toml',
          detected: 'no region',
          expected: 'primary_region',
          impact: 'Fly.io may use a default region.',
          suggestedAction: 'Add primary_region to fly.toml.',
        });
      }
      return issues;
    },
  },
];
