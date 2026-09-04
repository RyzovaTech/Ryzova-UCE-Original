import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatFileSize } from '@/lib/utils';
import { CircleAlert as AlertCircle, Boxes, CircleCheck as CheckCircle2, Clock, Download, ChartBar as FileBarChart, FileJson, FileText, FolderTree, GitBranch, HardDrive, Layers, Package, Terminal, CloudUpload as UploadCloud, Wrench, FolderArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReportEngine } from '@/hooks/useReportEngine';
import { ScoreRing, scoreStatus, CategoryBar } from '@/components/reports/ScoreRing';
import { SeverityBadge } from '@/components/reports/SeverityBadge';
import { exportJson, exportMarkdown, downloadFile } from '@/lib/report/export';
import { sortIssues } from '@/lib/compatibility/recommendations';
import type { AnalysisResult, Issue, Severity } from '@/lib/analyzer/types';

const SEVERITY_FILTERS: Array<'all' | Severity> = ['all', 'critical', 'warning', 'info'];
type SortBy = 'severity' | 'category' | 'file';

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'border-l-destructive',
  warning: 'border-l-warning',
  info: 'border-l-info',
};

export function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, getById } = useReportEngine();
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [sortBy, setSortBy] = useState<SortBy>('severity');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    if (id) {
      const r = getById(id);
      setReport(r);
    } else {
      setReport(history[0]?.result ?? null);
    }
  }, [id, history, getById]);

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    const list = filter === 'all' ? report.issues : report.issues.filter((i) => i.severity === filter);
    return sortIssues(list, sortBy);
  }, [report, filter, sortBy]);

  const issueCounts = useMemo(() => {
    if (!report) return { critical: 0, warning: 0, info: 0 };
    return {
      critical: report.issues.filter((i) => i.severity === 'critical').length,
      warning: report.issues.filter((i) => i.severity === 'warning').length,
      info: report.issues.filter((i) => i.severity === 'info').length,
    };
  }, [report]);

  const stackItems = useMemo(() => {
    if (!report) return [];
    return [
      { icon: Terminal, label: 'Language', value: report.stack.language },
      { icon: Layers, label: 'Framework', value: report.stack.framework },
      { icon: Boxes, label: 'Runtime', value: report.stack.runtime },
      { icon: Package, label: 'Package Manager', value: report.stack.packageManager },
      { icon: Wrench, label: 'Build Tool', value: report.stack.buildTool },
      { icon: GitBranch, label: 'Frontend', value: report.stack.frontend },
      { icon: GitBranch, label: 'Backend', value: report.stack.backend },
      { icon: Layers, label: 'Database', value: report.stack.database },
    ];
  }, [report?.stack]);

  if (!report) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compatibility Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {id ? 'Report not found in local history.' : 'No analysis has been run yet.'}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileBarChart className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No report available</p>
              <p className="text-xs text-muted-foreground">
                {id ? 'This report may have been cleared from local storage.' : 'Run an analysis to generate a report.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/report')}>
                Browse reports
              </Button>
              <Button onClick={() => navigate('/analyze')} className="gap-2">
                <UploadCloud className="h-4 w-4" />
                Analyze a project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = scoreStatus(report.score.overall);
  const isSoftware = report.classification?.isSoftware ?? true;
  const projectType = report.classification?.type ?? 'Software Project';

  const onExportJson = () => downloadFile(`${report.summary.name}-uce-report.json`, exportJson(report), 'application/json');
  const onExportMd = () => downloadFile(`${report.summary.name}-uce-report.md`, exportMarkdown(report), 'text/markdown');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{report.summary.name}</h1>
            <Badge variant="outline" className="gap-1.5">
              <FolderArchive className="h-3 w-3" />
              {projectType}
            </Badge>
            {isSoftware && (
              <Badge variant="outline" className={status.text}>{status.label}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Report ID <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{report.id}</code> ·
            Generated {new Date(report.createdAt).toLocaleString()} · Engine {report.analysisVersion}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExportJson} className="gap-2">
            <FileJson className="h-4 w-4" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={onExportMd} className="gap-2">
            <FileText className="h-4 w-4" />
            Markdown
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-2">
            <Download className="h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Score + Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Compatibility Health</CardTitle>
            <CardDescription>
              {isSoftware ? 'Overall compatibility score.' : 'Not applicable for this project type.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            {isSoftware ? (
              <ScoreRing score={report.score.overall} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-muted-foreground/20">
                  <span className="text-2xl font-bold text-muted-foreground">N/A</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Not Applicable</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Compatibility scoring is only available for software engineering projects.
                </p>
              </div>
            )}
            {isSoftware && (
              <div className="w-full space-y-2.5">
                {report.categories.map((c) => (
                  <CategoryBar key={c.id} score={c.score} label={c.label} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Project Overview</CardTitle>
            <CardDescription>Detected technology stack.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stackItems.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-md border bg-muted/50 p-3 transition-colors hover:bg-muted/80">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {s.label}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium" title={String(s.value)}>{s.value}</p>
                  </div>
                );
              })}
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Files scanned" value={report.summary.filesScanned} />
              <Stat label="Folders scanned" value={report.summary.foldersScanned} />
              <Stat label="Config files" value={report.summary.detectedConfigFiles.length} />
              <Stat label="Issues found" value={report.issues.length} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan Statistics */}
      {report.summary.scanStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Scan Statistics
            </CardTitle>
            <CardDescription>Project size and file analysis breakdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Project Size" value={formatFileSize(report.summary.scanStats.projectSize)} />
              <Stat label="Files Found" value={report.summary.scanStats.filesFound.toLocaleString()} />
              <Stat label="Files Analyzed" value={report.summary.scanStats.filesAnalyzed.toLocaleString()} />
              <Stat label="Files Ignored" value={report.summary.scanStats.filesIgnored.toLocaleString()} />
            </div>
            {(report.summary.scanStats.scanTimeMs !== undefined ||
              report.summary.scanStats.memoryUsedMB !== undefined ||
              report.summary.scanStats.rulesExecuted !== undefined ||
              report.summary.scanStats.zipSize !== undefined) && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {report.summary.scanStats.scanTimeMs !== undefined && (
                    <Stat label="Scan Time" value={`${report.summary.scanStats.scanTimeMs}ms`} />
                  )}
                  {report.summary.scanStats.memoryUsedMB !== undefined && (
                    <Stat label="Memory Used" value={`${report.summary.scanStats.memoryUsedMB}MB`} />
                  )}
                  {report.summary.scanStats.rulesExecuted !== undefined && (
                    <Stat label="Rules Executed" value={report.summary.scanStats.rulesExecuted.toLocaleString()} />
                  )}
                  {report.summary.scanStats.zipSize !== undefined && (
                    <Stat label="ZIP Size" value={formatFileSize(report.summary.scanStats.zipSize)} />
                  )}
                </div>
              </>
            )}
            {report.stack.confidence && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Detection Confidence</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      { label: 'Language', value: report.stack.confidence.language },
                      { label: 'Framework', value: report.stack.confidence.framework },
                      { label: 'Runtime', value: report.stack.confidence.runtime },
                      { label: 'Package Mgr', value: report.stack.confidence.packageManager },
                      { label: 'Build Tool', value: report.stack.confidence.buildTool },
                    ].map((c) => (
                      <div key={c.label} className="rounded-md border bg-muted/50 p-2">
                        <p className="text-[11px] text-muted-foreground">{c.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{c.value}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {report.stack.monorepo && report.stack.monorepo !== 'None' && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Monorepo:</p>
                  <Badge variant="secondary" className="text-xs">{report.stack.monorepo}</Badge>
                </div>
              </>
            )}
            {report.stack.cloudProvider && report.stack.cloudProvider !== 'None' && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">Cloud Provider:</p>
                <Badge variant="secondary" className="text-xs">{report.stack.cloudProvider}</Badge>
              </div>
            )}
            {report.summary.scanStats.ignoredCategories.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Ignored Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.summary.scanStats.ignoredCategories.map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs font-mono">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-software notice */}
      {!isSoftware && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="flex items-start gap-3 py-5">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium">
                Project Type: <span className="font-semibold">{projectType}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                UCE detected this is not a software engineering project. Compatibility analysis requires source code and engineering files.
              </p>
              {report.classification?.reason && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Classification reason: {report.classification.reason}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issue center */}
      {isSoftware && (
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Issue Center</CardTitle>
            <CardDescription>{report.issues.length} issue{report.issues.length !== 1 ? 's' : ''} detected across {report.categories.length} categories.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="flex rounded-md border p-0.5">
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Sort: Severity</SelectItem>
                <SelectItem value="category">Sort: Category</SelectItem>
                <SelectItem value="file">Sort: File</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Issue count chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            <CountChip label="Critical" count={issueCounts.critical} severity="critical" />
            <CountChip label="Warning" count={issueCounts.warning} severity="warning" />
            <CountChip label="Info" count={issueCounts.info} severity="info" />
          </div>

          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium">No issues in this view</p>
              <p className="text-xs text-muted-foreground">
                {report.issues.length === 0 ? 'All deterministic checks passed.' : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredIssues.map((issue) => (
                <li key={issue.id}>
                  <button
                    onClick={() => setSelectedIssue(issue)}
                    className={`flex w-full items-start gap-3 border-l-2 ${SEVERITY_BORDER[issue.severity]} bg-card py-3 pl-3 pr-3 text-left hover:bg-muted/80 rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  >
                    <SeverityBadge severity={issue.severity} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{issue.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{issue.category}</span> · <span className="font-mono">{issue.affectedFile}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground no-print">View</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      )}

      {/* Detected files + timeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-4 w-4" />
              Detected Files
            </CardTitle>
            <CardDescription>Known configuration and manifest files.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.detectedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No known config files detected.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {report.detectedFiles.map((f) => (
                  <li key={f.path} className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 transition-colors hover:bg-muted/80">
                    <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs" title={f.path}>{f.path}</p>
                      <p className="text-[11px] text-muted-foreground">{f.purpose}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Analysis Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No timeline data available for this analysis.
              </p>
            ) : (
              <ol className="space-y-3">
                {report.timeline.map((t) => (
                  <li key={t.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {t.step}
                      </span>
                      {t.step < report.timeline.length && (
                        <span className="my-1 h-full w-px flex-1 bg-border" aria-hidden />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No specific recommendations for this analysis.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.notes.map((n, i) => (
                <li key={`note-${i}`} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Analysis completed by UCE Engine. Results are generated using deterministic compatibility rules.
          </p>
        </CardContent>
      </Card>

      {/* History list (only on /report without id) */}
      {!id && history.length > 1 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="text-base">Analysis History</CardTitle>
            <CardDescription>Recent reports stored locally.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {history.map((h) => {
                const s = scoreStatus(h.result.score.overall);
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => navigate(`/report/${h.id}`)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/80 -mx-2 px-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.result.summary.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={s.text}>{s.label}</Badge>
                        <span className="text-sm font-semibold tabular-nums">{h.result.score.overall}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Issue detail dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        <DialogContent className="max-w-lg">
          {selectedIssue && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selectedIssue.severity} />
                  <DialogDescription className="capitalize">
                    {selectedIssue.category} · {selectedIssue.affectedFile}
                  </DialogDescription>
                </div>
                <DialogTitle>{selectedIssue.title}</DialogTitle>
              </DialogHeader>
              <Separator />
              <dl className="space-y-3 text-sm">
                <DetailRow label="Problem" value={selectedIssue.description} />
                <DetailRow label="Why it matters" value={selectedIssue.reason} />
                {selectedIssue.detected && <DetailRow label="Detected" value={selectedIssue.detected} mono />}
                {selectedIssue.expected && <DetailRow label="Expected" value={selectedIssue.expected} mono />}
                {selectedIssue.impact && <DetailRow label="Impact" value={selectedIssue.impact} />}
                {selectedIssue.suggestedAction && <DetailRow label="Suggested Action" value={selectedIssue.suggestedAction} />}
                <DetailRow label="Recommendation" value={selectedIssue.recommendation} />
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CountChip({ label, count, severity }: { label: string; count: number; severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: 'border-destructive/30 bg-destructive/10 text-destructive',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-info/30 bg-info/10 text-info',
  };
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${styles[severity]}`}>
      <span className="tabular-nums text-base font-bold">{count}</span>
      {label}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
