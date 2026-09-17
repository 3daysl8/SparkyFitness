import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useFocusDomains,
  useCreateFocus,
  useUpsertFocusCheckin,
  useDeleteFocusCheckin,
  useTodayFocusSnapshot,
} from '@/hooks/useFocus';
import type { RecurringFocus, FocusTargetType } from '@/types/focus';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Flame,
  Plus,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';
import CheckTarget from './CheckTarget';
import EmptyState from './EmptyState';

function quickStepFor(target: number | null): number {
  if (!target || target <= 0) return 1;
  const raw = target / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow10;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return Math.max(1, Math.round(niceNorm * pow10));
}

export default function HabitCard({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { data: domains = [] } = useFocusDomains();
  const { data: snapshot } = useTodayFocusSnapshot(selectedDate);
  const createFocus = useCreateFocus();
  const upsertCheckin = useUpsertFocusCheckin();
  const deleteCheckin = useDeleteFocusCheckin();

  const [isOpen, setIsOpen] = useState(true);
  const [selectedDomainFilter, setSelectedDomainFilter] =
    useState<string>('all');

  // Reflection note dialog state
  const [reflectionHabit, setReflectionHabit] = useState<RecurringFocus | null>(
    null
  );
  const [reflectionNote, setReflectionNote] = useState('');

  // Numeric habit progress dialog state
  const [numericHabit, setNumericHabit] = useState<RecurringFocus | null>(null);
  const [numericValue, setNumericValue] = useState('');

  // Add Habit dialog state
  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false);
  const [habitStatement, setHabitStatement] = useState('');
  const [habitDomainId, setHabitDomainId] = useState<string>('none');
  const [habitTargetType, setHabitTargetType] =
    useState<FocusTargetType>('none');
  const [habitTargetValue, setHabitTargetValue] = useState('');
  const [habitUnit, setHabitUnit] = useState('');
  const [habitDays, setHabitDays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6])
  );
  const [habitEndDate, setHabitEndDate] = useState('');

  const domainMap = useMemo(() => {
    return new Map(domains.map((d) => [d.id, d]));
  }, [domains]);

  const allHabits = useMemo(
    () => snapshot?.daily_recurring ?? [],
    [snapshot?.daily_recurring]
  );

  const completedHabitsCount = useMemo(() => {
    return allHabits.filter((h) => h.done).length;
  }, [allHabits]);

  const totalHabitsCount = allHabits.length;
  const overallPercentage =
    totalHabitsCount > 0
      ? Math.round((completedHabitsCount / totalHabitsCount) * 100)
      : 0;

  const filteredHabits = useMemo(() => {
    if (selectedDomainFilter === 'all') return allHabits;
    if (selectedDomainFilter === 'unassigned') {
      return allHabits.filter((h) => !h.domain_id);
    }
    return allHabits.filter((h) => h.domain_id === selectedDomainFilter);
  }, [allHabits, selectedDomainFilter]);

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
        description: t('focus.updateHabitError', 'Failed to update habit.'),
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
        description: t('focus.updateHabitError', 'Failed to update habit.'),
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
        description: t('focus.saveProgressError', 'Failed to save progress.'),
        variant: 'destructive',
      });
    }
  };

  const openReflection = (habit: RecurringFocus) => {
    setReflectionHabit(habit);
    setReflectionNote(habit.today_checkin?.reflection_note ?? '');
  };

  const handleSaveReflection = async () => {
    if (!reflectionHabit) return;
    try {
      await upsertCheckin.mutateAsync({
        focusId: reflectionHabit.id,
        date: selectedDate,
        body: {
          reflection_note: reflectionNote.trim() || null,
        },
      });
      setReflectionHabit(null);
      toast({
        title: t('focus.noteSaved', 'Reflection Saved'),
        description: t('focus.noteSavedDesc', 'Habit reflection note updated.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t(
          'focus.saveNoteError',
          'Failed to save reflection note.'
        ),
        variant: 'destructive',
      });
    }
  };

  const openAddHabit = () => {
    setHabitStatement('');
    setHabitDomainId('none');
    setHabitTargetType('none');
    setHabitTargetValue('');
    setHabitUnit('');
    setHabitDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    setHabitEndDate('');
    setIsAddHabitOpen(true);
  };

  const handleCreateHabit = async () => {
    if (!habitStatement.trim() || habitDays.size === 0) return;
    try {
      await createFocus.mutateAsync({
        timeframe: 'daily',
        statement: habitStatement.trim(),
        domain_id: habitDomainId !== 'none' ? habitDomainId : undefined,
        target_type: habitTargetType,
        target_value:
          habitTargetType === 'numeric' && habitTargetValue
            ? Number(habitTargetValue)
            : undefined,
        unit:
          habitTargetType === 'numeric' && habitUnit ? habitUnit : undefined,
        recurrence_days_of_week:
          habitDays.size > 0 && habitDays.size < 7
            ? Array.from(habitDays).sort()
            : undefined,
        recurrence_end_date: habitEndDate || undefined,
      });
      setIsAddHabitOpen(false);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('focus.createHabitError', 'Failed to create habit.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="transition-all">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                {t('focus.dailyHabits', 'Daily Habits & Streaks')}
              </CardTitle>
              {totalHabitsCount > 0 && (
                <Badge
                  variant={
                    completedHabitsCount === totalHabitsCount &&
                    totalHabitsCount > 0
                      ? 'default'
                      : 'secondary'
                  }
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {completedHabitsCount}/{totalHabitsCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label={t('focus.addHabit', 'Add Habit')}
                onClick={(e) => {
                  e.stopPropagation();
                  openAddHabit();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 p-4 pt-0">
            {totalHabitsCount > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t('focus.completionProgress', 'Daily Completion')}
                  </span>
                  <span className="font-medium text-foreground">
                    {overallPercentage}%
                  </span>
                </div>
                <Progress value={overallPercentage} className="h-1.5" />
              </div>
            )}

            {/* Pillar Filter Chips */}
            {domains.length > 0 && totalHabitsCount > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1">
                <button
                  onClick={() => setSelectedDomainFilter('all')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedDomainFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {t('common.all', 'All')}
                </button>
                {domains.map((dom) => (
                  <button
                    key={dom.id}
                    onClick={() => setSelectedDomainFilter(dom.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                      selectedDomainFilter === dom.id
                        ? 'border-primary bg-primary/15 text-foreground font-semibold'
                        : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: dom.color ?? 'var(--muted-foreground)',
                      }}
                    />
                    {dom.name}
                  </button>
                ))}
              </div>
            )}

            {filteredHabits.length === 0 && (
              <EmptyState
                emoji="✨"
                title={
                  totalHabitsCount === 0
                    ? t('focus.noHabitsToday', 'No habits due today')
                    : t(
                        'focus.noHabitsInFilter',
                        'No habits under this pillar today'
                      )
                }
                hint={t(
                  'focus.addHabitHint',
                  'Add one to start building a streak and driving accountability.'
                )}
                actionLabel={t('focus.addHabit', 'Add Habit')}
                onAction={openAddHabit}
              />
            )}

            {filteredHabits.map((habit) => {
              const domain = habit.domain_id
                ? domainMap.get(habit.domain_id)
                : null;
              const isNumeric = habit.target_type === 'numeric';
              const progressValue = habit.today_checkin?.progress_value ?? 0;
              const target = habit.target_value ?? 0;
              const pct =
                target > 0 ? Math.min(100, (progressValue / target) * 100) : 0;
              const hasReflection = !!habit.today_checkin?.reflection_note;

              return (
                <div
                  key={habit.id}
                  className={cn(
                    'group relative rounded-xl border border-border/70 bg-card/60 p-3 transition-all hover:bg-card/90',
                    habit.done && 'border-emerald-500/30 bg-emerald-500/5'
                  )}
                  style={
                    domain?.color
                      ? { borderLeft: `4px solid ${domain.color}` }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3 min-w-0">
                      {!isNumeric ? (
                        <button
                          onClick={() => handleToggleHabit(habit)}
                          className="mt-0.5 shrink-0"
                          aria-label={
                            habit.done
                              ? 'Mark as incomplete'
                              : 'Mark as complete'
                          }
                        >
                          <CheckTarget done={habit.done} />
                        </button>
                      ) : (
                        <button
                          onClick={() => openNumericHabit(habit)}
                          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Click to enter value"
                        >
                          <CheckCircle2
                            className={cn(
                              'h-5 w-5',
                              habit.done
                                ? 'text-emerald-500'
                                : 'text-muted-foreground/40'
                            )}
                          />
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={cn(
                              'font-medium text-sm leading-snug',
                              habit.done &&
                                'text-muted-foreground line-through opacity-80'
                            )}
                          >
                            {habit.statement}
                          </p>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {domain && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${domain.color ?? '#6366f1'}15`,
                                color: domain.color ?? '#6366f1',
                              }}
                            >
                              {domain.name}
                            </span>
                          )}

                          {habit.current_streak > 0 && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-medium',
                                habit.current_streak >= 3
                                  ? 'text-amber-500 font-semibold'
                                  : 'text-muted-foreground'
                              )}
                            >
                              <Flame className="h-3.5 w-3.5 fill-current" />
                              {habit.current_streak}{' '}
                              {habit.current_streak === 1 ? 'day' : 'days'}
                            </span>
                          )}

                          {hasReflection && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 italic">
                              <MessageSquare className="h-3 w-3" />
                              &ldquo;{habit.today_checkin?.reflection_note}
                              &rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isNumeric ? (
                        <button
                          onClick={() => openNumericHabit(habit)}
                          className="rounded px-2 py-1 text-xs font-semibold tabular-nums text-foreground hover:bg-muted"
                        >
                          {progressValue} / {target}
                          {habit.unit ? ` ${habit.unit}` : ''}
                        </button>
                      ) : null}

                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          'h-7 w-7 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100',
                          hasReflection && 'text-primary opacity-100'
                        )}
                        onClick={() => openReflection(habit)}
                        title={
                          hasReflection
                            ? 'Edit reflection note'
                            : 'Add reflection note'
                        }
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isNumeric && (
                    <div className="mt-2.5 flex items-center gap-2 pl-8">
                      <Progress value={pct} className="h-2 flex-1" />
                      <Button
                        size="icon"
                        variant={habit.done ? 'outline' : 'default'}
                        className="h-7 w-7 shrink-0 rounded-full"
                        aria-label="Increment progress"
                        onClick={() => handleQuickIncrement(habit)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Numeric Progress Dialog */}
      <Dialog
        open={!!numericHabit}
        onOpenChange={(open) => !open && setNumericHabit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{numericHabit?.statement}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="numeric-progress-input">
              {t('focus.progressValue', 'Progress value')}{' '}
              {numericHabit?.unit ? `(${numericHabit.unit})` : ''}
            </Label>
            <Input
              id="numeric-progress-input"
              type="number"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder={numericHabit?.unit ?? '0'}
            />
          </div>
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

      {/* Habit Reflection Note Dialog */}
      <Dialog
        open={!!reflectionHabit}
        onOpenChange={(open) => !open && setReflectionHabit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('focus.reflectionFor', 'Reflection note')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">
              {reflectionHabit?.statement}
            </p>
            <Textarea
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              placeholder={t(
                'focus.reflectionPlaceholder',
                'Add any notes or context about today’s habit execution...'
              )}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveReflection}
              disabled={upsertCheckin.isPending}
            >
              {t('common.save', 'Save Note')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Daily Habit Dialog */}
      <Dialog open={isAddHabitOpen} onOpenChange={setIsAddHabitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('focus.addHabit', 'Add Daily Habit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="space-y-2">
              <Label htmlFor="home-habit-statement">
                {t('focus.statement', 'Habit Statement')}
              </Label>
              <Textarea
                id="home-habit-statement"
                value={habitStatement}
                onChange={(e) => setHabitStatement(e.target.value)}
                placeholder={t(
                  'focus.statementPlaceholder',
                  'e.g. Read 20 pages or morning meditation'
                )}
                rows={2}
              />
            </div>

            {domains.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="home-habit-domain">
                  {t('focus.lifePillar', 'Life Pillar (Optional)')}
                </Label>
                <Select value={habitDomainId} onValueChange={setHabitDomainId}>
                  <SelectTrigger id="home-habit-domain">
                    <SelectValue
                      placeholder={t('focus.selectPillar', 'Select Pillar')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('focus.noPillar', 'None / General')}
                    </SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: d.color ?? 'var(--primary)',
                            }}
                          />
                          {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('focus.targetType', 'Target Type')}</Label>
              <Select
                value={habitTargetType}
                onValueChange={(val: FocusTargetType) =>
                  setHabitTargetType(val)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('focus.checkboxTarget', 'Checkbox (Done / Not done)')}
                  </SelectItem>
                  <SelectItem value="numeric">
                    {t(
                      'focus.numericTarget',
                      'Numeric Progress (e.g. 8 glasses, 30 mins)'
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {habitTargetType === 'numeric' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="home-habit-target-val">
                    {t('focus.targetValue', 'Target')}
                  </Label>
                  <Input
                    id="home-habit-target-val"
                    type="number"
                    value={habitTargetValue}
                    onChange={(e) => setHabitTargetValue(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="home-habit-unit">
                    {t('focus.unit', 'Unit')}
                  </Label>
                  <Input
                    id="home-habit-unit"
                    value={habitUnit}
                    onChange={(e) => setHabitUnit(e.target.value)}
                    placeholder="e.g. mins, pages"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('focus.repeatsOn', 'Repeats on')}</Label>
                {habitDays.size === 0 && (
                  <span className="text-[11px] font-medium text-destructive">
                    {t('focus.selectAtLeastOneDay', 'Select at least 1 day')}
                  </span>
                )}
              </div>
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
              disabled={
                createFocus.isPending ||
                !habitStatement.trim() ||
                habitDays.size === 0
              }
            >
              {t('common.save', 'Save Habit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
