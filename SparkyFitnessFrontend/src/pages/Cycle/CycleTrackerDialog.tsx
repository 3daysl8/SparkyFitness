import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Heart,
  Droplet,
  Dumbbell,
  Apple,
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  useCyclePhase,
  useCycleDailyEntry,
  useSaveCycleDailyEntry,
  useCycleSettings,
} from '@/hooks/useCycle';
import { CycleFlow, CycleSymptom, CycleDailyEntry } from '@/types/cycle';
import { formatDateYMD } from '@/utils/cycleUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CycleTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  defaultTab?: 'insights' | 'log' | 'calendar';
}

const FLOW_OPTIONS: Array<{
  value: CycleFlow;
  label: string;
  iconFill: number;
}> = [
  { value: 'none', label: 'None', iconFill: 0 },
  { value: 'spotting', label: 'Spotting', iconFill: 1 },
  { value: 'light', label: 'Light', iconFill: 2 },
  { value: 'medium', label: 'Medium', iconFill: 3 },
  { value: 'heavy', label: 'Heavy', iconFill: 4 },
];

const SYMPTOM_OPTIONS: Array<{ value: CycleSymptom; label: string }> = [
  { value: 'cramps', label: 'Cramps' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'headache', label: 'Headache' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'breast_tenderness', label: 'Breast Tenderness' },
  { value: 'acne', label: 'Acne / Breakouts' },
  { value: 'mood_swings', label: 'Mood Swings' },
  { value: 'cravings', label: 'Food Cravings' },
  { value: 'backache', label: 'Lower Backache' },
  { value: 'insomnia', label: 'Sleep Trouble' },
];

interface DailyLogFormProps {
  activeDate: string;
  initialEntry: CycleDailyEntry | null | undefined;
  cycleDay: number;
  onClose: () => void;
}

const DailyLogForm: React.FC<DailyLogFormProps> = ({
  activeDate,
  initialEntry,
  cycleDay,
  onClose,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { settings, updateSettings } = useCycleSettings();
  const saveEntryMutation = useSaveCycleDailyEntry();

  const [selectedFlow, setSelectedFlow] = useState<CycleFlow | null>(
    () => initialEntry?.flow ?? null
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<CycleSymptom[]>(
    () => initialEntry?.symptoms ?? []
  );
  const [energyLevel, setEnergyLevel] = useState<number>(
    () => initialEntry?.energy ?? 3
  );
  const [notes, setNotes] = useState<string>(() => initialEntry?.notes ?? '');

  const toggleSymptom = (symptom: CycleSymptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSave = async () => {
    try {
      await saveEntryMutation.mutateAsync({
        date: activeDate,
        flow: selectedFlow,
        symptoms: selectedSymptoms,
        energy: energyLevel,
        notes: notes.trim() || undefined,
      });

      // If user logs flow on day > 20, automatically adjust last period start date
      if (
        selectedFlow &&
        selectedFlow !== 'none' &&
        selectedFlow !== 'spotting'
      ) {
        if (settings.last_period_start_date !== activeDate && cycleDay > 20) {
          updateSettings({ last_period_start_date: activeDate });
        }
      }

      toast({
        title: t('cycle.logSaved', 'Daily Log Saved'),
        description: t(
          'cycle.logSavedDesc',
          'Your cycle metrics and daily symptoms have been recorded.'
        ),
      });
      onClose();
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('cycle.failedToSave', 'Failed to save daily cycle log.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Flow Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">
          {t('cycle.log.flowIntensity', 'Period & Flow Intensity')}
        </Label>
        <div className="grid grid-cols-5 gap-1.5">
          {FLOW_OPTIONS.map((opt) => {
            const isSelected = selectedFlow === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedFlow(isSelected ? null : opt.value)}
                className={cn(
                  'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                  isSelected
                    ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold ring-1 ring-rose-500'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <Droplet
                  className={cn(
                    'w-4 h-4 mb-1',
                    isSelected
                      ? 'text-rose-600 dark:text-rose-400 fill-rose-500'
                      : 'text-muted-foreground'
                  )}
                />
                <span>{t(`cycle.flow.${opt.value}`, opt.label)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Symptoms Multi-Select */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">
          {t('cycle.log.symptoms', 'Physical & Emotional Symptoms')}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOM_OPTIONS.map((sym) => {
            const isSelected = selectedSymptoms.includes(sym.value);
            return (
              <Button
                key={sym.value}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleSymptom(sym.value)}
                className={cn(
                  'h-7 text-xs rounded-full transition-all',
                  isSelected
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`cycle.symptoms.${sym.value}`, sym.label)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Energy Level (1-5) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-foreground">
            {t('cycle.log.energy', 'Energy & Vitality Level')}
          </Label>
          <span className="text-xs text-muted-foreground font-medium">
            {energyLevel} / 5
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <Button
              key={lvl}
              type="button"
              variant={energyLevel === lvl ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs font-bold"
              onClick={() => setEnergyLevel(lvl)}
            >
              <Zap
                className={cn(
                  'w-3.5 h-3.5 mr-1',
                  energyLevel >= lvl && 'fill-amber-400 text-amber-500'
                )}
              />
              {lvl}
            </Button>
          ))}
        </div>
      </div>

      {/* Daily Notes */}
      <div className="space-y-2">
        <Label
          htmlFor="cycle_notes"
          className="text-xs font-semibold text-foreground"
        >
          {t('cycle.log.notes', 'Personal Cycle Notes')}
        </Label>
        <Textarea
          id="cycle_notes"
          placeholder={t(
            'cycle.log.notesPlaceholder',
            'Any observations on training performance, sleep, mood, or cramps...'
          )}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveEntryMutation.isPending}
          className="bg-primary text-primary-foreground gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          {saveEntryMutation.isPending
            ? t('common.saving', 'Saving...')
            : t('cycle.saveLog', 'Save Daily Log')}
        </Button>
      </div>
    </div>
  );
};

export const CycleTrackerDialog: React.FC<CycleTrackerDialogProps> = ({
  open,
  onOpenChange,
  date,
  defaultTab = 'insights',
}) => {
  const { t } = useTranslation();
  const activeDate = date || formatDateYMD(new Date());
  const [activeTab, setActiveTab] = useState<'insights' | 'log' | 'calendar'>(
    defaultTab
  );

  const phaseInfo = useCyclePhase(activeDate);
  const { entry } = useCycleDailyEntry(activeDate);
  const { settings } = useCycleSettings();

  const intensityBadgeVariant = (intensity: string) => {
    switch (intensity) {
      case 'high':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'moderate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case 'recovery':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 dark:bg-rose-950/30 flex items-center justify-center">
                <Heart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {t('cycle.trackerTitle', 'Menstrual Cycle & Phase Guide')}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {t(
                    'cycle.trackerSubtitle',
                    'Daily metrics, hormone trends, and phase-adapted training'
                  )}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as 'insights' | 'log' | 'calendar')
          }
          className="w-full"
        >
          <div className="px-6 border-b">
            <TabsList className="grid grid-cols-3 w-full bg-muted/60">
              <TabsTrigger value="insights" className="text-xs">
                {t('cycle.tabs.insights', 'Phase & Training')}
              </TabsTrigger>
              <TabsTrigger value="log" className="text-xs">
                {t('cycle.tabs.log', 'Daily Log')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs">
                {t('cycle.tabs.calendar', 'Predictions')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: INSIGHTS & TRAINING */}
          <TabsContent value="insights" className="p-6 pt-4 space-y-4">
            {/* Phase Status Card */}
            <div className="rounded-xl bg-gradient-to-br from-rose-500/5 via-violet-500/5 to-transparent border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t('cycle.currentPhase', 'Current Phase')}
                  </span>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {phaseInfo.phaseName}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        intensityBadgeVariant(
                          phaseInfo.trainingGuidance.intensity
                        )
                      )}
                    >
                      {phaseInfo.trainingGuidance.intensity} Intensity
                    </Badge>
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary">
                    Day {phaseInfo.cycleDay}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    of {phaseInfo.totalCycleDays} days
                  </p>
                </div>
              </div>

              {/* Cycle Bar */}
              <div className="space-y-1">
                <Progress
                  value={phaseInfo.phaseProgressPercent}
                  className="h-2 bg-muted"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Day 1 (Period)</span>
                  <span>
                    Day {Math.round(phaseInfo.totalCycleDays / 2)} (Ovulation)
                  </span>
                  <span>Day {phaseInfo.totalCycleDays}</span>
                </div>
              </div>
            </div>

            {/* Training Recommendation */}
            <div className="rounded-lg border p-4 space-y-2 bg-card">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Dumbbell className="w-4 h-4" />
                <h4>{t('cycle.trainingTitle', 'Training & Workout Focus')}</h4>
              </div>
              <p className="text-xs font-medium text-foreground">
                {phaseInfo.trainingGuidance.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {phaseInfo.trainingGuidance.description}
              </p>
              <div className="pt-1 text-xs bg-muted/50 rounded p-2 text-foreground/90 font-medium">
                🎯 {phaseInfo.trainingGuidance.focus}
              </div>
            </div>

            {/* Nutrition & Metabolism Tip */}
            <div className="rounded-lg border p-4 space-y-2 bg-card">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Apple className="w-4 h-4" />
                <h4>
                  {t('cycle.nutritionTitle', 'Nutrition & Recovery Strategy')}
                </h4>
              </div>
              <p className="text-xs font-medium text-foreground">
                {phaseInfo.nutritionGuidance.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {phaseInfo.nutritionGuidance.tip}
              </p>
              {phaseInfo.nutritionGuidance.metabolicNote && (
                <div className="pt-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 rounded p-2 text-emerald-900 dark:text-emerald-200">
                  ⚡ {phaseInfo.nutritionGuidance.metabolicNote}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: DAILY LOG */}
          <TabsContent value="log" className="p-6 pt-4">
            <DailyLogForm
              key={`${activeDate}-${open}`}
              activeDate={activeDate}
              initialEntry={entry}
              cycleDay={phaseInfo.cycleDay}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          {/* TAB 3: CALENDAR & PREDICTIONS */}
          <TabsContent value="calendar" className="p-6 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3.5 space-y-1 bg-card">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t('cycle.predictedPeriod', 'Next Expected Period')}
                  </span>
                </div>
                <p className="text-base font-bold text-foreground">
                  {phaseInfo.nextPeriodDate}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {phaseInfo.daysUntilNextPeriod === 0
                    ? t('cycle.periodToday', 'Expected today')
                    : t('cycle.inDays', 'In ~{{days}} days', {
                        days: phaseInfo.daysUntilNextPeriod,
                      })}
                </p>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1 bg-card">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-semibold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {t('cycle.ovulationWindow', 'Estimated Ovulation Window')}
                  </span>
                </div>
                <p className="text-base font-bold text-foreground">
                  {phaseInfo.ovulationDate}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {phaseInfo.fertileWindowStart} – {phaseInfo.fertileWindowEnd}
                </p>
              </div>
            </div>

            {/* Cycle Parameters Summary */}
            <div className="rounded-lg bg-muted/40 border p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>{t('cycle.profileSettings', 'Cycle Configuration')}</span>
                <Badge variant="outline" className="text-[10px]">
                  {settings.avg_cycle_length}d cycle /{' '}
                  {settings.avg_period_length}d period
                </Badge>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                {t(
                  'cycle.configNote',
                  'Predictions are calculated based on your cycle baseline and adapt automatically as you record daily period entries.'
                )}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-6 pt-3 border-t bg-muted/10 flex justify-between sm:justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CycleTrackerDialog;
