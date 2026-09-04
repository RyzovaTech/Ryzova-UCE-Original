import { useState } from 'react';
import { Moon, Sun, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/useTheme';
import { useReportEngine } from '@/hooks/useReportEngine';
import { clearAllLocalData } from '@/lib/storage';

export function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { history, clear, refresh } = useReportEngine();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearAll = () => {
    clearAllLocalData();
    clear();
    refresh();
    setConfirmClear(false);
  };

  const handleExportData = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uce-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage preferences and local data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Toggle between light and dark mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggle} className="gap-2">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription>Export or clear locally stored analysis data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export Data</p>
              <p className="text-xs text-muted-foreground">
                Download all {history.length} report{history.length !== 1 ? 's' : ''} as JSON.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} className="gap-2" disabled={history.length === 0}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Clear All Data</p>
              <p className="text-xs text-muted-foreground">
                Remove all reports and settings from local storage.
              </p>
            </div>
            {confirmClear ? (
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleClearAll}>
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
          <CardDescription>UCE · v1.2.3</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>UCE performs deterministic, local-first compatibility analysis of software projects.</p>
          <p>No data leaves your browser. All analysis runs entirely client-side.</p>
        </CardContent>
      </Card>
    </div>
  );
}
