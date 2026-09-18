import { AlertTriangle, Brain, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExtendedIntelligence, IntelligenceModuleFinding } from '@/lib/analyzer/types';

const severityOrder = { critical: 0, warning: 1, info: 2 } as const;

export function ExtendedIntelligencePanel({ data }: { data?: ExtendedIntelligence }) {
  if (!data) return null;

  const modules = Object.values(data.modules);
  const findings = modules
    .flatMap((module) => module.findings.map((item) => ({ ...item, module: module.label })))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.confidence - a.confidence)
    .slice(0, 8);

  return (
    <Card className="mb-6 animate-slide-up">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" aria-hidden="true" />
              Intelligence Coverage 3.5
            </CardTitle>
            <CardDescription>Fourteen evidence-backed project intelligence modules summarized progressively.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{modules.length} modules</Badge>
            <Badge variant={data.overallScore < 70 ? 'destructive' : 'outline'}>{data.overallScore}% combined</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((module) => (
            <div key={module.id} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{module.label}</span>
                {module.status === 'healthy' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-label="Healthy" />
                ) : (
                  <Badge variant={module.status === 'risk' ? 'destructive' : 'outline'} className="text-[10px]">
                    {module.status}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-xl font-semibold tabular-nums">{module.score}%</span>
                <span className="text-[10px] text-muted-foreground">{module.findings.length} findings</span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{module.summary}</p>
            </div>
          ))}
        </div>

        {findings.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Priority findings</h3>
            <div className="space-y-2">
              {findings.map((item, index) => (
                <FindingRow
                  key={`${item.module}-${item.id}-${item.file ?? ''}-${item.line ?? 0}-${index}`}
                  finding={item}
                  module={item.module}
                />
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding, module }: { finding: IntelligenceModuleFinding; module: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">{finding.title}</span>
        <Badge variant={finding.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
          {finding.severity}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">{module}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">{finding.confidence}% confidence</span>
      </div>
      {finding.file && (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {finding.file}{finding.line ? `:${finding.line}` : ''}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{finding.evidence}</p>
      <p className="mt-1 text-xs">Recommendation: {finding.recommendation}</p>
    </div>
  );
}
