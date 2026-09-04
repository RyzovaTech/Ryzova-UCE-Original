import { cn } from '@/lib/utils';

interface UceLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showBeta?: boolean;
  className?: string;
}

export function UceLogo({ size = 'md', showText = true, showBeta = true, className }: UceLogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <img
        src="/uce-logo.svg"
        width={iconSize}
        height={iconSize}
        alt={showText ? 'UCE — Universal Compatibility Engine' : 'UCE'}
        className="block flex-shrink-0 rounded-lg bg-[#020718] object-contain"
      />

      {showText && (
        <div className="flex items-start gap-1.5">
          <span
            className="uppercase tracking-widest text-muted-foreground"
            style={{ fontSize: size === 'sm' ? 7 : size === 'lg' ? 10 : 8, letterSpacing: '0.12em' }}
          >
            Compatibility Engine
          </span>
          {showBeta && (
            <span className="mt-0.5 rounded border border-primary/30 bg-primary/10 px-1 py-px text-[8px] font-semibold leading-none tracking-[0.12em] text-primary">
              BETA
            </span>
          )}
        </div>
      )}
    </div>
  );
}
