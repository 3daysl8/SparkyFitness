import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  dayOfWeek,
  orderedDaysOfWeek,
  todayInZone,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useTodayFocusSnapshot } from '@/hooks/useFocus';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import { useDailyHealthMetrics } from '@/hooks/useGenericHealth';
import { hasLoggedWorkout } from '@/utils/workoutSessionSummary';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import { ChevronLeft, ChevronRight, Dumbbell, Zap } from 'lucide-react';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Start-of-week day-string containing `date`, for a week that begins on
 * `firstDayOfWeek` (0 = Sunday .. 6 = Saturday) rather than always Sunday. */
function startOfWeekFor(date: string, firstDayOfWeek: number): string {
  const offset = (dayOfWeek(date) - firstDayOfWeek + 7) % 7;
  return addDays(date, -offset);
}

const DayPill = forwardRef<
  HTMLButtonElement,
  {
    day: string;
    label: string;
    selected: boolean;
    onSelect: (date: string) => void;
  }
>(function DayPill({ day, label, selected, onSelect }, ref) {
  const { activeUserId } = useActiveUser();
  const { data: snapshot } = useTodayFocusSnapshot(day);
  const { data: exerciseEntries = [] } = useExerciseEntries(
    day,
    activeUserId ?? undefined
  );
  const total =
    (snapshot?.scheduled.length ?? 0) + (snapshot?.daily_recurring.length ?? 0);
  const done =
    (snapshot?.scheduled.filter((f) => f.status === 'completed').length ?? 0) +
    (snapshot?.daily_recurring.filter((h) => h.done).length ?? 0);
  const dotState =
    total === 0
      ? 'none'
      : done === total
        ? 'full'
        : done > 0
          ? 'partial'
          : 'none';
  const hasWorkout = hasLoggedWorkout(exerciseEntries);

  return (
    <button
      ref={ref}
      onClick={() => onSelect(day)}
      className={cn(
        'flex min-w-[44px] flex-1 snap-center flex-col items-center gap-1 rounded-full py-2 text-sm transition-all duration-200',
        selected
          ? 'scale-105 bg-primary font-semibold text-primary-foreground'
          : 'text-muted-foreground hover:bg-surface-2'
      )}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="text-base leading-none">{Number(day.slice(8, 10))}</span>
      <span className="flex h-1.5 items-center gap-0.5">
        {hasWorkout && (
          <Dumbbell
            className={cn(
              'h-2.5 w-2.5',
              selected ? 'text-primary-foreground' : 'text-metric-workout'
            )}
          />
        )}
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            dotState === 'full' &&
              (selected ? 'bg-primary-foreground' : 'bg-metric-recovery'),
            dotState === 'partial' &&
              (selected ? 'bg-primary-foreground/50' : 'bg-metric-fasting'),
            dotState === 'none' && 'bg-transparent'
          )}
        />
      </span>
    </button>
  );
});

function WeekStrip({
  selectedDate,
  onSelect,
  firstDayOfWeek,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  firstDayOfWeek: number;
}) {
  const orderedDayIds = useMemo(
    () => orderedDaysOfWeek(firstDayOfWeek),
    [firstDayOfWeek]
  );
  const weekStart = useMemo(
    () => startOfWeekFor(selectedDate, firstDayOfWeek),
    [selectedDate, firstDayOfWeek]
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const selectedPillRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedPillRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selectedDate]);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 rounded-full"
        onClick={() => onSelect(addDays(selectedDate, -7))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto py-1">
        {days.map((day, idx) => {
          const selected = day === selectedDate;
          return (
            <DayPill
              key={day}
              ref={selected ? selectedPillRef : undefined}
              day={day}
              label={WEEKDAY_LABELS[orderedDayIds[idx] ?? 0] ?? ''}
              selected={selected}
              onSelect={onSelect}
            />
          );
        })}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 rounded-full"
        onClick={() => onSelect(addDays(selectedDate, 7))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function greetingKey(): { key: string; fallback: string } {
  const hour = new Date().getHours();
  if (hour < 5) return { key: 'home.greeting.night', fallback: 'Still up' };
  if (hour < 12)
    return { key: 'home.greeting.morning', fallback: 'Good morning' };
  if (hour < 18)
    return { key: 'home.greeting.afternoon', fallback: 'Good afternoon' };
  return { key: 'home.greeting.evening', fallback: 'Good evening' };
}

export default function DailyStatusHero({
  selectedDate,
  onSelectDate,
  firstDayOfWeek,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  firstDayOfWeek: number;
}) {
  const { t } = useTranslation();
  const { timezone, formatDate } = usePreferences();
  const { activeUserId } = useActiveUser();
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const isToday = selectedDate === todayIso;
  const greeting = greetingKey();

  // Same query key HabitCard/ToDoCard/FocusBanner/DailyCheckpointCard already
  // call for this date — a cache hit, not a new request. Habit/focus
  // completion is always available regardless of wearable connection, unlike
  // a Garmin-only readiness score, so it's the hero figure; readiness is
  // surfaced alongside it only when real data exists for the day.
  const { data: snapshot } = useTodayFocusSnapshot(selectedDate);
  const habits = snapshot?.daily_recurring ?? [];
  const scheduled = snapshot?.scheduled ?? [];
  const totalIntentions = habits.length + scheduled.length;
  const doneIntentions =
    habits.filter((h) => h.done).length +
    scheduled.filter((f) => f.status === 'completed').length;
  const focusPct =
    totalIntentions > 0
      ? Math.round((doneIntentions / totalIntentions) * 100)
      : 0;

  const { data: healthMetrics } = useDailyHealthMetrics(
    selectedDate,
    selectedDate,
    activeUserId ?? undefined
  );
  const readiness = healthMetrics?.[0]?.training_readiness_score ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {isToday
              ? t(greeting.key, greeting.fallback)
              : formatDate(selectedDate)}
          </p>
          {isToday && (
            <p className="metric-num text-lg text-foreground">
              {formatDate(selectedDate)}
            </p>
          )}
        </div>
        {readiness !== null && (
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1">
            <Zap className="size-3.5 text-metric-recovery" strokeWidth={1.5} />
            <span className="metric-num text-xs text-foreground">
              {readiness}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t('home.readiness', 'readiness')}
            </span>
          </div>
        )}
      </div>

      {totalIntentions > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <CircularProgress
            value={focusPct}
            size={72}
            strokeWidth={5}
            className="text-metric-recovery"
            trackClassName="text-surface-2"
          >
            <span className="metric-num text-xl text-foreground">
              {focusPct}%
            </span>
          </CircularProgress>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('home.todaysFocus', "Today's focus")}
            </p>
            <p className="metric-num text-2xl text-foreground">
              {doneIntentions}/{totalIntentions}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('home.intentionsComplete', 'intentions complete')}
            </p>
          </div>
        </div>
      )}

      <WeekStrip
        selectedDate={selectedDate}
        onSelect={onSelectDate}
        firstDayOfWeek={firstDayOfWeek}
      />
    </div>
  );
}
