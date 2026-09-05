import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Boxes, Languages, Layers, Package, Wrench, Cpu, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReportEngine } from '@/hooks/useReportEngine';
import { ReportPage } from './ReportPage';
import type { AnalysisResult } from '@/lib/analyzer/types';

export function ReportWithLanguageBreakdownPage() {
  const { history, getById } = useReportEngine();
  const [report, setReport] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const id = window.location.pathname.split('/').filter(Boolean)[1];
    setReport(id ? getById(id) : history[0]?.result ?? null);
  }, [history, getById]);

  const stack = report?.stack;
  const languages = stack?.languages ?? [];
  const primaryLanguage = stack?.primaryLanguage ?? stack?.language;
  const frameworks = stack
    ? (stack.frameworks ?? (stack.framework !== 'Unknown' ? [stack.framework] : []))
    : [];
  const runtimes = stack
    ? (stack.runtimes ?? (stack.runtime !== 'Unknown' ? [stack.runtime] : []))
    : [];

  return (
    <>
      {report && languages.length > 0 && (
        <Card className="mb-6 animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Languages className="h-4 w-4" />
                  Language Breakdown
                </CardTitle>
                <CardDescription>
                  {languages.length} language{languages.length !== 1 ? 's' : ''} detected by source-file size.
                </CardDescription>
              </div>
              {stack?.mixedLanguage && (
                <Badge variant="secondary" className="shrink-0 text-xs">Mixed language</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {languages.map((profile) => {
                const percentage = Math.max(0, Math.min(100, profile.percentage));
                const isPrimary = profile.language === primaryLanguage;
                return (
                  <div key={profile.language} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{profile.language}</span>
                        {isPrimary && <Badge variant="outline" className="shrink-0 text-[10px]">Primary</Badge>}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{profile.percentage}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`${profile.language} source share`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{profile.files.toLocaleString()} file{profile.files !== 1 ? 's' : ''}</span>
                      <span>{formatBytes(profile.bytes)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {report && (frameworks.length > 0 || runtimes.length > 0) && (
        <Card className="mb-6 animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              Technology Intelligence
            </CardTitle>
            <CardDescription>
              Multiple frameworks and runtimes detected from project dependencies, configuration and manifests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <TechnologyGroup icon={<Layers className="h-4 w-4" />} title="Frameworks" values={frameworks} primary={stack?.framework} />
              <TechnologyGroup icon={<Boxes className="h-4 w-4" />} title="Runtimes" values={runtimes} primary={stack?.runtime} />
              {stack && <TechnologyGroup icon={<Package className="h-4 w-4" />} title="Package Manager" values={[stack.packageManager]} />}
              {stack && <TechnologyGroup icon={<Wrench className="h-4 w-4" />} title="Build Tool" values={[stack.buildTool]} />}
              {stack && <TechnologyGroup icon={<Database className="h-4 w-4" />} title="Database" values={[stack.database]} />}
            </div>
          </CardContent>
        </Card>
      )}

      <ReportPage />
    </>
  );
}

function TechnologyGroup({
  icon,
  title,
  values,
  primary,
}: {
  icon: ReactNode;
  title: string;
  values: string[];
  primary?: string;
}) {
  const visible = values.filter((value, index) => value && value !== 'Unknown' && (index === 0 || value !== values[index - 1]));
  if (!visible.length) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-auto text-[10px]">{visible.length} detected</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((value) => (
          <Badge key={value} variant={value === primary ? 'default' : 'outline'}>
            {value}
            {value === primary && <span className="ml-1 text-[10px] opacity-80">Primary</span>}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
