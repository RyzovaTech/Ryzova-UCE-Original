#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
for (const schema of ['schemas/knowledge-pack.schema.json', 'schemas/v3-rule-pack.schema.json', 'schemas/analysis-report.schema.json']) {
  try { const parsed = JSON.parse(fs.readFileSync(schema, 'utf8')); if (!parsed.$schema || !parsed.$id || parsed.type !== 'object') failures.push(`${schema} is missing required schema metadata.`); }
  catch (error) { failures.push(`${schema} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}

const index = fs.readFileSync('index.html', 'utf8');
if (!/<html[^>]+lang="en"/i.test(index)) failures.push('index.html must declare a document language.');
const analyze = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
if (!analyze.includes('aria-live="polite"') || !analyze.includes('aria-label="Analysis progress"')) failures.push('Analysis progress requires accessible live status and labeling.');
const catalog = fs.readFileSync('src/pages/CatalogPage.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
if (!catalog.includes('Search UCE knowledge') || !catalog.includes('aria-live="polite"')) failures.push('UCE Catalog requires accessible search and result status.');
if (!sidebar.includes("'/settings'") || !sidebar.includes("'/catalog'")) failures.push('UCE Catalog must be available below Settings in the sidebar.');
const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
const catalogSeo = fs.readFileSync('public/catalog/index.html', 'utf8');
for (const route of ['catalog', 'catalog/languages', 'catalog/technologies', 'catalog/browser', 'catalog/security', 'catalog/architecture', 'catalog/intelligence']) {
  if (!sitemap.includes(`https://uce.ryzova.com/${route}`)) failures.push(`Public sitemap must include /${route}.`);
}
for (const marker of ['rel="canonical" href="https://uce.ryzova.com/catalog"', 'name="description"', 'index, follow']) if (!catalogSeo.includes(marker)) failures.push(`Catalog SEO is missing: ${marker}.`);
for (const marker of ['77 programming language', '639 software technology', '105 browser compatibility', '40 security']) if (!catalogSeo.includes(marker)) failures.push(`Catalog coverage SEO is missing: ${marker}.`);
const seoGenerator = fs.readFileSync('scripts/prerender-seo.mjs', 'utf8');
for (const marker of ['UCE_CATALOG_ITEMS', "'ItemList'", "'DefinedTerm'", 'dist/catalog/${slug}/index.html']) if (!seoGenerator.includes(marker)) failures.push(`Catalog index generation is missing: ${marker}.`);

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
for (const gate of ['npm run check', 'npm run build', 'npm test', 'npm run benchmark', 'npm audit --omit=dev', 'upload-sarif']) if (!workflow.includes(gate)) failures.push(`CI is missing release gate: ${gate}.`);

const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const githubRelay = vercelConfig.rewrites?.find((rewrite) => rewrite.source === '/api/github/archive/:owner/:repository/:branch*');
if (githubRelay?.destination !== 'https://codeload.github.com/:owner/:repository/zip/refs/heads/:branch*') failures.push('Vercel must relay GitHub archives through the same UCE origin.');
const relayHeaders = vercelConfig.headers?.find((entry) => entry.source === '/api/github/archive/:path*')?.headers ?? [];
if (!relayHeaders.some((header) => header.key === 'x-vercel-enable-rewrite-caching' && header.value === '0')) failures.push('GitHub archive relay caching must remain disabled.');

const trust = fs.readFileSync('src/lib/analyzer/trust.ts', 'utf8');
for (const statement of ['not proof of runtime behavior', 'do not replace', 'scoringFormula', 'knowledgePacks']) if (!trust.includes(statement)) failures.push(`Trust metadata is missing: ${statement}.`);

const v3Platform = ['src/lib/knowledge/v3-types.ts', 'src/lib/knowledge/v3-validator.ts', 'src/lib/knowledge/v3-sdk.ts', 'src/lib/knowledge/v3-registry.ts', 'src/lib/knowledge/v3-signatures.ts', 'src/lib/knowledge/v3-docs.ts', 'src/lib/knowledge/v3-default-packs.ts'];
for (const file of v3Platform) if (!fs.existsSync(file)) failures.push(`V3 rule platform module is missing: ${file}.`);
console.log(JSON.stringify({ gateVersion: 1, schemas: 3, accessibilityChecks: 4, seoChecks: 18, workflowChecks: 6, deploymentChecks: 2, trustChecks: 4, v3PlatformChecks: v3Platform.length, failures }));
if (failures.length) process.exit(1);
