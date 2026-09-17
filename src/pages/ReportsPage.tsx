import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileBarChart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReportEngine } from '@/hooks/useReportEngine';
import { reportStatus } from '@/components/reports/ScoreRing';

export function ReportsPage() {
  const navigate = useNavigate();
  const { history, remove } = useReportEngine();

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">All compatibility reports stored in this browser.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileBarChart className="h-4 w-4" />Analysis History</CardTitle>
          <CardDescription>{history.length} saved report{history.length === 1 ? '' : 's'}.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileBarChart className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No reports yet. Analyze a project to create one.</p>
              <Button onClick={() => navigate('/analyze')}>Analyze a project</Button>
            </div>
          ) : (
            <ul className="divide-y">
              {history.map(({ id, createdAt, result }) => {
                const status = reportStatus(result.score.overall, result.issues.filter((issue) => issue.severity === 'critical').length, result.issues.filter((issue) => issue.severity === 'warning').length);
                return <li key={id} className="flex items-center gap-3 py-3">
                  <button onClick={() => navigate(`/report/${id}`)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold ${status.text}`}>{result.score.overall}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{result.summary.name}</span><span className="block text-xs text-muted-foreground">{new Date(createdAt).toLocaleString()} · {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}</span></span>
                    <Badge variant="outline" className={`ml-auto shrink-0 ${status.text}`}>{status.label}</Badge>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${result.summary.name} report`} onClick={() => remove(id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </li>;
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
