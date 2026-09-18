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
  /** Degrees of arc the ring spans, gap centered at the bottom. Default 360
   * (full ring). 270 gives the Whoop-style open-arc look. */
  sweep?: number;
  children?: ReactNode;
}

// Same "percentage ring" path/viewBox trick already used by
// EnergyProgressCircle.tsx and TodayMedications.tsx: at r=15.9155 the
// circle's circumference is ~100 units, so strokeDasharray can take the
// percentage directly instead of computing 2*pi*r.
const RING_PATH =
  'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

const CENTER = 18;
const RADIUS = 15.9155;

/** Point on the ring at `deg` degrees clockwise from the top (12 o'clock). */
function pointOnRing(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.sin(rad),
    y: CENTER - RADIUS * Math.cos(rad),
  };
}

/** An open arc spanning `sweepDeg` degrees, gap centered at the bottom. */
function arcPath(sweepDeg: number) {
  const start = 360 - sweepDeg / 2;
  const end = start + sweepDeg;
  const p1 = pointOnRing(start);
  const p2 = pointOnRing(end);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 3,
  className,
  trackClassName,
  sweep = 360,
  children,
}: CircularProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const isFullRing = sweep >= 360;
  const trackPath = isFullRing ? RING_PATH : arcPath(sweep);
  // The full-ring path already has a ~100-unit circumference, so the
  // percentage dasharray trick above works directly. A partial arc's
  // length is shorter and proportional to its sweep.
  const arcLength = isFullRing ? 100 : (sweep / 360) * 100;
  const progressDash = (pct / 100) * arcLength;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 36 36"
        className={cn('h-full w-full', isFullRing && '-rotate-90')}
      >
        <path
          className={cn('text-muted', trackClassName)}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap={isFullRing ? 'butt' : 'round'}
          fill="none"
          d={trackPath}
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
          strokeDasharray={`${progressDash}, ${100 - progressDash + arcLength}`}
          d={trackPath}
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
