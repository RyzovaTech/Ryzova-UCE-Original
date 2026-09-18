import { BrainCircuit, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { IntelligenceInsight } from '@/lib/analyzer/types';

export function IntelligenceInsightsPanel({ insights }: { insights?: IntelligenceInsight[] }) {
  if (!insights?.length) return null;
  return <Card className="mb-6 animate-slide-up"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4" aria-hidden="true" />Correlated Intelligence</CardTitle><CardDescription>Prioritized signals correlated across security, browser, dependency, architecture, quality, and testing analysis.</CardDescription></div><Badge variant="secondary">{insights.length} insights</Badge></div></CardHeader><CardContent className="space-y-3">{insights.slice(0, 8).map((insight) => <div key={insight.id} className="rounded-lg border bg-background p-3"><div className="flex flex-wrap items-center gap-2"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><span className="text-sm font-medium">{insight.title}</span><Badge variant={insight.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">{insight.severity}</Badge><Badge variant="secondary" className="text-[10px]">{insight.domain}</Badge><span className="ml-auto text-[10px] text-muted-foreground">{insight.confidence}% confidence</span></div><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{insight.evidence.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul><p className="mt-2 text-xs">Recommendation: {insight.recommendation}</p></div>)}</CardContent></Card>;
}
