import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getDueDosesForDate, formatDose } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, RotateCcw, ExternalLink } from 'lucide-react';
import {
  useMedications,
  useMedicationEntries,
  useCreateMedicationEntryMutation,
  useDeleteMedicationEntryMutation,
} from '@/hooks/useMedications';
import type { MedicationDetail, MedicationEntry } from '@/types/medications';
import { entryMatchesDue } from '@/utils/medicationUtils';

export default function SupplementsSnapshotCard({
  selectedDate,
}: {
  selectedDate: string;
}) {
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
