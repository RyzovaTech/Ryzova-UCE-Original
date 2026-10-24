import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BrowserQualityAudit } from '@/lib/report/phase5-quality';
import type { UnifiedBrowserFinding } from '@/lib/report/unified-intelligence';

/**
 * Saved-report, read-only review UX. No source bytes, solver calls, code
 * execution or patch generation. Structural parity is not measured accuracy.
 */
export function Phase5QualityPanel({ audit, findings, onSelectSource }: {
  audit: BrowserQualityAudit;
  findings: UnifiedBrowserFinding[];
  onSelectSource: (path: string) => void;
}) {
  const [showReview, setShowReview] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const byId = new Map(findings.map(f => [f.id, f]));
  const s = audit.symbolic;
  return <Card aria-label="Phase 5.5 intelligence quality evaluation">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Intelligence quality &amp; symbolic reasoning</CardTitle>
          <CardDescription>Read-only checks of saved browser report records, not a real-world accuracy evaluation or solver run.</CardDescription>
        </div>
        <Badge variant="outline">
          {audit.status === 'passed-structural-checks' ? 'Structure consistent · not accuracy-verified' :
            audit.status === 'review-required' ? 'Structural review required' : 'Structural status unknown'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border p-3 text-xs">
          <p className="text-muted-foreground">UCE score parity</p>
          <p className="mt-1 font-semibold">{audit.scoreParity}</p>
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="text-muted-foreground">Raw UCE issue records</p>
          <p className="mt-1 font-semibold">{audit.originalIssueParity}</p>
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="text-muted-foreground">Review candidates</p>
          <p className="mt-1 font-semibold tabular-nums">{audit.counts.candidatesTotal} (not independently adjudicated)</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">UCE: {audit.counts.uce} · Trilogy: {audit.counts.trilogy} · Both: {audit.counts.both} · Context only: {audit.counts.contextOnly} · Trilogy references missing: {audit.counts.missingTrilogySources} · Workspace findings omitted: {audit.counts.omittedWorkspaceFindings}</p>
      <p className="text-xs font-medium">Human-evaluated false-positive, false-merge, useful-finding and recommendation-correctness rates: Not measured.</p>
      <div className="rounded-lg border p-3 space-y-2">
        <h4 className="text-sm font-semibold">Symbolic AI status — saved report evidence only</h4>
        <p className="text-xs text-muted-foreground">Original UCE bounded symbolic reasoner: {s.localStatus === 'recorded'
          ? 'recorded decisions (constraint model, not application proof)'
          : 'not available in saved report'}.</p>
        {s.localStatus === 'recorded' && <p className="text-xs">Conflict: {s.conflict} · Satisfiable: {s.satisfiable} · Unknown: {s.unknown} · Limited: {s.limited === null ? 'Unknown' : s.limited ? 'Yes' : 'No'}</p>}
        <p className="text-xs text-muted-foreground">Native Soufflé → Z3 → cvc5:
          {s.diagnosticSource === 'none' ? ' not run in this browser view; no saved diagnostic' :
            ' saved optional diagnostic only — ' + s.solverStatus +
            (s.solverVerification === 'reported-independent-smt-agreement'
              ? ' (reports independent SMT agreement; not rerun or authenticated here)'
              : ' (no reported independent solver agreement)')}.</p>
        <p className="text-xs text-muted-foreground">No browser scan launches native tools. A satisfiable constraint is not proof that install, build, tests or runtime will succeed.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" aria-expanded={showReview}
          onClick={() => setShowReview(v => !v)}>
          {showReview ? 'Hide review queue' : 'Inspect review candidates (' + audit.counts.candidatesTotal + ')'}
        </Button>
        <Button type="button" variant="outline" size="sm" aria-expanded={showFlags}
          onClick={() => setShowFlags(v => !v)}>
          {showFlags ? 'Hide structural flags' : 'Inspect structural flags (' + (audit.flags.length + audit.additionalFlagsOmitted) + ')'}
        </Button>
      </div>
      {showReview && <div className="space-y-2" aria-label="Review candidates">
        {audit.reviewQueue.length === 0 && <p className="text-xs text-muted-foreground">No additional browser-derived review candidates in this saved report. This is not a clean-project certification.</p>}
        {audit.reviewQueue.map(item => {
          const finding = byId.get(item.id);
          const source = finding?.sourceRefs.find(ref => item.evidence === 'source-reference' && ref.length > 0);
          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{finding?.title ?? item.id}</p>
              <p className="text-muted-foreground">{item.origin} · {item.severity} · {item.evidence === 'source-reference' ? 'saved source reference' : 'source review required'} · Human adjudication pending</p>
            </div>
            {source && <Button variant="ghost" size="sm" onClick={() => onSelectSource(source)}>
              Inspect evidence
            </Button>}
          </div>;
        })}
        {audit.counts.candidatesTotal > audit.counts.candidatesShown &&
          <p className="text-xs text-muted-foreground">Review queue displays the first {audit.counts.candidatesShown} prioritized candidates. {audit.counts.candidatesTotal - audit.counts.candidatesShown} more are not shown here; they remain available in the report findings.</p>}
      </div>}
      {showFlags && <div className="space-y-1" aria-label="Structural flags">
        {audit.flags.length === 0 && <p className="text-xs text-muted-foreground">No structural flags detected. Source truth and runtime behavior remain unverified.</p>}
        {audit.flags.map((flag, i) => <p key={i} className="break-all text-xs text-muted-foreground">
          {flag.code}{flag.findingId ? ' · ' + flag.findingId : ''}
        </p>)}
        {audit.additionalFlagsOmitted > 0 && <p className="text-xs text-muted-foreground">{audit.additionalFlagsOmitted} further flags omitted by the display budget.</p>}
      </div>}
      <details className="rounded border p-3">
        <summary className="cursor-pointer text-xs font-medium">What this evaluation cannot prove</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {audit.limitations.map(item => <li key={item}>{item}</li>)}
        </ul>
      </details>
    </CardContent>
  </Card>;
}
