import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2, FileArchive, GitBranch, Gitlab, Github, Loader as Loader2, CirclePlay as PlayCircle, ShieldCheck, CloudUpload as UploadCloud, Circle as XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAnalyzer } from '@/hooks/useAnalyzer';
import { cn, formatFileSize } from '@/lib/utils';
import type { AnalysisStage } from '@/lib/analyzer/types';
import { parseRepositoryUrl, type RepositoryProvider } from '@/lib/analyzer/repository';

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: 'Waiting for a project',
  uploading: 'Preparing project archive…',
  reading: 'Reading project structure…',
  detecting: 'Detecting technologies…',
  analyzing: 'Running compatibility rules…',
  scoring: 'Calculating compatibility score…',
  reporting: 'Generating report…',
  completed: 'Analysis complete',
  error: 'Analysis failed',
};

const STEPS: { stage: AnalysisStage; label: string; description: string }[] = [
  { stage: 'reading', label: 'Reading project', description: 'Extracting file tree' },
  { stage: 'detecting', label: 'Detecting technologies', description: 'Language, framework, runtime' },
  { stage: 'analyzing', label: 'Running compatibility rules', description: 'Deterministic checks' },
  { stage: 'scoring', label: 'Calculating score', description: 'Weighted categories' },
  { stage: 'reporting', label: 'Generating report', description: 'Assembling output' },
];

const ORDER: AnalysisStage[] = ['idle', 'uploading', 'reading', 'detecting', 'analyzing', 'scoring', 'reporting', 'completed'];

function stageIndex(stage: AnalysisStage): number {
  return ORDER.indexOf(stage);
}

const SUPPORTED_FORMATS = ['.zip'];

const REPOSITORY_PROVIDERS: {
  id: RepositoryProvider; label: string; placeholder: string; hint: string;
}[] = [
  { id: 'github', label: 'GitHub',
    placeholder: 'https://github.com/owner/repository',
    hint: 'Public GitHub repository · owner/repository' },
  { id: 'gitlab', label: 'GitLab',
    placeholder: 'https://gitlab.com/group/subgroup/repository',
    hint: 'Public GitLab repository · nested groups supported' },
  { id: 'codeberg', label: 'Codeberg',
    placeholder: 'https://codeberg.org/owner/repository',
    hint: 'Public Codeberg repository · owner/repository' },
];

export function AnalyzePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, analyzeFile, analyzeDemo, analyzeRepository, reset, cancel, resume, isRunning } = useAnalyzer();
  const [dragOver, setDragOver] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<RepositoryProvider>('github');
  const repositoryValidation = useMemo(() => {
    if (!repositoryUrl.trim()) return { repository: null, error: null };
    try { return { repository: parseRepositoryUrl(repositoryUrl), error: null }; }
    catch (e) { return { repository: null,
      error: e instanceof Error ? e.message : 'Enter a supported public repository URL.' }; }
  }, [repositoryUrl]);
  const activeProvider = repositoryValidation.repository?.provider ?? preferredProvider;
  const activeProviderInfo = REPOSITORY_PROVIDERS.find(provider => provider.id === activeProvider)!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigatedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      analyzeDemo().then((r) => {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigate(`/report/${r.id}`);
        }
      }).catch(() => undefined);
    }
  }, [searchParams, analyzeDemo, navigate]);

  useEffect(() => {
    if (state.stage === 'completed' && state.result && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate(`/report/${state.result.id}`);
    }
  }, [state.stage, state.result, navigate]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (isRunning) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.zip')) {
      alert('Unsupported file type. Please upload a .zip archive.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    navigatedRef.current = false;
    analyzeFile(file).catch(() => undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const selectProvider = (provider: RepositoryProvider) => {
    if (busy) return;
    setPreferredProvider(provider);
    if (repositoryUrl.trim() && repositoryValidation.repository?.provider !== provider) {
      setRepositoryUrl('');
    }
  };

  const submitRepository = () => {
    if (busy || !repositoryValidation.repository) return;
    navigatedRef.current = false;
    void analyzeRepository(repositoryUrl.trim()).catch(() => undefined);
  };

  const scanToDevice = async () => {
    if (!repositoryValidation.repository || busy) return;
    const picker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    if (!picker) return;
    // Picker must run directly from this click while user activation is present.
    const destination = await picker({ suggestedName: 'uce-repository.zip', types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
    await analyzeRepository(repositoryUrl, destination);
  };

  const busy = state.stage !== 'idle' && state.stage !== 'error' && state.stage !== 'completed';

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyze Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze a ZIP archive or a public GitHub, GitLab, or Codeberg repository using deterministic browser-based checks.
        </p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <UploadCloud className="h-4 w-4" />
            ZIP Upload
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-2">
            <Github className="h-4 w-4" />
            Git Repository
            <span className="rounded border border-primary/30 bg-primary/10 px-1 py-px text-[8px] font-semibold leading-none tracking-[0.12em] text-primary">
              BETA
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card
            className={cn(
              'border-2 transition-all',
              dragOver ? 'border-primary border-solid bg-primary/10 shadow-glow scale-[1.01]' : 'border-dashed',
              busy && 'opacity-60'
            )}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload project archive. Press Enter or Space to browse files."
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!busy) fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className="flex cursor-pointer flex-col items-center justify-center gap-4 px-6 py-14 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full transition-colors',
                  dragOver ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary'
                )}
              >
                <FileArchive className={cn('h-7 w-7 transition-transform', dragOver && 'scale-110')} />
              </div>
              <div>
                <p className="text-base font-medium">
                  {dragOver ? 'Drop your project here' : 'Upload your project to analyze compatibility.'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag & drop a <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.zip</code> archive, or click to browse.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No arbitrary 50 MB cutoff · large projects are safely sampled · device memory still applies
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Choose file
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    navigatedRef.current = false;
                    analyzeDemo().then((r) => navigate(`/report/${r.id}`)).catch(() => undefined);
                  }}
                  className="gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  Run demo
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
              />
            </div>
          </Card>

          {/* Supported formats strip */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Supported:</span>
            {SUPPORTED_FORMATS.map((f) => (
              <span key={f} className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {f}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-success" />
              100% local — no upload to any server
            </span>
          </div>
        </TabsContent>

        <TabsContent value="github" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Git Repository Analysis
                <span className="rounded border border-primary/30 bg-primary/10 px-1 py-px text-[8px] font-semibold leading-none tracking-[0.12em] text-primary">
                  BETA
                </span>
              </CardTitle>
              <CardDescription>
                Paste a public GitHub, GitLab, or Codeberg repository root URL (or supported Git remote). UCE downloads its default branch and analyzes structure, manifests, dependencies, lockfiles, configuration, runtimes, and compatibility risks in your browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="group" aria-label="Repository provider" className="space-y-2">
                <p className="text-sm font-medium">Choose a Git provider</p>
                <div className="grid grid-cols-3 gap-2">
                  {REPOSITORY_PROVIDERS.map(({ id, label }) => (
                    <Button key={id} type="button" size="sm"
                      variant={activeProvider === id ? 'default' : 'outline'}
                      aria-pressed={activeProvider === id} disabled={busy}
                      onClick={() => selectProvider(id)}
                      className="min-w-0 gap-2 px-2 sm:px-3">
                      {id === 'github' ? <Github aria-hidden="true" className="h-4 w-4 shrink-0" /> :
                        id === 'gitlab' ? <Gitlab aria-hidden="true" className="h-4 w-4 shrink-0" /> :
                          <GitBranch aria-hidden="true" className="h-4 w-4 shrink-0" />}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); submitRepository(); }} className="space-y-2">
                <label htmlFor="uce-repository-url" className="block text-sm font-medium">Public repository URL</label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <Input id="uce-repository-url" name="repository-url"
                    placeholder={activeProviderInfo.placeholder} value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                    autoComplete="url" inputMode="url" spellCheck={false}
                    aria-invalid={Boolean(repositoryValidation.error)}
                    aria-describedby="repository-provider-help repository-url-validation"
                    disabled={busy} className="min-w-0 flex-1 font-mono text-sm" />
                  <Button type="submit" disabled={busy || !repositoryValidation.repository}
                    className="gap-2 sm:shrink-0">
                    {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> :
                      <GitBranch aria-hidden="true" className="h-4 w-4" />}
                    Analyze repository
                  </Button>
                </div>
                <p id="repository-url-validation" aria-live="polite" className={cn(
                  'text-xs', repositoryValidation.error ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {repositoryValidation.error ?? (repositoryValidation.repository
                    ? '✓ Valid public ' + activeProviderInfo.label + ' repository URL — ready to analyze.'
                    : activeProviderInfo.hint)}
                </p>
              </form>
              {'showSaveFilePicker' in window ?
                <Button type="button" variant="outline"
                  disabled={busy || !repositoryValidation.repository}
                  onClick={() => scanToDevice().catch((error) => {
                    if (error instanceof DOMException && error.name === 'AbortError') return;
                    toast.error(error instanceof Error ? error.message : 'Could not save the archive.');
                  })}>
                  Choose download location and analyze
                </Button> : null}
              <div id="repository-provider-help" className="space-y-1 text-xs text-muted-foreground">
                <p><strong>Public repositories only.</strong> Paste a repository root URL, not a branch, issue, or file link. The default branch is analyzed.</p>
                <p>UCE downloads public archives through a fixed-provider relay. Compatibility rules run locally in your browser; source code is not retained by the relay.</p>
                <p>Large archives can use device storage where supported. ZIP indexing uses 32 KB slices; existing browser safety and sampling budgets still apply.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Progress / states */}
      {(busy || state.stage === 'completed' || state.stage === 'error' || state.canResume) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {state.stage === 'error' ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : state.stage === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {state.download ? 'Downloading repository…' : STAGE_LABELS[state.stage]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.stage === 'error' ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">{state.error}</p>
                  <p className="mt-1 text-muted-foreground">
                    Try a different archive, or run the demo to see UCE in action.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {state.download ? 'Downloading repository archive' : `${STAGE_LABELS[state.stage]} — ${state.progress}% complete`}
                </div>
                {state.download ? (
                  <div className="space-y-2" aria-label="Repository download status">
                    {state.download.totalBytes !== null ? (
                      <Progress value={Math.min(100, state.download.receivedBytes / state.download.totalBytes * 100)} className="h-2" aria-label="Repository download progress" />
                    ) : (
                      <div role="progressbar" aria-label="Repository download progress" aria-valuetext="Total size unknown" className="h-2 overflow-hidden rounded-full bg-primary/20">
                        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                      </div>
                    )}
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(state.download.receivedBytes)} downloaded{state.download.totalBytes !== null ? ` / ${formatFileSize(state.download.totalBytes)} (${Math.floor(Math.min(100, state.download.receivedBytes / state.download.totalBytes * 100))}%)` : ' · Total size unknown'}</span>
                      <span>{state.download.receivedBytes > 0 ? `${formatFileSize(state.download.bytesPerSecond)}/s average` : 'Waiting for data…'} · {Math.floor(state.download.elapsedSeconds)}s elapsed</span>
                    </div>
                  </div>
                ) : <Progress value={state.progress} className="h-2" aria-label="Analysis progress" />}
                {state.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null}
                {state.preview ? <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-4"><span><strong>Project:</strong> {state.preview.projectType}</span><span><strong>Language:</strong> {state.preview.language}</span><span><strong>Framework:</strong> {state.preview.framework}</span><span><strong>Runtime:</strong> {state.preview.runtime}</span></div> : null}
                <ol className="space-y-2.5">
                  {STEPS.map((s) => {
                    const idx = stageIndex(s.stage);
                    const current = stageIndex(state.stage);
                    const done = current > idx;
                    const active = current === idx;
                    return (
                      <li key={s.stage} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                            done
                              ? 'bg-success/15 text-success'
                              : active
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            s.label.charAt(0)
                          )}
                        </span>
                        <div className="flex-1">
                          <p className={cn(active ? 'font-medium' : 'text-muted-foreground')}>
                            {s.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {state.stage === 'error' ? (
              <div className="flex flex-wrap gap-2">
                {state.canResume ? <Button onClick={() => resume().catch(() => undefined)} className="gap-2">Resume analysis</Button> : null}
                <Button variant="outline" onClick={reset} className="gap-2">Reset</Button>
              </div>
            ) : busy ? (
              <Button variant="outline" onClick={cancel} className="gap-2">
                Cancel analysis
              </Button>
            ) : state.stage === 'idle' && state.canResume ? (
              <Button onClick={() => resume().catch(() => undefined)} className="gap-2">Resume analysis</Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
