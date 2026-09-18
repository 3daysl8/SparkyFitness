import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getDueDosesForDate, formatDose } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { SectionCard } from '@/components/biometric/SectionCard';
import { DataRow } from '@/components/biometric/DataRow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ExternalLink, Pill, RotateCcw } from 'lucide-react';
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
    <SectionCard
      title={t('medications.today.supplementsTitle', "Today's Supplements")}
      icon={Pill}
      summary={
        dueDoses.length > 0
          ? `${completedCount} of ${dueDoses.length} completed`
          : `${supplementMeds.length} active supplements in cabinet`
      }
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/checkin?tab=protocols');
          }}
        >
          <span>Cabinet</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      }
      loading={loadingMeds || loadingEntries}
    >
      <div className="divide-y divide-border">
        {dueDoses.map((due, idx) => {
          const entry = entries.find((e) => entryMatchesDue(e, due));
          const isTaken = entry?.status === 'taken';

          return (
            <DataRow
              key={`${due.medication.id}-${due.schedule.id}-${idx}`}
              icon={Check}
              label={due.medication.display_name || due.medication.name}
              sublabel={formatDose(due.medication, due.schedule) ?? '1 dose'}
              state={isTaken ? 'complete' : 'default'}
              trailing={
                isTaken && entry ? (
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
                    className="h-7 px-3 text-xs"
                    onClick={() => handleTakeScheduled(due)}
                    disabled={createEntry.isPending}
                  >
                    {t('medications.today.take', 'Take')}
                  </Button>
                )
              }
            />
          );
        })}

        {dueDoses.length === 0 &&
          prnSupplements.map((med) => {
            const prnEntry = entries.find(
              (e) => e.medication_id === med.id && e.status === 'prn_taken'
            );
            return (
              <DataRow
                key={med.id}
                label={med.display_name || med.name}
                sublabel={formatDose(med) ?? 'As needed'}
                state={prnEntry ? 'complete' : 'default'}
                trailing={
                  prnEntry ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
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
                  )
                }
              />
            );
          })}
      </div>
    </SectionCard>
  );
}
