import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const distIndex = resolve("dist/index.html");
const analyzeIndex = resolve("dist/analyze/index.html");
const catalogIndex = resolve("dist/catalog/index.html");

const html = await readFile(distIndex, "utf8");

const replaceMeta = (source, pattern, replacement) => source.replace(pattern, replacement);

let analyzeHtml = html;
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<title>[^<]*<\/title>/i,
  "<title>Software Compatibility Analyzer — Ryzova UCE</title>",
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="description" content="Analyze Git repositories and project archives with Ryzova UCE. Detect dependencies, runtimes, frameworks, configuration, and software compatibility risks in a local-first workflow." />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="robots"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="robots" content="index, follow" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i,
  '<link rel="canonical" href="https://uce.ryzova.com/analyze" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:type" content="website" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:title" content="Software Compatibility Analyzer — Ryzova UCE" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:description" content="Analyze Git repositories and project archives for dependencies, runtimes, configuration, and compatibility risks." />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:url" content="https://uce.ryzova.com/analyze" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:image" content="https://uce.ryzova.com/uce-logo.svg" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:image:alt" content="Ryzova UCE — Universal Compatibility Engine logo" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="twitter:card" content="summary" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="twitter:title" content="Software Compatibility Analyzer — Ryzova UCE" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="twitter:description" content="Open-source compatibility analysis for Git repositories and software projects." />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="twitter:image" content="https://uce.ryzova.com/uce-logo.svg" />',
);
analyzeHtml = replaceMeta(
  analyzeHtml,
  /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/?\s*>/i,
  '<meta name="twitter:image:alt" content="Ryzova UCE — Universal Compatibility Engine logo" />',
);

const analyzeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Software Compatibility Analyzer — Ryzova UCE",
  description:
    "Analyze Git repositories and project archives for dependencies, runtimes, frameworks, configuration, and compatibility risks.",
  url: "https://uce.ryzova.com/analyze",
  isPartOf: {
    "@type": "WebSite",
    "@id": "https://uce.ryzova.com/#website",
    name: "Ryzova UCE — Universal Compatibility Engine",
    url: "https://uce.ryzova.com/",
  },
  about: { "@id": "https://uce.ryzova.com/#software" },
};

analyzeHtml = analyzeHtml.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
  `<script type="application/ld+json">${JSON.stringify(analyzeJsonLd)}</script>`,
);

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
        <p><a href="https://github.com/RyzovaTech/Ryzova-UCE-Original">View the official Ryzova UCE repository on GitHub</a></p>
        <p><a href="https://www.ryzova.com/">Built by Ryzova™</a></p>
      </main>
    </noscript>`;

analyzeHtml = analyzeHtml.replace(/\s*<noscript>[\s\S]*?<\/noscript>/i, fallback);

await mkdir(dirname(analyzeIndex), { recursive: true });
await writeFile(analyzeIndex, analyzeHtml, "utf8");

let catalogHtml = html;
const catalogMeta = [
  [/<title>[^<]*<\/title>/i, "<title>UCE Detection Catalog — Languages, Technologies and Rules</title>"],
  [/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="description" content="Explore UCE coverage for 77 languages, 639 software technologies, 105 browser compatibility rules, 40 security checks, 22 architecture patterns, and 21 intelligence capabilities." />'],
  [/<meta\s+name="robots"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="index, follow" />'],
  [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, '<link rel="canonical" href="https://uce.ryzova.com/catalog" />'],
  [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, '<meta property="og:title" content="UCE Detection Catalog — Ryzova UCE" />'],
  [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, '<meta property="og:description" content="Browse 77 languages, 639 technologies, 105 browser rules, 40 security checks, and the transparent intelligence knowledge behind Ryzova UCE." />'],
  [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, '<meta property="og:url" content="https://uce.ryzova.com/catalog" />'],
  [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:title" content="UCE Detection Catalog — Ryzova UCE" />'],
  [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:description" content="Explore UCE coverage for 77 languages, 639 technologies, browser compatibility, security, architecture, and project intelligence." />'],
];
for (const [pattern, replacement] of catalogMeta) catalogHtml = replaceMeta(catalogHtml, pattern, replacement);

const catalogJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "UCE Detection Catalog",
  description: "A searchable catalog covering 77 programming language labels, 639 software technologies, 105 browser rules, 40 security checks, 22 architecture patterns, and 21 intelligence capabilities.",
  url: "https://uce.ryzova.com/catalog",
  isPartOf: { "@type": "WebSite", "@id": "https://uce.ryzova.com/#website", name: "Ryzova UCE — Universal Compatibility Engine", url: "https://uce.ryzova.com/" },
  about: { "@id": "https://uce.ryzova.com/#software" },
  mainEntity: { "@type": "DefinedTermSet", name: "Ryzova UCE detection knowledge", description: "Programming languages, software technologies, architecture patterns, browser compatibility features, security checks, and intelligence modules.", numberOfItems: 904 },
};
catalogHtml = catalogHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${JSON.stringify(catalogJsonLd)}</script>`);
const catalogFallback = `
    <noscript>
      <main>
        <h1>Ryzova UCE Detection Catalog</h1>
        <p>Explore UCE coverage for 77 programming language labels, 639 software technology definitions, 105 browser compatibility rules, 40 security checks, 22 architecture patterns, and 21 intelligence capabilities.</p>
        <h2>Current UCE knowledge coverage</h2>
        <ul>
          <li>77 programming language labels with primary, secondary, and mixed-language profiling</li>
          <li>639 frameworks, libraries, runtimes, databases, package managers, build tools, testing tools, cloud platforms, CI/CD systems, and related technologies</li>
          <li>105 JavaScript, CSS, HTML, and Web API browser compatibility rules</li>
          <li>40 security checks across 13 categories</li>
          <li>22 evidence-based architecture patterns</li>
          <li>21 project intelligence capabilities</li>
        </ul>
        <h2>Language and technology detection</h2>
        <p>UCE uses manifests, dependencies, imports, configuration files, source extensions, content signatures, and repository structure to identify project technologies.</p>
        <p>Coverage spans web, mobile, desktop, backend, API, CLI, library, monorepo, AI and machine learning, data science, blockchain, game, infrastructure, serverless, container, database, testing, and deployment ecosystems.</p>
        <h2>Compatibility intelligence</h2>
        <p>The catalog documents code, architecture, dependency, runtime, platform, build, testing, performance, accessibility, API, database, environment, deployment, license, documentation, maintainability, and repository analysis.</p>
        <h2>Browser and security knowledge</h2>
        <p>Browser entries explain target-version compatibility and fallbacks. Security entries explain static review signals, confidence, recommendations, and false-positive limitations. These checks are not proof of runtime behavior or an exploitable vulnerability.</p>
        <p><a href="/analyze">Analyze a project with UCE</a></p>
        <p><a href="/">Return to Ryzova UCE</a></p>
        <p><a href="https://github.com/RyzovaTech/Ryzova-UCE-Original">View the official Ryzova UCE repository</a></p>
      </main>
    </noscript>`;
catalogHtml = catalogHtml.replace(/\s*<noscript>[\s\S]*?<\/noscript>/i, catalogFallback);
await mkdir(dirname(catalogIndex), { recursive: true });
await writeFile(catalogIndex, catalogHtml, "utf8");
console.log("Generated route-specific SEO HTML: dist/analyze/index.html, dist/catalog/index.html");
