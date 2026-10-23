import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { downloadFile } from '@/lib/report/export';
import { buildUnifiedBrowserReport, type UnifiedBrowserFinding } from '@/lib/report/unified-intelligence';
import { makeDeveloperPatchRequest, validateBrowserEvidenceBundle,
  type BrowserEvidenceBundle } from '@/lib/report/phase5-patch-request';
import type { AnalysisResult } from '@/lib/analyzer/types';

function FindingDetail({ item, onSelectSource }: {
  item: UnifiedBrowserFinding; onSelectSource: (path: string) => void;
}) {
  return <div className="space-y-2 rounded-lg border p-3" data-origin={item.origin}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={item.severity === 'critical' ? 'destructive' : 'outline'}>{item.severity}</Badge>
      <Badge variant="outline">Origin: {item.origin}</Badge>
      <Badge variant="outline">{item.contextOnly ? 'Context only' : 'Review finding'}</Badge>
      <Badge variant="outline">Not formally verified</Badge>
    </div>
    <h4 className="text-sm font-semibold">{item.title}</h4>
    <p className="text-xs text-muted-foreground">{item.evidenceLevel.replaceAll('-', ' ')}. {item.evidence || 'No detailed source evidence retained.'}</p>
    {item.recommendation && <p className="text-sm"><span className="font-medium">Next action: </span>{item.recommendation}</p>}
    <div className="flex flex-wrap gap-2">
      {item.sourceRefs.length ? item.sourceRefs.map(ref => <button key={ref} type="button"
        className="rounded border px-2 py-1 text-xs text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelectSource(ref)} title={'Inspect source references at ' + ref}>{ref}</button>) :
        <span className="text-xs text-muted-foreground">Exact source path not available in this saved report.</span>}
    </div>
  </div>;
}

/** In-browser, read-only Phase 5 experiment. No hidden source uploads or native solver calls. */
export function UnifiedIntelligencePanel({ report }: { report: AnalysisResult }) {
  const model = useMemo(() => buildUnifiedBrowserReport(report), [report]);
  const byId = useMemo(() => new Map(model.findings.map(f => [f.id, f])), [model]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [bundle, setBundle] = useState<BrowserEvidenceBundle | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [target, setTarget] = useState('22.0.0');
  const [requestInput, setRequestInput] = useState<Awaited<ReturnType<typeof makeDeveloperPatchRequest>> | null>(null);
  const [message, setMessage] = useState('');
  const selectSource = (path: string) => setSelectedSource(path);
  const loadBundle = async (selected?: File) => {
    setRequestInput(null);
    setBundle(null);
    setBundleName('');
    setMessage('');
    if (!selected) return;
    if (selected.size > 2500 * 1024) { setMessage('Local evidence JSON exceeds 2.5 MiB.'); return; }
    try {
      const checked = validateBrowserEvidenceBundle(JSON.parse(await selected.text()) as unknown);
      setBundle(checked);
      setBundleName(selected.name);
      setMessage('Local source evidence loaded into this view only. No upload or patch generation occurred.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid local evidence JSON.');
    }
  };
  const generate = async () => {
    // This branch executes ONLY in the developer's button click.
    setRequestInput(null);
    if (!bundle) { setMessage('Choose a local source evidence JSON file first.'); return; }
    try {
      const next = await makeDeveloperPatchRequest(bundle, target.trim());
      setRequestInput(next);
      setMessage(next.note);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cannot prepare a safe proposal request.');
    }
  };
  const matched = selectedSource ? model.findings.filter(f =>
    f.sourceRefs.includes(selectedSource) || f.file === selectedSource.split('#')[0]) : [];

  return <section className="space-y-4" aria-label="Experimental Unified Intelligence">
    <div>
      <h2 className="text-xl font-semibold">Unified Project Intelligence</h2>
      <p className="mt-1 text-sm text-muted-foreground">Phase 5 experimental browser view · Root Cause First · Native UCE score and original issues unchanged</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Original UCE issues</p>
        <p className="text-2xl font-semibold tabular-nums">{model.originalIssueCount}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Investigation clusters</p>
        <p className="text-2xl font-semibold tabular-nums">{model.rootGroups.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Extra evidence / context</p>
        <p className="text-2xl font-semibold tabular-nums">{model.findings.filter(f => f.origin === 'Trilogy').length}</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Root Cause First — investigation clusters</CardTitle>
      <CardDescription>These group potentially related findings for review. They do not establish causality or a formal solver proof.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {model.rootGroups.length === 0 && <p className="text-sm text-muted-foreground">No multiple-finding cluster is supported by the available report data. Individual findings remain visible below.</p>}
        {model.rootGroups.map(g => <div key={g.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1"><h3 className="text-sm font-semibold">{g.title}</h3>
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
    <Card><CardHeader><CardTitle className="text-base">Other findings and framework context</CardTitle>
      <CardDescription>Ungrouped findings are never hidden. Framework detection is informational context, not a proven incompatibility.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {model.ungroupedIds.slice(0, 100).map(id => byId.get(id)).filter((f): f is UnifiedBrowserFinding => !!f)
          .map(f => <FindingDetail key={f.id} item={f} onSelectSource={selectSource} />)}
        {model.ungroupedIds.length > 100 && <p className="text-xs text-muted-foreground">Display limited to 100 ungrouped items. Original UCE Issues view retains its own filters and exports.</p>}
        {!model.ungroupedIds.length && <p className="text-sm text-muted-foreground">All current findings appear within investigation clusters above.</p>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="text-base">Source evidence navigation</CardTitle>
      <CardDescription>Select a source reference from a finding to inspect linked report evidence; saved reports do not contain original source text.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {selectedSource ? <><div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{selectedSource}</code>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSource(null)}>Clear</Button></div>
          <p className="text-sm">{matched.length} report finding(s) refer to this source. Open the corresponding local project file to verify exact contents; no source bytes are reconstructed.</p>
          {matched.map(f => <p key={f.id} className="text-xs text-muted-foreground">{f.origin} · {f.title}: {f.evidence}</p>)}
        </> : <p className="text-sm text-muted-foreground">Select a file reference from the findings above.</p>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="text-base">Generate Fix Proposal — developer request only</CardTitle>
      <CardDescription>Prepare a source-hashed local CLI request only when you click Generate. No patch diff is created in the browser and no file is edited.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Supply your own local JSON evidence bundle (package.json, package-lock.json and exactly one literal .nvmrc/.node-version). The saved UCE report alone does not contain enough original bytes. Source data stays in this browser view unless you explicitly download it again.</p>
        <label className="block space-y-1 text-xs font-medium">Local evidence JSON (up to 2.5 MiB)
          <input type="file" accept=".json,application/json" className="block w-full rounded-md border p-2 text-sm"
            onChange={event => { void loadBundle(event.target.files?.[0]); }} />
        </label>
        {bundleName && <p className="text-xs text-muted-foreground">Local evidence: {bundleName}</p>}
        <label className="block space-y-1 text-xs font-medium">Developer-selected stable Node target (x.y.z)
          <Input value={target} onChange={event => { setTarget(event.target.value); setRequestInput(null); }} placeholder="22.0.0" />
        </label>
        <Button type="button" disabled={!bundle} onClick={() => { void generate(); }}>
          Generate Fix Proposal
        </Button>
        <p className="text-sm" role="status">{message || 'No patch request generated.'}</p>
        {requestInput && <div className="space-y-3 rounded-lg border p-3">
          <Badge variant="outline">Local CLI request prepared · Not verified</Badge>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify(requestInput.request, null, 2)}</pre>
          <Button variant="outline" onClick={() => downloadFile('trilogy-phase5-patch-input.json',
            JSON.stringify(requestInput.cliInput, null, 2), 'application/json')}>
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