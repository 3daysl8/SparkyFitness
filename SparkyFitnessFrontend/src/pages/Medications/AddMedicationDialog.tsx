import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pill, Sparkles } from 'lucide-react';
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
  useCreateMedicationMutation,
  useUpdateMedicationMutation,
} from '@/hooks/useMedications';
import type { Medication } from '@/types/medications';
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

  const createMutation = useCreateMedicationMutation();
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
    }
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
      createMutation.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  };

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

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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

          {/* Form / Type */}
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
