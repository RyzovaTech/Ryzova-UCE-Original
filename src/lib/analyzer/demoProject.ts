import type { ProjectFile } from './types';

const files: Array<{ path: string; content: string }> = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'modern-web-app',
        version: '1.4.2',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          next: '13.5.6',
          react: '17.0.2',
          'react-dom': '17.0.2',
        },
        devDependencies: {
          typescript: '4.9.5',
          '@types/react': '17.0.79',
          '@types/node': '18.19.0',
        },
      },
      null,
      2
    ),
  },
  {
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */\nconst nextConfig = { reactStrictMode: true };\nmodule.exports = nextConfig;\n`,
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'es2020',
          lib: ['dom', 'dom.iterable', 'esnext'],
          module: 'esnext',
          jsx: 'preserve',
          strict: true,
          moduleResolution: 'bundler',
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      },
      null,
      2
    ),
  },
  {
    path: '.env.example',
    content: `# Environment variables for the frontend\nNEXT_PUBLIC_API_URL=\nDATABASE_URL=\n`,
  },
  {
    path: 'README.md',
    content: `# Modern Web App\n\nA sample Next.js project used for UCE demo analysis.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
  },
  {
    path: 'app/layout.tsx',
    content: `import type { ReactNode } from 'react';\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
  },
  {
    path: 'app/page.tsx',
    content: `export default function Page() {\n  return <main>Hello from Modern Web App</main>;\n}\n`,
  },
  {
    path: 'app/api/route.ts',
    content: `export async function GET() {\n  return Response.json({ ok: true });\n}\n`,
  },
];

export function getDemoProjectFiles(): ProjectFile[] {
  const out: ProjectFile[] = [];
  for (const f of files) {
    out.push({ path: f.path, size: f.content.length, isDirectory: false, content: f.content });
  }
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  for (const d of dirs) out.push({ path: d, size: 0, isDirectory: true });
  return out;
}

export const DEMO_PROJECT_NAME = 'Modern Web Application';
