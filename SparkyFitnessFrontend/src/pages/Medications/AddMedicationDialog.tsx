import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pill,
  Sparkles,
  Clock,
  Calendar,
  Utensils,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  useCreateMedicationWithSchedulesMutation,
  useUpdateMedicationMutation,
} from '@/hooks/useMedications';
import type { Medication, MedicationSchedule } from '@/types/medications';
import type { MedicationWithMeal } from '@workspace/shared';
import {
  MED_TYPES,
  MED_TYPE_ICONS,
  MED_TYPE_COLORS,
  SUPPLEMENT_FORMS,
  positiveDoseOrNull,
} from './medicationUtils';

export function MedTypeIcon({
  typeId,
  isGlp1,
  className,
}: {
  typeId?: string | null;
  isGlp1?: boolean;
  className?: string;
}) {
  const key = typeId ?? (isGlp1 ? 'injection' : 'pill');
  const Icon = MED_TYPE_ICONS[key] ?? Pill;
  const color = MED_TYPE_COLORS[key] ?? 'text-muted-foreground';
  return <Icon className={`${color} ${className ?? ''}`} />;
}

export type FrequencyPreset =
  '1x_daily' | '2x_daily' | '3x_daily' | 'specific_days' | 'prn';

interface DoseSlot {
  time: string;
  withMeal: MedicationWithMeal | 'none';
}

const DEFAULT_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

export default function AddMedicationDialog({
  editMed,
  trigger,
  defaultIsSupplement = false,
}: {
  editMed?: Medication;
  trigger?: ReactNode;
  defaultIsSupplement?: boolean;
} = {}) {
  const { t } = useTranslation();
  const isEdit = Boolean(editMed);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editMed?.name ?? '');
  const [displayName, setDisplayName] = useState(editMed?.display_name ?? '');
  const [isSupplement, setIsSupplement] = useState(
    editMed?.is_supplement ?? defaultIsSupplement
  );
  const [typeId, setTypeId] = useState(() => {
    const isSupp = editMed?.is_supplement ?? defaultIsSupplement;
    const initial = editMed?.type_id ?? (isSupp ? 'capsule' : 'pill');
    return initial;
  });
  const [strength, setStrength] = useState(
    editMed?.strength_value != null ? String(editMed.strength_value) : ''
  );
  const [strengthUnit, setStrengthUnit] = useState(
    editMed?.strength_unit ?? 'mg'
  );
  const [doseAmount, setDoseAmount] = useState(
    editMed?.dose_amount != null ? String(editMed.dose_amount) : '1'
  );
  const [doseUnit, setDoseUnit] = useState(
    editMed?.dose_unit ?? (isSupplement ? 'capsule' : 'pill')
  );
  const [isActive, setIsActive] = useState(editMed?.is_active ?? true);
  const [reason, setReason] = useState(editMed?.reason_text ?? '');
  const [notes, setNotes] = useState(editMed?.notes ?? '');

  // Schedule & Multi-Dose State
  const [frequency, setFrequency] = useState<FrequencyPreset>('1x_daily');
  const [doseSlots, setDoseSlots] = useState<DoseSlot[]>([
    { time: '08:00', withMeal: 'none' },
    { time: '20:00', withMeal: 'none' },
    { time: '13:00', withMeal: 'none' },
  ]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(DEFAULT_DAYS_OF_WEEK);
  const [prnReason, setPrnReason] = useState('');

  const createMutation = useCreateMedicationWithSchedulesMutation();
  const updateMutation = useUpdateMedicationMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && editMed) {
      setName(editMed.name ?? '');
      setDisplayName(editMed.display_name ?? '');
      setIsSupplement(editMed.is_supplement ?? false);
      setTypeId(
        editMed.type_id ?? (editMed.is_supplement ? 'capsule' : 'pill')
      );
      setStrength(
        editMed.strength_value != null ? String(editMed.strength_value) : ''
      );
      setStrengthUnit(editMed.strength_unit ?? 'mg');
      setDoseAmount(
        editMed.dose_amount != null ? String(editMed.dose_amount) : '1'
      );
      setDoseUnit(editMed.dose_unit ?? 'capsule');
      setIsActive(editMed.is_active ?? true);
      setReason(editMed.reason_text ?? '');
      setNotes(editMed.notes ?? '');

      // Infer schedule preset if schedules exist
      const scheds = editMed.schedules ?? [];
      if (
        scheds.length >= 3 &&
        scheds.every((s) => s.schedule_type_id === 'daily')
      ) {
        setFrequency('3x_daily');
        setDoseSlots([
          {
            time: scheds[0]?.time_of_day || '08:00',
            withMeal: scheds[0]?.with_meal || 'none',
          },
          {
            time: scheds[1]?.time_of_day || '13:00',
            withMeal: scheds[1]?.with_meal || 'none',
          },
          {
            time: scheds[2]?.time_of_day || '20:00',
            withMeal: scheds[2]?.with_meal || 'none',
          },
        ]);
      } else if (
        scheds.length === 2 &&
        scheds.every((s) => s.schedule_type_id === 'daily')
      ) {
        setFrequency('2x_daily');
        setDoseSlots([
          {
            time: scheds[0]?.time_of_day || '08:00',
            withMeal: scheds[0]?.with_meal || 'none',
          },
          {
            time: scheds[1]?.time_of_day || '20:00',
            withMeal: scheds[1]?.with_meal || 'none',
          },
          { time: '13:00', withMeal: 'none' },
        ]);
      } else if (scheds.some((s) => s.schedule_type_id === 'weekly')) {
        setFrequency('specific_days');
        const weekly = scheds.find((s) => s.schedule_type_id === 'weekly');
        setDaysOfWeek(weekly?.days_of_week ?? DEFAULT_DAYS_OF_WEEK);
        setDoseSlots([
          {
            time: weekly?.time_of_day || '08:00',
            withMeal: weekly?.with_meal || 'none',
          },
          { time: '20:00', withMeal: 'none' },
          { time: '13:00', withMeal: 'none' },
        ]);
      } else if (scheds.some((s) => s.schedule_type_id === 'prn')) {
        setFrequency('prn');
        const prn = scheds.find((s) => s.schedule_type_id === 'prn');
        setPrnReason(prn?.prn_reason || '');
      } else {
        setFrequency('1x_daily');
        const daily = scheds.find((s) => s.schedule_type_id === 'daily');
        setDoseSlots([
          {
            time: daily?.time_of_day || '08:00',
            withMeal: daily?.with_meal || 'none',
          },
          { time: '20:00', withMeal: 'none' },
          { time: '13:00', withMeal: 'none' },
        ]);
      }
    } else if (nextOpen && !editMed) {
      setName('');
      setDisplayName('');
      setIsSupplement(defaultIsSupplement);
      setTypeId(defaultIsSupplement ? 'capsule' : 'pill');
      setStrength('');
      setStrengthUnit('mg');
      setDoseAmount('1');
      setDoseUnit(defaultIsSupplement ? 'capsule' : 'pill');
      setIsActive(true);
      setReason('');
      setNotes('');
      setFrequency('1x_daily');
      setDoseSlots([
        { time: '08:00', withMeal: 'none' },
        { time: '20:00', withMeal: 'none' },
        { time: '13:00', withMeal: 'none' },
      ]);
      setDaysOfWeek(DEFAULT_DAYS_OF_WEEK);
      setPrnReason('');
    }
  };

  const handleFrequencyChange = (val: string) => {
    setFrequency(val as FrequencyPreset);
  };

  const updateDoseSlot = (index: number, patch: Partial<DoseSlot>) => {
    setDoseSlots((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const parsedStrength = positiveDoseOrNull(strength);
    const parsedDose = positiveDoseOrNull(doseAmount);

    const payload: Partial<Medication> & { name: string } = {
      name: name.trim(),
      display_name: displayName.trim() || null,
      type_id: typeId || null,
      strength_value: parsedStrength,
      strength_unit: parsedStrength != null ? strengthUnit : null,
      dose_amount: parsedDose,
      dose_unit: doseUnit || null,
      is_supplement: isSupplement,
      is_active: isActive,
      reason_text: reason.trim() || null,
      notes: notes.trim() || null,
      nutrients: editMed?.nutrients ?? {},
      source: editMed?.source ?? 'user',
      custom_fields: editMed?.custom_fields ?? {},
    };

    if (isEdit && editMed) {
      updateMutation.mutate(
        { id: editMed.id, body: payload },
        { onSuccess: () => setOpen(false) }
      );
    } else {
      const schedulesToCreate: Array<
        Partial<MedicationSchedule> & { schedule_type_id: string }
      > = [];

      if (frequency === '1x_daily') {
        schedulesToCreate.push({
          schedule_type_id: 'daily',
          time_of_day: doseSlots[0]?.time || '08:00',
          with_meal:
            doseSlots[0]?.withMeal && doseSlots[0]?.withMeal !== 'none'
              ? (doseSlots[0]?.withMeal as MedicationWithMeal)
              : null,
        });
      } else if (frequency === '2x_daily') {
        schedulesToCreate.push(
          {
            schedule_type_id: 'daily',
            time_of_day: doseSlots[0]?.time || '08:00',
            with_meal:
              doseSlots[0]?.withMeal && doseSlots[0]?.withMeal !== 'none'
                ? (doseSlots[0]?.withMeal as MedicationWithMeal)
                : null,
          },
          {
            schedule_type_id: 'daily',
            time_of_day: doseSlots[1]?.time || '20:00',
            with_meal:
              doseSlots[1]?.withMeal && doseSlots[1]?.withMeal !== 'none'
                ? (doseSlots[1]?.withMeal as MedicationWithMeal)
                : null,
          }
        );
      } else if (frequency === '3x_daily') {
        schedulesToCreate.push(
          {
            schedule_type_id: 'daily',
            time_of_day: doseSlots[0]?.time || '08:00',
            with_meal:
              doseSlots[0]?.withMeal && doseSlots[0]?.withMeal !== 'none'
                ? (doseSlots[0]?.withMeal as MedicationWithMeal)
                : null,
          },
          {
            schedule_type_id: 'daily',
            time_of_day: doseSlots[1]?.time || '13:00',
            with_meal:
              doseSlots[1]?.withMeal && doseSlots[1]?.withMeal !== 'none'
                ? (doseSlots[1]?.withMeal as MedicationWithMeal)
                : null,
          },
          {
            schedule_type_id: 'daily',
            time_of_day: doseSlots[2]?.time || '20:00',
            with_meal:
              doseSlots[2]?.withMeal && doseSlots[2]?.withMeal !== 'none'
                ? (doseSlots[2]?.withMeal as MedicationWithMeal)
                : null,
          }
        );
      } else if (frequency === 'specific_days') {
        schedulesToCreate.push({
          schedule_type_id: 'weekly',
          days_of_week:
            daysOfWeek.length > 0 ? daysOfWeek : DEFAULT_DAYS_OF_WEEK,
          time_of_day: doseSlots[0]?.time || '08:00',
          with_meal:
            doseSlots[0]?.withMeal && doseSlots[0]?.withMeal !== 'none'
              ? (doseSlots[0]?.withMeal as MedicationWithMeal)
              : null,
        });
      } else if (frequency === 'prn') {
        schedulesToCreate.push({
          schedule_type_id: 'prn',
          prn_reason: prnReason || null,
        });
      }

      createMutation.mutate(
        { medication: payload, schedules: schedulesToCreate },
        { onSuccess: () => setOpen(false) }
      );
    }
  };

  const dayLabels = [
    { id: 1, label: t('common.day_short.monday', 'M') },
    { id: 2, label: t('common.day_short.tuesday', 'T') },
    { id: 3, label: t('common.day_short.wednesday', 'W') },
    { id: 4, label: t('common.day_short.thursday', 'T') },
    { id: 5, label: t('common.day_short.friday', 'F') },
    { id: 6, label: t('common.day_short.saturday', 'S') },
    { id: 0, label: t('common.day_short.sunday', 'S') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="rounded-full gap-1">
            <Plus className="h-4 w-4" />
            <span>
              {isSupplement
                ? t('medications.cabinet.addSupplement', 'Add Supplement')
                : t('medications.cabinet.addMed', 'Add Protocol')}
            </span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSupplement ? (
              <Sparkles className="h-5 w-5 text-emerald-500" />
            ) : (
              <Pill className="h-5 w-5 text-primary" />
            )}
            {isEdit
              ? isSupplement
                ? t('medications.cabinet.editSupplement', 'Edit Supplement')
                : t('medications.cabinet.editMed', 'Edit Protocol')
              : isSupplement
                ? t('medications.cabinet.addSupplement', 'Add Supplement')
                : t('medications.cabinet.addMed', 'Add Protocol / Routine')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Supplement toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
              <Label
                htmlFor="is_supplement_switch"
                className="font-medium text-sm"
              >
                {t(
                  'medications.cabinet.supplementCategory',
                  'Supplement / Vitamin'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'medications.cabinet.supplementHint',
                  'Categorize as a daily wellness supplement vs medication/routine.'
                )}
              </p>
            </div>
            <Switch
              id="is_supplement_switch"
              checked={isSupplement}
              onCheckedChange={setIsSupplement}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="med_name">
              {t('medications.cabinet.name', 'Name')} *
            </Label>
            <Input
              id="med_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isSupplement
                  ? 'e.g. Creatine Monohydrate, Vitamin D3'
                  : 'e.g. Morning Routine, Blood Pressure Pill'
              }
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="med_display_name">
              {t('medications.cabinet.displayName', 'Display Name (Optional)')}
            </Label>
            <Input
              id="med_display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Daily Creatine"
            />
          </div>

          {/* Form / Type & Dose */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('medications.cabinet.form', 'Form / Type')}</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <MedTypeIcon typeId={typeId} className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(isSupplement ? SUPPLEMENT_FORMS : MED_TYPES).map((form) => (
                    <SelectItem key={form} value={form}>
                      <div className="flex items-center gap-2 capitalize">
                        <MedTypeIcon typeId={form} className="h-4 w-4" />
                        <span>{form.replace('_', ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="med_dose_amount">
                {t('medications.cabinet.doseAmount', 'Default Dose')}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="med_dose_amount"
                  type="number"
                  step="0.1"
                  min="0"
                  value={doseAmount}
                  onChange={(e) => setDoseAmount(e.target.value)}
                  placeholder="1"
                  className="w-20"
                />
                <Input
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                  placeholder="capsule, scoop, etc."
                />
              </div>
            </div>
          </div>

          {/* Strength (optional) */}
          <div className="space-y-2">
            <Label>
              {t(
                'medications.cabinet.strength',
                'Strength per unit (Optional)'
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="500"
              />
              <Select value={strengthUnit} onValueChange={setStrengthUnit}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mg">mg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="mcg">mcg</SelectItem>
                  <SelectItem value="IU">IU</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule & Timing Section */}
          <div className="space-y-3 p-3.5 border rounded-lg bg-card/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">
                  {t(
                    'medications.cabinet.scheduleTiming',
                    'Schedule & Daily Timing'
                  )}
                </Label>
              </div>
            </div>

            {/* Frequency Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('medications.cabinet.frequency', 'Frequency')}
              </Label>
              <Select value={frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x_daily">
                    {t('medications.cabinet.freq1x', 'Once Daily (1x)')}
                  </SelectItem>
                  <SelectItem value="2x_daily">
                    {t(
                      'medications.cabinet.freq2x',
                      'Twice Daily (2x - Morning & Evening)'
                    )}
                  </SelectItem>
                  <SelectItem value="3x_daily">
                    {t(
                      'medications.cabinet.freq3x',
                      'Three Times Daily (3x - Morning, Midday, Evening)'
                    )}
                  </SelectItem>
                  <SelectItem value="specific_days">
                    {t(
                      'medications.cabinet.freqSpecificDays',
                      'Specific Days of Week'
                    )}
                  </SelectItem>
                  <SelectItem value="prn">
                    {t(
                      'medications.cabinet.freqPrn',
                      'As Needed (PRN / No fixed time)'
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dose Time Pickers */}
            {frequency === '1x_daily' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    {t('medications.cabinet.doseTime', 'Dose Time')}
                  </Label>
                  <Input
                    type="time"
                    value={doseSlots[0]?.time}
                    onChange={(e) =>
                      updateDoseSlot(0, { time: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Utensils className="h-3.5 w-3.5" />
                    {t(
                      'medications.cabinet.mealTiming',
                      'Meal Timing (Optional)'
                    )}
                  </Label>
                  <Select
                    value={doseSlots[0]?.withMeal || 'none'}
                    onValueChange={(val) =>
                      updateDoseSlot(0, {
                        withMeal: val as MedicationWithMeal | 'none',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t(
                          'medications.cabinet.noMealRestriction',
                          'Any Time / No restriction'
                        )}
                      </SelectItem>
                      <SelectItem value="with">
                        {t('medications.mealRelation.with', 'With meal')}
                      </SelectItem>
                      <SelectItem value="before">
                        {t('medications.mealRelation.before', 'Before meal')}
                      </SelectItem>
                      <SelectItem value="after">
                        {t('medications.mealRelation.after', 'After meal')}
                      </SelectItem>
                      <SelectItem value="away_from_meals">
                        {t(
                          'medications.mealRelation.awayFromMeals',
                          'Away from meals'
                        )}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {frequency === '2x_daily' && (
              <div className="space-y-3 pt-2">
                {/* Dose 1 (Morning) */}
                <div className="p-2.5 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      {t(
                        'medications.cabinet.dose1Morning',
                        'Dose 1 (Morning)'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={doseSlots[0]?.time}
                      onChange={(e) =>
                        updateDoseSlot(0, { time: e.target.value })
                      }
                    />
                    <Select
                      value={doseSlots[0]?.withMeal || 'none'}
                      onValueChange={(val) =>
                        updateDoseSlot(0, {
                          withMeal: val as MedicationWithMeal | 'none',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            'medications.cabinet.noMealRestriction',
                            'Any Time / No restriction'
                          )}
                        </SelectItem>
                        <SelectItem value="with">
                          {t('medications.mealRelation.with', 'With meal')}
                        </SelectItem>
                        <SelectItem value="before">
                          {t('medications.mealRelation.before', 'Before meal')}
                        </SelectItem>
                        <SelectItem value="after">
                          {t('medications.mealRelation.after', 'After meal')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dose 2 (Evening) */}
                <div className="p-2.5 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {t(
                        'medications.cabinet.dose2Evening',
                        'Dose 2 (Evening)'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={doseSlots[1]?.time}
                      onChange={(e) =>
                        updateDoseSlot(1, { time: e.target.value })
                      }
                    />
                    <Select
                      value={doseSlots[1]?.withMeal || 'none'}
                      onValueChange={(val) =>
                        updateDoseSlot(1, {
                          withMeal: val as MedicationWithMeal | 'none',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            'medications.cabinet.noMealRestriction',
                            'Any Time / No restriction'
                          )}
                        </SelectItem>
                        <SelectItem value="with">
                          {t('medications.mealRelation.with', 'With meal')}
                        </SelectItem>
                        <SelectItem value="after">
                          {t('medications.mealRelation.after', 'After meal')}
                        </SelectItem>
                        <SelectItem value="away_from_meals">
                          {t(
                            'medications.mealRelation.awayFromMeals',
                            'Away from meals'
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {frequency === '3x_daily' && (
              <div className="space-y-3 pt-2">
                {/* Dose 1 (Morning) */}
                <div className="p-2.5 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      {t(
                        'medications.cabinet.dose1Morning',
                        'Dose 1 (Morning)'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={doseSlots[0]?.time}
                      onChange={(e) =>
                        updateDoseSlot(0, { time: e.target.value })
                      }
                    />
                    <Select
                      value={doseSlots[0]?.withMeal || 'none'}
                      onValueChange={(val) =>
                        updateDoseSlot(0, {
                          withMeal: val as MedicationWithMeal | 'none',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            'medications.cabinet.noMealRestriction',
                            'Any Time / No restriction'
                          )}
                        </SelectItem>
                        <SelectItem value="with">
                          {t('medications.mealRelation.with', 'With meal')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dose 2 (Midday) */}
                <div className="p-2.5 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sunset className="h-3.5 w-3.5 text-orange-400" />
                    <span>
                      {t(
                        'medications.cabinet.dose2Midday',
                        'Dose 2 (Midday / Lunch)'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={doseSlots[1]?.time}
                      onChange={(e) =>
                        updateDoseSlot(1, { time: e.target.value })
                      }
                    />
                    <Select
                      value={doseSlots[1]?.withMeal || 'none'}
                      onValueChange={(val) =>
                        updateDoseSlot(1, {
                          withMeal: val as MedicationWithMeal | 'none',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            'medications.cabinet.noMealRestriction',
                            'Any Time / No restriction'
                          )}
                        </SelectItem>
                        <SelectItem value="with">
                          {t('medications.mealRelation.with', 'With meal')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dose 3 (Evening) */}
                <div className="p-2.5 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {t(
                        'medications.cabinet.dose3Evening',
                        'Dose 3 (Evening)'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={doseSlots[2]?.time}
                      onChange={(e) =>
                        updateDoseSlot(2, { time: e.target.value })
                      }
                    />
                    <Select
                      value={doseSlots[2]?.withMeal || 'none'}
                      onValueChange={(val) =>
                        updateDoseSlot(2, {
                          withMeal: val as MedicationWithMeal | 'none',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            'medications.cabinet.noMealRestriction',
                            'Any Time / No restriction'
                          )}
                        </SelectItem>
                        <SelectItem value="with">
                          {t('medications.mealRelation.with', 'With meal')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {frequency === 'specific_days' && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {t('medications.cabinet.activeDays', 'Active Days of Week')}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {dayLabels.map((d) => {
                      const isSelected = daysOfWeek.includes(d.id);
                      return (
                        <Button
                          key={d.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDayOfWeek(d.id)}
                          className="h-8 w-8 p-0 text-xs font-bold rounded-full"
                        >
                          {d.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <Input
                    type="time"
                    value={doseSlots[0]?.time}
                    onChange={(e) =>
                      updateDoseSlot(0, { time: e.target.value })
                    }
                  />
                  <Select
                    value={doseSlots[0]?.withMeal || 'none'}
                    onValueChange={(val) =>
                      updateDoseSlot(0, {
                        withMeal: val as MedicationWithMeal | 'none',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t(
                          'medications.cabinet.noMealRestriction',
                          'Any Time / No restriction'
                        )}
                      </SelectItem>
                      <SelectItem value="with">
                        {t('medications.mealRelation.with', 'With meal')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {frequency === 'prn' && (
              <div className="space-y-1 pt-2">
                <Label className="text-xs text-muted-foreground">
                  {t(
                    'medications.schedule.prnReason',
                    'As-Needed Condition / Trigger (Optional)'
                  )}
                </Label>
                <Input
                  value={prnReason}
                  onChange={(e) => setPrnReason(e.target.value)}
                  placeholder="e.g. For headaches, post-workout soreness"
                />
              </div>
            )}
          </div>

          {/* Reason / Purpose */}
          <div className="space-y-2">
            <Label htmlFor="med_reason">
              {t('medications.cabinet.reason', 'Target / Purpose (Optional)')}
            </Label>
            <Input
              id="med_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Muscle recovery, Joint health, Cognitive performance"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="med_notes">
              {t(
                'medications.cabinet.notes',
                'Notes & Instructions (Optional)'
              )}
            </Label>
            <Textarea
              id="med_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with food / plenty of water"
              rows={2}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor="is_active_switch" className="font-medium text-sm">
              {t('medications.cabinet.activeStatus', 'Active Routine')}
            </Label>
            <Switch
              id="is_active_switch"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending
              ? t('common.saving', 'Saving...')
              : isEdit
                ? t('common.save', 'Save Changes')
                : t('common.add', 'Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
