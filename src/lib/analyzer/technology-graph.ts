import type { ProjectCapability, TechnologyDetection, TechnologyRelationship } from './types';

interface CapabilityRule { id: string; name: string; matches: (item: TechnologyDetection) => boolean; }
const names = (...values: string[]) => (item: TechnologyDetection) => values.includes(item.name);
const kinds = (...values: TechnologyDetection['kind'][]) => (item: TechnologyDetection) => values.includes(item.kind);

const CAPABILITY_RULES: CapabilityRule[] = [
  { id: 'web-frontend', name: 'Web frontend', matches: names('React', 'Vue', 'Angular', 'Svelte', 'SvelteKit', 'Solid', 'Qwik', 'Preact', 'Lit', 'Stencil') },
  { id: 'backend-api', name: 'Backend or API', matches: names('Express', 'NestJS', 'Fastify', 'Hono', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Laravel', 'Symfony', 'Gin', 'Fiber', 'Echo', 'Chi', 'Axum', 'Actix') },
  { id: 'mobile', name: 'Mobile application', matches: names('React Native', 'Expo', 'Flutter', 'Ionic', 'Capacitor') },
  { id: 'desktop', name: 'Desktop application', matches: names('Electron', 'Tauri', 'Electron Forge', 'Electron Builder') },
  { id: 'server-rendering', name: 'Server rendering', matches: names('Next.js', 'Nuxt', 'SvelteKit', 'Remix') },
  { id: 'static-site', name: 'Static site generation', matches: names('Astro', 'Gatsby', 'Docusaurus', 'VitePress', 'VuePress', 'Eleventy') },
  { id: 'cli', name: 'Command-line application', matches: names('Clap', 'Cobra') },
  { id: 'ai-ml', name: 'AI or machine learning', matches: names('PyTorch', 'TensorFlow', 'Transformers', 'TensorFlow.js', 'Transformers.js', 'ONNX Runtime', 'LangChain', 'LlamaIndex', 'OpenAI SDK', 'Anthropic SDK', 'Vercel AI SDK') },
  { id: 'data-science', name: 'Data science', matches: names('NumPy', 'Pandas', 'SciPy', 'Scikit-learn', 'Polars', 'PyArrow', 'Dask', 'Ray') },
  { id: 'blockchain', name: 'Blockchain', matches: names('Web3', 'Ethers', 'Viem', 'Wagmi', 'Solana Web3', 'Anchor', 'Hardhat', 'Foundry') },
  { id: 'realtime', name: 'Realtime communication', matches: names('Socket.IO', 'ws', 'Yjs', 'Automerge') },
  { id: 'database', name: 'Database integration', matches: kinds('database') },
  { id: 'orm', name: 'Data access layer', matches: kinds('orm') },
  { id: 'testing', name: 'Automated testing', matches: kinds('testing') },
  { id: 'ci-cd', name: 'Continuous integration', matches: kinds('ci-cd') },
  { id: 'cloud-deployment', name: 'Cloud deployment', matches: kinds('cloud') },
  { id: 'containerized', name: 'Containerized application', matches: kinds('container') },
  { id: 'monorepo', name: 'Monorepo tooling', matches: names('Nx', 'Turborepo', 'Lerna', 'Rush') },
  { id: 'authentication', name: 'Authentication', matches: kinds('auth') },
  { id: 'observability', name: 'Observability', matches: names('Sentry', 'OpenTelemetry', 'Pino', 'Winston', 'Tracing', 'Zap', 'Zerolog') },
  { id: 'cms', name: 'Content management', matches: names('Strapi', 'Payload', 'Keystone', 'Directus', 'Sanity', 'Contentful') },
  { id: 'documentation-site', name: 'Documentation site', matches: names('Docusaurus', 'VitePress', 'VuePress', 'Nextra', 'MkDocs', 'Sphinx') },
  { id: 'game', name: 'Game development', matches: names('Phaser', 'Bevy', 'PixiJS', 'Three.js') },
  { id: 'infrastructure', name: 'Infrastructure automation', matches: names('Terraform', 'Pulumi', 'Kubernetes', 'Helm', 'Nomad') },
  { id: 'edge-serverless', name: 'Edge or serverless', matches: names('Cloudflare Workers', 'Deno Deploy', 'Serverless Framework', 'SST', 'AWS SAM') },
];

export const PROJECT_CAPABILITY_COUNT = CAPABILITY_RULES.length;

export function buildTechnologyGraph(detections: TechnologyDetection[]): { capabilities: ProjectCapability[]; relationships: TechnologyRelationship[] } {
  const capabilities: ProjectCapability[] = [];
  for (const rule of CAPABILITY_RULES) {
    const matches = detections.filter(rule.matches);
    if (!matches.length) continue;
    capabilities.push({ id: rule.id, name: rule.name, confidence: Math.max(...matches.map(item => item.confidence)), evidence: matches.slice(0, 6).map(item => item.id) });
  }
  const relationByKind: Partial<Record<TechnologyDetection['kind'], TechnologyRelationship['type']>> = {
    runtime: 'runs-on', 'build-tool': 'builds-with', testing: 'tests-with', database: 'stores-in',
    orm: 'accesses-with', cloud: 'deploys-to', 'ci-cd': 'automated-by', container: 'packages-with',
    auth: 'authenticates-with', styling: 'styles-with', 'package-manager': 'managed-by',
  };
  const relationships = detections.flatMap((item): TechnologyRelationship[] => {
    const type = relationByKind[item.kind];
    if (!type) return [];
    return [{ from: 'project', to: item.id, type, confidence: item.confidence, evidence: item.evidence[0]?.source ?? 'project evidence' }];
  });
  return { capabilities: capabilities.sort((a, b) => b.confidence - a.confidence), relationships };
}
