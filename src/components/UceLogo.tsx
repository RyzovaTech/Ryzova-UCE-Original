import { cn } from '@/lib/utils';

interface UceLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function UceLogo({ size = 'md', showText = true, className }: UceLogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const svgSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          width: iconSize,
          height: iconSize,
          background: 'linear-gradient(145deg, #1e3a5f 0%, #16304f 100%)',
          boxShadow: '0 2px 8px rgba(30,58,95,0.35)',
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="2.5" fill="white" />
          <circle cx="5" cy="7" r="2" fill="white" />
          <circle cx="19" cy="7" r="2" fill="white" />
          <circle cx="5" cy="17" r="2" fill="white" />
          <circle cx="19" cy="17" r="2" fill="white" />
          <line x1="10" y1="10.5" x2="6.7" y2="8.4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="14" y1="10.5" x2="17.3" y2="8.4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="10" y1="13.5" x2="6.7" y2="15.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="14" y1="13.5" x2="17.3" y2="15.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

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
