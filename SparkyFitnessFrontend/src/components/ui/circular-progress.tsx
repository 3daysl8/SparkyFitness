import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  /** 0-100. Values outside that range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Sets the indicator's stroke color via `currentColor` — pass a `text-*`
   * utility (e.g. `text-metric-water`). */
  className?: string;
  /** Overrides the track color, otherwise `text-muted`. */
  trackClassName?: string;
  children?: ReactNode;
}

// Same "percentage ring" path/viewBox trick already used by
// EnergyProgressCircle.tsx and TodayMedications.tsx: at r=15.9155 the
// circle's circumference is ~100 units, so strokeDasharray can take the
// percentage directly instead of computing 2*pi*r.
const RING_PATH =
  'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 3,
  className,
  trackClassName,
  children,
}: CircularProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <path
          className={cn('text-muted', trackClassName)}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          d={RING_PATH}
        />
        <path
          className={cn(
            'transition-[stroke-dasharray] duration-700 ease-out',
            className
          )}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${pct}, 100`}
          d={RING_PATH}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
