import type { ExtendedIntelligence, ExtendedIntelligenceModuleId, IntelligenceModuleFinding, IntelligenceModuleResult, ProjectFile, TechnologyStack } from './types';
import { classifyProjectFileScope } from './project-scope';

const VERSION = '3.5.1';
const sourceRe = /\.(?:[cm]?[jt]sx?|py|java|kt|kts|go|rs|php|rb|ex|exs|dart|swift|scala|cs|cpp|c|h|vue|svelte)$/i;
const text = (files: ProjectFile[], pattern: RegExp): string => files.filter((file) => !file.isDirectory && pattern.test(file.path)).map((file) => file.content ?? '').join('\n');
const paths = (files: ProjectFile[]): string[] => files.filter((file) => !file.isDirectory).map((file) => file.path.replace(/\\/g, '/'));
const lineAt = (source: string, offset: number): number => source.slice(0, offset).split('\n').length;
const result = (id: ExtendedIntelligenceModuleId, label: string, summary: string, evidence: string[], findings: IntelligenceModuleFinding[], metrics: Record<string, number | string | boolean>): IntelligenceModuleResult => {
  const grouped = new Map<string, IntelligenceModuleFinding[]>();
  for (const item of findings) {
    const family = item.id.startsWith('ENV-') ? 'ENV-undocumented' : item.id;
    grouped.set(family, [...(grouped.get(family) ?? []), item]);
  }
  const penalty = [...grouped.values()].reduce((sum, group) => {
    const representative = group[0];
    const weight = representative.severity === 'critical' ? 20 : representative.severity === 'warning' ? 4 : 0.5;
    const repeatMultiplier = 1 + Math.min(group.length - 1, 9) * 0.5;
    return sum + weight * representative.confidence / 100 * repeatMultiplier;
  }, 0);
  const score = Math.max(0, Math.round(100 - penalty));
  return { id, label, score, status: findings.some((item) => item.severity === 'critical') ? 'risk' : findings.some((item) => item.severity === 'warning') ? 'review' : evidence.length ? 'healthy' : 'unknown', summary, evidence: [...new Set(evidence)].slice(0, 12), findings: findings.slice(0, 100), metrics };
};
const finding = (id: string, title: string, severity: IntelligenceModuleFinding['severity'], confidence: number, evidence: string, recommendation: string, file?: string, line?: number): IntelligenceModuleFinding => ({ id, title, severity, confidence, evidence, recommendation, file, line });
const productionFiles = (files: ProjectFile[]) => files.filter((file) => !file.isDirectory && ['production', 'configuration'].includes(classifyProjectFileScope(file.path)));

function projectModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const pkg = text(files, /(^|\/)package\.json$/i); let description = '';
  try { description = (JSON.parse(pkg) as { description?: string }).description ?? ''; } catch { /* optional metadata */ }
  const evidence = [`Architecture: ${stack.architecture?.primary ?? 'Unknown'}`, `Primary language: ${stack.primaryLanguage ?? stack.language}`, ...(description ? [`Purpose metadata: ${description}`] : [])];
  const findings = description || text(files, /(^|\/)README(?:\.[^/]*)?$/i).trim() ? [] : [finding('PRJ001', 'Project purpose is not documented', 'info', 80, 'No package description or README content was found.', 'Add a concise purpose and intended users to the README.')];
  return result('project', 'Project Intelligence', `${stack.architecture?.primary ?? 'Unknown'} project using ${stack.primaryLanguage ?? stack.language}.`, evidence, findings, { files: files.filter((f) => !f.isDirectory).length, technologies: stack.technologyDetections?.length ?? 0 });
}

function runtimeModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const evidence: string[] = (stack.runtimes ?? [stack.runtime]).filter((item) => item !== 'Unknown').map((item) => `Runtime detected: ${item}`); const findings: IntelligenceModuleFinding[] = [];
  const pkg = text(files, /(^|\/)package\.json$/i); const nodeVersion = text(files, /(^|\/)(?:\.nvmrc|\.node-version)$/i).trim(); let engine = '';
  try { const data = JSON.parse(pkg) as { engines?: { node?: string } }; engine = data.engines?.node ?? ''; } catch { /* invalid handled elsewhere */ }
  if ((stack.runtimes ?? []).includes('Node.js') || stack.runtime === 'Node.js') { if (!engine && !nodeVersion) findings.push(finding('RUN001', 'Node.js version is not pinned', 'warning', 90, 'No engines.node, .nvmrc, or .node-version declaration was found.', 'Declare the supported Node.js version range.')); else evidence.push(`Node version declaration: ${engine || nodeVersion}`); }
  const pythonVersion = text(files, /(^|\/)(?:\.python-version|runtime\.txt)$/i).trim(); if ((stack.runtimes ?? []).includes('Python') && !pythonVersion && !/requires-python\s*=/i.test(text(files, /pyproject\.toml$/i))) findings.push(finding('RUN002', 'Python version is not declared', 'warning', 85, 'Python is detected without a version declaration.', 'Set project.requires-python or add .python-version.'));
  return result('runtime', 'Runtime Intelligence', `${evidence.length} runtime/version signals analyzed.`, evidence, findings, { runtimes: (stack.runtimes ?? [stack.runtime]).length, versionDeclarations: Number(Boolean(engine || nodeVersion || pythonVersion)) });
}

function platformModule(files: ProjectFile[]): IntelligenceModuleResult {
  const allPaths = paths(files); const evidence: string[] = []; const findings: IntelligenceModuleFinding[] = [];
  const markers: Array<[string, RegExp]> = [['Windows', /(?:^|\/)(?:[^/]+\.sln|[^/]+\.bat|[^/]+\.cmd|[^/]+\.ps1)$/i], ['Linux', /(?:^|\/)(?:Dockerfile|[^/]+\.sh)$/i], ['macOS/iOS', /(?:^|\/)(?:Podfile|[^/]+\.xcodeproj|Package\.swift)$/i], ['Android', /(?:^|\/)android\//i]];
  for (const [name, pattern] of markers) if (allPaths.some((path) => pattern.test(path))) evidence.push(`${name} project marker detected.`);
  for (const file of productionFiles(files).filter((item) => sourceRe.test(item.path))) { const source = file.content ?? ''; const match = /(?:["'](?:[A-Z]:\\|\/tmp\/)|\b(?:cmd\.exe|powershell\.exe)\b)/i.exec(source); if (match) findings.push(finding('OS001', 'OS-specific path or command', 'warning', 78, 'A platform-specific path or command is embedded in source.', 'Use platform APIs or configurable paths.', file.path, lineAt(source, match.index))); }
  return result('platform', 'OS/Platform Intelligence', `${evidence.length || 'No'} explicit platform markers found.`, evidence, findings, { platforms: evidence.length });
}

function buildModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const evidence: string[] = []; const findings: IntelligenceModuleFinding[] = []; const allPaths = paths(files);
  const tools: Array<[string, RegExp]> = [['Kbuild', /(^|\/)Kbuild$|(^|\/)Kconfig$/i], ['Make', /(^|\/)Makefile$/i], ['Vite', /vite\.config\./i], ['Webpack', /webpack\.config\./i], ['Rollup', /rollup\.config\./i], ['CMake', /CMakeLists\.txt$/i], ['Gradle', /build\.gradle/i], ['Maven', /pom\.xml$/i], ['Cargo', /Cargo\.toml$/i]];
  for (const [name, pattern] of tools) if (allPaths.some((path) => pattern.test(path))) { evidence.push(`${name} configuration detected.`); }
  const frontendTools = evidence.filter((item) => /Vite|Webpack|Rollup/.test(item)); if (frontendTools.length > 1) findings.push(finding('BLD001', 'Multiple frontend build systems detected', 'warning', 72, frontendTools.join(' '), 'Confirm whether configurations are intentional or remove obsolete tooling.'));
  const pkg = text(files, /(^|\/)package\.json$/i); if (pkg && !/"build"\s*:/i.test(pkg)) findings.push(finding('BLD002', 'Build command is not declared', 'info', 75, 'package.json has no build script.', 'Add a reproducible build script if the project produces deployable output.'));
  const primaryEvidence = stack.buildTool !== 'Unknown' ? [`Detected build tool: ${stack.buildTool}`] : [];
  return result('build', 'Build Intelligence', `Primary build tool: ${stack.buildTool}.`, [...primaryEvidence, ...evidence], findings, { tools: evidence.length });
}

function testingModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const all = paths(files); const sourceCount = all.filter((path) => sourceRe.test(path) && classifyProjectFileScope(path) === 'production').length; const testCount = all.filter((path) => classifyProjectFileScope(path) === 'test' && sourceRe.test(path)).length;
  const frameworks = (stack.technologyDetections ?? []).filter((item) => item.kind === 'testing').map((item) => item.name); const coverage = all.some((path) => /(?:coverage|nyc|c8|jacoco|coverlet|pytest\.ini)/i.test(path)) || /--coverage|coverage run|pytest-cov/i.test(text(files, /(^|\/)package\.json$|pyproject\.toml$/i));
  const findings: IntelligenceModuleFinding[] = []; if (sourceCount >= 5 && testCount === 0) findings.push(finding('TST001', 'No test source files detected', 'warning', 88, `${sourceCount} production source files and no test files were found.`, 'Add automated tests for critical behavior.')); if (testCount > 0 && !coverage) findings.push(finding('TST002', 'Coverage readiness not detected', 'info', 70, 'Tests exist but no coverage configuration or command was recognized.', 'Add coverage reporting with an appropriate threshold.'));
  return result('testing', 'Testing Intelligence', `${testCount} test files across ${frameworks.length} detected frameworks.`, frameworks.map((name) => `Testing framework: ${name}`), findings, { sourceFiles: sourceCount, testFiles: testCount, coverageReady: coverage });
}

function performanceModule(files: ProjectFile[]): IntelligenceModuleResult {
  const findings: IntelligenceModuleFinding[] = []; const evidence: string[] = [];
  const relevantFiles = productionFiles(files);
  for (const file of relevantFiles) { const size = file.size ?? new TextEncoder().encode(file.content ?? '').length; if (/\.(?:png|jpe?g|gif|webp|svg|mp4|webm|woff2?|ttf)$/i.test(file.path) && size > 500_000) findings.push(finding('PERF001', 'Large static asset', 'warning', 90, `${file.path} is ${Math.round(size / 1024)} KB.`, 'Compress, resize, subset, or lazy-load this asset.', file.path)); const source = file.content ?? ''; const sync = /\b(?:readFileSync|writeFileSync|execSync|spawnSync)\s*\(/.exec(source); if (sync && sourceRe.test(file.path)) findings.push(finding('PERF002', 'Synchronous blocking operation', 'warning', 82, 'A synchronous filesystem or process API is used.', 'Use an asynchronous API on request or UI paths.', file.path, lineAt(source, sync.index))); }
  const html = text(relevantFiles, /\.html?$/i); if (/<script(?![^>]*(?:async|defer|type=["']module))[\s>]/i.test(html)) findings.push(finding('PERF003', 'Potential render-blocking script', 'info', 72, 'A classic script lacks async or defer.', 'Defer non-critical scripts or use modules.'));
  return result('performance', 'Performance Intelligence', `${findings.length} static performance risks detected.`, evidence, findings, { largeAssets: findings.filter((x) => x.id === 'PERF001').length, blockingPatterns: findings.filter((x) => x.id !== 'PERF001').length });
}

function accessibilityModule(files: ProjectFile[]): IntelligenceModuleResult {
  const findings: IntelligenceModuleFinding[] = []; let scanned = 0;
  for (const file of productionFiles(files).filter((item) => /\.(?:html?|tsx|jsx|vue|svelte)$/i.test(item.path))) { scanned++; const source = file.content ?? ''; const rules: Array<[string, string, RegExp, string]> = [['A11Y001', 'Image missing alt text', /<img\b(?![^>]*\balt\s*=)[^>]*>/gi, 'Add meaningful alt text or alt="" for decorative images.'], ['A11Y002', 'Positive tabindex', /tabIndex\s*=\s*\{?["']?[1-9]\d*/gi, 'Use natural DOM order and tabindex 0 or -1.'], ['A11Y003', 'Click handler on non-interactive element', /<(?:div|span)\b(?=[^>]*\bonClick\s*=)(?![^>]*(?:role=|onKeyDown=|onKeyUp=))[^>]*>/gi, 'Use a button/link or add keyboard semantics and an appropriate role.'], ['A11Y004', 'Anchor opens new tab without safe rel', /<a\b(?=[^>]*target=["']_blank["'])(?![^>]*rel=["'][^"']*(?:noopener|noreferrer))[^>]*>/gi, 'Add rel="noopener noreferrer".']]; for (const [id, title, pattern, recommendation] of rules) for (const match of source.matchAll(pattern)) findings.push(finding(id, title, 'warning', 88, 'A deterministic HTML/JSX accessibility pattern matched.', recommendation, file.path, lineAt(source, match.index))); }
  return result('accessibility', 'Accessibility Intelligence', `${scanned} UI source files checked.`, scanned ? [`Scanned ${scanned} HTML/component files.`] : [], findings, { filesScanned: scanned, issues: findings.length });
}

function apiModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const endpoints = stack.codeIntelligence?.apiEndpoints ?? []; const findings: IntelligenceModuleFinding[] = []; const evidence = endpoints.slice(0, 10).map((item) => `${item.method} ${item.route} (${item.framework ?? 'route'})`); let graphql = 0; let websocket = 0; let grpc = 0;
  for (const file of productionFiles(files)) { const source = file.content ?? ''; graphql += (source.match(/\b(?:type\s+Query|type\s+Mutation|gql\s*`|GraphQLSchema)\b/g) ?? []).length; websocket += (source.match(/\b(?:new\s+WebSocket|WebSocketServer|socket\.on\s*\()/g) ?? []).length; grpc += (source.match(/\bservice\s+\w+\s*\{/g) ?? []).length; }
  if ((graphql || websocket || grpc) && endpoints.length === 0) findings.push(finding('API001', 'Non-REST API detected without route inventory', 'info', 70, `GraphQL ${graphql}, WebSocket ${websocket}, gRPC ${grpc} markers detected.`, 'Document transport endpoints and authentication requirements.'));
  return result('api', 'API Intelligence', `${endpoints.length} REST/file routes plus GraphQL, WebSocket, and gRPC markers.`, evidence, findings, { restEndpoints: endpoints.length, graphqlMarkers: graphql, websocketMarkers: websocket, grpcServices: grpc });
}

function databaseModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const relevantFiles = productionFiles(files); const all = paths(relevantFiles); const source = text(relevantFiles, /(?:schema\.prisma|\.sql$|models?\.[^/]+$|migrations?\/)/i); const models = (source.match(/\b(?:model|CREATE\s+TABLE|class)\s+[A-Za-z_]\w*/gi) ?? []).length; const migrations = all.filter((path) => /(?:^|\/)migrations?\//i.test(path)).length; const technologies = (stack.technologyDetections ?? []).filter((item) => item.kind === 'database' || item.kind === 'orm').map((item) => item.name); const findings: IntelligenceModuleFinding[] = [];
  if (technologies.length && models === 0 && migrations === 0) findings.push(finding('DB001', 'Database detected without schema or migrations', 'info', 68, `${technologies.join(', ')} detected but no schema model or migration files were recognized.`, 'Confirm schema management and document migration commands.'));
  return result('database', 'Database Intelligence', `${technologies.length} database/ORM technologies, ${models} schema models, ${migrations} migration files.`, technologies.map((name) => `Detected: ${name}`), findings, { technologies: technologies.length, schemaModels: models, migrationFiles: migrations });
}

function environmentModule(files: ProjectFile[]): IntelligenceModuleResult {
  const examples = files.filter((file) => /(^|\/)\.env(?:\.[^/]*)?\.example$|(^|\/)\.env\.example$/i.test(file.path)); const declared = new Set(examples.flatMap((file) => (file.content ?? '').split(/\r?\n/).map((line) => /^([A-Z][A-Z0-9_]*)\s*=/.exec(line)?.[1]).filter(Boolean) as string[])); const used = new Map<string, string>();
  for (const file of productionFiles(files).filter((item) => sourceRe.test(item.path))) for (const match of (file.content ?? '').matchAll(/(?:process\.env\.|import\.meta\.env\.|os\.getenv\(\s*["'])([A-Z][A-Z0-9_]*)/g)) used.set(match[1], file.path);
  const missing = [...used].filter(([name]) => !declared.has(name)); const findings = missing.map(([name, file]) => finding(`ENV-${name}`, `Undocumented environment variable ${name}`, 'warning', 88, `${name} is used in source but absent from an example environment file.`, 'Add the variable name with a safe placeholder and description to .env.example.', file));
  return result('environment', 'Environment Intelligence', `${used.size} required variables and ${declared.size} documented variables analyzed.`, [...declared].slice(0, 10).map((name) => `Documented variable: ${name}`), findings, { requiredVariables: used.size, documentedVariables: declared.size, undocumentedVariables: missing.length });
}

function licenseModule(files: ProjectFile[]): IntelligenceModuleResult {
  const allPaths = paths(files); const licenseFile = allPaths.find((path) => /(^|\/)(?:LICENSE|COPYING)(?:\.[^/]*)?$/i.test(path)) ?? allPaths.find((path) => /(^|\/)LICENSES\//i.test(path)); const manifests = files.filter((file) => /(^|\/)package\.json$/i.test(file.path) && classifyProjectFileScope(file.path) !== 'fixture'); const licenses = new Set<string>(); for (const file of manifests) try { const value = (JSON.parse(file.content ?? '{}') as { license?: string }).license; if (value) licenses.add(value); } catch { /* invalid handled elsewhere */ }
  const findings: IntelligenceModuleFinding[] = []; if (!licenseFile && licenses.size === 0) findings.push(finding('LIC001', 'Project license is missing', 'warning', 95, 'No license file or package license metadata was found.', 'Add a license file and matching SPDX identifier.')); if ([...licenses].some((value) => /^(?:UNLICENSED|SEE LICENSE)/i.test(value))) findings.push(finding('LIC002', 'Restricted or custom license metadata', 'info', 90, `License metadata: ${[...licenses].join(', ')}`, 'Document redistribution and contribution terms clearly.'));
  return result('license', 'License Intelligence', licenseFile ? `License file: ${licenseFile}` : `${licenses.size} manifest license identifiers.`, [licenseFile, ...licenses].filter(Boolean) as string[], findings, { licenseFile: Boolean(licenseFile), manifestLicenses: licenses.size });
}

function documentationModule(files: ProjectFile[]): IntelligenceModuleResult {
  const readmeFile = files.filter((file) => /(^|\/)README(?:\.[^/]*)?$/i.test(file.path) && classifyProjectFileScope(file.path) === 'documentation').sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.length - b.path.length)[0]; const readme = readmeFile?.content ?? ''; const sections = { installation: /#{1,6}\s*(?:install|getting started|setup)/i.test(readme), usage: /#{1,6}\s*(?:usage|examples?|quick start)/i.test(readme), configuration: /#{1,6}\s*(?:configuration|environment|config)/i.test(readme), license: /#{1,6}\s*license/i.test(readme) }; const findings: IntelligenceModuleFinding[] = [];
  if (!readme.trim()) findings.push(finding('DOC001', 'README is missing or empty', 'warning', 98, 'No usable README content was found.', 'Add project purpose, setup, usage, configuration, and license information.')); else for (const [name, present] of Object.entries(sections)) if (!present) findings.push(finding(`DOC-${name}`, `README ${name} guidance not detected`, 'info', 72, `No ${name} heading was recognized.`, `Document ${name} in the README.`, readmeFile?.path));
  const all = paths(files); return result('documentation', 'Documentation Intelligence', `${Object.values(sections).filter(Boolean).length}/4 core README sections detected.`, all.filter((path) => /(?:README|CONTRIBUTING|CHANGELOG|SECURITY|openapi|swagger)/i.test(path)).slice(0, 12), findings, { readme: Boolean(readme.trim()), sections: Object.values(sections).filter(Boolean).length, contributing: all.some((p) => /CONTRIBUTING/i.test(p)), apiDocs: all.some((p) => /(?:openapi|swagger)/i.test(p)) });
}

function maintainabilityModule(files: ProjectFile[], stack: TechnologyStack): IntelligenceModuleResult {
  const findings: IntelligenceModuleFinding[] = []; const blocks = new Map<string, Set<string>>(); let complexFiles = 0;
  for (const file of productionFiles(files).filter((item) => sourceRe.test(item.path))) { const source = file.content ?? ''; const branches = (source.match(/\b(?:if|else if|for|while|case|catch)\b|&&|\|\|/g) ?? []).length; if (branches >= 40) { complexFiles++; findings.push(finding('MAIN001', 'High branching density', 'warning', 72, `${file.path} contains ${branches} branch operators.`, 'Split responsibilities and reduce deeply nested decision logic.', file.path)); } const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 12 && !line.startsWith('//')); for (let i = 0; i <= lines.length - 6; i++) { const key = lines.slice(i, i + 6).join('\n'); (blocks.get(key) ?? blocks.set(key, new Set()).get(key)!).add(file.path); } }
  const duplicated = [...blocks.values()].filter((set) => set.size > 1).slice(0, 20); if (duplicated.length) findings.push(finding('MAIN002', 'Repeated code blocks detected', 'info', 70, `${duplicated.length} six-line blocks occur in multiple source files.`, 'Review repeated blocks and extract shared behavior where appropriate.'));
  const quality = stack.codeIntelligence?.quality; return result('maintainability', 'Maintainability Intelligence', `${quality?.largeFiles.length ?? 0} large files, ${quality?.largeFunctions.length ?? 0} large functions, ${duplicated.length} repeated blocks.`, (quality?.circularDependencies ?? []).slice(0, 5).map((cycle) => cycle.join(' → ')), findings, { largeFiles: quality?.largeFiles.length ?? 0, largeFunctions: quality?.largeFunctions.length ?? 0, circularDependencies: quality?.circularDependencies.length ?? 0, duplicatedBlocks: duplicated.length, complexFiles });
}

function repositoryModule(files: ProjectFile[]): IntelligenceModuleResult {
  const all = paths(files); const checks = { gitignore: all.some((p) => /(^|\/)\.gitignore$/i.test(p)), workflows: all.some((p) => /(^|\/)\.github\/workflows\//i.test(p)), contributing: all.some((p) => /CONTRIBUTING/i.test(p)), codeowners: all.some((p) => /CODEOWNERS$/i.test(p)), issueTemplates: all.some((p) => /\.github\/ISSUE_TEMPLATE/i.test(p)), securityPolicy: all.some((p) => /(^|\/)(?:SECURITY(?:\.[^/]*)?|security-bugs\.(?:md|rst|txt))$/i.test(p)) }; const findings: IntelligenceModuleFinding[] = [];
  if (!checks.gitignore) findings.push(finding('GIT001', '.gitignore is missing', 'warning', 92, 'No .gitignore file was found.', 'Add ignore rules for dependencies, build output, local environment files, and secrets.')); if (!checks.workflows) findings.push(finding('GIT002', 'CI workflow not detected', 'info', 75, 'No GitHub Actions workflow was found in the uploaded tree.', 'Add automated test/build checks or document the external CI system.'));
  return result('repository', 'Git/Repository Intelligence', `${Object.values(checks).filter(Boolean).length}/6 repository health markers detected.`, Object.entries(checks).filter(([, present]) => present).map(([name]) => `${name} detected`), findings, checks);
}

export function detectExtendedIntelligence(files: ProjectFile[], stack: TechnologyStack): ExtendedIntelligence {
  const modules = [projectModule(files, stack), runtimeModule(files, stack), platformModule(files), buildModule(files, stack), testingModule(files, stack), performanceModule(files), accessibilityModule(files), apiModule(files, stack), databaseModule(files, stack), environmentModule(files), licenseModule(files), documentationModule(files), maintainabilityModule(files, stack), repositoryModule(files)];
  const record = Object.fromEntries(modules.map((module) => [module.id, module])) as Record<ExtendedIntelligenceModuleId, IntelligenceModuleResult>; const scored = modules.filter((module) => module.status !== 'unknown');
  return { version: VERSION, modules: record, overallScore: scored.length ? Math.round(scored.reduce((sum, module) => sum + module.score, 0) / scored.length) : 0, filesAnalyzed: files.filter((file) => !file.isDirectory).length, generatedFindings: modules.reduce((sum, module) => sum + module.findings.length, 0) };
}
