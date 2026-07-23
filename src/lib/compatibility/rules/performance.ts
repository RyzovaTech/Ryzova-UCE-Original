import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const performanceRules: CompatibilityRule[] = [
  {
    id: 'large-source-files',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      const largeFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.size > 500_000 &&
          /\.(ts|js|tsx|jsx|css|scss)$/i.test(f.path) &&
          !f.path.includes('node_modules/') && !f.path.includes('dist/') && !f.path.includes('build/')
      );
      for (const file of largeFiles.slice(0, 3)) {
        issues.push({
          id: `large-file-${file.path}`,
          title: 'Large source file detected',
          category: 'performance',
          severity: 'info',
          description: `${file.path} is ${(file.size / 1024).toFixed(0)}KB.`,
          reason: 'Large files slow down compilation and IDE performance.',
          recommendation: 'Consider splitting the file into smaller modules.',
          affectedFile: file.path,
          detected: `${(file.size / 1024).toFixed(0)}KB`,
          expected: '< 500KB',
          impact: 'Build and IDE performance may degrade.',
          suggestedAction: 'Split the file into smaller modules.',
        });
      }
      return issues;
    },
  },
  {
    id: 'no-source-map-config',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.buildTool !== 'Vite') return issues;
      const viteConfig = ctx.files.find(
        (f) => !f.isDirectory && f.content && /vite\.config\./.test(f.path)
      );
      if (!viteConfig?.content) return issues;
      if (!/sourcemap/i.test(viteConfig.content)) {
        issues.push({
          id: 'vite-no-sourcemap',
          title: 'Vite config does not configure sourcemaps',
          category: 'performance',
          severity: 'info',
          description: 'vite.config does not specify sourcemap settings.',
          reason: 'Explicit sourcemap config helps debug production issues.',
          recommendation: 'Add build.sourcemap: true for production debugging.',
          affectedFile: viteConfig.path,
          detected: 'not configured',
          expected: 'sourcemap setting',
          impact: 'Debugging production issues is harder.',
          suggestedAction: 'Configure sourcemaps in vite.config.',
        });
      }
      return issues;
    },
  },
  {
    id: 'no-minification-config',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.buildTool !== 'Webpack' && ctx.stack.buildTool !== 'Rollup') return issues;
      const configFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content && /(webpack|rollup)\.config\./.test(f.path)
      );
      for (const file of configFiles) {
        if (!file.content) continue;
        if (!/minimize|minify|terser/i.test(file.content)) {
          issues.push({
            id: `no-minification-${file.path}`,
            title: 'Build config does not enable minification',
            category: 'performance',
            severity: 'info',
            description: `${file.path} does not configure minification.`,
            reason: 'Minification reduces bundle size significantly.',
            recommendation: 'Enable minification in the build config.',
            affectedFile: file.path,
            detected: 'no minification',
            expected: 'minification enabled',
            impact: 'Larger bundles for end users.',
            suggestedAction: 'Enable minification in the build config.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'no-code-splitting',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.framework !== 'Next.js' && ctx.stack.buildTool !== 'Vite' && ctx.stack.buildTool !== 'Webpack') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const hasReactLazy = ctx.files.some(
          (f) => !f.isDirectory && f.content && /React\.lazy|lazy\(/i.test(f.content)
        );
        const hasDynamicImport = ctx.files.some(
          (f) => !f.isDirectory && f.content && /import\s*\(/i.test(f.content)
        );
        const depCount = Object.keys({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>).length;
        if (depCount > 20 && !hasReactLazy && !hasDynamicImport) {
          issues.push({
            id: 'no-code-splitting-detected',
            title: 'No code splitting detected despite many dependencies',
            category: 'performance',
            severity: 'info',
            description: `The project has ${depCount} dependencies but no dynamic imports or React.lazy.`,
            reason: 'Code splitting reduces initial bundle size.',
            recommendation: 'Use React.lazy or dynamic imports for route-based splitting.',
            affectedFile: 'package.json',
            detected: `${depCount} deps, no splitting`,
            expected: 'code splitting',
            impact: 'Larger initial bundle for users.',
            suggestedAction: 'Add code splitting for routes.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'no-tree-shaking-hints',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript' && ctx.stack.language !== 'JavaScript') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (p.sideEffects === undefined) {
          const depCount = Object.keys({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>).length;
          if (depCount > 10) {
            issues.push({
              id: 'no-side-effects-hint',
              title: 'package.json missing sideEffects field',
              category: 'performance',
              severity: 'info',
              description: 'package.json does not declare a sideEffects field.',
              reason: 'The sideEffects field enables better tree shaking.',
              recommendation: 'Add "sideEffects": false or list files with side effects.',
              affectedFile: 'package.json',
              detected: 'not declared',
              expected: 'sideEffects field',
              impact: 'Bundlers cannot tree-shake as aggressively.',
              suggestedAction: 'Add sideEffects to package.json.',
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
    id: 'no-bundle-analyzer',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.buildTool !== 'Vite' && ctx.stack.buildTool !== 'Webpack') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const allDeps = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>;
        if (!allDeps['rollup-plugin-visualizer'] && !allDeps['webpack-bundle-analyzer']) {
          issues.push({
            id: 'no-bundle-analyzer',
            title: 'No bundle analyzer configured',
            category: 'performance',
            severity: 'info',
            description: 'No bundle analyzer plugin was found in dependencies.',
            reason: 'Bundle analyzers help identify large dependencies.',
            recommendation: 'Add rollup-plugin-visualizer or webpack-bundle-analyzer.',
            affectedFile: 'package.json',
            detected: 'no analyzer',
            expected: 'bundle analyzer plugin',
            impact: 'Bundle size is harder to optimize.',
            suggestedAction: 'Install a bundle analyzer plugin.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'no-image-optimization',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.framework !== 'Next.js') return issues;
      const nextConfig = ctx.files.find(
        (f) => !f.isDirectory && f.content && /next\.config\./.test(f.path)
      );
      if (!nextConfig?.content) return issues;
      if (!/images|remotePatterns|domains/i.test(nextConfig.content)) {
        issues.push({
          id: 'next-no-image-config',
          title: 'Next.js config does not configure image optimization',
          category: 'performance',
          severity: 'info',
          description: 'next.config does not configure image optimization settings.',
          reason: 'Image optimization reduces bandwidth and improves LCP.',
          recommendation: 'Configure images in next.config.js.',
          affectedFile: nextConfig.path,
          detected: 'no image config',
          expected: 'images configuration',
          impact: 'Unoptimized images may slow down the page.',
          suggestedAction: 'Add image config to next.config.',
        });
      }
      return issues;
    },
  },
  {
    id: 'large-json-files',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      const largeJson = ctx.files.filter(
        (f) => !f.isDirectory && f.size > 1_000_000 && /\.json$/i.test(f.path) &&
          !f.path.includes('node_modules/') && !f.path.includes('package-lock') &&
          !f.path.includes('pnpm-lock') && !f.path.includes('yarn.lock')
      );
      for (const file of largeJson.slice(0, 2)) {
        issues.push({
          id: `large-json-${file.path}`,
          title: 'Large JSON file detected',
          category: 'performance',
          severity: 'info',
          description: `${file.path} is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
          reason: 'Large JSON files increase bundle size and parse time.',
          recommendation: 'Consider splitting or compressing the JSON data.',
          affectedFile: file.path,
          detected: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
          expected: '< 1MB',
          impact: 'Slower load and parse times.',
          suggestedAction: 'Split or compress large JSON files.',
        });
      }
      return issues;
    },
  },
  {
    id: 'no-lazy-loading-images',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      const htmlFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content && /\.html$/i.test(f.path)
      );
      for (const file of htmlFiles) {
        if (!file.content) continue;
        const imgCount = (file.content.match(/<img\s/gi) || []).length;
        const lazyCount = (file.content.match(/loading\s*=\s*["']lazy["']/gi) || []).length;
        if (imgCount > 3 && lazyCount === 0) {
          issues.push({
            id: `no-lazy-images-${file.path}`,
            title: 'Images without lazy loading detected',
            category: 'performance',
            severity: 'info',
            description: `${file.path} has ${imgCount} images but none use loading="lazy".`,
            reason: 'Lazy loading defers offscreen images, improving initial load.',
            recommendation: 'Add loading="lazy" to img tags.',
            affectedFile: file.path,
            detected: `${imgCount} images, 0 lazy`,
            expected: 'lazy loading',
            impact: 'Slower initial page load.',
            suggestedAction: 'Add loading="lazy" to images.',
          });
          break;
        }
      }
      return issues;
    },
  },
  {
    id: 'no-prefetch-preload',
    category: 'performance',
    run: (ctx) => {
      const issues: Issue[] = [];
      const htmlFiles = ctx.files.filter(
        (f) => !f.isDirectory && f.content && /\.html$/i.test(f.path)
      );
      for (const file of htmlFiles) {
        if (!file.content) continue;
        if (!/<link\s+[^>]*(prefetch|preload)/i.test(file.content)) {
          issues.push({
            id: `no-prefetch-${file.path}`,
            title: 'No prefetch/preload links in HTML',
            category: 'performance',
            severity: 'info',
            description: `${file.path} does not use prefetch or preload for critical resources.`,
            reason: 'Preloading critical resources improves load performance.',
            recommendation: 'Add rel="preload" for fonts, CSS, and key scripts.',
            affectedFile: file.path,
            detected: 'no preload',
            expected: 'preload hints',
            impact: 'Critical resources load later than necessary.',
            suggestedAction: 'Add preload links for critical assets.',
          });
          break;
        }
      }
      return issues;
    },
  },
];
