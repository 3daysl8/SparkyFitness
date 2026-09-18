import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CircularProgress } from '@/components/ui/circular-progress';

export type MetricKey =
  'recovery' | 'workout' | 'sleep' | 'water' | 'fasting' | 'warning';

// Static map — Tailwind can't detect a dynamically built class name, so every
// metric's text/border classes must appear as literal strings somewhere.
const METRIC_TEXT: Record<MetricKey, string> = {
  recovery: 'text-metric-recovery',
  workout: 'text-metric-workout',
  sleep: 'text-metric-sleep',
  water: 'text-metric-water',
  fasting: 'text-metric-fasting',
  warning: 'text-status-moderate',
};
const METRIC_BG: Record<MetricKey, string> = {
  recovery: 'bg-metric-recovery',
  workout: 'bg-metric-workout',
  sleep: 'bg-metric-sleep',
  water: 'bg-metric-water',
  fasting: 'bg-metric-fasting',
  warning: 'bg-status-moderate',
};

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  /** 0-100; omit for a card with no ring. */
  progress?: number;
  metric?: MetricKey;
  /** Rendered centered inside the ring — only meaningful with `layout="tile"`. */
  icon?: LucideIcon;
  /** 'wide' (default): label+value left, ring right — for the vitals HUD and
   * standalone cards. 'tile': ring on top, centered — for a narrow grid cell
   * like the Home Workout/Water/Sleep row. */
  layout?: 'wide' | 'tile';
  onSelect?: () => void;
  /** Small pulsing dot in the corner — an "in progress / live" signal. */
  cornerIndicator?: boolean;
  /** Dashed border for an empty/CTA tile (e.g. "+ Start Workout"). */
  emptyBorder?: boolean;
  className?: string;
  /** Extra content below a hairline rule (wide layout) or below the label
   * (tile layout) — e.g. a weekly-goal chip. */
  children?: ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  progress,
  metric = 'recovery',
  icon: Icon,
  layout = 'wide',
  onSelect,
  cornerIndicator,
  emptyBorder,
  className,
  children,
}: MetricCardProps) {
  const Wrapper = onSelect ? 'button' : 'div';
  // An empty/CTA tile has no real data yet — accent colour is for data, so
  // this is the one place the ring/icon/value fall back to a neutral tone.
  const ringColor = emptyBorder ? 'text-muted-foreground' : METRIC_TEXT[metric];

  const ring = progress !== undefined && (
    <CircularProgress
      value={progress}
      size={layout === 'tile' ? 52 : 48}
      strokeWidth={4}
      className={ringColor}
      trackClassName="text-surface-2"
    >
      {Icon && <Icon className={cn('size-5', ringColor)} strokeWidth={1.5} />}
    </CircularProgress>
  );

  if (layout === 'tile') {
    return (
      <Wrapper
        onClick={onSelect}
        className={cn(
          'relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
          emptyBorder
            ? 'border-dashed border-border hover:bg-surface-2'
            : 'border-border bg-card',
          onSelect && !emptyBorder && 'hover:bg-surface-2',
          className
        )}
      >
        {cornerIndicator && (
          <span
            className={cn(
              'absolute right-2.5 top-2.5 size-2 animate-pulse rounded-full',
              METRIC_BG[metric]
            )}
          />
        )}
        {ring}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className={cn('metric-num truncate text-sm', ringColor)}>
            {value}
            {unit && (
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                {unit}
              </span>
            )}
          </p>
          {children}
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border border-border bg-card p-4 text-left transition-colors',
        onSelect && 'hover:bg-surface-2',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="metric-num text-3xl text-foreground">{value}</span>
            {unit && (
              <span className="text-sm font-medium text-muted-foreground">
                {unit}
              </span>
            )}
          </div>
        </div>
        {ring}
      </div>
      {children && (
        <div className="mt-3 border-t border-border pt-3">{children}</div>
      )}
    </Wrapper>
  );
}

export default MetricCard;
