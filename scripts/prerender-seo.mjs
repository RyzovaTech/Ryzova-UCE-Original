import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build as viteBuild } from "vite";

const distIndex = resolve("dist/index.html");
const analyzeIndex = resolve("dist/analyze/index.html");
const catalogIndex = resolve("dist/catalog/index.html");
const catalogSummaryFile = resolve("dist/catalog-summary.json");

// Bundle the real catalog as a temporary server-side ES module. This keeps SEO
// synchronized with detector knowledge without evaluating generated code.
const catalogBundleDir = resolve('dist/.catalog-seo');
const catalogBundleFile = resolve(catalogBundleDir, 'catalog.mjs');
await viteBuild({
  configFile: false,
  logLevel: 'silent',
  resolve: { alias: { '@': resolve('src') } },
  build: {
    ssr: resolve('src/lib/catalog.ts'),
    outDir: catalogBundleDir,
    emptyOutDir: true,
    copyPublicDir: false,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'catalog.mjs' } },
  },
});
const { UCE_CATALOG_ITEMS, UCE_CATALOG_COUNTS } = await import(pathToFileURL(catalogBundleFile).href);
await rm(catalogBundleDir, { recursive: true, force: true });

const catalogSummary = {
  schemaVersion: 1,
  product: "Ryzova UCE™",
  catalogUrl: "https://uce.ryzova.com/catalog",
  counts: {
    languages: UCE_CATALOG_COUNTS.languages,
    technologyDetectionDefinitions: UCE_CATALOG_COUNTS.technologies,
    uniqueTechnologyNames: UCE_CATALOG_COUNTS.uniqueTechnologies,
    frameworkDefinitions: UCE_CATALOG_COUNTS.frameworks,
    runtimeDefinitions: UCE_CATALOG_COUNTS.runtimes,
    databaseDefinitions: UCE_CATALOG_COUNTS.databases,
    buildToolDefinitions: UCE_CATALOG_COUNTS.buildTools,
    packageManagerDefinitions: UCE_CATALOG_COUNTS.packageManagers,
    libraryDefinitions: UCE_CATALOG_COUNTS.libraries,
    testingToolDefinitions: UCE_CATALOG_COUNTS.testingTools,
    lintingToolDefinitions: UCE_CATALOG_COUNTS.lintingTools,
    stylingToolDefinitions: UCE_CATALOG_COUNTS.stylingTools,
    authenticationDefinitions: UCE_CATALOG_COUNTS.authenticationTools,
    ormDefinitions: UCE_CATALOG_COUNTS.orms,
    ciCdDefinitions: UCE_CATALOG_COUNTS.ciCdTools,
    cloudPlatformDefinitions: UCE_CATALOG_COUNTS.cloudPlatforms,
    containerDefinitions: UCE_CATALOG_COUNTS.containers,
    architecturePatterns: UCE_CATALOG_COUNTS.architecture,
    browserCompatibilityRules: UCE_CATALOG_COUNTS.browser,
    securityChecks: UCE_CATALOG_COUNTS.security,
    intelligenceCapabilities: UCE_CATALOG_COUNTS.intelligence,
  },
};
await writeFile(catalogSummaryFile, JSON.stringify(catalogSummary, null, 2) + "\n", "utf8");
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const serializeJsonLd = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

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
        <p>UCE is released under the Mozilla Public License 2.0 (MPL 2.0). The project is intended to be understandable and inspectable by developers and open-source maintainers. Local project archives stay in the browser during analysis, while remote repository analysis occurs only when a repository is explicitly supplied. Use the analyzer to investigate a project and then review the generated findings in the UCE interface.</p>
        <p>Ryzova UCE™ — Copyright © 2026 Ryzova — Licensed under MPL 2.0</p>
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
  [/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="Explore 3,000 validated UCE core rules, ${UCE_CATALOG_COUNTS.languages} language labels, and ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique technologies from ${UCE_CATALOG_COUNTS.technologies} detection definitions." />`],
  [/<meta\s+name="robots"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="index, follow" />'],
  [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, '<link rel="canonical" href="https://uce.ryzova.com/catalog" />'],
  [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, '<meta property="og:title" content="Ryzova UCE Detection Catalog" />'],
  [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="Browse 6,500 schema-validated V3 rules, ${UCE_CATALOG_COUNTS.languages} language labels, and ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique technologies with transparent deterministic analysis." />`],
  [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, '<meta property="og:url" content="https://uce.ryzova.com/catalog" />'],
  [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="twitter:title" content="Ryzova UCE Detection Catalog" />'],
  [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:description" content="Explore 6,500 schema-validated V3 rules for languages, technologies, browser compatibility, security, architecture, APIs, cloud and accessibility." />`],
];
for (const [pattern, replacement] of catalogMeta) catalogHtml = replaceMeta(catalogHtml, pattern, replacement);

const catalogJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "UCE Detection Catalog",
  description: `A searchable catalog covering ${UCE_CATALOG_COUNTS.languages} language labels and ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique technology names from ${UCE_CATALOG_COUNTS.technologies} detection definitions, plus ${UCE_CATALOG_COUNTS.browser} browser rules, ${UCE_CATALOG_COUNTS.security} security checks, ${UCE_CATALOG_COUNTS.architecture} architecture patterns, and ${UCE_CATALOG_COUNTS.intelligence} intelligence capabilities.`,
  url: "https://uce.ryzova.com/catalog",
  isPartOf: { "@type": "WebSite", "@id": "https://uce.ryzova.com/#website", name: "Ryzova UCE — Universal Compatibility Engine", url: "https://uce.ryzova.com/" },
  about: { "@id": "https://uce.ryzova.com/#software" },
  mainEntity: { "@type": "DefinedTermSet", name: "Ryzova UCE detection knowledge", description: "Programming languages, software technologies, architecture patterns, browser compatibility features, security checks, and intelligence modules.", numberOfItems: UCE_CATALOG_ITEMS.length },
};
catalogHtml = catalogHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${JSON.stringify(catalogJsonLd)}</script>`);
const catalogFallback = `
    <noscript>
      <main>
        <h1>Ryzova UCE Detection Catalog</h1>
        <p>Explore 6,500 schema-validated V3 rules, ${UCE_CATALOG_COUNTS.languages} programming and source-language labels, and ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique named technologies from ${UCE_CATALOG_COUNTS.technologies} detection definitions, plus browser, security, architecture, API, cloud, and accessibility intelligence.</p>
        <h2>Current UCE knowledge coverage</h2>
        <ul>
          <li>${UCE_CATALOG_COUNTS.languages} programming language labels with primary, secondary, and mixed-language profiling</li>
          <li>${UCE_CATALOG_COUNTS.technologies} technology detection definitions consolidated into ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique named technology profiles</li>\n          <li>${UCE_CATALOG_COUNTS.frameworks} framework definitions including React, Next.js, Vue, Angular, SvelteKit, Express, Django, FastAPI, Spring Boot, Laravel and Flutter</li>\n          <li>${UCE_CATALOG_COUNTS.runtimes} runtime definitions including Node.js, Bun, Deno, Python, JVM, Go, Rust, Ruby, BEAM, Dart, Swift and .NET</li>\n          <li>${UCE_CATALOG_COUNTS.databases} database definitions including PostgreSQL, MySQL, SQLite, MongoDB, Redis, DynamoDB, Elasticsearch, Supabase and Neo4j</li>\n          <li>${UCE_CATALOG_COUNTS.buildTools} build-tool definitions including Vite, Webpack, Rollup, esbuild, Maven, Gradle, Cargo, CMake and Bazel</li>\n          <li>${UCE_CATALOG_COUNTS.packageManagers} package-manager definitions including npm, pnpm, Yarn, Bun, pip, Poetry, Cargo, Maven, Gradle, Composer and NuGet</li>\n          <li>${UCE_CATALOG_COUNTS.libraries} library definitions including React Native, Expo, Redux, Axios, PyTorch, TensorFlow, NumPy and Pandas</li>\n          <li>${UCE_CATALOG_COUNTS.testingTools} testing-tool definitions including Vitest, Jest and Playwright</li>
          <li>${UCE_CATALOG_COUNTS.browser} JavaScript, CSS, HTML, and Web API browser compatibility rules</li>
          <li>${UCE_CATALOG_COUNTS.security} security checks across 13 categories</li>
          <li>${UCE_CATALOG_COUNTS.architecture} evidence-based architecture patterns</li>
          <li>${UCE_CATALOG_COUNTS.intelligence} project intelligence capabilities</li>
        </ul>
        <h2>Language and technology detection</h2>
        <p>UCE uses manifests, dependencies, imports, configuration files, source extensions, content signatures, and repository structure to identify project technologies.</p>
        <p>Coverage spans web, mobile, desktop, backend, API, CLI, library, monorepo, AI and machine learning, data science, blockchain, game, infrastructure, serverless, container, database, testing, and deployment ecosystems.</p>
        <h2>Browse the complete detection indexes</h2>
        <ul>
          <li><a href="/catalog/languages">Programming language detection</a></li>
          <li><a href="/catalog/technologies">Framework, library, runtime, database, and tool detection</a></li>
          <li><a href="/catalog/browser">Browser compatibility rules</a></li>
          <li><a href="/catalog/security">Security static-analysis checks</a></li>
          <li><a href="/catalog/architecture">Architecture pattern detection</a></li>
          <li><a href="/catalog/intelligence">UCE intelligence modules</a></li>
        </ul>
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

const catalogSections = {
  languages: {
    title: `Programming Language Detection (${UCE_CATALOG_COUNTS.languages}) — UCE Catalog`,
    heading: 'Programming Languages Detected by Ryzova UCE',
    description: `Browse ${UCE_CATALOG_COUNTS.languages} language labels including TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#, Kotlin, Swift, PHP, Ruby, HTML, CSS, SQL and more.`,
    intro: 'UCE can identify primary, secondary, and mixed-language projects. A language result depends on evidence found in the scanned repository and does not imply that UCE compiles or executes that language.',
  },
  technologies: {
    title: `Framework and Technology Detection (${UCE_CATALOG_COUNTS.technologies} definitions) — UCE`,
    heading: 'Frameworks, Libraries, Runtimes and Tools Detected by UCE',
    description: `Explore ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique technology names from ${UCE_CATALOG_COUNTS.technologies} UCE detection definitions, including React, Next.js, Node.js, Python, PostgreSQL, Vite, Jest, Docker and more.`,
    intro: `UCE currently contains ${UCE_CATALOG_COUNTS.technologies} registry definitions consolidated into ${UCE_CATALOG_COUNTS.uniqueTechnologies} unique named profiles: ${UCE_CATALOG_COUNTS.frameworks} framework definitions, ${UCE_CATALOG_COUNTS.runtimes} runtime definitions, ${UCE_CATALOG_COUNTS.databases} database definitions, ${UCE_CATALOG_COUNTS.buildTools} build-tool definitions, ${UCE_CATALOG_COUNTS.packageManagers} package-manager definitions, ${UCE_CATALOG_COUNTS.libraries} library definitions, and ${UCE_CATALOG_COUNTS.testingTools} testing-tool definitions, plus linting, styling, authentication, ORM, CI/CD, cloud, and container coverage.`,
  },
  browser: {
    title: `Browser Compatibility Rules (${UCE_CATALOG_COUNTS.browser}) — UCE Catalog`,
    heading: 'Browser Compatibility Features Checked by UCE',
    description: `Review ${UCE_CATALOG_COUNTS.browser} static browser compatibility rules for JavaScript, CSS, HTML, and Web APIs across desktop and mobile browser targets.`,
    intro: 'UCE compares detected feature usage with configured browser targets and suggests fallbacks where available. These are static compatibility checks, not runtime browser tests.',
  },
  security: {
    title: `Security Static Analysis Checks (${UCE_CATALOG_COUNTS.security}) — UCE`,
    heading: 'Security Review Signals Checked by UCE',
    description: `Explore ${UCE_CATALOG_COUNTS.security} deterministic UCE security checks with evidence, severity, confidence, limitations, and remediation guidance.`,
    intro: 'UCE security findings are static review signals. They can include false positives and are not automatic proof of an exploitable vulnerability or a replacement for professional security testing.',
  },
  architecture: {
    title: `Software Architecture Detection (${UCE_CATALOG_COUNTS.architecture} patterns) — UCE`,
    heading: 'Software Architecture Patterns Identified by UCE',
    description: `Browse ${UCE_CATALOG_COUNTS.architecture} evidence-based architecture classifications, including SPA, SSR, SSG, API, monorepo, serverless, microservices, desktop, mobile, and more.`,
    intro: 'Architecture classifications combine repository structure, technology relationships, manifests, and configuration evidence. Results are confidence-based and may require developer review.',
  },
  intelligence: {
    title: `Project Intelligence Modules (${UCE_CATALOG_COUNTS.intelligence}) — UCE`,
    heading: 'Ryzova UCE Project Intelligence Modules',
    description: `Discover ${UCE_CATALOG_COUNTS.intelligence} UCE analysis modules for project identity, code, dependencies, architecture, runtime, builds, testing, accessibility, security, deployment, and compatibility.`,
    intro: 'UCE combines normalized evidence from multiple modules into a compatibility report with confidence, limitations, and recommended next actions.',
  },
};

const catalogNavigation = Object.entries(catalogSections)
  .map(([slug, section]) => `<li><a href="/catalog/${slug}">${escapeHtml(section.heading)}</a></li>`)
  .join('');

for (const [slug, section] of Object.entries(catalogSections)) {
  const items = UCE_CATALOG_ITEMS.filter((item) => item.section === slug);
  const groupedItems = new Map();
  for (const item of items) groupedItems.set(item.category, [...(groupedItems.get(item.category) ?? []), item]);
  const itemMarkup = [...groupedItems.entries()].map(([category, categoryItems]) => `
        <section>
          <h2>${escapeHtml(category)} (${categoryItems.length})</h2>
          <ul>${categoryItems.map((item) => `
            <li id="${escapeHtml(item.id)}">
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.description)}</p>
              <p><strong>Support:</strong> ${escapeHtml(item.status)}. <strong>Evidence:</strong> ${escapeHtml(item.evidence.join('; ') || 'Project evidence required')}.</p>
              ${item.recommendation ? `<p><strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}</p>` : ''}
            </li>`).join('')}
          </ul>
        </section>`).join('');
  const canonicalUrl = `https://uce.ryzova.com/catalog/${slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: section.heading,
    description: section.description,
    url: canonicalUrl,
    isPartOf: { '@type': 'WebSite', '@id': 'https://uce.ryzova.com/#website', name: 'Ryzova UCE — Universal Compatibility Engine', url: 'https://uce.ryzova.com/' },
    about: { '@id': 'https://uce.ryzova.com/#software' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'DefinedTerm',
          name: item.name,
          description: item.description,
          termCode: item.id,
          inDefinedTermSet: 'https://uce.ryzova.com/catalog',
        },
      })),
    },
  };
  let sectionHtml = html;
  const sectionMeta = [
    [/<title>[^<]*<\/title>/i, `<title>${escapeHtml(section.title)}</title>`],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(section.description)}" />`],
    [/<meta\s+name="robots"\s+content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="index, follow" />'],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${canonicalUrl}" />`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHtml(section.title)}" />`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHtml(section.description)}" />`],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${canonicalUrl}" />`],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:title" content="${escapeHtml(section.title)}" />`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:description" content="${escapeHtml(section.description)}" />`],
  ];
  for (const [pattern, replacement] of sectionMeta) sectionHtml = replaceMeta(sectionHtml, pattern, replacement);
  sectionHtml = sectionHtml.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>`,
  );
  sectionHtml = sectionHtml.replace(/\s*<noscript>[\s\S]*?<\/noscript>/i, `
    <noscript>
      <main>
        <nav aria-label="UCE catalog sections"><a href="/catalog">Catalog overview</a><ul>${catalogNavigation}</ul></nav>
        <h1>${escapeHtml(section.heading)}</h1>
        <p>${escapeHtml(section.description)}</p>
        <p>${escapeHtml(section.intro)}</p>
        <p>This index contains ${items.length} unique named catalog entries generated directly from the same versioned UCE knowledge used by the analyzer.</p>
        ${itemMarkup}
        <p><a href="/analyze">Analyze a project with UCE</a></p>
      </main>
    </noscript>`);
  const outputPath = resolve(`dist/catalog/${slug}/index.html`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sectionHtml, 'utf8');
}

console.log(`Generated route-specific SEO HTML for Analyze, Catalog, and ${Object.keys(catalogSections).length} catalog indexes (${UCE_CATALOG_ITEMS.length} unique entries).`);
