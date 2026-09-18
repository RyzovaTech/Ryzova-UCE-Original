import type { ProjectFile } from '../../../src/lib/analyzer/types';

export type FixtureKind = 'positive' | 'negative' | 'mixed-stack' | 'monorepo' | 'vendor-heavy' | 'vulnerable' | 'browser' | 'cross-platform';
export interface AccuracyFixture { id: string; kind: FixtureKind; files: ProjectFile[]; expected: { software: boolean; minimumDetections?: number; securityFinding?: boolean; browserFinding?: boolean }; }

const file = (path: string, content = ''): ProjectFile => ({ path, content, size: content.length, isDirectory: false });
const scenarios: Array<{ name: string; files: ProjectFile[]; expected: AccuracyFixture['expected'] }> = [
  { name: 'react-vite', files: [file('package.json', '{"dependencies":{"react":"18","vite":"5"}}'), file('src/App.tsx', 'export function App(){return <main>Hello</main>}')], expected: { software: true, minimumDetections: 2 } },
  { name: 'python-fastapi', files: [file('requirements.txt', 'fastapi>=0.110\nuvicorn>=0.29'), file('app/main.py', 'from fastapi import FastAPI\napp=FastAPI()')], expected: { software: true, minimumDetections: 1 } },
  { name: 'go-service', files: [file('go.mod', 'module example.com/service\nrequire github.com/gin-gonic/gin v1.10.0'), file('cmd/server/main.go', 'package main\nfunc main(){}')], expected: { software: true, minimumDetections: 1 } },
  { name: 'rust-cli', files: [file('Cargo.toml', '[package]\nname="tool"\n[dependencies]\nclap="4"'), file('src/main.rs', 'fn main() {}')], expected: { software: true, minimumDetections: 1 } },
  { name: 'mixed-web-api', files: [file('apps/web/package.json', '{"dependencies":{"vue":"3"}}'), file('apps/api/requirements.txt', 'django>=5'), file('apps/api/manage.py', 'print("api")')], expected: { software: true, minimumDetections: 2 } },
  { name: 'monorepo', files: [file('package.json', '{"workspaces":["apps/*"]}'), file('pnpm-workspace.yaml', 'packages:\n - apps/*'), file('apps/site/package.json', '{"dependencies":{"next":"15"}}')], expected: { software: true, minimumDetections: 2 } },
  { name: 'vendor-heavy', files: [file('src/index.ts', 'export const ready=true'), file('vendor/library.js', 'navigator.gpu;'.repeat(100)), file('generated/client.ts', 'eval(input);'.repeat(100))], expected: { software: true, minimumDetections: 0 } },
  { name: 'vulnerable', files: [file('src/server.ts', 'const password="production-secret-value"; eval(payload);')], expected: { software: true, securityFinding: true } },
  { name: 'browser-target', files: [file('.browserslistrc', 'safari 14\nchrome 90'), file('src/app.ts', 'navigator.gpu; const copy=structuredClone(value);')], expected: { software: true, browserFinding: true } },
  { name: 'cross-platform', files: [file('src/path.ts', 'const location="C:\\\\temp";'), file('Dockerfile', 'FROM node:20-alpine'), file('.github/workflows/ci.yml', 'jobs:\n build:\n  runs-on: ubuntu-latest')], expected: { software: true, minimumDetections: 2 } },
  { name: 'negative-docs', files: [file('README.md', '# Product documentation\nReact Django eval navigator.gpu are mentioned only as prose.')], expected: { software: false, minimumDetections: 0 } },
  { name: 'negative-media', files: [file('assets/photo.png', ''), file('assets/movie.mp4', '')], expected: { software: false, minimumDetections: 0 } },
];

const kinds: FixtureKind[] = ['positive', 'negative', 'mixed-stack', 'monorepo', 'vendor-heavy', 'vulnerable', 'browser', 'cross-platform'];

/** 120 deterministic projects modeled on common repository layouts; no third-party source is embedded. */
export const PHASE5_ACCURACY_FIXTURES: AccuracyFixture[] = Array.from({ length: 120 }, (_, index) => {
  const scenario = scenarios[index % scenarios.length];
  const variant = Math.floor(index / scenarios.length) + 1;
  const kind = scenario.name.startsWith('negative') ? 'negative' : scenario.name.includes('mixed') ? 'mixed-stack' : scenario.name.includes('monorepo') ? 'monorepo' : scenario.name.includes('vendor') ? 'vendor-heavy' : scenario.name.includes('vulnerable') ? 'vulnerable' : scenario.name.includes('browser') ? 'browser' : scenario.name.includes('platform') ? 'cross-platform' : kinds[index % kinds.length] === 'negative' ? 'positive' : kinds[index % kinds.length];
  return { id: `${scenario.name}-${variant.toString().padStart(2, '0')}`, kind, files: scenario.files.map((item) => ({ ...item })), expected: { ...scenario.expected } };
});
