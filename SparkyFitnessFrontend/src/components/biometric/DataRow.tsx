import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataRowProps {
  icon?: LucideIcon;
  label: ReactNode;
  sublabel?: ReactNode;
  value?: ReactNode;
  unit?: string;
  /** Visually completed rows get a struck-through label and a dimmer tone;
   * 'missed' tints the row toward the destructive/status-low accent. */
  state?: 'default' | 'complete' | 'missed';
  onSelect?: () => void;
  /** Trailing control — a checkbox, a Take/Undo button, a chevron. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The one flat "icon + label + value + action" row, replacing the same
 * pattern that used to be hand-rolled independently across
 * DailyCheckpointCard, HabitCard, SupplementsSnapshotCard, ToDoCard,
 * AgendaCard, TodayMedications, Medications' Cabinet list, ScheduleManager,
 * WaterIntake's drink log, ExerciseSearchListItem and WorkoutPlaybackSetRow —
 * each with its own drifting radius/padding/background-opacity string.
 *
 * Renders no card and no border of its own. The parent supplies separation
 * via `divide-y divide-border` (or its own `space-y-*` between rows) — that
 * is what keeps this from becoming another nested card.
 */
export function DataRow({
  icon: Icon,
  label,
  sublabel,
  value,
  unit,
  state = 'default',
  onSelect,
  trailing,
  className,
}: DataRowProps) {
  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 py-3 text-left',
        onSelect &&
          'transition-colors hover:bg-surface-2 rounded-lg px-2 -mx-2',
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'size-5 shrink-0',
            state === 'complete'
              ? 'text-metric-recovery'
              : state === 'missed'
                ? 'text-status-low'
                : 'text-muted-foreground'
          )}
          strokeWidth={1.5}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium text-foreground',
            state === 'complete' && 'text-muted-foreground line-through'
          )}
        >
          {label}
        </p>
        {sublabel && (
          <p className="truncate text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
      {value !== undefined && (
        <span className="metric-num shrink-0 text-sm text-foreground">
          {value}
          {unit && (
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </span>
      )}
      {trailing}
    </Wrapper>
  );
}

export default DataRow;
