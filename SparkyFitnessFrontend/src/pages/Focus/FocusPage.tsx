import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { todayInZone, dayOfWeek, addDays } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  { key: 'long_term', titleKey: 'focus.longTerm', fallback: 'Long-Term Focus' },
  { key: 'weekly', titleKey: 'focus.weekly', fallback: 'This Week' },
  { key: 'daily', titleKey: 'focus.daily', fallback: 'Today' },
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

  const [checkInFocus, setCheckInFocus] = useState<Focus | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reflectionNote, setReflectionNote] = useState('');

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
        description: 'Failed to create domain.',
        variant: 'destructive',
      });
    }
  };

  const handleAddFocus = async () => {
    if (!addFocusTimeframe || !statement.trim()) return;
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
        period_date:
          addFocusTimeframe === 'daily'
            ? todayIso
            : addFocusTimeframe === 'weekly'
              ? weekStartIso
              : undefined,
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
        description: 'Failed to delete domain.',
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
              {t('focus.addDomain', 'Add Domain')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('focus.addDomain', 'Add Domain')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="domain-name">
                {t(
                  'focus.domainName',
                  'Domain name (e.g. Health, Work, Relationship)'
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

      {today &&
        (today.daily.length > 0 ||
          today.weekly.length > 0 ||
          today.long_term.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t('focus.todaySummary', "Today's Briefing")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {today.daily.map((f) => (
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
                    <div className="space-y-2">
                      <Label>{t('focus.domain', 'Domain')}</Label>
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
