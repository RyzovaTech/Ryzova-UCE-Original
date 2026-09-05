export type Severity = 'critical' | 'warning' | 'info';
export type CategoryId = 'runtime' | 'dependencies' | 'configuration' | 'structure' | 'environment' | 'security' | 'deployment' | 'performance';
export type CategoryStatus = 'good' | 'warning' | 'unknown';
export type ProjectType = 'Software Project' | 'Game Project' | 'Media Archive' | 'Document Archive' | 'Unknown Archive';
export interface ProjectClassification { type: ProjectType; isSoftware: boolean; reason: string; }
export type Language = 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'Kotlin' | 'Go' | 'Rust' | 'PHP' | 'Ruby' | 'Elixir' | 'Dart' | 'C' | 'C++' | 'Swift' | 'Scala' | 'C#' | 'Zig' | 'OCaml' | 'Haskell' | 'Lua' | 'Julia' | 'R' | 'Crystal' | 'Nim' | 'Solidity' | 'V' | 'Perl' | 'Erlang' | 'Unknown';
export type Runtime = 'Node.js' | 'Bun' | 'Deno' | 'Python' | 'JVM' | 'Go' | 'Rust' | 'Ruby' | 'BEAM' | 'Dart' | 'Swift' | '.NET' | 'Unknown';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'pdm' | 'pipenv' | 'uv' | 'hatch' | 'cargo' | 'maven' | 'gradle' | 'composer' | 'go-modules' | 'bundler' | 'mix' | 'pub' | 'swift-package' | 'sbt' | 'nuget' | 'Unknown';
export type BuildTool = 'Vite' | 'Next.js' | 'Nuxt' | 'Astro' | 'Remix' | 'Gatsby' | 'Angular CLI' | 'Create React App' | 'Webpack' | 'esbuild' | 'Rollup' | 'Turbo' | 'Cargo' | 'Maven' | 'Gradle' | 'pip' | 'poetry' | 'hatch' | 'CMake' | 'Make' | 'Swift Package Manager' | 'Mix' | 'Pub' | 'turbopack' | 'Unknown';
export type Framework = 'Next.js' | 'Nuxt' | 'Astro' | 'Remix' | 'Gatsby' | 'React' | 'Vue' | 'Angular' | 'Svelte' | 'SvelteKit' | 'Solid' | 'Qwik' | 'Preact' | 'Alpine.js' | 'Lit' | 'Stencil' | 'Express' | 'NestJS' | 'Fastify' | 'Hono' | 'Fiber' | 'Echo' | 'Chi' | 'Django' | 'Flask' | 'FastAPI' | 'Spring Boot' | 'Quarkus' | 'Ktor' | 'Micronaut' | 'Actix' | 'Axum' | 'Rocket' | 'Rails' | 'Sinatra' | 'Phoenix' | 'Vapor' | 'Revel' | 'Play Framework' | 'Laravel' | 'Symfony' | 'Flutter' | 'Gin' | 'Unknown';
export type Database = 'PostgreSQL' | 'MySQL' | 'MariaDB' | 'SQLite' | 'MongoDB' | 'Redis' | 'Cassandra' | 'DynamoDB' | 'Elasticsearch' | 'OpenSearch' | 'Firebase' | 'Supabase' | 'CockroachDB' | 'Neo4j' | 'Detected' | 'Unknown';
export interface ProjectFile { path: string; size: number; isDirectory: boolean; content?: string; }
export interface DetectedFile { path: string; size: number; kind: string; purpose: string; }
export interface DetectionConfidence { language: number; framework: number; runtime: number; packageManager: number; buildTool: number; }
export interface LanguageProfile { language: Language; bytes: number; files: number; percentage: number; }
export type TechnologyKind = 'framework' | 'runtime' | 'database' | 'build-tool' | 'package-manager' | 'library' | 'testing' | 'linting' | 'styling' | 'auth' | 'api' | 'orm' | 'ci-cd' | 'container' | 'cloud' | 'configuration';
export interface TechnologyEvidence { name: string; kind: TechnologyKind; confidence: number; evidence: string[]; version?: string; }
export interface DependencyItem { name: string; version: string; type: 'runtime' | 'development' | 'peer' | 'optional'; }
export interface DependencyIntelligence { manager: PackageManager; total: number; runtime: number; development: number; peer: number; optional: number; dependencies: DependencyItem[]; duplicateNames: string[]; versionConflicts: string[]; healthScore: number; }
export type ArchitectureType = 'SPA' | 'SSR' | 'SSG' | 'API Server' | 'Frontend + Backend' | 'Library' | 'Monorepo' | 'CLI' | 'Mobile App' | 'Desktop App' | 'Unknown';
export interface ArchitectureIntelligence { primary: ArchitectureType; patterns: ArchitectureType[]; confidence: number; evidence: string[]; }
export interface CodeSymbol { name: string; kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'component' | 'export'; file: string; line: number; exported: boolean; }
export interface DependencyEdge { from: string; to: string; kind: 'import' | 'require' | 'dynamic-import'; }
export interface ApiEndpoint { method: string; route: string; file: string; line: number; framework?: string; }
export interface CodeQualitySignals { largeFiles: Array<{ file: string; lines: number }>; largeFunctions: Array<{ file: string; name: string; line: number }>; todoCount: number; fixmeCount: number; circularDependencies: string[][]; }
export interface CodeIntelligence { filesAnalyzed: number; symbols: CodeSymbol[]; dependencyEdges: DependencyEdge[]; apiEndpoints: ApiEndpoint[]; entryPoints: string[]; architectureAreas: Record<string, string[]>; quality: CodeQualitySignals; }
export interface SecurityFinding { id: string; title: string; severity: Severity; file: string; line: number; evidence: string; recommendation: string; }
export interface SecurityIntelligence { findings: SecurityFinding[]; score: number; filesScanned: number; rulesExecuted: number; }
export interface BrowserTarget { browser: 'Chrome' | 'Firefox' | 'Safari' | 'Edge'; version: number; }
export interface BrowserCompatibilityFinding { feature: string; kind: 'javascript' | 'css' | 'web-api'; file: string; line: number; status: 'supported' | 'partial' | 'unsupported' | 'unknown'; affectedBrowsers: BrowserTarget['browser'][]; recommendation: string; }
export interface BrowserCompatibilityIntelligence { targets: BrowserTarget[]; findings: BrowserCompatibilityFinding[]; score: number; filesScanned: number; featuresChecked: number; }
export interface TechnologyStack {
  language: Language; languages?: LanguageProfile[]; mixedLanguage?: boolean; primaryLanguage?: Language; secondaryLanguages?: LanguageProfile[];
  frameworks?: Framework[]; runtimes?: Runtime[]; technologyEvidence?: TechnologyEvidence[]; dependencyIntelligence?: DependencyIntelligence; architecture?: ArchitectureIntelligence; codeIntelligence?: CodeIntelligence; securityIntelligence?: SecurityIntelligence; browserCompatibility?: BrowserCompatibilityIntelligence;
  framework: Framework; runtime: Runtime; packageManager: PackageManager; buildTool: BuildTool; frontend: Framework | 'None' | 'Unknown'; backend: Framework | 'None' | 'Unknown'; database: Database; configFiles: string[]; monorepo?: MonorepoTool | 'None'; cloudProvider?: CloudProvider | 'None'; confidence?: DetectionConfidence;
}
export type MonorepoTool = 'Nx' | 'Turborepo' | 'Lerna' | 'Rush' | 'pnpm Workspaces' | 'Yarn Workspaces' | 'None';
export type CloudProvider = 'Vercel' | 'Netlify' | 'Railway' | 'Fly.io' | 'Render' | 'Cloudflare' | 'None';
export interface ScanStats { projectSize: number; filesFound: number; filesAnalyzed: number; filesIgnored: number; ignoredCategories: string[]; zipSize?: number; scanTimeMs?: number; memoryUsedMB?: number; rulesExecuted?: number; }
export interface ProjectSummary { name: string; framework: Framework; language: Language; runtime: Runtime; packageManager: PackageManager; detectedConfigFiles: string[]; filesScanned: number; foldersScanned: number; scanStats: ScanStats; }
export interface Issue { id: string; title: string; category: CategoryId; severity: Severity; description: string; reason: string; recommendation: string; affectedFile: string; detected?: string; expected?: string; impact?: string; suggestedAction?: string; }
export interface CategoryResult { id: CategoryId; label: string; status: CategoryStatus; score: number; issues: Issue[]; summary: string; }
export interface CompatibilityScore { runtime: number; dependencies: number; configuration: number; structure: number; environment: number; security: number; deployment: number; performance: number; overall: number; }
export type AnalysisStage = 'idle' | 'uploading' | 'reading' | 'detecting' | 'analyzing' | 'scoring' | 'reporting' | 'completed' | 'error';
export interface TimelineStep { step: number; label: string; description: string; status: 'done' | 'active' | 'pending'; }
export interface AnalysisResult { id: string; createdAt: string; analysisVersion: string; classification: ProjectClassification; summary: ProjectSummary; stack: TechnologyStack; detectedFiles: DetectedFile[]; categories: CategoryResult[]; issues: Issue[]; score: CompatibilityScore; timeline: TimelineStep[]; notes: string[]; source: 'upload' | 'demo' | 'github'; }
export interface AnalysisInput { fileName: string; files: ProjectFile[]; source: 'upload' | 'demo' | 'github'; scanStats: ScanStats; }
