export type Severity = 'critical' | 'warning' | 'info';

export type CategoryId =
  | 'runtime'
  | 'dependencies'
  | 'configuration'
  | 'structure'
  | 'environment'
  | 'security'
  | 'deployment'
  | 'performance';

export type CategoryStatus = 'good' | 'warning' | 'unknown';

export type ProjectType =
  | 'Software Project'
  | 'Game Project'
  | 'Media Archive'
  | 'Document Archive'
  | 'Unknown Archive';

export interface ProjectClassification {
  type: ProjectType;
  isSoftware: boolean;
  reason: string;
}

export type Language =
  | 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'Kotlin' | 'Go' | 'Rust'
  | 'PHP' | 'Ruby' | 'Elixir' | 'Dart' | 'C' | 'C++' | 'Swift' | 'Scala' | 'C#'
  | 'Zig' | 'OCaml' | 'Haskell' | 'Lua' | 'Julia' | 'R' | 'Crystal' | 'Nim'
  | 'Solidity' | 'V' | 'Perl' | 'Erlang' | 'Unknown';

export type Runtime =
  | 'Node.js' | 'Bun' | 'Deno' | 'Python' | 'JVM' | 'Go' | 'Rust' | 'Ruby'
  | 'BEAM' | 'Dart' | 'Swift' | '.NET' | 'Unknown';

export type PackageManager =
  | 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'pdm' | 'pipenv'
  | 'uv' | 'hatch' | 'cargo' | 'maven' | 'gradle' | 'composer' | 'go-modules'
  | 'bundler' | 'mix' | 'pub' | 'swift-package' | 'sbt' | 'nuget' | 'Unknown';

export type BuildTool =
  | 'Vite' | 'Next.js' | 'Nuxt' | 'Astro' | 'Remix' | 'Gatsby' | 'Angular CLI'
  | 'Create React App' | 'Webpack' | 'esbuild' | 'Rollup' | 'Turbo' | 'Cargo'
  | 'Maven' | 'Gradle' | 'pip' | 'poetry' | 'hatch' | 'CMake' | 'Make'
  | 'Swift Package Manager' | 'Mix' | 'Pub' | 'turbopack' | 'Unknown';

export type Framework =
  | 'Next.js' | 'Nuxt' | 'Astro' | 'Remix' | 'Gatsby' | 'React' | 'Vue' | 'Angular'
  | 'Svelte' | 'SvelteKit' | 'Solid' | 'Qwik' | 'Preact' | 'Alpine.js' | 'Lit'
  | 'Stencil' | 'Express' | 'NestJS' | 'Fastify' | 'Hono' | 'Fiber' | 'Echo' | 'Chi'
  | 'Django' | 'Flask' | 'FastAPI' | 'Spring Boot' | 'Quarkus' | 'Ktor' | 'Micronaut'
  | 'Actix' | 'Axum' | 'Rocket' | 'Rails' | 'Sinatra' | 'Phoenix' | 'Vapor' | 'Revel'
  | 'Play Framework' | 'Laravel' | 'Symfony' | 'Flutter' | 'Gin' | 'Unknown';

export type Database =
  | 'PostgreSQL' | 'MySQL' | 'MariaDB' | 'SQLite' | 'MongoDB' | 'Redis' | 'Cassandra'
  | 'DynamoDB' | 'Elasticsearch' | 'OpenSearch' | 'Firebase' | 'Supabase'
  | 'CockroachDB' | 'Neo4j' | 'Detected' | 'Unknown';

export interface ProjectFile {
  path: string;
  size: number;
  isDirectory: boolean;
  content?: string;
}

export interface DetectedFile {
  path: string;
  size: number;
  kind: string;
  purpose: string;
}

export interface DetectionConfidence {
  language: number;
  framework: number;
  runtime: number;
  packageManager: number;
  buildTool: number;
}

export interface TechnologyStack {
  language: Language;
  framework: Framework;
  runtime: Runtime;
  packageManager: PackageManager;
  buildTool: BuildTool;
  frontend: Framework | 'None' | 'Unknown';
  backend: Framework | 'None' | 'Unknown';
  database: Database;
  configFiles: string[];
  monorepo?: MonorepoTool | 'None';
  cloudProvider?: CloudProvider | 'None';
  confidence?: DetectionConfidence;
}

export type MonorepoTool =
  | 'Nx' | 'Turborepo' | 'Lerna' | 'Rush' | 'pnpm Workspaces' | 'Yarn Workspaces' | 'None';

export type CloudProvider =
  | 'Vercel' | 'Netlify' | 'Railway' | 'Fly.io' | 'Render' | 'Cloudflare' | 'None';

export interface ScanStats {
  projectSize: number;
  filesFound: number;
  filesAnalyzed: number;
  filesIgnored: number;
  ignoredCategories: string[];
  zipSize?: number;
  scanTimeMs?: number;
  memoryUsedMB?: number;
  rulesExecuted?: number;
}

export interface ProjectSummary {
  name: string;
  framework: Framework;
  language: Language;
  runtime: Runtime;
  packageManager: PackageManager;
  detectedConfigFiles: string[];
  filesScanned: number;
  foldersScanned: number;
  scanStats: ScanStats;
}

export interface Issue {
  id: string;
  title: string;
  category: CategoryId;
  severity: Severity;
  description: string;
  reason: string;
  recommendation: string;
  affectedFile: string;
  detected?: string;
  expected?: string;
  impact?: string;
  suggestedAction?: string;
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  status: CategoryStatus;
  score: number;
  issues: Issue[];
  summary: string;
}

export interface CompatibilityScore {
  runtime: number;
  dependencies: number;
  configuration: number;
  structure: number;
  environment: number;
  security: number;
  deployment: number;
  performance: number;
  overall: number;
}

export type AnalysisStage =
  | 'idle' | 'uploading' | 'reading' | 'detecting' | 'analyzing' | 'scoring'
  | 'reporting' | 'completed' | 'error';

export interface TimelineStep {
  step: number;
  label: string;
  description: string;
  status: 'done' | 'active' | 'pending';
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  analysisVersion: string;
  classification: ProjectClassification;
  summary: ProjectSummary;
  stack: TechnologyStack;
  detectedFiles: DetectedFile[];
  categories: CategoryResult[];
  issues: Issue[];
  score: CompatibilityScore;
  timeline: TimelineStep[];
  notes: string[];
  source: 'upload' | 'demo' | 'github';
}

export interface AnalysisInput {
  fileName: string;
  files: ProjectFile[];
  source: 'upload' | 'demo' | 'github';
  scanStats: ScanStats;
}
