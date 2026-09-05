import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Boxes, Languages, Layers, Package, Wrench, Cpu, Database, Cloud, GitBranch, Monitor, Server, ShieldCheck, Network, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReportEngine } from '@/hooks/useReportEngine';
import { ReportPage } from './ReportPage';
import { CodeIntelligencePanel } from '@/components/reports/CodeIntelligence';
import type { AnalysisResult, TechnologyEvidence } from '@/lib/analyzer/types';

export function ReportWithLanguageBreakdownPage() {
  const { history, getById } = useReportEngine();
  const [report, setReport] = useState<AnalysisResult | null>(null);
  useEffect(() => { const id = window.location.pathname.split('/').filter(Boolean)[1]; setReport(id ? getById(id) : history[0]?.result ?? null); }, [history, getById]);
  const stack = report?.stack;
  const languages = stack?.languages ?? [];
  const primaryLanguage = stack?.primaryLanguage ?? stack?.language;
  const frameworks = stack ? uniqueKnown([...(stack.frameworks ?? []), stack.framework]) : [];
  const runtimes = stack ? uniqueKnown([...(stack.runtimes ?? []), stack.runtime]) : [];
  const confidence = stack?.confidence;
  const technologyEvidence = stack?.technologyEvidence ?? [];
  const dependencies = stack?.dependencyIntelligence;
  const architecture = stack?.architecture;
  const technologyGroups = stack ? [
    { icon: <Layers className="h-4 w-4" />, title: 'Frameworks', values: frameworks, primary: stack.framework, confidence: confidence?.framework },
    { icon: <Boxes className="h-4 w-4" />, title: 'Runtimes', values: runtimes, primary: stack.runtime, confidence: confidence?.runtime },
    { icon: <Package className="h-4 w-4" />, title: 'Package Manager', values: uniqueKnown([stack.packageManager]), confidence: confidence?.packageManager },
    { icon: <Wrench className="h-4 w-4" />, title: 'Build Tool', values: uniqueKnown([stack.buildTool]), confidence: confidence?.buildTool },
    { icon: <Database className="h-4 w-4" />, title: 'Database', values: uniqueKnown([stack.database]) },
    { icon: <Monitor className="h-4 w-4" />, title: 'Frontend', values: uniqueKnown([stack.frontend]) },
    { icon: <Server className="h-4 w-4" />, title: 'Backend', values: uniqueKnown([stack.backend]) },
    { icon: <GitBranch className="h-4 w-4" />, title: 'Monorepo', values: uniqueKnown([stack.monorepo ?? 'Unknown']) },
    { icon: <Cloud className="h-4 w-4" />, title: 'Cloud Provider', values: uniqueKnown([stack.cloudProvider ?? 'Unknown']) },
  ] : [];
  return (
    <>
      {report && languages.length > 0 && <Card className="mb-6 animate-slide-up"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Languages className="h-4 w-4" />Language Breakdown</CardTitle><CardDescription>{languages.length} language{languages.length !== 1 ? 's' : ''} detected by source-file size.</CardDescription></div>{stack?.mixedLanguage && <Badge variant="secondary" className="shrink-0 text-xs">Mixed language</Badge>}</div></CardHeader><CardContent><div className="space-y-4">{languages.map((profile) => { const percentage = Math.max(0, Math.min(100, profile.percentage)); const isPrimary = profile.language === primaryLanguage; return <div key={profile.language} className="space-y-1.5"><div className="flex items-center justify-between gap-3 text-sm"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{profile.language}</span>{isPrimary && <Badge variant="outline" className="shrink-0 text-[10px]">Primary</Badge>}</div><span className="shrink-0 font-semibold tabular-nums">{profile.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${profile.language} source share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} /></div><div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{profile.files.toLocaleString()} file{profile.files !== 1 ? 's' : ''}</span><span>{formatBytes(profile.bytes)}</span></div></div>; })}</div></CardContent></Card>}
      {report && stack && <Card className="mb-6 animate-slide-up"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4" />Technology Intelligence 2.0</CardTitle><CardDescription>Evidence-backed technologies, dependency health, and architecture inferred from the scanned project — no external API required.</CardDescription></div><Badge variant="secondary" className="shrink-0 text-xs">{technologyEvidence.length} evidence items</Badge></div></CardHeader><CardContent className="space-y-6"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{technologyGroups.map((group) => <TechnologyGroup key={group.title} icon={group.icon} title={group.title} values={group.values} primary={group.primary} confidence={group.confidence} />)}</div>{technologyEvidence.length > 0 && <section><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Why detected</div><div className="grid gap-3 md:grid-cols-2">{technologyEvidence.slice(0, 12).map((item) => <EvidenceRow key={`${item.kind}-${item.name}`} item={item} />)}</div></section>}{dependencies && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" />Dependency Intelligence</div><div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Metric label="Total" value={dependencies.total} /><Metric label="Runtime" value={dependencies.runtime} /><Metric label="Dev" value={dependencies.development} /><Metric label="Peer" value={dependencies.peer} /></div><div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span>Health score</span><span className="font-semibold">{dependencies.healthScore}%</span></div></div>{architecture && <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4" />Architecture Intelligence</div><div className="flex flex-wrap items-center gap-2"><Badge>{architecture.primary}</Badge><Badge variant="outline">{Math.round(architecture.confidence)}% confidence</Badge></div><div className="mt-3 flex flex-wrap gap-2">{architecture.patterns.map((pattern) => <Badge key={pattern} variant="secondary">{pattern}</Badge>)}</div><ul className="mt-3 space-y-1 text-xs text-muted-foreground">{architecture.evidence.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>}</section>}</CardContent></Card>}
      <CodeIntelligencePanel data={stack?.codeIntelligence} />
      <ReportPage />
    </>
  );
}
function TechnologyGroup({ icon, title, values, primary, confidence }: { icon: ReactNode; title: string; values: string[]; primary?: string; confidence?: number }) { const visible = uniqueKnown(values); if (!visible.length) return null; return <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium">{icon}<span>{title}</span><Badge variant="secondary" className="ml-auto text-[10px]">{visible.length} detected</Badge></div><div className="flex flex-wrap gap-2">{visible.map((value) => <Badge key={value} variant={value === primary ? 'default' : 'outline'}>{value}{value === primary && <span className="ml-1 text-[10px] opacity-80">Primary</span>}</Badge>)}</div>{confidence !== undefined && <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground"><span>Detection confidence</span><span className="font-medium text-foreground">{Math.round(confidence)}%</span></div>}</div>; }
function EvidenceRow({ item }: { item: TechnologyEvidence }) { return <div className="rounded-lg border bg-background p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><span className="font-medium text-sm">{item.name}</span><span className="ml-2 text-[10px] uppercase text-muted-foreground">{item.kind}</span></div><Badge variant="outline" className="shrink-0 text-[10px]">{Math.round(item.confidence)}%</Badge></div>{item.version && <div className="mt-1 text-[11px] text-muted-foreground">Version: {item.version}</div>}<ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">{item.evidence.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border bg-background p-2 text-center"><div className="text-base font-semibold tabular-nums">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>; }
function uniqueKnown(values: string[]): string[] { return [...new Set(values.filter((value) => value && value !== 'Unknown' && value !== 'None'))]; }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; const units = ['KB', 'MB', 'GB', 'TB']; let value = bytes / 1024; let unit = 0; while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; } return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`; }
