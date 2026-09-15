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
  AlertTriangle,
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
import {
  useMedications,
  useMedicationEntries,
  useCreateMedicationEntryMutation,
  useDeleteMedicationEntryMutation,
} from '@/hooks/useMedications';
import type { RecurringFocus } from '@/types/focus';
import type { MedicationDetail, MedicationEntry } from '@/types/medications';
import { hasLoggedWorkout } from '@/utils/workoutSessionSummary';
import { entryMatchesDue } from '@/utils/medicationUtils';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';
import AgendaCard from '@/pages/Home/AgendaCard';
import ToDoCard from '@/pages/Home/ToDoCard';
import CheckTarget from '@/pages/Home/CheckTarget';
import EmptyState from '@/pages/Home/EmptyState';
import WorkoutCard from '@/pages/Home/WorkoutCard';

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

/**
 * Detail + actions for unaddressed missed workouts (WorkoutCard's own tile
 * only shows a compact count) — a global signal computed relative to today,
 * so it only ever renders while selectedDate is actually today (browsing a
 * different date would make "you missed X" read as a non-sequitur). Per
 * Isaac's product decision, a missed plan only ever moves via this explicit
 * action — it is never auto-moved off its original date.
 */
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
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
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
      className="rounded-xl border px-3.5 py-2.5"
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
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-3">
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
      <CardContent className="space-y-2 text-sm p-4 pt-0">
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
  const { timezone, firstDayOfWeek } = usePreferences();
  const { data: domains = [] } = useFocusDomains();
  const domainColor = useMemo(() => {
    const map = new Map(domains.map((d) => [d.id, d.color]));
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [domains]);

  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Roll selectedDate forward at the user's local midnight, but only while
  // they're still viewing "today" — deliberately browsing another date must
  // never be yanked back to it. lastKnownTodayRef anchors what "today" was as
  // of the last check, so the comparison is against the *previous* boundary,
  // not a value recomputed fresh every tick. Mirrors useActiveWorkoutDraft's
  // "recheck on an interval + visibilitychange" pattern below.
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
      <WeekStrip
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        firstDayOfWeek={firstDayOfWeek}
      />
      <MetricCards selectedDate={selectedDate} />
      <MissedWorkoutsNudge selectedDate={selectedDate} />
      <AgendaCard selectedDate={selectedDate} />

      <SupplementsSnapshotCard selectedDate={selectedDate} />

      {isLoading && <p>{t('common.loading', 'Loading...')}</p>}

      <ToDoCard selectedDate={selectedDate} />

      <Collapsible open={isHabitsOpen} onOpenChange={setIsHabitsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                {t('focus.dailyHabits', 'Daily Habits')}
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {snapshot?.daily_recurring.length ?? 0}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddHabit();
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2 p-4 pt-0">
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
