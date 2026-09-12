import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { todayInZone, addDays, dayOfWeek } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  CircleCheck,
  Circle,
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
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import type { Focus, RecurringFocus } from '@/types/focus';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sundayOf(date: string): string {
  return addDays(date, -dayOfWeek(date));
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
        onClick={() => onSelect(addDays(selectedDate, -7))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day, idx) => (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={`flex flex-col items-center rounded-md border py-2 text-sm ${
              day === selectedDate
                ? 'border-primary bg-primary/10 font-semibold'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            <span className="text-xs">{WEEKDAY_LABELS[idx]}</span>
            <span>{Number(day.slice(8, 10))}</span>
          </button>
        ))}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onSelect(addDays(selectedDate, 7))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StatusStrip({ selectedDate }: { selectedDate: string }) {
  const navigate = useNavigate();
  const { activeUserId } = useActiveUser();
  const userId = activeUserId ?? undefined;
  const { data: exerciseEntries = [] } = useExerciseEntries(
    selectedDate,
    userId
  );
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  const { data: waterGoalMl = 1920 } = useWaterGoalQuery(selectedDate, userId);
  const { data: sleepEntries = [] } = useSleepEntriesQuery(
    selectedDate,
    selectedDate
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={() => navigate('/exercises')}
        className="flex flex-col items-center gap-1 rounded-md border p-3 text-sm"
      >
        <Dumbbell className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">Workout</span>
        <span className="font-medium">
          {exerciseEntries.length > 0
            ? `${exerciseEntries.length} logged`
            : 'Not logged'}
        </span>
      </button>
      <button
        onClick={() => navigate('/')}
        className="flex flex-col items-center gap-1 rounded-md border p-3 text-sm"
      >
        <Droplet className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">Water</span>
        <span className="font-medium">
          {waterMl} / {waterGoalMl} ml
        </span>
      </button>
      <button
        onClick={() => navigate('/checkin')}
        className="flex flex-col items-center gap-1 rounded-md border p-3 text-sm"
      >
        <Moon className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">Sleep</span>
        <span className="font-medium">
          {sleepEntries.length > 0 ? 'Logged' : 'Not logged'}
        </span>
      </button>
    </div>
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
      className="flex w-full items-center gap-3 rounded-md border p-3 text-left"
    >
      {done ? (
        <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? 'line-through text-muted-foreground' : ''}>
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
}: {
  habit: RecurringFocus;
  domainColor?: string | null;
  onToggle: (habit: RecurringFocus) => void;
  onOpenNumeric: (habit: RecurringFocus) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border p-3"
      style={
        domainColor ? { borderLeft: `4px solid ${domainColor}` } : undefined
      }
    >
      <div className="min-w-0">
        <p
          className={
            habit.done ? 'line-through text-muted-foreground' : 'font-medium'
          }
        >
          {habit.statement}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {habit.current_streak > 0 && (
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" /> {habit.current_streak}
            </span>
          )}
          {habit.target_type === 'numeric' && (
            <span>
              {habit.today_checkin?.progress_value ?? 0} / {habit.target_value}
              {habit.unit ? ` ${habit.unit}` : ''}
            </span>
          )}
        </div>
      </div>
      {habit.target_type === 'numeric' ? (
        <Button
          size="sm"
          variant={habit.done ? 'outline' : 'default'}
          onClick={() => onOpenNumeric(habit)}
        >
          {habit.done ? 'Edit' : 'Log'}
        </Button>
      ) : (
        <Button size="icon" variant="ghost" onClick={() => onToggle(habit)}>
          {habit.done ? (
            <CircleCheck className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      )}
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
      <StatusStrip selectedDate={selectedDate} />

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
                <p className="text-sm text-muted-foreground">
                  {t('focus.noneScheduled', 'Nothing scheduled for this day.')}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  {t('focus.noneRecurring', 'No habits due on this day.')}
                </p>
              )}
              {snapshot?.daily_recurring.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  domainColor={domainColor(habit.domain_id)}
                  onToggle={handleToggleHabit}
                  onOpenNumeric={openNumericHabit}
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
