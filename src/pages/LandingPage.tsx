import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bug, CircleCheck as CheckCircle2, Clock, FileSearch, GitBranch, Github, Layers, Package, CirclePlay as PlayCircle, ShieldCheck, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UceLogo } from '@/components/UceLogo';

const problems = [
  { icon: GitBranch, title: 'Version conflicts', desc: 'Mismatched runtimes and packages break builds silently.' },
  { icon: Package, title: 'Missing dependencies', desc: 'Unlisted or unpinned packages cause non-deterministic installs.' },
  { icon: Terminal, title: 'Environment problems', desc: 'Missing env vars and config drift between local and CI.' },
  { icon: Bug, title: 'Runtime issues', desc: 'EOL runtimes and outdated majors introduce security and build risk.' },
];

const features = [
  { icon: FileSearch, title: 'Project & Git Analysis', desc: 'Inspect manifests, configs, and structure from ZIP uploads or public GitHub repositories.' },
  { icon: ShieldCheck, title: 'Compatibility Detection', desc: 'Deterministic rules flag runtime, dependency, and config risk.' },
  { icon: Zap, title: 'Runtime Insights', desc: 'See the detected runtime, language, and build tool at a glance.' },
  { icon: Layers, title: 'Dependency Awareness', desc: 'Spot outdated majors, missing lockfiles, and duplicate ranges.' },
  { icon: CheckCircle2, title: 'Clear Reports', desc: 'Engineering-grade reports with severity, impact, and next steps.' },
  { icon: Terminal, title: 'Developer Friendly', desc: 'Built for engineers — no marketing fluff, no AI claims.' },
];

const steps = [
  { step: 1, title: 'Add a Project', desc: 'Upload a ZIP or paste a public GitHub repository URL.' },
  { step: 2, title: 'UCE Analyzes Structure', desc: 'Files are scanned and the stack is detected deterministically.' },
  { step: 3, title: 'Receive Compatibility Report', desc: 'Get a scored report with issues and recommendations.' },
];

const audience = [
  { icon: Terminal, title: 'Developers', desc: 'Catch setup issues before they block your flow.' },
  { icon: Zap, title: 'Indie Hackers', desc: 'Ship faster by fixing compatibility before deploy.' },
  { icon: Layers, title: 'Software Teams', desc: 'Standardize project health across repositories.' },
  { icon: GitBranch, title: 'Open Source Maintainers', desc: 'Give contributors a clear compatibility baseline.' },
];

const supportedStacks = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'Kotlin', 'Ruby', 'PHP', 'Next.js', 'React', 'Vue', 'Django', 'Flask', 'Spring Boot', 'Rails',
];

export function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
          <UceLogo size="md" />
          <span className="font-mono text-xs text-muted-foreground">UCE · v1.2.3</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button size="sm" onClick={() => navigate('/analyze')} className="gap-2">
              Analyze Project
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" aria-hidden />
        <div className="absolute left-1/2 top-0 -z-0 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-5 border-primary/30 bg-primary/10 text-primary">
                <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary" />
                UCE · v1.2.3 · Deterministic Engine
              </Badge>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
                Stop wasting hours fixing <span className="text-gradient">broken project setups.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground md:text-xl">
                UCE analyzes software projects and public Git repositories for compatibility, dependency, runtime, and configuration issues
                before development gets blocked.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate('/analyze')} className="gap-2">
                  Analyze Project
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/analyze?demo=1')} className="gap-2">
                  <PlayCircle className="h-4 w-4" />
                  View Demo
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Understand software compatibility before debugging. No AI. Local-first analysis runs in your browser.
              </p>
            </div>

            {/* Product mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 -z-0 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent blur-2xl" aria-hidden />
              <Card className="relative overflow-hidden shadow-glow">
                <div className="flex items-center gap-1.5 border-b px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                  <span className="ml-2 font-mono text-xs text-muted-foreground">uce-report</span>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Compatibility Score</p>
                      <p className="text-2xl font-bold text-success">81<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { label: 'Runtime', score: 88, color: 'bg-success' },
                      { label: 'Dependencies', score: 40, color: 'bg-warning' },
                      { label: 'Configuration', score: 100, color: 'bg-success' },
                      { label: 'Structure', score: 100, color: 'bg-success' },
                    ].map((c) => (
                      <div key={c.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-medium tabular-nums">{c.score}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                    <Bug className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-medium">next is on an older major version</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Detects compatibility across {supportedStacks.length}+ stacks
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {supportedStacks.map((s) => (
              <span key={s} className="font-mono text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <Badge variant="outline" className="mb-3 border-destructive/30 text-destructive">The Problem</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Hours lost to setup issues</h2>
            <p className="mt-3 text-muted-foreground">
              Developers waste hours fixing issues that a deterministic check could catch in seconds.
            </p>
            <div className="mt-6 grid gap-3">
              {problems.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-destructive/30">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Badge variant="outline" className="mb-3 border-success/30 text-success">The Solution</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Engineering reports, not guesses</h2>
            <p className="mt-3 text-muted-foreground">
              Add a ZIP project or public GitHub repository and receive an engineering compatibility report.
            </p>
            <Card className="mt-6 border-primary/20 bg-primary/10">
              <CardHeader>
                <CardTitle className="text-lg">How UCE helps</CardTitle>
                <CardDescription>
                  A deterministic engine inspects your project and returns a scored report — no magic, no AI.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Detects language, framework, runtime, and tooling
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Flags runtime, dependency, config, and structure issues
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Produces an exportable engineering report
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Runs deterministically in your browser after a Git repository is fetched
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">Features</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Everything you need to inspect a project</h2>
            <p className="mt-3 text-muted-foreground">
              Before it blocks you.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="transition-all duration-200 hover:border-primary/40 hover:shadow-soft hover:-translate-y-0.5">
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3 border-secondary/30 text-secondary">How it works</Badge>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Three steps from project to report</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.step} className="relative">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {s.step}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden h-px flex-1 bg-border md:block" aria-hidden />
                  )}
                </div>
                <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Target users */}
      <section className="border-y bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">Who it's for</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Built for engineers</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audience.map((a) => {
              const Icon = a.icon;
              return (
                <Card key={a.title}>
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <CardDescription>{a.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">Open Source</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Open Source</h2>
            <p className="mt-3 text-muted-foreground">
              UCE is free and open source, built for developers and teams.
            </p>
            <p className="mt-1 text-muted-foreground">Licensed under Apache License 2.0.</p>
          </div>
          <Button variant="outline" asChild className="gap-2">
            <a href="https://github.com/ryzovauce-ryzova/Ryzova-UCE" target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-dots opacity-20" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Find compatibility issues before they become debugging nightmares.</h2>
            <p className="mt-2 text-primary-foreground/90">Analyze a ZIP project or public GitHub repository with deterministic checks.</p>
          </div>
          <Button size="lg" variant="secondary" onClick={() => navigate('/analyze')} className="gap-2">
            <Clock className="h-4 w-4" />
            Analyze a project
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 md:flex-row md:px-8">
          <UceLogo size="sm" />
          <p className="text-xs text-muted-foreground">
            Built by <a href="https://www.ryzova.com/" target="_blank" rel="noreferrer" className="hover:text-foreground">Ryzova</a> · Trust First philosophy · UCE · v1.2.3
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="https://github.com/ryzovauce-ryzova/Ryzova-UCE" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
            <Link to="/settings" className="hover:text-foreground">Settings</Link>
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
