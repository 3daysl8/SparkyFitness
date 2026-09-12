import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { todayInZone, addDays, dayOfWeek } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useWaterContainer } from '@/contexts/WaterContainerContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useFocusDomains,
  useCreateFocus,
  useUpdateFocus,
  useUpsertFocusCheckin,
  useDeleteFocusCheckin,
  useTodayFocusSnapshot,
} from '@/hooks/useFocus';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import {
  useWaterIntakeQuery,
  useWaterGoalQuery,
  useUpdateWaterIntakeMutation,
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import type { Focus, RecurringFocus } from '@/types/focus';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sundayOf(date: string): string {
  return addDays(date, -dayOfWeek(date));
}

/** A sensible round increment for a numeric habit's quick "+" stepper —
 * roughly 10 taps to fill the target, rounded to a "nice" 1/2/5x10^n step.
 * There's no explicit step field on the habit, so this is a judgment call;
 * the precise-entry dialog (tap the progress label) still covers exact
 * values. */
function quickStepFor(target: number | null): number {
  if (!target || target <= 0) return 1;
  const raw = target / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow10;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return Math.max(1, Math.round(niceNorm * pow10));
}

/** One pill in the week strip, including its own completion dot — done as
 * its own component (rather than a loop calling the hook 7 times) so each
 * day's snapshot is a normal, rules-of-hooks-safe query. The selected day's
 * snapshot is already cached by HomeChecklist's own fetch of it, so this
 * adds at most 6 extra lightweight requests per visible week, not 7. */
function DayPill({
  day,
  label,
  selected,
  onSelect,
}: {
  day: string;
  label: string;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const { data: snapshot } = useTodayFocusSnapshot(day);
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

  return (
    <button
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
    </button>
  );
}

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
        {days.map((day, idx) => (
          <DayPill
            key={day}
            day={day}
            label={WEEKDAY_LABELS[idx] ?? ''}
            selected={day === selectedDate}
            onSelect={onSelect}
          />
        ))}
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

function WorkoutCard({ selectedDate }: { selectedDate: string }) {
  const navigate = useNavigate();
  const { activeUserId } = useActiveUser();
  const { data: exerciseEntries = [] } = useExerciseEntries(
    selectedDate,
    activeUserId ?? undefined
  );
  const logged = exerciseEntries.length > 0;

  return (
    <button
      onClick={() => navigate('/exercises')}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors',
        logged
          ? 'border-metric-workout/30 bg-metric-workout/10'
          : 'border-border hover:bg-muted/50'
      )}
    >
      <CircularProgress
        value={logged ? 100 : 0}
        size={52}
        strokeWidth={4}
        className="text-metric-workout"
      >
        <Dumbbell
          className={cn(
            'h-5 w-5',
            logged ? 'text-metric-workout' : 'text-muted-foreground'
          )}
        />
      </CircularProgress>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Workout</p>
        <p
          className={cn(
            'text-sm font-semibold',
            logged && 'text-metric-workout'
          )}
        >
          {logged ? `${exerciseEntries.length} logged` : 'Log workout'}
        </p>
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
  const navigate = useNavigate();
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  const { data: waterGoalMl = 1920 } = useWaterGoalQuery(selectedDate, userId);
  const { activeContainer } = useWaterContainer();
  const { mutate: updateWater, isPending } = useUpdateWaterIntakeMutation();

  const pct =
    waterGoalMl > 0 ? Math.min(100, (waterMl / waterGoalMl) * 100) : 0;

  // Mirrors the common case of WaterIntake.tsx's getVolumeDisplay() (an
  // explicit container volume, else the 250ml default) without the
  // linked-food serving-size math — this is a quick-add shortcut, the full
  // Diary water card remains the source of truth for that edge case.
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/diary')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/diary');
        }
      }}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center transition-colors hover:bg-muted/50"
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
      onClick={() => navigate('/checkin')}
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

/** The circular check-target shared by to-dos and boolean habits. Purely
 * visual (the enclosing row is the real tap target) so it stays valid HTML
 * and one big touch target, but reads as a dedicated checkbox. Remounting
 * the icon via `key` on every toggle re-triggers the check-pop animation
 * only on the actual state change, not on every render. */
function CheckTarget({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        done
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/30 text-transparent'
      )}
    >
      <Check
        key={String(done)}
        className={cn('h-4 w-4', done && 'animate-check-pop')}
      />
    </span>
  );
}

function ToDoRow({
  focus,
  onToggle,
}: {
  focus: Focus;
  onToggle: (focus: Focus) => void;
}) {
  const done = focus.status === 'completed';
  return (
    <button
      onClick={() => onToggle(focus)}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <CheckTarget done={done} />
      <span className={done ? 'text-muted-foreground line-through' : ''}>
        {focus.statement}
      </span>
    </button>
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

function EmptyState({
  emoji,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  hint?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center">
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Button size="sm" variant="outline" onClick={onAction} className="mt-1">
        <Plus className="mr-1 h-3.5 w-3.5" /> {actionLabel}
      </Button>
    </div>
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
  const updateFocus = useUpdateFocus();
  const upsertCheckin = useUpsertFocusCheckin();
  const deleteCheckin = useDeleteFocusCheckin();

  const [isTodoOpen, setIsTodoOpen] = useState(true);
  const [isHabitsOpen, setIsHabitsOpen] = useState(true);
  const [numericHabit, setNumericHabit] = useState<RecurringFocus | null>(null);
  const [numericValue, setNumericValue] = useState('');

  const [isAddTodoOpen, setIsAddTodoOpen] = useState(false);
  const [todoStatement, setTodoStatement] = useState('');
  const [todoDate, setTodoDate] = useState(selectedDate);

  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false);
  const [habitStatement, setHabitStatement] = useState('');
  const [habitDays, setHabitDays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6])
  );
  const [habitEndDate, setHabitEndDate] = useState('');

  const handleToggleTodo = async (focus: Focus) => {
    try {
      await updateFocus.mutateAsync({
        id: focus.id,
        body: { status: focus.status === 'completed' ? 'active' : 'completed' },
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to update.',
        variant: 'destructive',
      });
    }
  };

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

  const openAddTodo = () => {
    setTodoStatement('');
    setTodoDate(selectedDate);
    setIsAddTodoOpen(true);
  };

  const handleCreateTodo = async () => {
    if (!todoStatement.trim()) return;
    try {
      await createFocus.mutateAsync({
        timeframe: 'daily',
        statement: todoStatement.trim(),
        period_date: todoDate,
      });
      setIsAddTodoOpen(false);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to create to-do.',
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

      {isLoading && <p>{t('common.loading', 'Loading...')}</p>}

      <Collapsible open={isTodoOpen} onOpenChange={setIsTodoOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex cursor-pointer flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {t('focus.todoList', 'To-Do List')}
                <Badge variant="secondary">
                  {snapshot?.scheduled.length ?? 0}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddTodo();
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
              {(snapshot?.scheduled.length ?? 0) === 0 && (
                <EmptyState
                  emoji="🎉"
                  title={t('focus.allCaughtUp', 'All caught up for today!')}
                  actionLabel={t('focus.addTask', 'Add Task')}
                  onAction={openAddTodo}
                />
              )}
              {snapshot?.scheduled.map((focus) => (
                <ToDoRow
                  key={focus.id}
                  focus={focus}
                  onToggle={handleToggleTodo}
                />
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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

      <Dialog open={isAddTodoOpen} onOpenChange={setIsAddTodoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('focus.addTodo', 'Add To-Do')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="home-todo-statement">
                {t('focus.statement', 'Statement')}
              </Label>
              <Textarea
                id="home-todo-statement"
                value={todoStatement}
                onChange={(e) => setTodoStatement(e.target.value)}
                placeholder={t(
                  'focus.statementPlaceholder',
                  'e.g. Finish the client proposal'
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-todo-date">
                {t('focus.scheduleDate', 'Date')}
              </Label>
              <Input
                id="home-todo-date"
                type="date"
                value={todoDate}
                onChange={(e) => setTodoDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTodo} disabled={createFocus.isPending}>
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
