import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Bug, ChartBar as FileBarChart, FileSearch, Gauge, History, CirclePlay as PlayCircle, TrendingUp, CloudUpload as UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReportEngine } from '@/hooks/useReportEngine';
import { toShareableList } from '@/lib/storage';
import { scoreStatus } from '@/components/reports/ScoreRing';
import { SeverityBadge } from '@/components/reports/SeverityBadge';

export function DashboardPage() {
  const navigate = useNavigate();
  const { history } = useReportEngine();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stats = useMemo(() => {
    const total = history.length;
    const avg = total ? Math.round(history.reduce((s, h) => s + h.result.score.overall, 0) / total) : 0;
    const issues = history.reduce((s, h) => s + h.result.issues.length, 0);
    const critical = history.reduce(
      (s, h) => s + h.result.issues.filter((i) => i.severity === 'critical').length,
      0
    );
    return { total, avg, issues, critical };
  }, [history]);

  const recent = useMemo(() => toShareableList(history).slice(0, 5), [history]);

  const commonIssues = useMemo(() => {
    const counts = new Map<string, { title: string; severity: 'critical' | 'warning' | 'info'; count: number }>();
    for (const h of history) {
      for (const issue of h.result.issues) {
        const key = issue.title;
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { title: issue.title, severity: issue.severity, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [history]);

  const cards = useMemo(() => [
    { label: 'Projects Analyzed', value: stats.total, icon: FileSearch, accent: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Average Score', value: stats.total ? `${stats.avg}/100` : '—', icon: Gauge, accent: 'text-success', bg: 'bg-success/10' },
    { label: 'Issues Detected', value: stats.issues, icon: Bug, accent: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Critical Issues', value: stats.critical, icon: Activity, accent: 'text-destructive', bg: 'bg-destructive/10' },
  ], [stats]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome */}
      <Card className="relative overflow-hidden border-primary/20 bg-primary/10">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <CardContent className="relative flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
          <div>
            <Badge variant="outline" className="mb-2 border-primary/30 bg-primary/10 text-primary">
              Universal Compatibility Engine
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to UCE</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inspect a project and get a deterministic compatibility report — no AI, no cloud.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/analyze?demo=1')} className="gap-2">
              <PlayCircle className="h-4 w-4" />
              View demo
            </Button>
            <Button onClick={() => navigate('/analyze')} className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Analyze New Project
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${c.bg}`}>
                  <Icon className={`h-4 w-4 ${c.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {mounted ? c.value : '—'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent + common issues */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Recent Analyses
              </CardTitle>
              <CardDescription>Recently generated compatibility reports.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/report')} className="gap-2">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="No reports yet"
                description="Run your first analysis to see reports here."
                actionLabel="Analyze a project"
                onAction={() => navigate('/analyze')}
              />
            ) : (
              <ul className="divide-y">
                {recent.map((r) => {
                  const status = scoreStatus(r.overallScore);
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => navigate(`/report/${r.id}`)}
                        className="group flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/80 -mx-2 px-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted ${status.text}`}>
                            <span className="text-xs font-bold tabular-nums">{r.overallScore}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.projectName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.createdAt).toLocaleString()} · {r.issueCount} issue{r.issueCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={status.text}>{status.label}</Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Common Issues Found
            </CardTitle>
            <CardDescription>Across all analyzed projects.</CardDescription>
          </CardHeader>
          <CardContent>
            {commonIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <FileSearch className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No issues detected yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {commonIssues.map((i) => (
                  <li key={i.title} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.title}</p>
                      <p className="text-xs text-muted-foreground">{i.count} occurrence{i.count > 1 ? 's' : ''}</p>
                    </div>
                    <SeverityBadge severity={i.severity} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/analyze')} className="gap-2">
            <UploadCloud className="h-4 w-4" />
            Upload project
          </Button>
          <Button variant="outline" onClick={() => navigate('/analyze?demo=1')} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Run demo
          </Button>
          <Button variant="outline" onClick={() => navigate('/report')} className="gap-2">
            <FileBarChart className="h-4 w-4" />
            Browse reports
          </Button>
          <Button variant="outline" onClick={() => navigate('/settings')} className="gap-2">
            <Activity className="h-4 w-4" />
            Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileSearch className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" onClick={onAction} className="gap-2">
        <UploadCloud className="h-3.5 w-3.5" />
        {actionLabel}
      </Button>
    </div>
  );
}
