#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
for (const schema of ['schemas/knowledge-pack.schema.json', 'schemas/analysis-report.schema.json']) {
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

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
for (const gate of ['npm run check', 'npm run build', 'npm test', 'npm run benchmark', 'npm audit --omit=dev', 'upload-sarif']) if (!workflow.includes(gate)) failures.push(`CI is missing release gate: ${gate}.`);

const trust = fs.readFileSync('src/lib/analyzer/trust.ts', 'utf8');
for (const statement of ['not proof of runtime behavior', 'do not replace', 'scoringFormula', 'knowledgePacks']) if (!trust.includes(statement)) failures.push(`Trust metadata is missing: ${statement}.`);

console.log(JSON.stringify({ gateVersion: 1, schemas: 2, accessibilityChecks: 4, workflowChecks: 6, trustChecks: 4, failures }));
if (failures.length) process.exit(1);
