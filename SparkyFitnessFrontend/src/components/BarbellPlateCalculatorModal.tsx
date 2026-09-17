import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dumbbell, Plus, Minus, Check, AlertCircle } from 'lucide-react';
import {
  calculatePlates,
  BARBELL_OPTIONS,
  type PlateCalculationResult,
} from '@/utils/plateCalculator';

export interface BarbellPlateCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWeight?: number | null;
  weightUnit?: string;
  onApplyWeight?: (weight: number) => void;
}

interface BarbellPlateCalculatorContentProps {
  initialWeight?: number | null;
  weightUnit?: string;
  onApplyWeight?: (weight: number) => void;
  onClose: () => void;
}

const BarbellPlateCalculatorContent = ({
  initialWeight = 60,
  weightUnit = 'kg',
  onApplyWeight,
  onClose,
}: BarbellPlateCalculatorContentProps) => {
  const { t } = useTranslation();
  const [targetWeight, setTargetWeight] = useState<number>(
    () => initialWeight || 60
  );
  const [barWeight, setBarWeight] = useState<number>(() =>
    weightUnit === 'lbs' ? 45 : 20
  );

  const result: PlateCalculationResult = useMemo(() => {
    return calculatePlates(targetWeight, barWeight, weightUnit);
  }, [targetWeight, barWeight, weightUnit]);

  const stepSizes =
    weightUnit === 'lbs' ? [2.5, 5, 10, 25] : [1.25, 2.5, 5, 10];

  const handleAdjustWeight = (delta: number) => {
    setTargetWeight((prev) =>
      Math.max(0, Math.round((prev + delta) * 100) / 100)
    );
  };

  const handleApply = () => {
    if (onApplyWeight) {
      onApplyWeight(targetWeight);
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {t('exercise.plateCalculator.title', 'Plate Calculator')}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Target Weight & Bar Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="target-weight-input"
              className="text-xs font-semibold"
            >
              {t('exercise.plateCalculator.targetWeight', 'Target Weight')} (
              {weightUnit})
            </Label>
            <Input
              id="target-weight-input"
              type="number"
              step="any"
              min="0"
              value={targetWeight || ''}
              onChange={(e) => setTargetWeight(Number(e.target.value) || 0)}
              className="font-bold text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bar-select" className="text-xs font-semibold">
              {t('exercise.plateCalculator.barWeight', 'Bar Weight')} (
              {weightUnit})
            </Label>
            <Select
              value={String(barWeight)}
              onValueChange={(val) => setBarWeight(Number(val))}
            >
              <SelectTrigger id="bar-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BARBELL_OPTIONS.map((opt) => (
                  <SelectItem
                    key={`${opt.label}-${opt.weight}`}
                    value={String(opt.weight)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Stepper Buttons */}
        <div className="flex items-center justify-between gap-1.5">
          {stepSizes.map((step) => (
            <Button
              key={`minus-${step}`}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAdjustWeight(-step)}
              className="h-8 px-2 text-xs flex-1"
            >
              <Minus className="h-3 w-3 mr-0.5" />
              {step}
            </Button>
          ))}
          {stepSizes.map((step) => (
            <Button
              key={`plus-${step}`}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAdjustWeight(step)}
              className="h-8 px-2 text-xs flex-1"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              {step}
            </Button>
          ))}
        </div>

        {/* Barbell Visual Sleeve Display */}
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">
              {t('exercise.plateCalculator.eachSide', 'Each Side')}
            </span>
            <span className="font-bold text-sm text-foreground">
              {result.weightPerSide} {weightUnit} / side
            </span>
          </div>

          {/* Realistic Barbell Sleeve */}
          <div className="relative flex items-center justify-center py-6">
            {/* Bar Shaft */}
            <div className="h-4 w-12 rounded-l bg-slate-400 dark:bg-slate-600" />
            {/* Bar Collar */}
            <div className="h-10 w-3 rounded-sm bg-slate-500 dark:bg-slate-500 ring-1 ring-slate-600" />

            {/* Sleeve Loading Area */}
            <div className="h-5 flex-1 max-w-[200px] bg-slate-300 dark:bg-slate-700 flex items-center justify-start pl-0.5 overflow-hidden">
              {result.platesPerSide.length === 0 ? (
                <span className="text-[10px] text-muted-foreground px-2 italic">
                  {t('exercise.plateCalculator.emptyBar', 'Empty Bar')}
                </span>
              ) : (
                <div className="flex items-center gap-0.5">
                  {result.platesPerSide.map((item) =>
                    Array.from({ length: item.count }).map((_, i) => (
                      <div
                        key={`${item.plate.weight}-${i}`}
                        className={`w-3.5 sm:w-4 ${item.plate.heightClass} rounded-[2px] shadow-md flex items-center justify-center font-bold text-[9px]`}
                        style={{
                          backgroundColor: item.plate.color,
                          borderColor: item.plate.borderColor,
                          color: item.plate.textColor,
                          borderWidth: 1.5,
                        }}
                      >
                        <span className="-rotate-90 select-none">
                          {item.plate.weight}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* Sleeve Cap */}
            <div className="h-6 w-2 rounded-r bg-slate-400 dark:bg-slate-600" />
          </div>
        </div>

        {/* Plate Breakdown Text List */}
        {result.platesPerSide.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
            {result.platesPerSide.map((item) => (
              <span
                key={item.plate.weight}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${item.plate.color}20`,
                  color: item.plate.borderColor,
                  border: `1px solid ${item.plate.borderColor}40`,
                }}
              >
                {item.count} × {item.plate.weight} {weightUnit}
              </span>
            ))}
          </div>
        ) : null}

        {/* Remainder warning if not exact */}
        {!result.isExact && result.remainder !== 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {t('exercise.plateCalculator.remainderWarning', {
                remainder: Math.abs(result.remainder),
                unit: weightUnit,
                defaultValue: `Cannot exact-match: ${Math.abs(result.remainder)} ${weightUnit} difference.`,
              })}
            </span>
          </div>
        )}
      </div>

      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {onApplyWeight && (
          <Button type="button" onClick={handleApply} className="gap-1.5">
            <Check className="h-4 w-4" />
            {t(
              'exercise.plateCalculator.applyWeight',
              'Apply {{weight}} {{unit}}',
              {
                weight: targetWeight,
                unit: weightUnit,
              }
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
};

export const BarbellPlateCalculatorModal = ({
  open,
  onOpenChange,
  initialWeight = 60,
  weightUnit = 'kg',
  onApplyWeight,
}: BarbellPlateCalculatorModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BarbellPlateCalculatorContent
          key={`${open ? 'open' : 'closed'}-${initialWeight}-${weightUnit}`}
          initialWeight={initialWeight}
          weightUnit={weightUnit}
          onApplyWeight={onApplyWeight}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default BarbellPlateCalculatorModal;
