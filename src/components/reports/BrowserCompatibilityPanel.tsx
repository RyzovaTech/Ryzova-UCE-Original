import { Globe2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { BrowserCompatibilityIntelligence } from '@/lib/analyzer/types';

interface BrowserCompatibilityPanelProps {
  data?: BrowserCompatibilityIntelligence;
}

export function BrowserCompatibilityPanel({ data }: BrowserCompatibilityPanelProps) {
  if (!data) return null;

  const status = data.score >= 95 ? 'Compatible' : data.score >= 80 ? 'Partial compatibility' : 'Compatibility issues';
  const statusIcon = data.findings.length === 0 ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-4 w-4" aria-hidden="true" />
          Browser Compatibility
        </CardTitle>
        <CardDescription>
          Web-platform compatibility checked against detected browser targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="mt-1 text-lg font-semibold">{data.score}%</p>
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              {statusIcon} {status}
            </p>
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Files scanned</p>
            <p className="mt-1 text-lg font-semibold">{data.filesScanned}</p>
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Features checked</p>
            <p className="mt-1 text-lg font-semibold">{data.featuresChecked}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Target browsers</p>
          <div className="flex flex-wrap gap-2">
            {data.targets.map((target) => (
              <Badge key={`${target.browser}-${target.version}`} variant="outline">
                {target.browser} {target.version}
              </Badge>
            ))}
          </div>
        </div>

        {data.findings.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Compatibility findings</p>
              {data.findings.map((finding, index) => (
                <div key={`${finding.file}-${finding.line}-${finding.feature}-${index}`} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{finding.kind}</Badge>
                      <span className="text-sm font-medium">{finding.feature}</span>
                    </div>
                    <Badge variant="destructive">Unsupported</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {finding.file}:{finding.line} · Affected: {finding.affectedBrowsers.join(', ')}
                  </p>
                  <p className="mt-2 text-sm">{finding.recommendation}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            No browser compatibility findings were detected for the selected targets.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
