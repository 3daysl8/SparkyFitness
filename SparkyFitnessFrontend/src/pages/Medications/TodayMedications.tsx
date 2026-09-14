import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  getDueDosesForDate,
  dayToUtcRange,
  localDateTimeToUtc,
  utcToLocalDateTimeInput,
  formatDose,
  type SharedScheduleRule,
} from '@workspace/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { entryMatchesDue } from '@/utils/medicationUtils';
import { formatTimeOfDayString } from '@/utils/timeFormatters';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  useCreateMedicationEntryMutation,
  useUpdateMedicationEntryMutation,
  useDeleteMedicationEntryMutation,
} from '@/hooks/useMedications';
import type {
  MedicationDetail,
  MedicationEntry,
  MedicationSchedule,
} from '@/types/medications';
import AddMedicationDialog, { MedTypeIcon } from './AddMedicationDialog';
import MedicationLogCalendar from './MedicationLogCalendar';

export interface DueDose {
  medication: MedicationDetail;
  schedule: SharedScheduleRule & { id: string };
}

export interface TodayMedicationsProps {
  selectedDate: string;
  today: string;
  meds: MedicationDetail[];
  entries: MedicationEntry[];
  loadingMeds: boolean;
  loadingEntries: boolean;
  onSelectDate: (date: string) => void;
}

type StackGroupKey = 'morning' | 'afternoon' | 'evening' | 'asNeeded';

interface StackRow {
  key: string;
  name: string;
  doseLabel: string | null;
  notes: string | null;
  timeLabel: string | null;
  timeOfDay: string | null;
  isPrn: boolean;
  entry: MedicationEntry | undefined;
  take: () => void;
}

// Buckets a row by its schedule time. PRN items and anything without a fixed
// time (schedule_type_id 'prn' or a null time_of_day) fall into "As Needed" —
// there is no clock time to group them by.
const bucketForRow = (row: StackRow): StackGroupKey => {
  if (row.isPrn || !row.timeOfDay) return 'asNeeded';
  const hour = parseInt(row.timeOfDay.split(':')[0] ?? '', 10);
  if (Number.isNaN(hour)) return 'asNeeded';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

export default function TodayMedications({
  selectedDate,
  today,
  meds,
  entries,
  loadingMeds,
  loadingEntries,
  onSelectDate,
}: TodayMedicationsProps) {
  const { t } = useTranslation();
  const { timezone, formatTime, timeFormat } = usePreferences();

  // Edit-time dialog state (correct the "when" of an already-logged dose)
  const [editingEntry, setEditingEntry] = useState<MedicationEntry | null>(
    null
  );
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Mutations
  const createEntryMutation = useCreateMedicationEntryMutation();
  const updateEntryMutation = useUpdateMedicationEntryMutation();
  const deleteEntryMutation = useDeleteMedicationEntryMutation();

  const isPending =
    createEntryMutation.isPending ||
    updateEntryMutation.isPending ||
    deleteEntryMutation.isPending;

  // Schedules evaluation
  const dueDoses = useMemo(() => {
    if (loadingMeds || meds.length === 0) return [];
    return getDueDosesForDate(meds, selectedDate, timezone);
  }, [meds, selectedDate, timezone, loadingMeds]);

  const prnMeds = useMemo(() => {
    return meds.filter((m) => {
      if (!m.is_active) return false;
      // Exclude if it's currently due today to prevent showing it twice
      if (dueDoses.some((d) => d.medication.id === m.id)) return false;
      if (!m.schedules || m.schedules.length === 0) return true;
      return m.schedules.some(
        (s: MedicationSchedule) => s.schedule_type_id === 'prn'
      );
    });
  }, [meds, dueDoses]);

  const completedDosesCount = useMemo(() => {
    return dueDoses.filter((due) =>
      entries.some(
        (e) =>
          entryMatchesDue(e, due) &&
          (e.status === 'taken' || e.status === 'skipped')
      )
    ).length;
  }, [dueDoses, entries]);

  const handleLogScheduled = (
    due: DueDose,
    status: 'taken' | 'skipped' | 'snoozed'
  ) => {
    let scheduledFor = null;
    if (due.schedule.time_of_day) {
      try {
        const { start } = dayToUtcRange(selectedDate, timezone);
        const [h, m] = due.schedule.time_of_day.split(':');
        scheduledFor = new Date(
          start.getTime() +
            parseInt(h || '0', 10) * 3600000 +
            parseInt(m || '0', 10) * 60000
        ).toISOString();
      } catch (e) {
        console.error(e);
      }
    }

    const takenAt =
      selectedDate === today
        ? new Date().toISOString()
        : `${selectedDate}T12:00:00.000Z`;

    createEntryMutation.mutate({
      medication_id: due.medication.id,
      schedule_id: due.schedule.id,
      status,
      taken_at: takenAt,
      scheduled_for: scheduledFor,
      entry_date: selectedDate,
      notes: null,
    });
  };

  const handleLogPrn = (med: MedicationDetail) => {
    const prnSched = med.schedules?.find((s) => s.schedule_type_id === 'prn');
    const takenAt =
      selectedDate === today
        ? new Date().toISOString()
        : `${selectedDate}T12:00:00.000Z`;

    createEntryMutation.mutate({
      medication_id: med.id,
      schedule_id: prnSched?.id || null,
      status: 'prn_taken',
      taken_at: takenAt,
      entry_date: selectedDate,
      notes: null,
    });
  };

  const handleUndoEntry = (entry: MedicationEntry) => {
    deleteEntryMutation.mutate(entry.id);
  };

  const stackRows: StackRow[] = [];

  dueDoses.forEach((due, idx) => {
    const entry = entries.find((e) => entryMatchesDue(e, due));
    stackRows.push({
      key: `due-${due.medication.id}-${due.schedule.id}-${idx}`,
      name: due.medication.display_name || due.medication.name,
      doseLabel: formatDose(due.medication, due.schedule),
      notes: due.medication.notes,
      timeLabel: due.schedule.time_of_day
        ? formatTimeOfDayString(due.schedule.time_of_day, timeFormat)
        : null,
      timeOfDay: due.schedule.time_of_day ?? null,
      isPrn: false,
      entry,
      take: () => handleLogScheduled(due, 'taken'),
    });
  });

  prnMeds.forEach((med) => {
    const entry = entries.find(
      (e) => e.medication_id === med.id && e.status === 'prn_taken'
    );
    stackRows.push({
      key: `prn-${med.id}`,
      name: med.display_name || med.name,
      doseLabel: formatDose(med),
      notes: med.notes,
      timeLabel: null,
      timeOfDay: null,
      isPrn: true,
      entry,
      take: () => handleLogPrn(med),
    });
  });

  const groupedRows: Record<StackGroupKey, StackRow[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    asNeeded: [],
  };
  stackRows.forEach((row) => groupedRows[bucketForRow(row)].push(row));

  const stackGroupOrder: { key: StackGroupKey; label: string }[] = [
    { key: 'morning', label: t('medications.today.morning', 'Morning') },
    { key: 'afternoon', label: t('medications.today.afternoon', 'Afternoon') },
    { key: 'evening', label: t('medications.today.evening', 'Evening') },
    { key: 'asNeeded', label: t('medications.today.asNeeded', 'As Needed') },
  ];

  const openEditEntry = (entry: MedicationEntry) => {
    setEditingEntry(entry);
    setEditTime(utcToLocalDateTimeInput(entry.taken_at, timezone));
    setEditNotes(entry.notes ?? '');
  };

  const handleSaveEditEntry = () => {
    if (!editingEntry) return;
    const notes = editNotes.trim() || null;
    const takenAtUtc = editTime
      ? localDateTimeToUtc(editTime, timezone).toISOString()
      : undefined;
    const entryDate = editTime ? editTime.substring(0, 10) : undefined;
    const onSuccess = () => setEditingEntry(null);

    updateEntryMutation.mutate(
      {
        id: editingEntry.id,
        body: {
          ...(takenAtUtc ? { taken_at: takenAtUtc } : {}),
          ...(entryDate ? { entry_date: entryDate } : {}),
          notes,
        },
      },
      { onSuccess }
    );
  };

  const formatEntryTime = (timestamp: string) => {
    try {
      return formatTime(timestamp);
    } catch (e) {
      return '--:--';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-6">
          {/* Today's Stack: unified checklist of everything due or as-needed today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  {t('medications.today.stackTitle', "Today's Stack")}
                </CardTitle>
                {dueDoses.length > 0 && (
                  <Badge variant="secondary">
                    {t(
                      'medications.today.takenBadge',
                      '{{done}}/{{total}} Taken',
                      {
                        done: completedDosesCount,
                        total: dueDoses.length,
                      }
                    )}
                  </Badge>
                )}
              </div>
              <AddMedicationDialog
                defaultIsSupplement
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="text-xs font-semibold">
                      {t('medications.cabinet.addSupplement', 'Add Supplement')}
                    </span>
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingMeds && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'medications.today.loadingChecklist',
                    'Loading checklist…'
                  )}
                </p>
              )}
              {!loadingMeds && stackRows.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t(
                    'medications.today.emptyStack',
                    'Nothing scheduled. Add a supplement to build your daily stack.'
                  )}
                </div>
              )}
              {!loadingMeds &&
                stackGroupOrder.map((group) => {
                  const rows = groupedRows[group.key];
                  if (rows.length === 0) return null;
                  return (
                    <div key={group.key} className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </h3>
                      <div className="space-y-2">
                        {rows.map((row) => {
                          const isDone = !!row.entry;
                          return (
                            <div
                              key={row.key}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                                isDone
                                  ? 'border-muted bg-muted/30'
                                  : 'border-border bg-card hover:shadow-sm'
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isDone && row.entry
                                    ? handleUndoEntry(row.entry)
                                    : row.take()
                                }
                                disabled={isPending}
                                aria-label={
                                  isDone
                                    ? t('medications.today.undo', 'Undo')
                                    : t('medications.today.take', 'Take')
                                }
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                                  isDone
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-muted-foreground/30 text-transparent hover:border-emerald-400'
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </button>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    'text-sm font-medium',
                                    isDone &&
                                      'text-muted-foreground line-through opacity-70'
                                  )}
                                >
                                  {row.name}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                  {row.doseLabel && (
                                    <span>{row.doseLabel}</span>
                                  )}
                                  {row.doseLabel && row.notes && <span>·</span>}
                                  {row.notes && (
                                    <span className="italic">{row.notes}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                {row.timeLabel ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 text-[10px] font-medium"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {row.timeLabel}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {t(
                                      'medications.schedule.anyTime',
                                      'Any time'
                                    )}
                                  </Badge>
                                )}
                                {isDone && row.entry && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() =>
                                      row.entry && handleUndoEntry(row.entry)
                                    }
                                    disabled={isPending}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    {t('medications.today.undo', 'Undo')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <MedicationLogCalendar
            medications={meds}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
          {/* Today Activity Log Column */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  </span>
                  {t('medications.today.loggedActivity', 'Logged today')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'medications.today.loggedActivityDescription',
                    "Everything you've taken or skipped on this date."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingEntries && (
                  <p className="text-sm text-muted-foreground">
                    {t('medications.today.loadingHistory', 'Loading history…')}
                  </p>
                )}
                {!loadingEntries && entries.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {t(
                      'medications.today.noIntake',
                      'No entries logged yet today.'
                    )}
                  </div>
                )}
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/10 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MedTypeIcon
                        typeId={
                          meds.find((m) => m.id === entry.medication_id)
                            ?.type_id
                        }
                        className="h-4 w-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {entry.med_name_snapshot}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span className="tabular-nums font-medium">
                            {formatEntryTime(entry.taken_at)}
                          </span>
                          <span>•</span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 border-none font-semibold ${
                              entry.status === 'taken'
                                ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                : entry.status === 'prn_taken'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : entry.status === 'snoozed'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-850 dark:text-gray-300'
                            }`}
                          >
                            {entry.status === 'taken'
                              ? t('medications.today.taken', 'Taken')
                              : entry.status === 'prn_taken'
                                ? t('medications.today.prnTaken', 'PRN Taken')
                                : entry.status === 'snoozed'
                                  ? t('medications.today.snoozed', 'Snoozed')
                                  : t(
                                      'medications.calendar.skipped',
                                      'Skipped'
                                    )}
                          </Badge>
                        </div>
                        {entry.notes && (
                          <p className="text-[11px] text-muted-foreground italic mt-1">
                            {t('medications.today.note', 'Note:')} {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => openEditEntry(entry)}
                        disabled={isPending}
                        aria-label={t(
                          'medications.today.editEntryTime',
                          'Edit entry time'
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleUndoEntry(entry)}
                        disabled={isPending}
                        aria-label={t(
                          'medications.today.removeEntry',
                          'Remove entry'
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit logged dose time/notes */}
      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
      >
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('medications.today.editLogged', 'Edit logged dose')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingEntry?.med_name_snapshot && (
              <p className="text-sm font-medium">
                {editingEntry.med_name_snapshot}
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('medications.today.takenAt', 'Taken at')}
              </Label>
              <Input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('common.notes', 'Notes')}
              </Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingEntry(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveEditEntry} disabled={isPending}>
              {isPending
                ? t('common.saving', 'Saving...')
                : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
