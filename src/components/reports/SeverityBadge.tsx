import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/analyzer/types';

const styles: Record<Severity, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/40',
  warning: 'bg-warning/15 text-warning border-warning/40',
  info: 'bg-info/15 text-info border-info/40',
};

const dotStyles: Record<Severity, string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

const labels: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant="outline" className={cn(styles[severity], 'gap-1.5', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[severity])} />
      {labels[severity]}
    </Badge>
  );
}
