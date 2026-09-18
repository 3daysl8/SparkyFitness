import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  useTodayFocusSnapshot,
  useFocuses,
  useCreateFocus,
  useUpdateFocus,
} from '@/hooks/useFocus';
import { formatTimeOfDayString } from '@/utils/timeFormatters';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { CheckCircle2, ChevronDown, Clock, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Focus } from '@/types/focus';
import CheckTarget from './CheckTarget';
import EmptyState from './EmptyState';
import DayWeekToggle, { type DayWeekView } from './DayWeekToggle';

function ToDoRow({
  focus,
  timeFormat,
  onToggle,
}: {
  focus: Focus;
  timeFormat: string;
  onToggle: (focus: Focus) => void;
}) {
  const done = focus.status === 'completed';
  return (
    <button
      onClick={() => onToggle(focus)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-strong bg-card/50 px-3.5 py-2.5 text-left transition-colors hover:bg-card/80"
    >
      <span className="flex min-w-0 items-center gap-3">
        <CheckTarget done={done} />
        <span
          className={cn(
            'truncate',
            done && 'text-muted-foreground line-through'
          )}
        >
          {focus.statement}
        </span>
      </span>
      {focus.due_time && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatTimeOfDayString(focus.due_time, timeFormat)}
        </span>
      )}
    </button>
  );
}

function ToDoWeekView({
  weekStart,
  tasks,
  timeFormat,
  onToggle,
}: {
  weekStart: string;
  tasks: Focus[];
  timeFormat: string;
  onToggle: (focus: Focus) => void;
}) {
  const { t } = useTranslation();

  const days = useMemo(() => {
    const byDay = new Map<string, Focus[]>();
    for (const task of tasks) {
      if (!task.period_date) continue;
      const list = byDay.get(task.period_date) ?? [];
      list.push(task);
      byDay.set(task.period_date, list);
    }
    // Untimed tasks (due_time null) sort after every timed task in the day —
    // '99:99' is lexicographically greater than any real HH:MM(:SS) value.
    for (const list of byDay.values()) {
      list.sort((a, b) =>
        (a.due_time ?? '99:99').localeCompare(b.due_time ?? '99:99')
      );
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      .map((day) => ({ day, tasks: byDay.get(day) ?? [] }))
      .filter((d) => d.tasks.length > 0);
  }, [weekStart, tasks]);

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" />
        <p className="text-sm font-medium">
          {t('focus.noTasksThisWeek', 'Nothing scheduled this week.')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {days.map(({ day, tasks: dayTasks }, idx) => {
        // Built manually (not toLocaleDateString's {weekday, day} options)
        // because that pair's field order is locale-dependent — some locales
        // render "14 Mon" instead of the intended "Mon 14".
        const date = new Date(`${day}T00:00:00`);
        const weekdayShort = new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
        }).format(date);
        const label = `${weekdayShort} ${date.getDate()}`;
        return (
          <div key={day}>
            <p
              className={cn(
                'mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                idx === 0 ? 'mt-0' : 'mt-3'
              )}
            >
              {label}
            </p>
            <div className="space-y-2">
              {dayTasks.map((task) => (
                <ToDoRow
                  key={task.id}
                  focus={task}
                  timeFormat={timeFormat}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ToDoCard({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { timeFormat } = usePreferences();
  const [view, setView] = useState<DayWeekView>('day');
  const [isOpen, setIsOpen] = useState(true);

  // Rolling 7-day window starting at selectedDate, not a Monday-anchored
  // calendar week — mirrors AgendaCard's choice so "the rest of the week"
  // reads the same way across both cards.
  const weekStart = selectedDate;
  const weekEnd = addDays(weekStart, 6);

  const { data: snapshot, isLoading: isDayLoading } =
    useTodayFocusSnapshot(selectedDate);
  const { data: weekTasks = [], isLoading: isWeekLoading } = useFocuses(
    {
      timeframe: 'daily',
      status: 'active',
      startDate: weekStart,
      endDate: weekEnd,
    },
    { enabled: view === 'week' }
  );

  const createFocus = useCreateFocus();
  const updateFocus = useUpdateFocus();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState('');

  const dayTasks = snapshot?.scheduled ?? [];
  const count = view === 'day' ? dayTasks.length : weekTasks.length;
  const isLoading = view === 'day' ? isDayLoading : isWeekLoading;

  const handleToggle = async (focus: Focus) => {
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

  const openAdd = () => {
    setStatement('');
    setDate(selectedDate);
    setTime('');
    setIsAddOpen(true);
  };

  const handleCreate = async () => {
    if (!statement.trim()) return;
    try {
      await createFocus.mutateAsync({
        timeframe: 'daily',
        statement: statement.trim(),
        period_date: date,
        due_time: time || undefined,
      });
      setIsAddOpen(false);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to create to-do.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              {t('focus.todoList', 'To-Do List')}
              <Badge variant="secondary">{count}</Badge>
            </CardTitle>
            <div className="flex items-center gap-1">
              <DayWeekToggle view={view} onChange={setView} />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  openAdd();
                }}
              >
                <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
              <ChevronDown className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t('common.loading', 'Loading...')}
              </p>
            ) : view === 'day' ? (
              <>
                {dayTasks.length === 0 && (
                  <EmptyState
                    icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                    title={t('focus.allCaughtUp', 'All caught up for today!')}
                    actionLabel={t('focus.addTask', 'Add Task')}
                    onAction={openAdd}
                  />
                )}
                {dayTasks.map((focus) => (
                  <ToDoRow
                    key={focus.id}
                    focus={focus}
                    timeFormat={timeFormat}
                    onToggle={handleToggle}
                  />
                ))}
              </>
            ) : (
              <ToDoWeekView
                weekStart={weekStart}
                tasks={weekTasks}
                timeFormat={timeFormat}
                onToggle={handleToggle}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('focus.addTodo', 'Add To-Do')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="todo-statement">
                {t('focus.statement', 'Statement')}
              </Label>
              <Textarea
                id="todo-statement"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder={t(
                  'focus.statementPlaceholder',
                  'e.g. Finish the client proposal'
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="todo-date">
                  {t('focus.scheduleDate', 'Date')}
                </Label>
                <Input
                  id="todo-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="todo-time">
                  {t('focus.scheduleTime', 'Time (optional)')}
                </Label>
                <Input
                  id="todo-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createFocus.isPending}>
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
