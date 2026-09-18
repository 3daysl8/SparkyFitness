import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Trash2,
  Activity,
  Clock,
  Pencil,
  Info,
  Pill,
  Tablets,
} from 'lucide-react';
import {
  todayInZone,
  getDueDosesForDate,
  formatDose,
  formatStrengthPerUnit,
} from '@workspace/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useMedications,
  useDeleteMedicationMutation,
  useMedicationEntries,
} from '@/hooks/useMedications';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { MedicationDetail } from '@/types/medications';
import AddMedicationDialog, { MedTypeIcon } from './AddMedicationDialog';
import { countMedicationNutrients } from './medicationUtils';
import ScheduleManager from './ScheduleManager';
import TodayMedications from './TodayMedications';
import { formatScheduleDescription } from './medicationUtils';

interface MedicationsProps {
  /** Which half of the old Log/Cabinet split to render — folded up into the
   * parent CheckIn page's own SegmentedControl rather than a nested one. */
  view: 'today' | 'cabinet';
}

export default function Medications({ view }: MedicationsProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  const preferencesContext = usePreferences();
  const timezone =
    preferencesContext?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeFormat = preferencesContext?.timeFormat ?? 'h:mm A';
  const today = todayInZone(timezone);

  const [selectedDate, setSelectedDate] = useState<string>(
    () => dateParam || today
  );

  useEffect(() => {
    const targetDate = dateParam || today;
    if (targetDate !== selectedDate) {
      setSelectedDate(targetDate);
    }
  }, [dateParam, today, selectedDate]);

  // Queries
  const { data: meds = [], isLoading: loadingMeds } = useMedications({
    activeOnly: false,
  });

  const { data: entries = [], isLoading: loadingEntries } =
    useMedicationEntries({
      fromDate: selectedDate,
      toDate: selectedDate,
    });

  const visibleMeds = meds as MedicationDetail[];

  const dueTodayCount = useMemo(() => {
    return getDueDosesForDate(visibleMeds, selectedDate, timezone).length;
  }, [visibleMeds, selectedDate, timezone]);

  // Mutations
  const removeMedMutation = useDeleteMedicationMutation();

  const handleDeleteMed = (id: string) =>
    removeMedMutation.mutate(id, { onSuccess: () => setSelectedId(null) });

  const selected = visibleMeds.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {view === 'today' && (
        <TodayMedications
          selectedDate={selectedDate}
          today={today}
          meds={visibleMeds}
          entries={entries}
          loadingMeds={loadingMeds}
          loadingEntries={loadingEntries}
          onSelectDate={(d) => setSearchParams({ date: d })}
        />
      )}

      {view === 'cabinet' && (
        <div className="space-y-6">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: t(
                  'medications.cabinet.activeScripts',
                  'Active routines'
                ),
                value: visibleMeds.filter((m) => m.is_active).length,
                Icon: Pill,
              },
              {
                label: t('medications.cabinet.supplements', 'Supplements'),
                value: visibleMeds.filter((m) => m.is_active && m.is_supplement)
                  .length,
                Icon: Tablets,
              },
              {
                label: t(
                  'medications.cabinet.scheduledToday',
                  'Scheduled today'
                ),
                value: dueTodayCount,
                Icon: Clock,
              },
              {
                label: t('medications.cabinet.totalMeds', 'Total items'),
                value: visibleMeds.length,
                Icon: Activity,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-surface-2 p-2 text-muted-foreground">
                    <kpi.Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="metric-num text-2xl text-foreground">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {kpi.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-[380px_1fr]">
            {/* Medications List */}
            <div className="space-y-4">
              {visibleMeds.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    {t(
                      'medications.cabinet.empty',
                      'No medications or supplements yet. Add your first one to get started.'
                    )}
                  </CardContent>
                </Card>
              )}
              {visibleMeds.map((med) => (
                <Card
                  key={med.id}
                  onClick={() => setSelectedId(med.id)}
                  className={`cursor-pointer transition hover:bg-surface-2 ${
                    selectedId === med.id
                      ? 'border-primary ring-1 ring-primary'
                      : ''
                  }`}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <MedTypeIcon typeId={med.type_id} className="h-5 w-5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {med.display_name || med.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{formatDose(med) ?? med.type_id}</span>
                          {med.schedules?.[0] && (
                            <>
                              <span>·</span>
                              <span>
                                {formatScheduleDescription(
                                  med.schedules[0],
                                  timeFormat
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!med.is_active && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t('medications.common.inactive', 'Inactive')}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected Medication Details (Drawer-like Right Column) */}
            <div>
              {!selected ? (
                <Card className="h-full border-dashed flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Info className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {t('medications.noSelection.title', 'No item selected')}
                  </CardTitle>
                  <CardDescription className="max-w-[240px] mt-1 text-xs">
                    {t(
                      'medications.noSelection.description',
                      'Select a medication or supplement from the list to view schedules and notes.'
                    )}
                  </CardDescription>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold">
                            {selected.display_name || selected.name}
                          </CardTitle>
                          {selected.is_supplement &&
                            countMedicationNutrients(selected.nutrients) >
                              0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {t('medications.cabinet.nutrientCount', {
                                  defaultValue: '{{count}} nutrient',
                                  defaultValue_other: '{{count}} nutrients',
                                  count: countMedicationNutrients(
                                    selected.nutrients
                                  ),
                                })}
                              </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs mt-0.5">
                          {[
                            formatDose(selected),
                            formatStrengthPerUnit(selected),
                          ]
                            .filter(Boolean)
                            .join(' · ') || selected.type_id}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <AddMedicationDialog
                          key={selected.id}
                          editMed={selected}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMed(selected.id)}
                          disabled={removeMedMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {selected.reason_text && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {t('medications.cabinet.reason', 'Reason')}
                          </p>
                          <p className="mt-0.5">{selected.reason_text}</p>
                        </div>
                      )}

                      {selected.notes && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {t('medications.cabinet.notes', 'Notes')}
                          </p>
                          <p className="whitespace-pre-wrap mt-0.5">
                            {selected.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <ScheduleManager med={selected} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
