#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
// Optional isolated install path supplied by CI, avoiding changes to the app lockfile.
const { chromium } = await import(process.env.UCE_PLAYWRIGHT_ENTRY
  ? pathToFileURL(process.env.UCE_PLAYWRIGHT_ENTRY).href : 'playwright');

const HOST = 'http://127.0.0.1:4179';
const fixture = {
  fileName: 'phase5-e2e',
  files: [
    { path: 'package.json', content: JSON.stringify({ name: 'demo', version: '1.0.0',
      engines: { node: '>=22' }, dependencies: { alpha: '^1.0.0' } }) },
    { path: 'package-lock.json', content: JSON.stringify({ name: 'demo', lockfileVersion: 3,
      packages: { '': { dependencies: { alpha: '^1.0.0' } },
        'node_modules/alpha': { version: '1.0.1' } } }) },
    { path: '.nvmrc', content: '20.0.0\n' },
  ],
};
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4179', '--strictPort'],
  { stdio: 'ignore', shell: false, env: { ...process.env, CI: 'true' } });
let browser;
async function ready() {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error('Vite server exited before browser testing.');
    try {
      const r = await fetch(HOST + '/analyze?demo=1', { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch { /* server starting */ }
    await delay(200);
  }
  throw new Error('Vite server startup timeout.');
}
async function shown(locator, timeout = 30000) {
  await locator.waitFor({ state: 'visible', timeout });
}
async function main() {
  await ready();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 },
    acceptDownloads: false });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(HOST + '/analyze?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/report\/[^/?]+/, { timeout: 90000 });
  await shown(page.getByRole('navigation', { name: 'Report sections' }));
  const nav = page.getByRole('navigation', { name: 'Report sections' });
  await nav.getByRole('button', { name: 'Root Causes' }).click();

  const panel = page.getByRole('region', { name: 'Experimental Unified Intelligence' });
  await shown(panel.getByRole('heading', { name: 'Unified Project Intelligence' }));
  await shown(panel.getByText('Root Cause First — investigation clusters'));
  const quality = page.locator('[aria-label="Phase 5.5 intelligence quality evaluation"]');
  await shown(quality.getByText('Intelligence quality & symbolic reasoning'));
  await shown(quality.getByText('Human-evaluated false-positive', { exact: false }));
  await shown(quality.getByText('Symbolic AI status — saved report evidence only'));

  const cluster = panel.getByRole('button', { name: 'Inspect findings' }).first();
  if (await cluster.count()) {
    await cluster.click();
    assert.equal(await panel.getByRole('button', { name: 'Collapse evidence' }).count() > 0, true);
  }
  const reviewToggle = quality.getByRole('button', { name: /Inspect review candidates/ });
  await reviewToggle.click();
  assert.equal(await reviewToggle.getAttribute('aria-expanded'), 'true');
  await quality.getByRole('button', { name: /Inspect structural flags/ }).click();

  const source = panel.locator('[title^="Inspect source references at "]').first();
  if (await source.count()) {
    await source.click();
    await shown(panel.getByText('report finding(s) refer to this source.', { exact: false }));
    await panel.getByRole('button', { name: 'Clear', exact: true }).click();
    await shown(panel.getByText('Select a file reference from the findings above.'));
  }
  await panel.getByRole('button', { name: 'Inspect original issues' }).click();
  await shown(panel.getByText('Original issues:', { exact: false }));

  // After the scan finishes, any proposal preparation is strictly local.
  const outbounds = [];
  page.on('request', request => {
    if (!request.url().startsWith(HOST)) outbounds.push(request.url());
  });
  const upload = panel.locator('input[type="file"]');
  const generate = panel.getByRole('button', { name: 'Generate Fix Proposal', exact: true });
  assert.equal(await generate.isDisabled(), true);
  await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json',
    buffer: Buffer.from('{"files":[{"path":"../private","content":"bad"}]}') });
  await shown(panel.getByText('V1 supports root npm evidence', { exact: false }));
  assert.equal(await generate.isDisabled(), true);

  await upload.setInputFiles({ name: 'source-bundle.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)) });
  await shown(panel.getByText('Local evidence loaded into this view only.', { exact: false }));
  const target = panel.getByPlaceholder('22.0.0');
  await target.fill('22.0.0');
  await generate.click();
  await shown(panel.getByText('Local CLI request prepared · Not verified'));
  const download = panel.getByRole('button', { name: 'Download reviewed local CLI input' });
  assert.equal(await download.isDisabled(), true);
  const approval = panel.getByLabel('I reviewed the exact target', { exact: false });
  await approval.check();
  assert.equal(await download.isEnabled(), true);
  // Changing target invalidates previously approved SHA-bound request.
  await target.fill('24.0.0');
  assert.equal(await panel.getByText('Local CLI request prepared · Not verified').count(), 0);
  assert.equal(await download.count(), 0);
  await panel.getByRole('button', { name: 'Clear local evidence' }).click();
  await shown(panel.getByText('Local evidence cleared.', { exact: false }));
  assert.equal(await generate.isDisabled(), true);
  assert.deepEqual(outbounds, [], 'Proposal preparation must perform no remote requests.');
  assert.deepEqual(pageErrors, [], 'No uncaught browser exceptions are acceptable.');

  // Responsive layout and keyboard-accessible quality controls remain mounted.
  await page.setViewportSize({ width: 390, height: 844 });
  await shown(quality.getByText('Intelligence quality & symbolic reasoning'));
  assert.equal(await reviewToggle.getAttribute('aria-expanded'), 'true');
  console.log(JSON.stringify({ suite: 'phase5.5-browser-e2e', browser: 'chromium',
    routes: 'demo-report', assertions: 'navigation, Root Cause First, quality, review, evidence, proposal, stale-state, privacy, responsive' }));
}
try { await main(); }
finally {
  await browser?.close();
  server.kill('SIGTERM');
}
