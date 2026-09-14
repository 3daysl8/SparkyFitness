import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import DayNavigator from '@/components/DayNavigator';
import {
  Package,
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

export default function Medications() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'today' | 'cabinet'>('today');
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
      {/* Navigation & Date Filter Row */}
      <div className="w-full flex flex-col lg:flex-row items-center gap-4 lg:gap-6 border-b pb-3 mb-6">
        {/* Navigation Pills */}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1 flex-1">
          <Button
            variant={activeTab === 'today' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('today')}
            className={`rounded-full px-4 h-9 gap-2 transition-all ${
              activeTab === 'today'
                ? 'bg-slate-200/60 dark:bg-muted shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold">
              {t('medications.tabs.log', 'Log')}
            </span>
          </Button>
          <Button
            variant={activeTab === 'cabinet' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('cabinet')}
            className={`rounded-full px-4 h-9 gap-2 transition-all ${
              activeTab === 'cabinet'
                ? 'bg-slate-200/60 dark:bg-muted shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="text-xs font-semibold">
              {t('medications.tabs.cabinet', 'Cabinet')}
            </span>
          </Button>
        </div>

        {/* Vertical Divider (Desktop Only) */}
        <div className="hidden lg:block w-px h-6 bg-border" />

        {/* Date Filter */}
        <div className="shrink-0">
          <DayNavigator
            selectedDate={selectedDate}
            onDateChange={(d) => setSearchParams({ date: d })}
            className="flex items-center justify-end gap-2 mb-0"
          />
        </div>
      </div>

      {activeTab === 'today' && (
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

      {activeTab === 'cabinet' && (
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
                color: 'text-emerald-500',
              },
              {
                label: t('medications.cabinet.supplements', 'Supplements'),
                value: visibleMeds.filter((m) => m.is_active && m.is_supplement)
                  .length,
                Icon: Tablets,
                color: 'text-teal-500',
              },
              {
                label: t(
                  'medications.cabinet.scheduledToday',
                  'Scheduled today'
                ),
                value: dueTodayCount,
                Icon: Clock,
                color: 'text-amber-500',
              },
              {
                label: t('medications.cabinet.totalMeds', 'Total items'),
                value: visibleMeds.length,
                Icon: Activity,
                color: 'text-slate-500',
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`rounded-lg bg-muted p-2 ${kpi.color}`}>
                    <kpi.Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
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
                  className={`cursor-pointer transition hover:shadow-sm ${
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
