import { cn } from '@/lib/utils';

export function scoreStatus(score: number): { label: string; text: string } {
  if (score >= 90) return { label: 'Excellent', text: 'text-success' };
  if (score >= 75) return { label: 'Good', text: 'text-primary' };
  if (score >= 50) return { label: 'Fair', text: 'text-warning' };
  return { label: 'Poor', text: 'text-destructive' };
}

export function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const status = scoreStatus(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-700', status.text)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-3xl font-bold tabular-nums', status.text)}>{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{status.label}</span>
      </div>
    </div>
  );
}

export function CategoryBar({ score, label }: { score: number; label: string }) {
  const status = scoreStatus(score);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-semibold tabular-nums', status.text)}>{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-700', status.text)}
          style={{ width: `${score}%`, backgroundColor: 'currentColor' }}
        />
      </div>
    </div>
  );
}
