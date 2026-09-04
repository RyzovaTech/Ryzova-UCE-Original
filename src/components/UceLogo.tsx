import { cn } from '@/lib/utils';

interface UceLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function UceLogo({ size = 'md', showText = true, className }: UceLogoProps) {
  const logoWidth = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src="/uce-logo.svg" alt="UCE — Universal Compatibility Engine" width={logoWidth} height={logoWidth} className="flex-shrink-0 rounded-lg" />

      {showText && (
        <div className="flex flex-col leading-none">
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
            Compatibility Engine
          </span>
        </div>
      )}
    </div>
  );
}
