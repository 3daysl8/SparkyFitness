import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { todayInZone, dayOfWeek, addDays } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Target as TargetIcon,
  CheckCircle2,
  History,
  Sparkles,
  Flame,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useFocusDomains,
  useCreateFocusDomain,
  useDeleteFocusDomain,
  useFocuses,
  useCreateFocus,
  useUpdateFocus,
  useDeleteFocus,
  useUpsertFocusCheckin,
  useFocusCheckins,
  useTodayFocusSnapshot,
} from '@/hooks/useFocus';
import type { Focus, FocusTimeframe, FocusTargetType } from '@/types/focus';
import WeekdayToggle from './WeekdayToggle';

function FocusHistoryButton({ focus }: { focus: Focus }) {
  const [open, setOpen] = useState(false);
  const { data: checkins = [] } = useFocusCheckins(focus.id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{focus.statement}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {checkins.length === 0 && (
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          )}
          {checkins.map((c) => (
            <div key={c.id} className="rounded-md border p-2 text-sm">
              <div className="font-medium">{c.checkin_date}</div>
              {c.progress_value !== null && (
                <div>Progress: {c.progress_value}</div>
              )}
              {c.completed !== null && (
                <div>Completed: {c.completed ? 'Yes' : 'No'}</div>
              )}
              {c.reflection_note && (
                <div className="text-muted-foreground">{c.reflection_note}</div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TIMEFRAME_SECTIONS: {
  key: FocusTimeframe;
  titleKey: string;
  fallback: string;
}[] = [
  {
    key: 'long_term',
    titleKey: 'focus.longTerm',
    fallback: 'Long-Term Vision',
  },
  { key: 'weekly', titleKey: 'focus.weekly', fallback: 'Weekly Focus' },
  { key: 'daily', titleKey: 'focus.daily', fallback: 'Daily Actions' },
];

function FocusStatementLine({
  focus,
  domainName,
  onCheckIn,
  onComplete,
  onDelete,
}: {
  focus: Focus;
  domainName?: string;
  onCheckIn: (focus: Focus) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="font-medium">{focus.statement}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {domainName && <Badge variant="secondary">{domainName}</Badge>}
          {focus.target_type === 'numeric' && focus.target_value !== null && (
            <span>
              Target: {focus.target_value}
              {focus.unit ? ` ${focus.unit}` : ''}
            </span>
          )}
          {focus.target_type === 'boolean' && <span>Target: yes/no</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onCheckIn(focus)}>
          <TargetIcon className="h-4 w-4" />
        </Button>
        <FocusHistoryButton focus={focus} />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onComplete(focus.id)}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(focus.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FocusPage() {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  const { data: domains = [] } = useFocusDomains();
  const { data: focuses = [], isLoading } = useFocuses({ status: 'active' });
  const { data: today } = useTodayFocusSnapshot();
  const createDomain = useCreateFocusDomain();
  const deleteDomain = useDeleteFocusDomain();
  const createFocus = useCreateFocus();
  const updateFocus = useUpdateFocus();
  const deleteFocus = useDeleteFocus();
  const upsertCheckin = useUpsertFocusCheckin();

  const domainName = useMemo(() => {
    const map = new Map(domains.map((d) => [d.id, d.name]));
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [domains]);

  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');

  const [addFocusTimeframe, setAddFocusTimeframe] =
    useState<FocusTimeframe | null>(null);
  const [statement, setStatement] = useState('');
  const [domainId, setDomainId] = useState<string>('');
  const [targetType, setTargetType] = useState<FocusTargetType>('none');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6])
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const [checkInFocus, setCheckInFocus] = useState<Focus | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reflectionNote, setReflectionNote] = useState('');

  // Weekly Motivation Checkpoint state
  const [motivationScore, setMotivationScore] = useState<number>(() => {
    const saved = localStorage.getItem('focus.weeklyMotivationScore');
    return saved ? Number(saved) : 8;
  });
  const [weeklyWin, setWeeklyWin] = useState<string>(() => {
    return localStorage.getItem('focus.weeklyWin') || '';
  });
  const [weeklyAdjustment, setWeeklyAdjustment] = useState<string>(() => {
    return localStorage.getItem('focus.weeklyAdjustment') || '';
  });
  const [checkpointSaved, setCheckpointSaved] = useState(false);

  const handleSaveCheckpoint = () => {
    localStorage.setItem(
      'focus.weeklyMotivationScore',
      String(motivationScore)
    );
    localStorage.setItem('focus.weeklyWin', weeklyWin);
    localStorage.setItem('focus.weeklyAdjustment', weeklyAdjustment);
    setCheckpointSaved(true);
    toast({
      title: t('focus.checkpointSaved', 'Motivation Checkpoint Saved'),
      description: t(
        'focus.checkpointSavedDesc',
        'Your weekly motivation reflection has been updated.'
      ),
    });
    setTimeout(() => setCheckpointSaved(false), 3000);
  };

  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  // Monday-based week start, matching focusService.weekStartFor on the server.
  const weekStartIso = useMemo(() => {
    const offset = (dayOfWeek(todayIso) + 6) % 7; // Sun(0)->6, Mon(1)->0, ... Sat(6)->5
    return addDays(todayIso, -offset);
  }, [todayIso]);

  const resetAddFocusForm = () => {
    setAddFocusTimeframe(null);
    setStatement('');
    setDomainId('');
    setTargetType('none');
    setTargetValue('');
    setUnit('');
    setScheduleDate('');
    setIsRecurring(false);
    setRecurrenceDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    setRecurrenceEndDate('');
  };

  const handleAddDomain = async () => {
    if (!newDomainName.trim()) return;
    try {
      await createDomain.mutateAsync({ name: newDomainName.trim() });
      setNewDomainName('');
      setIsAddDomainOpen(false);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to create life pillar.',
        variant: 'destructive',
      });
    }
  };

  const handleAddFocus = async () => {
    if (!addFocusTimeframe || !statement.trim()) return;
    const isDailyRecurring = addFocusTimeframe === 'daily' && isRecurring;
    try {
      await createFocus.mutateAsync({
        timeframe: addFocusTimeframe,
        statement: statement.trim(),
        domain_id: domainId || undefined,
        target_type: targetType,
        target_value:
          targetType === 'numeric' && targetValue
            ? Number(targetValue)
            : undefined,
        unit: targetType === 'numeric' && unit ? unit : undefined,
        period_date: isDailyRecurring
          ? undefined
          : addFocusTimeframe === 'daily'
            ? scheduleDate || todayIso
            : addFocusTimeframe === 'weekly'
              ? weekStartIso
              : undefined,
        recurrence_days_of_week:
          isDailyRecurring && recurrenceDays.size < 7
            ? Array.from(recurrenceDays).sort()
            : undefined,
        recurrence_end_date:
          isDailyRecurring && recurrenceEndDate ? recurrenceEndDate : undefined,
      });
      resetAddFocusForm();
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to create focus.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFocus.mutateAsync(id);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to delete focus.',
        variant: 'destructive',
      });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateFocus.mutateAsync({ id, body: { status: 'completed' } });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to update focus.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDomain = async (id: string) => {
    try {
      await deleteDomain.mutateAsync(id);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to delete life pillar.',
        variant: 'destructive',
      });
    }
  };

  const openCheckIn = (focus: Focus) => {
    setCheckInFocus(focus);
    setProgressValue('');
    setCompleted(null);
    setReflectionNote('');
  };

  const handleCheckIn = async () => {
    if (!checkInFocus) return;
    try {
      await upsertCheckin.mutateAsync({
        focusId: checkInFocus.id,
        date: todayIso,
        body: {
          progress_value:
            checkInFocus.target_type === 'numeric' && progressValue
              ? Number(progressValue)
              : undefined,
          completed:
            checkInFocus.target_type === 'boolean'
              ? (completed ?? undefined)
              : undefined,
          reflection_note: reflectionNote || undefined,
        },
      });
      setCheckInFocus(null);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: 'Failed to save check-in.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('focus.title', 'Focus & Motivation')}
        </h1>
        <Dialog open={isAddDomainOpen} onOpenChange={setIsAddDomainOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              {t('focus.addDomain', 'Add Life Pillar')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('focus.addDomain', 'Add Life Pillar')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="domain-name">
                {t(
                  'focus.domainName',
                  'Life Pillar name (e.g. Health & Vitality, Career & Wealth, Relationships, Mindfulness)'
                )}
              </Label>
              <Input
                id="domain-name"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
              />
            </div>
            {domains.length > 0 && (
              <div className="space-y-1 border-t pt-3">
                {domains.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{d.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteDomain(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={handleAddDomain}
                disabled={createDomain.isPending}
              >
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Weekly Motivation Checkpoint Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('focus.motivationCheckpoint', 'Weekly Motivation Checkpoint')}
          </CardTitle>
          <CardDescription>
            {t(
              'focus.motivationCheckpointDesc',
              'Reflect on your energy, align your mindset, and define your intention for the week ahead.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                {t('focus.motivationLevel', 'Motivation & Drive Level (1-10)')}
              </Label>
              <span className="flex items-center gap-1 font-bold text-primary">
                <Flame className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                {motivationScore}/10
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setMotivationScore(score)}
                  className={`flex-1 h-8 rounded text-xs font-semibold transition-all ${
                    motivationScore === score
                      ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="weekly-win"
                className="text-xs font-medium text-muted-foreground"
              >
                {t('focus.weeklyWin', 'Top Win or Breakthrough')}
              </Label>
              <Textarea
                id="weekly-win"
                placeholder={t(
                  'focus.weeklyWinPlaceholder',
                  'What worked well or gave you momentum?'
                )}
                value={weeklyWin}
                onChange={(e) => setWeeklyWin(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="weekly-adjustment"
                className="text-xs font-medium text-muted-foreground"
              >
                {t('focus.weeklyAdjustment', 'Key Focus & Alignment Shift')}
              </Label>
              <Textarea
                id="weekly-adjustment"
                placeholder={t(
                  'focus.weeklyAdjustmentPlaceholder',
                  'What is the single most important action to prioritize?'
                )}
                value={weeklyAdjustment}
                onChange={(e) => setWeeklyAdjustment(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={handleSaveCheckpoint}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {checkpointSaved
                ? t('common.saved', 'Saved!')
                : t('focus.saveCheckpoint', 'Save Checkpoint')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {today &&
        (today.scheduled.length > 0 ||
          today.weekly.length > 0 ||
          today.long_term.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t('focus.todaySummary', "Today's Briefing")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {today.scheduled.map((f) => (
                <p key={f.id}>
                  <strong>{t('focus.today', 'Today')}:</strong> {f.statement}
                </p>
              ))}
              {today.weekly.map((f) => (
                <p key={f.id}>
                  <strong>{t('focus.thisWeek', 'This week')}:</strong>{' '}
                  {f.statement}
                </p>
              ))}
              {today.long_term.map((f) => (
                <p key={f.id}>
                  <strong>
                    {domainName(f.domain_id) ??
                      t('focus.longTerm', 'Long-term')}
                    :
                  </strong>{' '}
                  {f.statement}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

      {isLoading && <p>{t('common.loading', 'Loading...')}</p>}

      {TIMEFRAME_SECTIONS.map((section) => {
        const items = focuses.filter((f) => f.timeframe === section.key);
        return (
          <Card key={section.key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t(section.titleKey, section.fallback)}</CardTitle>
              <Dialog
                open={addFocusTimeframe === section.key}
                onOpenChange={(open) =>
                  open ? setAddFocusTimeframe(section.key) : resetAddFocusForm()
                }
              >
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t('focus.addFocus', 'Add focus')} —{' '}
                      {t(section.titleKey, section.fallback)}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="focus-statement">
                        {t('focus.statement', 'Statement')}
                      </Label>
                      <Textarea
                        id="focus-statement"
                        value={statement}
                        onChange={(e) => setStatement(e.target.value)}
                        placeholder={t(
                          'focus.statementPlaceholder',
                          'e.g. Finish the client proposal'
                        )}
                      />
                    </div>
                    {addFocusTimeframe === 'daily' && (
                      <div className="space-y-3 rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="focus-recurring">
                            {t('focus.makeRecurring', 'Make this recurring')}
                          </Label>
                          <input
                            id="focus-recurring"
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                          />
                        </div>
                        {isRecurring ? (
                          <>
                            <div className="space-y-2">
                              <Label>
                                {t('focus.repeatsOn', 'Repeats on')}
                              </Label>
                              <WeekdayToggle
                                selected={recurrenceDays}
                                onChange={setRecurrenceDays}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="focus-recurrence-end">
                                {t('focus.endDate', 'End date (optional)')}
                              </Label>
                              <Input
                                id="focus-recurrence-end"
                                type="date"
                                value={recurrenceEndDate}
                                onChange={(e) =>
                                  setRecurrenceEndDate(e.target.value)
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="focus-schedule-date">
                              {t('focus.scheduleDate', 'Date')}
                            </Label>
                            <Input
                              id="focus-schedule-date"
                              type="date"
                              value={scheduleDate || todayIso}
                              onChange={(e) => setScheduleDate(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t('focus.domain', 'Life Pillar')}</Label>
                      <Select value={domainId} onValueChange={setDomainId}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('focus.noDomain', 'None')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('focus.targetType', 'Target')}</Label>
                      <Select
                        value={targetType}
                        onValueChange={(v) =>
                          setTargetType(v as FocusTargetType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t('focus.targetNone', 'None — just a statement')}
                          </SelectItem>
                          <SelectItem value="numeric">
                            {t('focus.targetNumeric', 'Numeric')}
                          </SelectItem>
                          <SelectItem value="boolean">
                            {t('focus.targetBoolean', 'Yes/No')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {targetType === 'numeric' && (
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="focus-target-value">
                            {t('focus.targetValue', 'Target value')}
                          </Label>
                          <Input
                            id="focus-target-value"
                            type="number"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="focus-unit">
                            {t('focus.unit', 'Unit')}
                          </Label>
                          <Input
                            id="focus-unit"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            placeholder="steps, $, ..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddFocus}
                      disabled={createFocus.isPending}
                    >
                      {t('common.save', 'Save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('focus.none', 'Nothing set yet.')}
                </p>
              )}
              {items.map((focus) => (
                <FocusStatementLine
                  key={focus.id}
                  focus={focus}
                  domainName={domainName(focus.domain_id)}
                  onCheckIn={openCheckIn}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={!!checkInFocus}
        onOpenChange={(open) => !open && setCheckInFocus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('focus.checkIn', 'Check in')}</DialogTitle>
          </DialogHeader>
          {checkInFocus && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {checkInFocus.statement}
              </p>
              {checkInFocus.target_type === 'numeric' && (
                <div className="space-y-2">
                  <Label htmlFor="checkin-progress">
                    {t('focus.progress', 'Progress')}
                    {checkInFocus.unit ? ` (${checkInFocus.unit})` : ''}
                  </Label>
                  <Input
                    id="checkin-progress"
                    type="number"
                    value={progressValue}
                    onChange={(e) => setProgressValue(e.target.value)}
                  />
                </div>
              )}
              {checkInFocus.target_type === 'boolean' && (
                <div className="flex gap-2">
                  <Button
                    variant={completed === true ? 'default' : 'outline'}
                    onClick={() => setCompleted(true)}
                  >
                    {t('common.yes', 'Yes')}
                  </Button>
                  <Button
                    variant={completed === false ? 'default' : 'outline'}
                    onClick={() => setCompleted(false)}
                  >
                    {t('common.no', 'No')}
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="checkin-note">
                  {t('focus.reflection', 'Reflection (optional)')}
                </Label>
                <Textarea
                  id="checkin-note"
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleCheckIn} disabled={upsertCheckin.isPending}>
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
