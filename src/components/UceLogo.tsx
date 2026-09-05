import { cn } from '@/lib/utils';

interface UceLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function UceLogo({ size = 'md', showText = true, className }: UceLogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <img
        src="/uce-logo.svg"
        alt="UCE — Universal Compatibility Engine logo"
        className="shrink-0 rounded-lg"
        style={{
          width: iconSize,
          height: iconSize,
        }}
        role={showText ? undefined : 'img'}
        aria-label={!showText ? 'UCE — Universal Compatibility Engine' : undefined}
        aria-hidden={showText ? true : undefined}
      />

      {showText && (
        <div className="flex min-w-0 flex-col leading-none">
          <span
            className="font-bold tracking-tight text-foreground"
            style={{ fontSize: size === 'sm' ? 13 : size === 'lg' ? 18 : 15 }}
          >
            UCE
          </span>
          <span
            className="uppercase tracking-widest text-muted-foreground"
            style={{ fontSize: size === 'sm' ? 7 : size === 'lg' ? 10 : 8, letterSpacing: '0.12em' }}
          >
            Universal Compatibility Engine
          </span>
        </div>
      )}
    </div>
  );
}
