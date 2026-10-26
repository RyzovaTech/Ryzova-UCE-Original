import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Phase5QualityPanel } from '@/components/reports/Phase5QualityPanel';
import { evaluateBrowserQuality } from '@/lib/report/phase5-quality';
import { downloadFile } from '@/lib/report/export';
import { buildUnifiedBrowserReport, type UnifiedBrowserFinding } from '@/lib/report/unified-intelligence';
import { makeDeveloperPatchRequest, validateBrowserEvidenceBundle,
  type BrowserEvidenceBundle } from '@/lib/report/phase5-patch-request';
import type { AnalysisResult } from '@/lib/analyzer/types';

function FindingDetail({ item, onSelectSource }: {
  item: UnifiedBrowserFinding; onSelectSource: (path: string) => void;
}) {
  return <div className="min-w-0 max-w-full space-y-2 rounded-lg border p-3" data-origin={item.origin}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={item.severity === 'critical' ? 'destructive' : 'outline'}>{item.severity}</Badge>
      <Badge variant="outline">Origin: {item.origin}</Badge>
      <Badge variant="outline">{item.contextOnly ? 'Context only' : 'Review finding'}</Badge>
      <Badge variant="outline">Evidence: {item.evidenceStatus.replace(/-/g, ' ')}</Badge>
      <Badge variant="outline">Formal verification: not run</Badge>
    </div>
    <h4 className="text-sm font-semibold">{item.title}</h4>
    <p className="text-xs text-muted-foreground">Evidence origin: {item.evidenceLevel.replace(/-/g, ' ')}. {item.evidence || 'No detailed source evidence retained.'}</p>
    <p className="text-xs text-muted-foreground"><span className="font-medium">Potential impact (unverified): </span>{item.potentialImpact}</p>
    {item.sourceIssueIds.length > 0 && <p className="break-all text-xs text-muted-foreground">Record provenance: {item.sourceIssueIds.map(id => (id.startsWith('trilogy:') ? 'Trilogy ' : 'UCE ') + id).join(' · ')}</p>}
    {item.recommendation && <p className="text-sm"><span className="font-medium">Next action: </span>{item.recommendation}</p>}
    <div className="flex flex-wrap gap-2">
      {item.sourceRefs.length ? item.sourceRefs.map(ref => <button key={ref} type="button"
        className="max-w-full break-all rounded border px-2 py-1 text-left text-xs text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelectSource(ref)} title={'Inspect source references at ' + ref}>{ref}</button>) :
        <span className="text-xs text-muted-foreground">Exact source path not available in this saved report.</span>}
    </div>
  </div>;
}

/** In-browser, read-only Phase 5 experiment. No hidden source uploads or native solver calls. */
export function UnifiedIntelligencePanel({ report }: { report: AnalysisResult }) {
  const model = useMemo(() => buildUnifiedBrowserReport(report), [report]);
  const quality = useMemo(() => evaluateBrowserQuality(report, model), [report, model]);
  const byId = useMemo(() => new Map(model.findings.map(f => [f.id, f])), [model]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [showAllUngrouped, setShowAllUngrouped] = useState(false);
  const [showOriginalIssues, setShowOriginalIssues] = useState(false);
  const [showAllOriginalIssues, setShowAllOriginalIssues] = useState(false);
  const [bundle, setBundle] = useState<BrowserEvidenceBundle | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [target, setTarget] = useState('');
  const [requestInput, setRequestInput] = useState<Awaited<ReturnType<typeof makeDeveloperPatchRequest>> | null>(null);
  const [message, setMessage] = useState('');
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [reviewApproved, setReviewApproved] = useState(false);
  // Independent revisions prevent late file reads or SHA-256 results from
  // resurrecting a stale source/target request after the developer changes it.
  const sourceRevision = useRef(0);
  const requestRevision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectSource = (path: string) => {
    setSelectedSource(path);
    document.getElementById('trilogy-source-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const resetEvidence = () => {
    sourceRevision.current++;
    requestRevision.current++;
    setBundle(null);
    setBundleName('');
    setTarget('');
    setRequestInput(null);
    setReviewApproved(false);
    setLoadingEvidence(false);
    setPreparing(false);
    setMessage('Local evidence cleared. No fix proposal was generated or applied.');
    if (fileInput.current) fileInput.current.value = '';
  };
  const loadBundle = async (selected?: File) => {
    const currentSource = ++sourceRevision.current;
    ++requestRevision.current;
    setRequestInput(null);
    setReviewApproved(false);
    setPreparing(false);
    setBundle(null);
    setBundleName('');
    setTarget('');
    setMessage('');
    setLoadingEvidence(!!selected);
    if (!selected) return;
    if (selected.size > 2500 * 1024) {
      setLoadingEvidence(false);
      setMessage('Local evidence JSON exceeds 2.5 MiB.');
      return;
    }
    try {
      const text = await selected.text();
      if (currentSource !== sourceRevision.current) return;
      const checked = validateBrowserEvidenceBundle(JSON.parse(text) as unknown);
      if (currentSource !== sourceRevision.current) return;
      setBundle(checked);
      setBundleName(selected.name);
      setMessage('Local evidence loaded into this view only. No upload or patch generation occurred.');
    } catch (error) {
      if (currentSource === sourceRevision.current) {
        setMessage(error instanceof Error ? error.message : 'Invalid local evidence JSON.');
      }
    } finally {
      if (currentSource === sourceRevision.current) setLoadingEvidence(false);
    }
  };
  const changeTarget = (value: string) => {
    ++requestRevision.current;
    setTarget(value);
    setRequestInput(null);
    setReviewApproved(false);
    setPreparing(false);
    setMessage('Target changed; a new explicit Generate request is required.');
  };
  const generate = async () => {
    // SHA-256 preparation is permitted ONLY after an explicit developer click.
    const currentRequest = ++requestRevision.current;
    setRequestInput(null);
    setReviewApproved(false);
    if (!bundle) {
      setMessage('Choose a local source evidence JSON file first.');
      return;
    }
    setPreparing(true);
    const requestedTarget = target.trim();
    try {
      const next = await makeDeveloperPatchRequest(bundle, requestedTarget);
      if (currentRequest !== requestRevision.current) return;
      setRequestInput(next);
      setMessage(next.note);
    } catch (error) {
      if (currentRequest === requestRevision.current) {
        setMessage(error instanceof Error ? error.message : 'Cannot prepare a safe proposal request.');
      }
    } finally {
      if (currentRequest === requestRevision.current) setPreparing(false);
    }
  };
  const matched = selectedSource ? model.findings.filter(f =>
    f.sourceRefs.includes(selectedSource) || f.file === selectedSource.split('#')[0]) : [];

  return <section className="min-w-0 w-full max-w-full space-y-4" aria-label="Experimental Unified Intelligence">
    <div>
      <h2 className="text-xl font-semibold">Unified Project Intelligence</h2>
      <p className="mt-1 text-sm text-foreground">Phase 5 experimental browser view · Root Cause First · Native UCE score and original issues unchanged</p>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Original UCE issues</p>
        <p className="text-2xl font-semibold tabular-nums">{model.originalIssueCount}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Investigation clusters</p>
        <p className="text-2xl font-semibold tabular-nums">{model.rootGroups.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Extra evidence / context</p>
        <p className="text-2xl font-semibold tabular-nums">{model.findings.filter(f => f.origin === 'Trilogy').length}</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Root Cause First — investigation clusters</CardTitle>
      <CardDescription>These group potentially related findings for review. They do not establish causality or a formal solver proof.</CardDescription></CardHeader>
      <CardContent className="min-w-0 space-y-3">
        {model.rootGroups.length === 0 && <p className="text-sm text-muted-foreground">No multiple-finding cluster is supported by the available report data. Individual findings remain visible below.</p>}
        {model.rootGroups.map(g => <div key={g.id} className="min-w-0 space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1"><h3 className="break-words text-sm font-semibold">{g.title}</h3>
              <p className="text-xs text-muted-foreground">{g.findingIds.length} linked review findings · {g.disclaimer}</p></div>
            <Button variant="outline" size="sm" aria-expanded={opened === g.id}
              onClick={() => setOpened(opened === g.id ? null : g.id)}>
              {opened === g.id ? 'Collapse evidence' : 'Inspect findings'}
            </Button>
          </div>
          <p className="text-sm">{g.recommendation}</p>
          {opened === g.id && <div className="space-y-2">
            {g.findingIds.map(id => byId.get(id)).filter((f): f is UnifiedBrowserFinding => !!f)
              .map(f => <FindingDetail key={f.id} item={f} onSelectSource={selectSource} />)}
          </div>}
        </div>)}
      </CardContent>
    </Card>
    <Phase5QualityPanel audit={quality} findings={model.findings} onSelectSource={selectSource} />
    <Card><CardHeader><CardTitle className="text-base">Other findings and framework context</CardTitle>
      <CardDescription>Ungrouped findings are never hidden. Framework detection is informational context, not a proven incompatibility.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {(showAllUngrouped ? model.ungroupedIds : model.ungroupedIds.slice(0, 100)).map(id => byId.get(id)).filter((f): f is UnifiedBrowserFinding => !!f)
          .map(f => <FindingDetail key={f.id} item={f} onSelectSource={selectSource} />)}
        {model.ungroupedIds.length > 100 && <Button variant="outline" size="sm" onClick={() => setShowAllUngrouped(v => !v)}>{showAllUngrouped ? 'Show first 100 findings' : 'Show all ' + model.ungroupedIds.length + ' ungrouped findings'}</Button>}
        {!model.ungroupedIds.length && <p className="text-sm text-muted-foreground">All current findings appear within investigation clusters above.</p>}
      </CardContent>
    </Card>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2">
      <div><CardTitle className="text-base">Original UCE issues — unchanged records</CardTitle>
        <CardDescription>Every raw original UCE issue stays accessible, even where workspace display deduplication applies. These are not rescored by Trilogy.</CardDescription></div>
      <Button variant="outline" size="sm" aria-expanded={showOriginalIssues} onClick={() => setShowOriginalIssues(v => !v)}>
        {showOriginalIssues ? 'Hide original issues' : 'Inspect original issues'}
      </Button>
    </div></CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Original issues: {model.originalIssues.length} · Unified workspace findings omitted by 1000-item display cap: {model.omittedWorkspaceFindings}</p>
        {showOriginalIssues && <>
          {(showAllOriginalIssues ? model.originalIssues : model.originalIssues.slice(0, 100)).map((issue, index) =>
            <div key={issue.id + ':' + index} className="space-y-1 rounded border p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{issue.severity}</Badge>
                <span className="font-semibold">{issue.title}</span></div>
              <p className="break-all text-muted-foreground">UCE record: {issue.id} · File: {issue.affectedFile || 'Not provided'}</p>
              <p className="text-muted-foreground">{issue.reason || 'No reason retained.'}</p>
            </div>)}
          {model.originalIssues.length > 100 && <Button variant="outline" size="sm"
            onClick={() => setShowAllOriginalIssues(v => !v)}>
            {showAllOriginalIssues ? 'Show first 100 original issues' : 'Show all ' + model.originalIssues.length + ' original issues'}
          </Button>}
        </>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle id="trilogy-source-evidence" className="text-base">Source evidence navigation</CardTitle>
      <CardDescription>Select a source reference from a finding to inspect linked report evidence; saved reports do not contain original source text.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {selectedSource ? <><div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{selectedSource}</code>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSource(null)}>Clear</Button></div>
          <p className="text-sm">{matched.length} report finding(s) refer to this source. Line fragments (#L...) locate saved report references only. Open the corresponding local project file to verify exact contents; no source bytes are reconstructed.</p>
          {matched.map(f => <p key={f.id} className="text-xs text-muted-foreground">{f.origin} · {f.title}: {f.evidence}</p>)}
        </> : <p className="text-sm text-muted-foreground">Select a file reference from the findings above.</p>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="text-base">Generate Fix Proposal — developer request only</CardTitle>
      <CardDescription>Prepare a source-hashed local CLI request only when you click Generate. No patch diff is created in the browser and no file is edited.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Supply your own local JSON evidence bundle (package.json, package-lock.json and exactly one literal .nvmrc/.node-version). The saved UCE report alone does not contain enough original bytes. Source data stays in this browser view unless you explicitly download it again.</p>
        <label className="block space-y-1 text-xs font-medium">Local evidence JSON (up to 2.5 MiB)
          <input ref={fileInput} type="file" accept=".json,application/json" className="block w-full rounded-md border p-2 text-sm"
            onChange={event => { void loadBundle(event.target.files?.[0]); }} />
        </label>
        {loadingEvidence && <p className="text-xs text-muted-foreground">Reading local evidence; no proposal requested.</p>}
        {bundleName && <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Local evidence: {bundleName}</p>
          <Button type="button" variant="outline" size="sm" onClick={resetEvidence}>Clear local evidence</Button>
        </div>}
        <label className="block space-y-1 text-xs font-medium">Developer-selected stable Node target (x.y.z)
          <Input value={target} onChange={event => changeTarget(event.target.value)} placeholder="22.0.0" />
        </label>
        <Button type="button" disabled={!bundle || !target.trim() || loadingEvidence || preparing} onClick={() => { void generate(); }}>
          {preparing ? 'Preparing local request…' : 'Generate Fix Proposal'}
        </Button>
        <p className="text-sm" role="status">{message || 'No patch request generated.'}</p>
        {requestInput && <div className="space-y-3 rounded-lg border p-3">
          <Badge variant="outline">Local CLI request prepared · Not verified</Badge>
          <p className="text-sm">This is a SHA-256-bound request, NOT a generated diff, solver proof or compatibility approval. The separate local CLI may block it.</p>
          <p className="text-xs">File: <code>{requestInput.review.targetFile}</code> · Current pin: <code>{requestInput.review.originalVersion}</code> · Selected target: <code>{requestInput.review.targetVersion}</code></p>
          <p className="break-all text-xs">Original source SHA-256: <code>{requestInput.review.sourceSha256}</code></p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify(requestInput.request, null, 2)}</pre>
          <h4 className="text-sm font-semibold">Change risks — manual review required</h4>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {requestInput.review.riskFactors.map(risk => <li key={risk}>{risk}</li>)}
          </ul>
          <h4 className="text-sm font-semibold">Developer verification checklist</h4>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            {requestInput.review.verificationChecklist.map(item => <li key={item}>{item}</li>)}
          </ol>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={reviewApproved}
              onChange={event => setReviewApproved(event.target.checked)} />
            <span>I reviewed the exact target, source hash and risks, and understand this download contains local source data. No patch has been generated or verified.</span>
          </label>
          <Button type="button" variant="outline" disabled={!reviewApproved}
            onClick={() => {
              if (!reviewApproved) return;
              downloadFile('trilogy-phase5-patch-input.json',
                JSON.stringify(requestInput.cliInput, null, 2), 'application/json');
            }}>
            Download reviewed local CLI input
          </Button>
          <p className="text-xs text-muted-foreground">This download contains the local source text you selected. Keep it private. In your trusted local checkout run:</p>
          <code className="block overflow-x-auto rounded border p-2 text-xs">node experiments/datalog-z3/phase5-cli.mjs propose trilogy-phase5-patch-input.json</code>
          <p className="text-xs text-muted-foreground">Only the separate Node CLI validates all modeled dependencies and can return a read-only proposed diff. You still need to review, apply manually and run builds/tests.</p>
        </div>}
      </CardContent>
    </Card>
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer text-sm font-medium">Scope and evidence limitations</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {model.limitations.map(x => <li key={x}>{x}</li>)}
        <li>No project code execution, native solver invocation, remote request or file write occurs in this browser component.</li>
      </ul>
    </details>
  </section>;
}