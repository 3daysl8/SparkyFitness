import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  todayInZone,
  addDays,
  dayOfWeek,
  orderedDaysOfWeek,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useWaterContainer } from '@/contexts/WaterContainerContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Droplet,
  Moon,
  Plus,
} from 'lucide-react';
import { useTodayFocusSnapshot } from '@/hooks/useFocus';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import {
  usePlannedWorkoutDayView,
  useMovePlannedWorkoutMutation,
  useSkipPlannedWorkoutMutation,
} from '@/hooks/Exercises/usePlannedWorkouts';
import {
  useWaterIntakeQuery,
  useWaterGoalQuery,
  useUpdateWaterIntakeMutation,
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import { hasLoggedWorkout } from '@/utils/workoutSessionSummary';
import AgendaCard from '@/pages/Home/AgendaCard';
import ToDoCard from '@/pages/Home/ToDoCard';
import WorkoutCard from '@/pages/Home/WorkoutCard';
import HabitCard from '@/pages/Home/HabitCard';
import FocusBanner from '@/pages/Home/FocusBanner';
import DailyCheckpointCard from '@/pages/Home/DailyCheckpointCard';
import SupplementsSnapshotCard from '@/pages/Home/SupplementsSnapshotCard';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Start-of-week day-string containing `date`, for a week that begins on
 * `firstDayOfWeek` (0 = Sunday .. 6 = Saturday) rather than always Sunday.
 * Generalizes the old Sunday-only anchor so the strip can be reordered per
 * the user's preference — see orderedDaysOfWeek's own doc for why the
 * underlying data model still always treats 0 as Sunday. */
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
          ? 'scale-105 bg-primary font-semibold text-primary-foreground shadow-md'
          : 'text-muted-foreground hover:bg-muted'
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
              (selected ? 'bg-primary-foreground' : 'bg-emerald-500'),
            dotState === 'partial' &&
              (selected ? 'bg-primary-foreground/50' : 'bg-amber-400'),
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

function WaterCard({
  selectedDate,
  userId,
}: {
  selectedDate: string;
  userId?: string;
}) {
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  const { data: waterGoalMl = 1920 } = useWaterGoalQuery(selectedDate, userId);
  const { activeContainer } = useWaterContainer();
  const { mutate: updateWater, isPending } = useUpdateWaterIntakeMutation();

  const pct =
    waterGoalMl > 0 ? Math.min(100, (waterMl / waterGoalMl) * 100) : 0;

  const mlPerDrink = (() => {
    if (!activeContainer) return 250;
    const servings = Math.max(1, activeContainer.servings_per_container || 1);
    const hasVolumeOverride =
      !activeContainer.linked_food_id || activeContainer.volume > 0;
    return hasVolumeOverride ? activeContainer.volume / servings : 250;
  })();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId || isPending) return;
    updateWater({
      user_id: userId,
      entry_date: selectedDate,
      change_drinks: 1,
      container_id: activeContainer?.id ?? null,
    });
  };

  const cardClassName =
    'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors';

  return (
    <div
      className={cn(
        cardClassName,
        pct > 0
          ? 'border-metric-water/30 bg-metric-water/10'
          : 'border-dashed border-metric-water/40 bg-metric-water/5 hover:bg-metric-water/10'
      )}
    >
      <CircularProgress
        value={pct}
        size={52}
        strokeWidth={4}
        className="text-metric-water"
      >
        <Droplet className="h-5 w-5 text-metric-water" />
      </CircularProgress>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Water</p>
        <p className="text-sm font-semibold">{Math.round(pct)}%</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="h-6 gap-1 rounded-full px-2.5 text-[11px] bg-metric-water/15 text-foreground hover:bg-metric-water/25 border border-metric-water/20"
        onClick={handleQuickAdd}
        disabled={!userId || isPending}
      >
        <Plus className="h-3 w-3" /> {Math.round(mlPerDrink)}ml
      </Button>
    </div>
  );
}

function SleepCard({ selectedDate }: { selectedDate: string }) {
  const navigate = useNavigate();
  const { data: sleepEntries = [] } = useSleepEntriesQuery(
    selectedDate,
    selectedDate
  );
  const logged = sleepEntries.length > 0;
  const totalHours =
    sleepEntries.reduce((sum, e) => sum + (e.duration_in_seconds || 0), 0) /
    3600;

  return (
    <button
      onClick={() => navigate('/checkin?tab=sleep')}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors',
        logged
          ? 'border-metric-sleep/30 bg-metric-sleep/10'
          : 'border-dashed border-metric-sleep/40 bg-metric-sleep/5 hover:bg-metric-sleep/10'
      )}
    >
      <CircularProgress
        value={logged ? 100 : 0}
        size={52}
        strokeWidth={4}
        className="text-metric-sleep"
      >
        <Moon
          className={cn(
            'h-5 w-5',
            logged ? 'text-metric-sleep' : 'text-metric-sleep/70'
          )}
        />
      </CircularProgress>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Sleep</p>
        <p
          className={cn('text-sm font-semibold', logged && 'text-metric-sleep')}
        >
          {logged ? `${totalHours.toFixed(1)}h logged` : 'Tap to log'}
        </p>
      </div>
    </button>
  );
}

function MetricCards({ selectedDate }: { selectedDate: string }) {
  const { activeUserId } = useActiveUser();
  const userId = activeUserId ?? undefined;
  return (
    <div className="grid grid-cols-3 gap-2">
      <WorkoutCard selectedDate={selectedDate} />
      <WaterCard selectedDate={selectedDate} userId={userId} />
      <SleepCard selectedDate={selectedDate} />
    </div>
  );
}

function MissedWorkoutsNudge({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();
  const { timezone, formatDate } = usePreferences();
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const isToday = selectedDate === todayIso;
  const { data: dayView } = usePlannedWorkoutDayView(
    selectedDate,
    activeUserId ?? undefined
  );
  const moveMutation = useMovePlannedWorkoutMutation();
  const skipMutation = useSkipPlannedWorkoutMutation();

  const missed = dayView?.missed ?? [];
  if (!isToday || missed.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          {t('exercise.workoutCard.missedTitle', {
            count: missed.length,
            defaultValue: '{{count}} missed workouts',
          })}
        </div>
        {missed.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 p-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(row.planned_date)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  moveMutation.mutate({
                    id: row.id,
                    data: { planned_date: todayIso },
                  })
                }
                disabled={moveMutation.isPending || skipMutation.isPending}
              >
                {t('exercise.workoutCard.moveToToday', 'Move to today')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => skipMutation.mutate(row.id)}
                disabled={moveMutation.isPending || skipMutation.isPending}
              >
                {t('exercise.workoutCard.skip', 'Skip')}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function HomeChecklist() {
  const { timezone, firstDayOfWeek } = usePreferences();
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Roll selectedDate forward at the user's local midnight, but only while
  // they're still viewing "today"
  const lastKnownTodayRef = useRef(todayIso);
  const checkMidnightRollover = useCallback(() => {
    const currentToday = todayInZone(timezone);
    if (currentToday === lastKnownTodayRef.current) {
      return;
    }
    const previousToday = lastKnownTodayRef.current;
    lastKnownTodayRef.current = currentToday;
    setSelectedDate((current) =>
      current === previousToday ? currentToday : current
    );
  }, [timezone]);

  useEffect(() => {
    checkMidnightRollover();
    const interval = window.setInterval(checkMidnightRollover, 60000);
    document.addEventListener('visibilitychange', checkMidnightRollover);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkMidnightRollover);
    };
  }, [checkMidnightRollover]);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Date Navigation */}
      <WeekStrip
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        firstDayOfWeek={firstDayOfWeek}
      />

      {/* 2. Focus & Vision Reminder Banner */}
      <FocusBanner selectedDate={selectedDate} />

      {/* 3. Metric Tiles & Missed Workout Alerts */}
      <MetricCards selectedDate={selectedDate} />
      <MissedWorkoutsNudge selectedDate={selectedDate} />

      {/* 4. Daily Accountability Checkpoint */}
      <DailyCheckpointCard selectedDate={selectedDate} />

      {/* 5. Schedule & Calendar Events */}
      <AgendaCard selectedDate={selectedDate} />

      {/* 6. Today's Supplements & Protocols */}
      <SupplementsSnapshotCard selectedDate={selectedDate} />

      {/* 7. Actionable Tasks (To-Do List) */}
      <ToDoCard selectedDate={selectedDate} />

      {/* 8. Daily Habits & Streaks */}
      <div id="home-habits-section">
        <HabitCard selectedDate={selectedDate} />
      </div>
    </div>
  );
}
