import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Code2,
  Download,
  FileJson,
  FileSearch,
  FolderTree,
  Layers3,
  LockKeyhole,
  Network,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { BrowserCompatibilityPanel } from '@/components/reports/BrowserCompatibilityPanel';
import { CodeIntelligencePanel } from '@/components/reports/CodeIntelligence';
import { ExtendedIntelligencePanel } from '@/components/reports/ExtendedIntelligencePanel';
import { IntelligenceInsightsPanel } from '@/components/reports/IntelligenceInsightsPanel';
import { exportJson, downloadFile } from '@/lib/report/export';
import type { AnalysisResult, Issue, Severity } from '@/lib/analyzer/types';

type ReportSection = 'overview' | 'technology' | 'code' | 'security' | 'compatibility' | 'quality' | 'issues' | 'map';
type UserMode = 'simple' | 'developer' | 'expert';
type SoftStatus = 'Confirmed' | 'Likely' | 'Possible' | 'Review required' | 'Not enough evidence' | 'Not applicable';

const NAV_ITEMS: Array<{ id: ReportSection; label: string; icon: typeof CircleGauge }> = [
  { id: 'overview', label: 'Overview', icon: CircleGauge },
  { id: 'technology', label: 'Technology', icon: Boxes },
  { id: 'code', label: 'Code & Architecture', icon: Code2 },
  { id: 'security', label: 'Security', icon: LockKeyhole },
  { id: 'compatibility', label: 'Compatibility', icon: Layers3 },
  { id: 'quality', label: 'Quality', icon: Sparkles },
  { id: 'issues', label: 'Issues', icon: AlertTriangle },
  { id: 'map', label: 'Project Map', icon: FolderTree },
];

const SEVERITIES: Array<'all' | Severity> = ['all', 'critical', 'warning', 'info'];

export function Phase4ReportWorkspace({ report }: { report: AnalysisResult }) {
  const [section, setSection] = useState<ReportSection>('overview');
  const [mode, setMode] = useState<UserMode>(() => readMode());

  const changeMode = (next: UserMode) => {
    setMode(next);
    try { localStorage.setItem('uce-report-mode:v1', next); } catch { /* private browsing */ }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <ReportHeader report={report} mode={mode} onModeChange={changeMode} />
      <nav aria-label="Report sections" className="no-print overflow-x-auto rounded-xl border bg-card p-1.5">
        <div className="flex min-w-max gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={section === item.id ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main>
        {section === 'overview' && <OverviewView report={report} mode={mode} onNavigate={setSection} />}
        {section === 'technology' && <TechnologyView report={report} mode={mode} />}
        {section === 'code' && <CodeView report={report} mode={mode} />}
        {section === 'security' && <SecurityView report={report} mode={mode} />}
        {section === 'compatibility' && <CompatibilityView report={report} mode={mode} />}
        {section === 'quality' && <QualityView report={report} mode={mode} />}
        {section === 'issues' && <IssueCenter report={report} mode={mode} />}
        {section === 'map' && <ProjectMapView report={report} mode={mode} />}
      </main>
    </div>
  );
}

function ReportHeader({ report, mode, onModeChange }: { report: AnalysisResult; mode: UserMode; onModeChange: (mode: UserMode) => void }) {
  const exportReport = () => downloadFile(`${report.summary.name}-uce-report.json`, exportJson(report), 'application/json');
  return (
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{report.summary.name}</h1>
          <Badge variant="outline">{report.classification.type}</Badge>
          <SoftStatusBadge status={report.classification.isSoftware ? statusFromConfidence(projectConfidence(report)) : 'Not applicable'} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">UCE Engine {report.analysisVersion} · {new Date(report.createdAt).toLocaleString()}</p>
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-muted/30 p-1" aria-label="Report detail mode">
          {(['simple', 'developer', 'expert'] as UserMode[]).map((item) => (
            <button key={item} type="button" onClick={() => onModeChange(item)} aria-pressed={mode === item} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item}</button>
          ))}
        </div>
        {mode === 'expert' && <Button variant="outline" size="sm" className="gap-2" onClick={exportReport}><FileJson className="h-4 w-4" />JSON</Button>}
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}><Download className="h-4 w-4" />PDF</Button>
      </div>
    </header>
  );
}

function OverviewView({ report, mode, onNavigate }: { report: AnalysisResult; mode: UserMode; onNavigate: (section: ReportSection) => void }) {
  const critical = report.issues.filter((item) => item.severity === 'critical');
  const attention = report.categories.filter((item) => item.score < 80).sort((a, b) => a.score - b.score);
  const actions = topActions(report);
  const confidence = projectConfidence(report);
  const identity = projectIdentity(report);
  const readiness = readinessText(report.score.overall, critical.length);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><SoftStatusBadge status={critical.length ? 'Review required' : statusFromConfidence(confidence)} /><span className="text-xs text-muted-foreground">Overall readiness</span></div>
            <h2 className="text-2xl font-semibold">{readiness}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{identity}. {critical.length ? `${critical.length} critical issue${critical.length === 1 ? '' : 's'} should be reviewed first.` : 'No critical compatibility issue was detected by the current static rules.'}</p>
          </div>
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-8 border-primary/20 bg-background/80">
            <span className="text-3xl font-bold tabular-nums">{report.score.overall}</span><span className="text-[10px] uppercase text-muted-foreground">readiness</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="What is this project?" icon={<Boxes className="h-4 w-4" />}>
          <p className="text-sm font-medium">{identity}</p>
          <p className="mt-2 text-xs text-muted-foreground">Primary: {report.stack.primaryLanguage ?? report.stack.language} · {report.stack.architecture?.primary ?? report.stack.framework}</p>
          <TextLink onClick={() => onNavigate('technology')}>View technology</TextLink>
        </SummaryCard>
        <SummaryCard title="What needs attention?" icon={<AlertTriangle className="h-4 w-4" />}>
          {attention.length ? <ul className="space-y-2">{attention.slice(0, 3).map((item) => <li key={item.id} className="flex items-center justify-between gap-3 text-sm"><span>{item.label}</span><Badge variant={item.score < 50 ? 'destructive' : 'outline'}>{item.score}%</Badge></li>)}</ul> : <p className="text-sm text-muted-foreground">No low-scoring area was detected.</p>}
          <TextLink onClick={() => onNavigate('quality')}>Review quality areas</TextLink>
        </SummaryCard>
        <SummaryCard title="What should I do next?" icon={<Wrench className="h-4 w-4" />}>
          <p className="text-sm font-medium">{actions[0] ?? 'Review the report evidence before release.'}</p>
          <p className="mt-2 text-xs text-muted-foreground">UCE prioritizes critical and high-confidence signals first.</p>
          <TextLink onClick={() => onNavigate('issues')}>Open Issue Center</TextLink>
        </SummaryCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Top five actions</CardTitle><CardDescription>Highest-value next steps from this scan.</CardDescription></CardHeader><CardContent><ol className="space-y-3">{actions.map((action, index) => <li key={`${action}-${index}`} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><span>{action}</span></li>)}</ol></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Scan confidence</CardTitle><CardDescription>{statusFromConfidence(confidence)} evidence across the primary detectors.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-end justify-between"><span className="text-3xl font-semibold tabular-nums">{confidence}%</span><SoftStatusBadge status={statusFromConfidence(confidence)} /></div><Progress value={confidence} /><p className="text-xs text-muted-foreground">Based on language, framework, runtime, package-manager, and build-tool evidence.</p></CardContent></Card>
      </div>

      <details className="rounded-lg border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Analysis limitations</summary>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground"><li>Static signals show review opportunities; they do not prove runtime behavior or exploitability.</li><li>Browser and platform results use detected targets and source patterns, not real-device execution.</li><li>Accessibility and license checks do not replace user testing or legal review.</li>{mode !== 'simple' && <li>Unknown or excluded files can reduce evidence confidence.</li>}</ul>
      </details>
    </div>
  );
}

function TechnologyView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const stack = report.stack;
  const technologies = [stack.language, ...(stack.frameworks ?? [stack.framework]), ...(stack.runtimes ?? [stack.runtime]), stack.packageManager, stack.buildTool, stack.database].filter(isKnown);
  return <div className="space-y-4"><SectionHeading title="Technology" description="Languages, frameworks, runtimes, data tools, and dependency health." /><Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">{technologies.map((item, index) => <div key={`${item}-${index}`} className="rounded-lg border bg-muted/20 p-3"><p className="text-sm font-medium">{item}</p><p className="mt-1 text-[11px] text-muted-foreground">{index === 0 ? 'Primary language' : 'Detected technology'}</p></div>)}</CardContent></Card>{stack.languages?.length ? <Card><CardHeader><CardTitle className="text-base">Language composition</CardTitle></CardHeader><CardContent className="space-y-3">{stack.languages.map((language) => <div key={language.language}><div className="mb-1 flex justify-between text-xs"><span>{language.language}</span><span>{language.percentage}%</span></div><Progress value={language.percentage} /></div>)}</CardContent></Card> : null}{mode !== 'simple' && stack.technologyEvidence?.length ? <EvidenceList report={report} expert={mode === 'expert'} /> : null}</div>;
}

function CodeView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const code = report.stack.codeIntelligence;
  if (!code) return <EmptyState text="Not enough evidence to build code intelligence." />;
  if (mode === 'simple') return <div className="space-y-4"><SectionHeading title="Code & Architecture" description="A plain-language summary of the repository structure." /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Code symbols" value={code.symbols.length} /><MetricCard label="Internal links" value={code.dependencyEdges.length} /><MetricCard label="API endpoints" value={code.apiEndpoints.length} /></div><Card><CardContent className="p-5 text-sm">UCE identifies this primarily as <strong>{report.stack.architecture?.primary ?? 'an unknown architecture'}</strong>. {code.quality.circularDependencies.length ? `${code.quality.circularDependencies.length} circular dependency path(s) need review.` : 'No circular dependency path was detected.'}</CardContent></Card></div>;
  return <><SectionHeading title="Code & Architecture" description="Symbols, dependency edges, endpoints, entry points, and architecture evidence." /><CodeIntelligencePanel data={code} /></>;
}

function SecurityView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const security = report.stack.securityIntelligence;
  if (!security) return <EmptyState text="Security analysis is not applicable or has insufficient evidence." />;
  return <div className="space-y-4"><SectionHeading title="Security" description="Static security-sensitive signals that require developer confirmation." /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Security score" value={`${security.score}%`} /><MetricCard label="Review signals" value={security.findings.length} /><MetricCard label="Production files" value={security.filesScanned} /></div><Card><CardContent className="space-y-3 p-5">{security.findings.length === 0 ? <EmptyState text="No security-sensitive pattern matched the current rules." /> : security.findings.slice(0, mode === 'simple' ? 5 : 30).map((finding) => <div key={finding.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><SoftStatusBadge status="Review required" /><span className="text-sm font-medium">{finding.title}</span><Badge variant={finding.severity === 'critical' ? 'destructive' : 'outline'}>{finding.severity}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{finding.recommendation}</p>{mode !== 'simple' && <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium">Technical evidence</summary><div className="mt-2 space-y-1 text-muted-foreground"><p className="font-mono">{finding.file}:{finding.line}</p><p>{finding.evidence}</p>{mode === 'expert' && finding.ruleId && <p>Rule ID: {finding.ruleId}</p>}</div></details>}</div>)}</CardContent></Card></div>;
}

function CompatibilityView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const browser = report.stack.browserCompatibility;
  return <div className="space-y-4"><SectionHeading title="Compatibility" description="Runtime, browser, environment, deployment, and platform readiness." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{report.categories.map((category) => <Card key={category.id}><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{category.label}</span><SoftStatusBadge status={category.score >= 85 ? 'Confirmed' : category.score >= 65 ? 'Likely' : 'Review required'} /></div><p className="mt-3 text-2xl font-semibold">{category.score}%</p>{mode !== 'simple' && <p className="mt-2 text-xs text-muted-foreground">{category.summary}</p>}</CardContent></Card>)}</div>{browser ? mode === 'simple' ? <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="font-medium">Browser readiness</p><p className="mt-1 text-xs text-muted-foreground">{browser.findings.length ? `${browser.findings.length} browser compatibility signal(s) need review.` : 'No browser compatibility gap was detected for the selected targets.'}</p></div><Badge variant={browser.score < 80 ? 'destructive' : 'secondary'}>{browser.score}%</Badge></CardContent></Card> : <BrowserCompatibilityPanel data={browser} /> : null}</div>;
}

function QualityView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const extended = report.stack.extendedIntelligence;
  if (!extended) return <EmptyState text="Quality intelligence is unavailable for this report." />;
  if (mode === 'simple') {
    const modules = Object.values(extended.modules).sort((a, b) => a.score - b.score).slice(0, 6);
    return <div className="space-y-4"><SectionHeading title="Quality" description="The areas most likely to benefit from attention." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map((module) => <Card key={module.id}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">{module.label}</span><Badge variant={module.score < 60 ? 'destructive' : 'outline'}>{module.score}%</Badge></div><p className="mt-2 text-xs text-muted-foreground">{module.summary}</p></CardContent></Card>)}</div></div>;
  }
  return <div><SectionHeading title="Quality" description="Maintainability, testing, performance, documentation, and correlated intelligence." /><IntelligenceInsightsPanel insights={report.stack.intelligenceInsights} /><ExtendedIntelligencePanel data={extended} /></div>;
}

function IssueCenter({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [category, setCategory] = useState('all');
  const [file, setFile] = useState('all');
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [suppressed, setSuppressed] = useState<Set<string>>(() => new Set());
  const files = useMemo(() => [...new Set(report.issues.map((item) => item.affectedFile))].sort(), [report.issues]);
  const categories = useMemo(() => [...new Set(report.issues.map((item) => item.category))].sort(), [report.issues]);
  const visible = useMemo(() => report.issues.filter((item) => {
    const text = `${item.title} ${item.description} ${item.affectedFile}`.toLowerCase();
    return !suppressed.has(item.id) && (severity === 'all' || item.severity === severity) && (category === 'all' || item.category === category) && (file === 'all' || item.affectedFile === file) && (!query || text.includes(query.toLowerCase()));
  }), [report.issues, query, severity, category, file, suppressed]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <div className="space-y-4"><SectionHeading title="Issue Center" description="Search, filter, review, and suppress static findings." /><Card><CardContent className="space-y-3 p-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues, files, or descriptions" className="pl-9" /></div><div className="grid gap-2 sm:grid-cols-3"><FilterSelect label="Severity" value={severity} onChange={(value) => setSeverity(value as 'all' | Severity)} options={SEVERITIES} /><FilterSelect label="Module" value={category} onChange={setCategory} options={['all', ...categories]} /><FilterSelect label="File" value={file} onChange={setFile} options={['all', ...files]} /></div></CardContent></Card><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{visible.length} of {report.issues.length} findings · {reviewed.size} reviewed · {suppressed.size} suppressed</p>{mode === 'expert' && <Button variant="outline" size="sm" onClick={() => exportSelected(report, visible)}>Export selected</Button>}</div><div className="space-y-2">{visible.map((issue) => <IssueRow key={issue.id} issue={issue} mode={mode} reviewed={reviewed.has(issue.id)} onReview={() => toggle(setReviewed, issue.id)} onSuppress={() => toggle(setSuppressed, issue.id)} />)}{visible.length === 0 && <EmptyState text="No findings match these filters." />}</div></div>;
}

function ProjectMapView({ report, mode }: { report: AnalysisResult; mode: UserMode }) {
  const code = report.stack.codeIntelligence;
  const areas = Object.entries(code?.architectureAreas ?? {});
  return <div className="space-y-4"><SectionHeading title="Project Map" description="A structured view of entry points, areas, configuration, and internal relationships." /><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4" />Architecture areas</CardTitle></CardHeader><CardContent className="space-y-3">{areas.length ? areas.map(([area, paths]) => <div key={area} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{area}</span><Badge variant="secondary">{paths.length} files</Badge></div>{mode !== 'simple' && <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">{paths.slice(0, mode === 'expert' ? 12 : 5).map((path) => <li key={path} className="truncate">{path}</li>)}</ul>}</div>) : <EmptyState text="Not enough evidence to map architecture areas." />}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="h-4 w-4" />Known project files</CardTitle></CardHeader><CardContent className="space-y-2">{report.detectedFiles.slice(0, mode === 'expert' ? 50 : 15).map((item) => <div key={item.path} className="rounded-md border p-3"><p className="truncate font-mono text-xs">{item.path}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.purpose}</p></div>)}</CardContent></Card></div>{mode === 'expert' && code ? <CodeIntelligencePanel data={code} /> : null}</div>;
}

function EvidenceList({ report, expert }: { report: AnalysisResult; expert: boolean }) {
  const evidence = report.stack.technologyEvidence ?? [];
  return <Card><CardHeader><CardTitle className="text-base">Why UCE detected these technologies</CardTitle><CardDescription>Expand an item to see its evidence.</CardDescription></CardHeader><CardContent className="space-y-2">{evidence.slice(0, expert ? 50 : 15).map((item) => <details key={`${item.kind}-${item.name}`} className="rounded-lg border p-3"><summary className="flex cursor-pointer list-none items-center gap-2"><span className="text-sm font-medium">{item.name}</span><Badge variant="outline">{item.kind}</Badge><SoftStatusBadge status={statusFromConfidence(item.confidence)} /><ChevronRight className="ml-auto h-4 w-4" /></summary><ul className="mt-3 space-y-1 text-xs text-muted-foreground">{item.evidence.map((line) => <li key={line}>• {line}</li>)}</ul></details>)}</CardContent></Card>;
}

function IssueRow({ issue, mode, reviewed, onReview, onSuppress }: { issue: Issue; mode: UserMode; reviewed: boolean; onReview: () => void; onSuppress: () => void }) {
  return <Card className={reviewed ? 'opacity-70' : ''}><CardContent className="p-4"><div className="flex flex-wrap items-start gap-2"><Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'}>{issue.severity}</Badge><div className="min-w-0 flex-1"><p className="text-sm font-medium">{issue.title}</p><p className="mt-1 text-xs text-muted-foreground">{issue.description}</p>{mode !== 'simple' && <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Technical evidence</summary><div className="mt-2 space-y-1 text-muted-foreground"><p className="font-mono">{issue.affectedFile}</p><p>{issue.reason}</p><p className="text-foreground">Recommendation: {issue.recommendation}</p></div></details>}</div><SoftStatusBadge status="Review required" /></div><div className="mt-3 flex gap-2 border-t pt-3"><Button variant="ghost" size="sm" onClick={onReview}>{reviewed ? <CheckCircle2 className="mr-1 h-4 w-4" /> : null}{reviewed ? 'Reviewed' : 'Mark reviewed'}</Button>{mode === 'expert' && <Button variant="ghost" size="sm" onClick={onSuppress}>Suppress false positive</Button>}</div></CardContent></Card>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-xs text-foreground"><option value="all">All {label.toLowerCase()}s</option>{options.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function SummaryCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }
function MetricCard({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>; }
function SectionHeading({ title, description }: { title: string; description: string }) { return <div className="mb-4"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline">{children}<ChevronRight className="h-3 w-3" /></button>; }
function EmptyState({ text }: { text: string }) { return <Card><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Braces className="h-5 w-5" /><span>{text}</span></CardContent></Card>; }
function SoftStatusBadge({ status }: { status: SoftStatus }) { const variant = status === 'Review required' ? 'destructive' : status === 'Confirmed' ? 'secondary' : 'outline'; return <Badge variant={variant} className="whitespace-nowrap text-[10px]">{status}</Badge>; }

function statusFromConfidence(confidence: number): SoftStatus { if (confidence >= 90) return 'Confirmed'; if (confidence >= 70) return 'Likely'; if (confidence >= 45) return 'Possible'; return confidence > 0 ? 'Not enough evidence' : 'Not applicable'; }
function projectConfidence(report: AnalysisResult): number { const values = Object.values(report.stack.confidence ?? {}).filter((value): value is number => typeof value === 'number'); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0; }
function projectIdentity(report: AnalysisResult): string { const architecture = report.stack.architecture?.primary; const framework = isKnown(report.stack.framework) ? report.stack.framework : null; const language = report.stack.primaryLanguage ?? report.stack.language; return [architecture, framework, language].filter(Boolean).join(' · ') || report.classification.type; }
function readinessText(score: number, critical: number): string { if (critical) return 'Important issues need review'; if (score >= 90) return 'Ready with strong confidence'; if (score >= 75) return 'Mostly ready; review a few areas'; if (score >= 50) return 'Usable, but needs focused improvements'; return 'Significant review is recommended'; }
function isKnown(value: unknown): value is string { return typeof value === 'string' && value !== 'Unknown' && value !== 'None' && value.length > 0; }
function topActions(report: AnalysisResult): string[] { const source = [...report.issues].sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity])).map((item) => item.suggestedAction || item.recommendation).filter(Boolean); const moduleActions = Object.values(report.stack.extendedIntelligence?.modules ?? {}).flatMap((module) => module.findings.map((item) => item.recommendation)); const defaults = ['Confirm the detected project identity and target environment.', 'Review critical and warning findings before release.', 'Verify build and test commands in a clean environment.', 'Confirm browser, runtime, and deployment targets.', 'Record reviewed findings and accepted limitations.']; return [...new Set([...source, ...moduleActions, ...defaults])].slice(0, 5); }
function exportSelected(report: AnalysisResult, issues: Issue[]) { const payload = JSON.stringify({ reportId: report.id, exportedAt: new Date().toISOString(), issues }, null, 2); downloadFile(`${report.summary.name}-selected-findings.json`, payload, 'application/json'); }
function readMode(): UserMode { try { const saved = localStorage.getItem('uce-report-mode:v1'); if (saved === 'simple' || saved === 'developer' || saved === 'expert') return saved; } catch { /* private browsing */ } return 'simple'; }
