import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  todayInZone,
  addDays,
  dayOfWeek,
  getDueDosesForDate,
  formatDose,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useWaterContainer } from '@/contexts/WaterContainerContext';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Check,
  Dumbbell,
  Droplet,
  Moon,
  Plus,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useFocusDomains,
  useCreateFocus,
  useUpsertFocusCheckin,
  useDeleteFocusCheckin,
  useTodayFocusSnapshot,
} from '@/hooks/useFocus';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import { useActiveWorkoutPlan } from '@/hooks/Exercises/useWorkoutPlans';
import { useWorkoutPreset } from '@/hooks/Exercises/useWorkoutPresets';
import {
  useWaterIntakeQuery,
  useWaterGoalQuery,
  useUpdateWaterIntakeMutation,
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import {
  useMedications,
  useMedicationEntries,
  useCreateMedicationEntryMutation,
  useDeleteMedicationEntryMutation,
} from '@/hooks/useMedications';
import type { RecurringFocus } from '@/types/focus';
import type { MedicationDetail, MedicationEntry } from '@/types/medications';
import type { ExerciseSessionResponse } from '@workspace/shared';
import {
  loadWorkoutPlaybackDraftFromStorage,
  getWorkoutPlaybackStats,
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
  type WorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import { formatWeight } from '@/utils/numberFormatting';
import { entryMatchesDue } from '@/utils/medicationUtils';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';
import AgendaCard from '@/pages/Home/AgendaCard';
import ToDoCard from '@/pages/Home/ToDoCard';
import CheckTarget from '@/pages/Home/CheckTarget';
import EmptyState from '@/pages/Home/EmptyState';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sundayOf(date: string): string {
  return addDays(date, -dayOfWeek(date));
}

function quickStepFor(target: number | null): number {
  if (!target || target <= 0) return 1;
  const raw = target / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow10;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return Math.max(1, Math.round(niceNorm * pow10));
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
  const hasWorkout = exerciseEntries.length > 0;

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
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const weekStart = useMemo(() => sundayOf(selectedDate), [selectedDate]);
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
              label={WEEKDAY_LABELS[idx] ?? ''}
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

function useActiveWorkoutDraft(selectedDate: string) {
  const [draft, setDraft] = useState<WorkoutPlaybackDraft | null>(() =>
    loadWorkoutPlaybackDraftFromStorage(selectedDate)
  );

  useEffect(() => {
    const recheck = () =>
      setDraft(loadWorkoutPlaybackDraftFromStorage(selectedDate));
    recheck();
    window.addEventListener('storage', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('storage', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [selectedDate]);

  return draft;
}

function summarizeWorkoutSessions(sessions: ExerciseSessionResponse[]) {
  let durationMinutes = 0;
  let volumeKg = 0;

  for (const session of sessions) {
    durationMinutes +=
      session.type === 'preset'
        ? session.total_duration_minutes
        : session.duration_minutes;
    const exercises = session.type === 'preset' ? session.exercises : [session];
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        volumeKg += (set.weight ?? 0) * (set.reps ?? 0);
      }
    }
  }

  const first = sessions[0];
  const name =
    sessions.length === 1 && first
      ? first.type === 'preset'
        ? first.name
        : (first.name ?? first.exercise_snapshot?.name ?? 'Workout')
      : `${sessions.length} Workouts`;

  return { name, durationMinutes: Math.round(durationMinutes), volumeKg };
}

function WorkoutCard({ selectedDate }: { selectedDate: string }) {
  const navigate = useNavigate();
  const { activeUserId } = useActiveUser();
  const { weightUnit, timezone } = usePreferences();
  const { data: exerciseEntries = [] } = useExerciseEntries(
    selectedDate,
    activeUserId ?? undefined
  );
  const activeDraft = useActiveWorkoutDraft(selectedDate);
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const isToday = selectedDate === todayIso;
  const { data: activePlan } = useActiveWorkoutPlan(
    selectedDate,
    isToday ? (activeUserId ?? undefined) : undefined
  );
  const todaysAssignments = isToday
    ? (activePlan?.assignments ?? []).filter(
        (a) => a.day_of_week === dayOfWeek(selectedDate)
      )
    : [];
  const scheduledAssignment = todaysAssignments.find(
    (a) => a.workout_preset_id
  );
  // Called unconditionally (rules-of-hooks) even though its result is only
  // used by the "scheduled today" branch below, which may not be reached.
  const { data: scheduledPreset } = useWorkoutPreset(
    scheduledAssignment?.workout_preset_id
  );

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeDraft) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [activeDraft]);

  const cardClassName =
    'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors';

  if (activeDraft) {
    const startedMs = Date.parse(activeDraft.started_at);
    const elapsedMinutes = Number.isNaN(startedMs)
      ? 0
      : Math.max(0, Math.floor((nowTick - startedMs) / 60000));
    const stats = getWorkoutPlaybackStats(activeDraft);

    return (
      <button
        onClick={() => navigate(`/workout-playback?date=${selectedDate}`)}
        className={cn(
          cardClassName,
          'border-metric-workout/40 bg-metric-workout/10'
        )}
      >
        <span className="absolute right-2.5 top-2.5 h-2 w-2 animate-pulse rounded-full bg-metric-workout" />
        <CircularProgress
          value={stats.completionRate * 100}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="text-sm font-semibold text-metric-workout">
            ⚡ Active ({elapsedMinutes} min{elapsedMinutes === 1 ? '' : 's'})
          </p>
        </div>
      </button>
    );
  }

  const logged = exerciseEntries.length > 0;

  if (logged) {
    const summary = summarizeWorkoutSessions(exerciseEntries);
    return (
      <button
        onClick={() => navigate('/workouts')}
        className={cn(
          cardClassName,
          'border-metric-workout/30 bg-metric-workout/10'
        )}
      >
        <CircularProgress
          value={100}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="max-w-[110px] truncate text-sm font-semibold text-metric-workout">
            {summary.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {summary.durationMinutes} min
            {summary.durationMinutes === 1 ? '' : 's'} •{' '}
            {formatWeight(summary.volumeKg, weightUnit)}
          </p>
        </div>
      </button>
    );
  }

  if (todaysAssignments.length > 0) {
    const routineName =
      scheduledAssignment?.workout_preset_name ||
      todaysAssignments[0]?.exercise_name ||
      'Workout';
    const exerciseCount = scheduledPreset?.exercises?.length;

    const handleStartScheduled = () => {
      if (scheduledAssignment && scheduledPreset) {
        const routeState = createWorkoutPlaybackRouteState(
          scheduledPreset,
          selectedDate,
          '/'
        );
        navigate(`/workout-playback?date=${selectedDate}`, {
          state: routeState,
        });
        return;
      }
      navigate(`/workout-playback?date=${selectedDate}`, {
        state: {
          returnTo: '/',
          draft: createBlankWorkoutPlaybackDraft(selectedDate),
        },
      });
    };

    return (
      <button
        onClick={handleStartScheduled}
        className={cn(
          cardClassName,
          'border-metric-workout/30 bg-metric-workout/10'
        )}
      >
        <CircularProgress
          value={0}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="max-w-[110px] truncate text-sm font-semibold text-metric-workout">
            {routineName}
          </p>
          {exerciseCount !== undefined && (
            <p className="text-[10px] text-muted-foreground">
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </p>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() =>
        navigate('/workouts', { state: { openStartWorkout: true } })
      }
      className={cn(cardClassName, 'border-border hover:bg-muted/50')}
    >
      <CircularProgress
        value={0}
        size={52}
        strokeWidth={4}
        className="text-metric-workout"
      >
        <Dumbbell className="h-5 w-5 text-muted-foreground" />
      </CircularProgress>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Workout</p>
        <p className="text-sm font-semibold">+ Start Workout</p>
      </div>
    </button>
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

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center transition-colors">
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
        className="h-6 gap-1 rounded-full px-2 text-[11px]"
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

function HabitRow({
  habit,
  domainColor,
  onToggle,
  onOpenNumeric,
  onQuickIncrement,
}: {
  habit: RecurringFocus;
  domainColor?: string | null;
  onToggle: (habit: RecurringFocus) => void;
  onOpenNumeric: (habit: RecurringFocus) => void;
  onQuickIncrement: (habit: RecurringFocus) => void;
}) {
  const isNumeric = habit.target_type === 'numeric';
  const progressValue = habit.today_checkin?.progress_value ?? 0;
  const target = habit.target_value ?? 0;
  const pct = target > 0 ? Math.min(100, (progressValue / target) * 100) : 0;

  return (
    <div
      className="rounded-xl border p-3"
      style={
        domainColor ? { borderLeft: `4px solid ${domainColor}` } : undefined
      }
    >
      <div className="flex items-center gap-3">
        {isNumeric ? (
          <div className="min-w-0 flex-1">
            <p
              className={
                habit.done
                  ? 'text-muted-foreground line-through'
                  : 'font-medium'
              }
            >
              {habit.statement}
            </p>
            {habit.current_streak > 0 && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Flame className="h-3 w-3" /> {habit.current_streak}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => onToggle(habit)}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <CheckTarget done={habit.done} />
            <div className="min-w-0">
              <p
                className={
                  habit.done
                    ? 'text-muted-foreground line-through'
                    : 'font-medium'
                }
              >
                {habit.statement}
              </p>
              {habit.current_streak > 0 && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="h-3 w-3" /> {habit.current_streak}
                </span>
              )}
            </div>
          </button>
        )}
        {isNumeric && (
          <button
            onClick={() => onOpenNumeric(habit)}
            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {progressValue}/{target}
            {habit.unit ? ` ${habit.unit}` : ''}
          </button>
        )}
      </div>
      {isNumeric && (
        <div className="mt-2.5 flex items-center gap-2 pl-11">
          <Progress value={pct} className="h-2 flex-1" />
          <Button
            size="icon"
            variant={habit.done ? 'outline' : 'default'}
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => onQuickIncrement(habit)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SupplementsSnapshotCard({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { timezone } = usePreferences();
  const { data: meds = [], isLoading: loadingMeds } = useMedications({
    activeOnly: true,
  });
  const { data: entries = [], isLoading: loadingEntries } =
    useMedicationEntries({
      fromDate: selectedDate,
      toDate: selectedDate,
    });

  const createEntry = useCreateMedicationEntryMutation();
  const deleteEntry = useDeleteMedicationEntryMutation();

  const supplementMeds = useMemo(
    () => (meds as MedicationDetail[]).filter((m) => m.is_supplement),
    [meds]
  );

  const dueDoses = useMemo(() => {
    if (loadingMeds || supplementMeds.length === 0) return [];
    return getDueDosesForDate(supplementMeds, selectedDate, timezone);
  }, [supplementMeds, selectedDate, timezone, loadingMeds]);

  const prnSupplements = useMemo(() => {
    return supplementMeds.filter((m) => {
      if (dueDoses.some((d) => d.medication.id === m.id)) return false;
      return (
        !m.schedules ||
        m.schedules.length === 0 ||
        m.schedules.some((s) => s.schedule_type_id === 'prn')
      );
    });
  }, [supplementMeds, dueDoses]);

  const completedCount = useMemo(() => {
    return dueDoses.filter((due) =>
      entries.some(
        (e) =>
          entryMatchesDue(e, due) &&
          (e.status === 'taken' || e.status === 'skipped')
      )
    ).length;
  }, [dueDoses, entries]);

  const handleTakeScheduled = (due: (typeof dueDoses)[0]) => {
    createEntry.mutate({
      medication_id: due.medication.id,
      schedule_id: due.schedule.id,
      status: 'taken',
      taken_at: new Date().toISOString(),
      entry_date: selectedDate,
    });
  };

  const handleTakePrn = (med: MedicationDetail) => {
    createEntry.mutate({
      medication_id: med.id,
      schedule_id: null,
      status: 'prn_taken',
      taken_at: new Date().toISOString(),
      entry_date: selectedDate,
    });
  };

  const handleUndo = (entry: MedicationEntry) => {
    deleteEntry.mutate(entry.id);
  };

  if (!loadingMeds && supplementMeds.length === 0) {
    return null;
  }

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-50/20 via-card to-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">
            {t('medications.today.supplementsTitle', "Today's Supplements")}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {dueDoses.length > 0
              ? `${completedCount} of ${dueDoses.length} completed`
              : `${supplementMeds.length} active supplements in cabinet`}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/checkin?tab=protocols')}
        >
          <span>Cabinet</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm pt-0">
        {loadingMeds || loadingEntries ? (
          <p className="text-xs text-muted-foreground">
            {t('common.loading', 'Loading...')}
          </p>
        ) : (
          <>
            {dueDoses.map((due, idx) => {
              const entry = entries.find((e) => entryMatchesDue(e, due));
              const isTaken = entry?.status === 'taken';

              return (
                <div
                  key={`${due.medication.id}-${due.schedule.id}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-card/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                        isTaken
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-muted-foreground/30 text-transparent'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'font-medium text-xs truncate',
                          isTaken && 'line-through text-muted-foreground'
                        )}
                      >
                        {due.medication.display_name || due.medication.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDose(due.medication, due.schedule) ?? '1 dose'}
                      </p>
                    </div>
                  </div>

                  {isTaken && entry ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      onClick={() => handleUndo(entry)}
                      disabled={deleteEntry.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t('common.undo', 'Undo')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleTakeScheduled(due)}
                      disabled={createEntry.isPending}
                    >
                      {t('medications.today.take', 'Take')}
                    </Button>
                  )}
                </div>
              );
            })}

            {dueDoses.length === 0 &&
              prnSupplements.map((med) => {
                const prnEntry = entries.find(
                  (e) => e.medication_id === med.id && e.status === 'prn_taken'
                );
                return (
                  <div
                    key={med.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card/60"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-xs truncate">
                        {med.display_name || med.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDose(med) ?? 'As needed'}
                      </p>
                    </div>
                    {prnEntry ? (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          Taken
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleUndo(prnEntry)}
                          disabled={deleteEntry.isPending}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs"
                        onClick={() => handleTakePrn(med)}
                        disabled={createEntry.isPending}
                      >
                        {t('medications.today.take', 'Take')}
                      </Button>
                    )}
                  </div>
                );
              })}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomeChecklist() {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  const { data: domains = [] } = useFocusDomains();
  const domainColor = useMemo(() => {
    const map = new Map(domains.map((d) => [d.id, d.color]));
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [domains]);

  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const { data: snapshot, isLoading } = useTodayFocusSnapshot(selectedDate);
  const createFocus = useCreateFocus();
  const upsertCheckin = useUpsertFocusCheckin();
  const deleteCheckin = useDeleteFocusCheckin();

  const [isHabitsOpen, setIsHabitsOpen] = useState(true);
  const [numericHabit, setNumericHabit] = useState<RecurringFocus | null>(null);
  const [numericValue, setNumericValue] = useState('');

  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false);
  const [habitStatement, setHabitStatement] = useState('');
  const [habitDays, setHabitDays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6])
  );
  const [habitEndDate, setHabitEndDate] = useState('');

  const handleToggleHabit = async (habit: RecurringFocus) => {
    try {
      if (habit.done) {
        await deleteCheckin.mutateAsync({
          focusId: habit.id,
          date: selectedDate,
        });
      } else {
        await upsertCheckin.mutateAsync({
          focusId: habit.id,
          date: selectedDate,
          body: { completed: true },
        });
      }
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to update habit.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickIncrement = async (habit: RecurringFocus) => {
    const step = quickStepFor(habit.target_value);
    const current = habit.today_checkin?.progress_value ?? 0;
    try {
      await upsertCheckin.mutateAsync({
        focusId: habit.id,
        date: selectedDate,
        body: { progress_value: current + step },
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to update habit.',
        variant: 'destructive',
      });
    }
  };

  const openNumericHabit = (habit: RecurringFocus) => {
    setNumericHabit(habit);
    setNumericValue(String(habit.today_checkin?.progress_value ?? ''));
  };

  const handleSaveNumeric = async () => {
    if (!numericHabit) return;
    try {
      await upsertCheckin.mutateAsync({
        focusId: numericHabit.id,
        date: selectedDate,
        body: {
          progress_value: numericValue ? Number(numericValue) : undefined,
        },
      });
      setNumericHabit(null);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to save progress.',
        variant: 'destructive',
      });
    }
  };

  const openAddHabit = () => {
    setHabitStatement('');
    setHabitDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    setHabitEndDate('');
    setIsAddHabitOpen(true);
  };

  const handleCreateHabit = async () => {
    if (!habitStatement.trim()) return;
    try {
      await createFocus.mutateAsync({
        timeframe: 'daily',
        statement: habitStatement.trim(),
        recurrence_days_of_week:
          habitDays.size < 7 ? Array.from(habitDays).sort() : undefined,
        recurrence_end_date: habitEndDate || undefined,
      });
      setIsAddHabitOpen(false);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to create habit.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
      <MetricCards selectedDate={selectedDate} />
      <AgendaCard selectedDate={selectedDate} />

      <SupplementsSnapshotCard selectedDate={selectedDate} />

      {isLoading && <p>{t('common.loading', 'Loading...')}</p>}

      <ToDoCard selectedDate={selectedDate} />

      <Collapsible open={isHabitsOpen} onOpenChange={setIsHabitsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex cursor-pointer flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {t('focus.dailyHabits', 'Daily Habits')}
                <Badge variant="secondary">
                  {snapshot?.daily_recurring.length ?? 0}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddHabit();
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {(snapshot?.daily_recurring.length ?? 0) === 0 && (
                <EmptyState
                  emoji="✨"
                  title={t('focus.noHabitsToday', 'No habits due today')}
                  hint={t(
                    'focus.addHabitHint',
                    'Add one to start building a streak.'
                  )}
                  actionLabel={t('focus.addHabit', 'Add Habit')}
                  onAction={openAddHabit}
                />
              )}
              {snapshot?.daily_recurring.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  domainColor={domainColor(habit.domain_id)}
                  onToggle={handleToggleHabit}
                  onOpenNumeric={openNumericHabit}
                  onQuickIncrement={handleQuickIncrement}
                />
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog
        open={!!numericHabit}
        onOpenChange={(open) => !open && setNumericHabit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{numericHabit?.statement}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            value={numericValue}
            onChange={(e) => setNumericValue(e.target.value)}
            placeholder={numericHabit?.unit ?? ''}
          />
          <DialogFooter>
            <Button
              onClick={handleSaveNumeric}
              disabled={upsertCheckin.isPending}
            >
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddHabitOpen} onOpenChange={setIsAddHabitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('focus.addHabit', 'Add Daily Habit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="home-habit-statement">
                {t('focus.statement', 'Statement')}
              </Label>
              <Textarea
                id="home-habit-statement"
                value={habitStatement}
                onChange={(e) => setHabitStatement(e.target.value)}
                placeholder={t(
                  'focus.statementPlaceholder',
                  'e.g. Finish the client proposal'
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('focus.repeatsOn', 'Repeats on')}</Label>
              <WeekdayToggle selected={habitDays} onChange={setHabitDays} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-habit-end-date">
                {t('focus.endDate', 'End date (optional)')}
              </Label>
              <Input
                id="home-habit-end-date"
                type="date"
                value={habitEndDate}
                onChange={(e) => setHabitEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateHabit}
              disabled={createFocus.isPending}
            >
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
