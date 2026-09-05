import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const distIndex = resolve('dist/index.html');
const analyzeIndex = resolve('dist/analyze/index.html');

const html = await readFile(distIndex, 'utf8');

const replaceMeta = (source, pattern, replacement) => source.replace(pattern, replacement);

let analyzeHtml = html;
analyzeHtml = replaceMeta(analyzeHtml, /<title>[^<]*<\/title>/i, '<title>Analyze a Project — UCE</title>');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="description" content="[^"]*"\s*\/?\s*>/i, '<meta name="description" content="Analyze Git repositories and project archives with UCE. Detect dependencies, runtimes, frameworks, configuration, and software compatibility risks in a local-first workflow." />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="robots" content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="index, follow" />');
analyzeHtml = replaceMeta(analyzeHtml, /<link rel="canonical" href="[^"]*"\s*\/?\s*>/i, '<link rel="canonical" href="https://uce.ryzova.com/analyze" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:type" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:type" content="website" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:title" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:title" content="Analyze a Project — UCE" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:description" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:description" content="Analyze Git repositories and project archives for dependencies, runtimes, configuration, and compatibility risks." />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:url" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:url" content="https://uce.ryzova.com/analyze" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:image" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:image" content="https://uce.ryzova.com/uce-logo.svg" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta property="og:image:alt" content="[^"]*"\s*\/?\s*>/i, '<meta property="og:image:alt" content="UCE — Universal Compatibility Engine logo" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="twitter:card" content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:card" content="summary" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="twitter:title" content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:title" content="Analyze a Project — UCE" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="twitter:description" content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:description" content="Open-source compatibility analysis for Git repositories and software projects." />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="twitter:image" content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:image" content="https://uce.ryzova.com/uce-logo.svg" />');
analyzeHtml = replaceMeta(analyzeHtml, /<meta name="twitter:image:alt" content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:image:alt" content="UCE — Universal Compatibility Engine logo" />');

const analyzeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Analyze a Project — UCE',
  description: 'Analyze Git repositories and project archives for dependencies, runtimes, frameworks, configuration, and compatibility risks.',
  url: 'https://uce.ryzova.com/analyze',
  isPartOf: { '@type': 'WebSite', name: 'UCE — Universal Compatibility Engine', url: 'https://uce.ryzova.com/' },
  about: { '@type': 'SoftwareApplication', name: 'UCE — Universal Compatibility Engine', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', url: 'https://uce.ryzova.com/' },
};

analyzeHtml = analyzeHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${JSON.stringify(analyzeJsonLd)}</script>`);

const fallback = `
    <noscript>
      <main>
        <h1>Analyze a Project with UCE</h1>
        <p>Universal Compatibility Engine (UCE) is an open-source, local-first tool for analyzing software projects. Use this page to inspect a ZIP project archive or a public Git repository and understand compatibility risks before development, building, or deployment.</p>
        <h2>What UCE analyzes</h2>
        <p>UCE examines project structure, programming languages, frameworks, runtime versions, package managers, dependencies, lockfiles, build tools, configuration files, and other signals that affect whether a software project can be installed, built, tested, or deployed reliably. The analysis is designed to turn technical project details into a practical compatibility report.</p>
        <h2>Git repository analysis</h2>
        <p>Provide a public repository when you want UCE to inspect a remote project. The analyzer can use repository files to identify the technologies and configuration that shape compatibility. This is useful for reviewing an unfamiliar open-source project, checking a repository before contributing, or finding likely setup problems before running a full build.</p>
        <h2>ZIP archive analysis</h2>
        <p>You can also choose a project archive directly from your device. ZIP analysis is performed locally in the browser, making it suitable for projects you do not want to upload to a third-party analysis service. UCE focuses on deterministic engineering checks and reports detected technology, severity, impact, and useful next steps.</p>
        <h2>Why use a compatibility check?</h2>
        <p>Compatibility problems often appear when runtime versions, dependency ranges, lockfiles, build configuration, or environment assumptions do not agree. Finding these signals early can reduce failed installs, confusing build errors, and deployment surprises. UCE provides a compatibility baseline that developers can review before making changes.</p>
        <h2>Open source and local first</h2>
        <p>UCE is released under the Apache License 2.0. The project is intended to be understandable and inspectable by developers and open-source maintainers. Local project archives stay in the browser during analysis, while remote repository analysis occurs only when a repository is explicitly supplied. Use the analyzer to investigate a project and then review the generated findings in the UCE interface.</p>
        <p><a href="/">Return to UCE</a></p>
      </main>
    </noscript>`;

analyzeHtml = analyzeHtml.replace(/\s*<noscript>[\s\S]*?<\/noscript>/i, fallback);

await mkdir(dirname(analyzeIndex), { recursive: true });
await writeFile(analyzeIndex, analyzeHtml, 'utf8');
console.log('Generated route-specific SEO HTML: dist/analyze/index.html');
