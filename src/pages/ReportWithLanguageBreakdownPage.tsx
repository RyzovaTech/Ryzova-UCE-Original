import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileBarChart, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phase4ReportWorkspace } from '@/components/reports/Phase4ReportWorkspace';
import { useReportEngine } from '@/hooks/useReportEngine';
import type { AnalysisResult } from '@/lib/analyzer/types';

export function ReportWithLanguageBreakdownPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, getById } = useReportEngine();
  const [report, setReport] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    setReport(id ? getById(id) : history[0]?.result ?? null);
  }, [id, history, getById]);

  if (report) return <Phase4ReportWorkspace report={report} />;

  return (
    <Card className="animate-slide-up">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileBarChart className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">No report available</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run an analysis to open the Phase 4 report workspace.</p>
        </div>
        <Button onClick={() => navigate('/analyze')} className="gap-2">
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          Analyze a project
        </Button>
      </CardContent>
    </Card>
  );
}
