import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2, FileArchive, Github, Loader as Loader2, CirclePlay as PlayCircle, ShieldCheck, CloudUpload as UploadCloud, Circle as XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAnalyzer } from '@/hooks/useAnalyzer';
import { cn } from '@/lib/utils';
import type { AnalysisStage } from '@/lib/analyzer/types';

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: 'Waiting for project',
  uploading: 'Preparing project…',
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

export function AnalyzePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, analyzeFile, analyzeDemo, analyzeGithub, reset, cancel, isRunning } = useAnalyzer();
  const [dragOver, setDragOver] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
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

  const busy = state.stage !== 'idle' && state.stage !== 'error' && state.stage !== 'completed';

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyze Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a ZIP project or analyze a public GitHub repository. Compatibility checks run deterministically in your browser.
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
            GitHub URL
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
              aria-label="Upload a project ZIP archive. Press Enter or Space to browse files."
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
                  {dragOver ? 'Drop your project ZIP here' : 'Upload a project ZIP to analyze compatibility.'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag & drop a <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.zip</code> archive, or click to browse.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  node_modules, .git, and build output are skipped automatically
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
                Analyze a public GitHub repository
              </CardTitle>
              <CardDescription>
                Paste a public repository URL. UCE downloads its default branch, then runs the compatibility checks locally in your browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={busy}
                  className="font-mono text-sm"
                />
                <Button
                  disabled={busy || !githubUrl.trim()}
                  onClick={() => analyzeGithub(githubUrl).catch(() => undefined)}
                  className="gap-2"
                >
                  <Github className="h-4 w-4" />
                  Analyze
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Works with public repositories only. Repository contents are fetched directly from GitHub and are not sent to a UCE server.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Progress / states */}
      {(busy || state.stage === 'completed' || state.stage === 'error') && (
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
              {STAGE_LABELS[state.stage]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.stage === 'error' ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">{state.error}</p>
                  <p className="mt-1 text-muted-foreground">
                    Try a different ZIP or public GitHub repository, or run the demo to see UCE in action.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {STAGE_LABELS[state.stage]} — {state.progress}% complete
                </div>
                <Progress value={state.progress} className="h-2" aria-label="Analysis progress" />
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
              <Button variant="outline" onClick={reset} className="gap-2">
                Reset
              </Button>
            ) : busy ? (
              <Button variant="outline" onClick={cancel} className="gap-2">
                Cancel analysis
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
