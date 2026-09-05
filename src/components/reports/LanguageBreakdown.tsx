import { Languages } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LanguageProfile } from '@/lib/analyzer/types';

interface LanguageBreakdownProps {
  languages?: LanguageProfile[];
  primaryLanguage?: string;
  mixedLanguage?: boolean;
}

export function LanguageBreakdown({ languages, primaryLanguage, mixedLanguage }: LanguageBreakdownProps) {
  const profiles = languages ?? [];

  if (profiles.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-4 w-4" />
              Language Breakdown
            </CardTitle>
            <CardDescription>
              {profiles.length} language{profiles.length !== 1 ? 's' : ''} detected by source-file size.
            </CardDescription>
          </div>
          {mixedLanguage && (
            <Badge variant="secondary" className="shrink-0 text-xs">Mixed language</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {profiles.map((profile) => {
            const isPrimary = profile.language === primaryLanguage;
            const percentage = Math.max(0, Math.min(100, profile.percentage));

            return (
              <div key={profile.language} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{profile.language}</span>
                    {isPrimary && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">Primary</Badge>
                    )}
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
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
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
