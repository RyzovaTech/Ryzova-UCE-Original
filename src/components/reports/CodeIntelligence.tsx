import type { ReactNode } from 'react';
import { Boxes, GitBranch, ListChecks, Network, Route, Terminal, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CodeIntelligence } from '@/lib/analyzer/types';

export function CodeIntelligencePanel({ data }: { data?: CodeIntelligence }) {
  if (!data) return null;
  const areas = Object.entries(data.architectureAreas).filter(([, files]) => files.length > 0);
  const uniqueDependencyEdges = Array.from(
    new Map(data.dependencyEdges.map((edge) => [`${edge.from}|${edge.to}`, edge])).values(),
  );
  return (
    <Card className="mb-6 animate-slide-up">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" />Code Intelligence</CardTitle>
            <CardDescription>Static, deterministic code-structure analysis from the uploaded source tree. No external API or AI call.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">{data.filesAnalyzed} files</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Metric icon={<Boxes className="h-4 w-4" />} label="Symbols" value={data.symbols.length} />
          <Metric icon={<GitBranch className="h-4 w-4" />} label="Internal edges" value={uniqueDependencyEdges.length} />
          <Metric icon={<Route className="h-4 w-4" />} label="API endpoints" value={data.apiEndpoints.length} />
          <Metric icon={<Terminal className="h-4 w-4" />} label="Entry points" value={data.entryPoints.length} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4" />Architecture Map</div>
            <div className="space-y-2">{areas.map(([area, files]) => <div key={area} className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">{area}</span><Badge variant="outline">{files.length} files</Badge></div>)}</div>
            {data.entryPoints.length > 0 && <div className="mt-4 border-t pt-3"><div className="mb-2 text-[11px] font-medium text-muted-foreground">Entry points</div><div className="flex flex-wrap gap-1.5">{data.entryPoints.slice(0, 8).map((file) => <Badge key={file} variant="secondary" className="max-w-full truncate text-[10px]">{file}</Badge>)}</div></div>}
          </section>
          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Route className="h-4 w-4" />API Intelligence</div>
            {data.apiEndpoints.length ? <div className="space-y-2">{data.apiEndpoints.slice(0, 8).map((endpoint, index) => <div key={`${endpoint.method}-${endpoint.route}-${endpoint.file}-${index}`} className="flex items-center gap-2 text-xs"><Badge variant="outline" className="w-14 justify-center text-[10px]">{endpoint.method}</Badge><span className="truncate font-mono">{endpoint.route}</span><span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{endpoint.file}:{endpoint.line}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No recognizable route declarations found.</p>}
          </section>
        </div>
        <section className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" />Code Quality Signals</div>
          <div className="grid gap-3 sm:grid-cols-4"><Metric label="Large files" value={data.quality.largeFiles.length} /><Metric label="Large functions" value={data.quality.largeFunctions.length} /><Metric label="TODO" value={data.quality.todoCount} /><Metric label="FIXME" value={data.quality.fixmeCount} /></div>
          {data.quality.circularDependencies.length > 0 && <div className="mt-3 rounded-md border p-3 text-xs"><span className="font-medium">Circular dependencies:</span> {data.quality.circularDependencies.slice(0, 3).map((cycle) => cycle.join(' → ')).join(' · ')}</div>}
          {data.quality.largeFiles.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{data.quality.largeFiles.slice(0, 6).map((item) => <Badge key={item.file} variant="secondary" className="text-[10px]">{item.file} · {item.lines} lines</Badge>)}</div>}
        </section>
        <section className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 text-sm font-semibold">Dependency Graph</div>
          {uniqueDependencyEdges.length ? <div className="grid gap-1.5 max-h-52 overflow-auto">{uniqueDependencyEdges.slice(0, 40).map((edge) => <div key={`${edge.from}-${edge.to}`} className="flex gap-2 text-[11px] font-mono"><span className="truncate">{edge.from}</span><span className="text-muted-foreground">→</span><span className="truncate">{edge.to}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No internal relative import edges were detected.</p>}
        </section>
      </CardContent>
    </Card>
  );
}
function Metric({ icon, label, value }: { icon?: ReactNode; label: string; value: number }) {
  return <div className="rounded-md border bg-background p-2 text-center"><div className="flex items-center justify-center gap-1.5 text-base font-semibold tabular-nums">{icon}{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}
