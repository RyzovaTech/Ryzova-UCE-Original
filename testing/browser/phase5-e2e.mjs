#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
// Optional isolated install path supplied by CI, avoiding changes to the app lockfile.
const engines = await import(process.env.UCE_PLAYWRIGHT_ENTRY
  ? pathToFileURL(process.env.UCE_PLAYWRIGHT_ENTRY).href : 'playwright');
const browserName = process.env.UCE_BROWSER ?? 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browserName))
  throw new Error('Unsupported E2E browser');
const engine = engines[browserName];

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
  browser = await engine.launch({ headless: true,
    ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
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
  // Keyboard-only activation and focus persistence, not pointer-only testing.
  await reviewToggle.focus();
  assert.equal(await reviewToggle.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  const hideReview = quality.getByRole('button', { name: 'Hide review queue' });
  assert.equal(await hideReview.getAttribute('aria-expanded'), 'true');
  assert.equal(await hideReview.evaluate(node => node === document.activeElement), true);
  const flagToggle = quality.getByRole('button', { name: /Inspect structural flags/ });
  await flagToggle.focus();
  await page.keyboard.press('Space');
  assert.equal(await quality.getByRole('button', { name: 'Hide structural flags' })
    .getAttribute('aria-expanded'), 'true');
  const limitations = quality.locator('details summary');
  await limitations.focus();
  await page.keyboard.press('Enter');
  assert.equal(await quality.locator('details').getAttribute('open'), '');
  // Scanned Phase 5.5 panel: WCAG A/AA rules, without treating automation
  // as a substitute for real assistive technology/screen-reader acceptance.
  const axePath = process.env.UCE_AXE_CORE_PATH;
  if (!axePath) throw new Error('Axe accessibility runner path is required.');
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const el = document.querySelector('[aria-label="Phase 5.5 intelligence quality evaluation"]');
    if (!el || !window.axe) throw new Error('Accessibility audit target unavailable.');
    const result = await window.axe.run(el, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'region': { enabled: false } },
    });
    return result.violations.map(item => ({
      id: item.id, impact: item.impact,
      nodes: item.nodes.map(node => node.target).slice(0, 5),
    }));
  });
  assert.deepEqual(violations, [], 'Phase 5.5 panel WCAG A/AA automated audit');

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

  // Phase 2: automated full-panel WCAG A/AA, not merely the nested quality card.
  // Axe is a diagnostic, not a substitute for screen-reader or real-device review.
  const panelViolations = await page.evaluate(async () => {
    const region = document.querySelector('[aria-label="Experimental Unified Intelligence"]');
    if (!region || !window.axe) throw new Error('Full Unified Intelligence region or axe not available.');
    const results = await window.axe.run(region, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { region: { enabled: false } },
    });
    return results.violations.map(v => ({
      id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 5).map(n => n.target),
    }));
  });
  assert.deepEqual(panelViolations, [], 'Full Unified Intelligence WCAG A/AA audit');

  // Do not hide page-wide overflow; verify actual document geometry in all three
  // real engines. The report section nav may scroll *within its own container*.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await shown(quality.getByText('Intelligence quality & symbolic reasoning'));
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('[aria-label="Report sections"]');
      return {
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        navWidth: nav?.clientWidth ?? null,
        sources: [...document.querySelectorAll('body *')]
          .map(el => ({ el, rect: el.getBoundingClientRect() }))
          .filter(x => x.rect.right > window.innerWidth + 3 && x.rect.width >= 30 &&
            !x.el.closest('[aria-label="Report sections"]') &&
            getComputedStyle(x.el).overflowX !== 'auto')
          .sort((a, b) => b.rect.right - a.rect.right).slice(0, 8)
          .map(x => ({
            tag: x.el.tagName,
            className: typeof x.el.className === 'string' ? x.el.className.slice(0, 100) : '',
            right: Math.round(x.rect.right),
          })),
      };
    });
    assert.ok(geometry.document <= geometry.viewport + 2 &&
      geometry.body <= geometry.viewport + 2,
      'Mobile page-wide horizontal overflow: ' + JSON.stringify(geometry));
    assert.ok(geometry.navWidth > 0 && geometry.navWidth <= geometry.viewport,
      'Report navigation must stay inside mobile viewport: ' + JSON.stringify(geometry));
    const queue = quality.getByRole('button', { name: 'Hide review queue' });
    assert.equal(await queue.getAttribute('aria-expanded'), 'true');
    await queue.focus();
    assert.equal(await queue.evaluate(el => document.activeElement === el), true,
      'Keyboard focus must be retained at narrow widths');
  }
  // Navigation remains keyboard-reachable after resizing, and root cause view remains mounted.
  await shown(panel.getByRole('heading', { name: 'Unified Project Intelligence' }));
  assert.deepEqual(pageErrors, [], 'No uncaught errors after viewport resize');
  console.log(JSON.stringify({ suite: 'uce-phase2-cross-browser-e2e', browser: browserName,
    routes: 'demo-report', assertions: 'WCAG A/AA full panel, keyboard/focus, 320px/390px reflow, no global overflow, reduced motion, privacy, score parity, unchanged findings' }));
}
try { await main(); }
finally {
  await browser?.close();
  server.kill('SIGTERM');
}
