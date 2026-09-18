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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Dumbbell,
  Flame,
  Droplet,
  Moon,
  Target,
  ShieldAlert,
  Lightbulb,
} from 'lucide-react';
import {
  GOAL_ARCHETYPES,
  type GoalArchetype,
} from '@/constants/goalArchetypes';
import WeekdayToggle from './WeekdayToggle';
import {
  useCreateFocusDomain,
  useCreateFocus,
  useFocusDomains,
} from '@/hooks/useFocus';
import { toast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { todayInZone, dayOfWeek, addDays } from '@workspace/shared';

interface GuidedGoalWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICONS_MAP: Record<string, React.ReactNode> = {
  Dumbbell: <Dumbbell className="h-5 w-5" />,
  Flame: <Flame className="h-5 w-5" />,
  Droplet: <Droplet className="h-5 w-5" />,
  Moon: <Moon className="h-5 w-5" />,
  Target: <Target className="h-5 w-5" />,
};

export default function GuidedGoalWizardModal({
  isOpen,
  onClose,
}: GuidedGoalWizardModalProps) {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  const { data: existingDomains = [] } = useFocusDomains();
  const createDomain = useCreateFocusDomain();
  const createFocus = useCreateFocus();

  const [step, setStep] = useState<number>(1);

  // Form State
  const [pillarName, setPillarName] = useState<string>('Health & Vitality');
  const [pillarColor, setPillarColor] = useState<string>('#6366f1');

  // Long-Term (North Star)
  const [longTermStatement, setLongTermStatement] = useState<string>('');
  const [longTermWhy, setLongTermWhy] = useState<string>('');

  // Weekly Focus
  const [weeklyStatement, setWeeklyStatement] = useState<string>('');
  const [weeklyTargetValue, setWeeklyTargetValue] = useState<string>('3');
  const [weeklyUnit, setWeeklyUnit] = useState<string>('sessions');

  // Daily Habit & WOOP
  const [dailyStatement, setDailyStatement] = useState<string>('');
  const [dailyCue, setDailyCue] = useState<string>('');
  const [dailyObstacle, setDailyObstacle] = useState<string>('');
  const [dailyPlan, setDailyPlan] = useState<string>('');
  const [recurrenceDays, setRecurrenceDays] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5])
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const todayIso = todayInZone(timezone);
  const weekStartIso = (() => {
    const offset = (dayOfWeek(todayIso) + 6) % 7;
    return addDays(todayIso, -offset);
  })();

  const handleSelectArchetype = (arch: GoalArchetype) => {
    setPillarName(arch.pillarName);
    setPillarColor(arch.pillarColor);
    setLongTermStatement(
      t(arch.longTerm.statementKey, arch.longTerm.statementDefault)
    );
    setLongTermWhy(t(arch.longTerm.whyKey, arch.longTerm.whyDefault));
    setWeeklyStatement(
      t(arch.weekly.statementKey, arch.weekly.statementDefault)
    );
    setWeeklyTargetValue(String(arch.weekly.targetValue));
    setWeeklyUnit(arch.weekly.unit);
    setDailyStatement(t(arch.daily.statementKey, arch.daily.statementDefault));
    setDailyCue(t(arch.daily.cueKey, arch.daily.cueDefault));
    setDailyObstacle(t(arch.daily.obstacleKey, arch.daily.obstacleDefault));
    setDailyPlan(t(arch.daily.planKey, arch.daily.planDefault));
    setRecurrenceDays(new Set(arch.daily.recurrenceDays));
    setStep(2);
  };

  const handleStartCustom = () => {
    setPillarName('Health & Vitality');
    setPillarColor('#6366f1');
    setLongTermStatement('');
    setLongTermWhy('');
    setWeeklyStatement('');
    setWeeklyTargetValue('3');
    setWeeklyUnit('times');
    setDailyStatement('');
    setDailyCue('');
    setDailyObstacle('');
    setDailyPlan('');
    setRecurrenceDays(new Set([1, 2, 3, 4, 5]));
    setStep(2);
  };

  const handleFinish = async () => {
    if (
      !longTermStatement.trim() ||
      !weeklyStatement.trim() ||
      !dailyStatement.trim()
    ) {
      toast({
        title: t('common.error', 'Error'),
        description: t(
          'focus.wizard.missingFields',
          'Please ensure all goal statements are filled in before saving.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Find or create domain
      let domainId: string | undefined = existingDomains.find(
        (d) => d.name.toLowerCase() === pillarName.trim().toLowerCase()
      )?.id;

      if (!domainId) {
        const newDomain = await createDomain.mutateAsync({
          name: pillarName.trim(),
          color: pillarColor,
        });
        domainId = newDomain.id;
      }

      // 2. Create Long-Term Focus
      const fullLongTermStatement = longTermWhy.trim()
        ? `${longTermStatement.trim()} (Why: ${longTermWhy.trim()})`
        : longTermStatement.trim();

      await createFocus.mutateAsync({
        timeframe: 'long_term',
        statement: fullLongTermStatement,
        domain_id: domainId,
        target_type: 'none',
      });

      // 3. Create Weekly Focus
      await createFocus.mutateAsync({
        timeframe: 'weekly',
        statement: weeklyStatement.trim(),
        domain_id: domainId,
        period_date: weekStartIso,
        target_type: weeklyTargetValue ? 'numeric' : 'none',
        target_value: weeklyTargetValue ? Number(weeklyTargetValue) : undefined,
        unit: weeklyUnit.trim() || undefined,
      });

      // 4. Create Daily Habit with WOOP Plan
      let fullDailyStatement = dailyStatement.trim();
      const woopNotes: string[] = [];
      if (dailyCue.trim()) woopNotes.push(`Cue: ${dailyCue.trim()}`);
      if (dailyPlan.trim()) woopNotes.push(`If-Then: ${dailyPlan.trim()}`);
      if (woopNotes.length > 0) {
        fullDailyStatement += ` [${woopNotes.join(' | ')}]`;
      }

      await createFocus.mutateAsync({
        timeframe: 'daily',
        statement: fullDailyStatement,
        domain_id: domainId,
        target_type: 'boolean',
        recurrence_days_of_week:
          recurrenceDays.size > 0 && recurrenceDays.size < 7
            ? Array.from(recurrenceDays).sort()
            : undefined,
      });

      toast({
        title: t(
          'focus.wizard.successTitle',
          'Grounded Goal Framework Created! 🎯'
        ),
        description: t(
          'focus.wizard.successDesc',
          'Your Long-Term North Star, Weekly Focus, and Daily Habit are now active.'
        ),
      });

      onClose();
    } catch (error) {
      console.error('Failed to create goal cascade:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t(
          'focus.wizard.errorDesc',
          'Failed to create goal structure. Please try again.'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-lg">
                {t('focus.wizard.modalTitle', 'Grounded Goal Setting Guide')}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t(
                  'focus.wizard.modalSubtitle',
                  'Behavioral science framework: Connect your Identity (North Star) ➔ Weekly Milestone ➔ Daily If-Then Habit.'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Wizard Steps Indicator */}
        <div className="flex items-center justify-between border-b pb-3 text-xs font-medium">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 1 ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
              1
            </span>
            {t('focus.wizard.step1', 'Pillar & Archetype')}
          </button>
          <span className="text-muted-foreground/40">➔</span>
          <button
            type="button"
            onClick={() => step > 2 && setStep(2)}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 2 ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
              2
            </span>
            {t('focus.wizard.step2', 'North Star & Why')}
          </button>
          <span className="text-muted-foreground/40">➔</span>
          <button
            type="button"
            onClick={() => step > 3 && setStep(3)}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 3 ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
              3
            </span>
            {t('focus.wizard.step3', 'This Week')}
          </button>
          <span className="text-muted-foreground/40">➔</span>
          <button
            type="button"
            onClick={() => step > 4 && setStep(4)}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 4 ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
              4
            </span>
            {t('focus.wizard.step4', 'Daily WOOP Habit')}
          </button>
        </div>

        {/* STEP 1: Select Archetype or Custom */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-sm font-semibold">
                {t(
                  'focus.wizard.chooseArchetype',
                  'Choose a Grounded Starter Goal or Start Custom'
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'focus.wizard.chooseArchetypeDesc',
                  'Select a pre-designed behavioral template proven to maximize adherence, or tailor your own.'
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {GOAL_ARCHETYPES.map((arch) => (
                <div
                  key={arch.id}
                  onClick={() => handleSelectArchetype(arch)}
                  className="cursor-pointer rounded-lg border border-border p-3.5 transition-all hover:border-primary/50 hover:bg-surface-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: arch.pillarColor }}
                    >
                      {ICONS_MAP[arch.icon] || <Target className="h-5 w-5" />}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold">
                        {t(arch.titleKey, arch.titleDefault)}
                      </h4>
                      <Badge variant="outline" className="mt-0.5 text-[10px]">
                        {arch.pillarName}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {t(arch.descriptionKey, arch.descriptionDefault)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleStartCustom}
                className="w-full text-xs font-medium"
              >
                {t(
                  'focus.wizard.startCustom',
                  'Or Build a Custom Goal from Scratch ➔'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: North Star & Why (Identity) */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/20 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Lightbulb className="h-4 w-4" />
                {t(
                  'focus.wizard.tier1Title',
                  'Tier 1: Identity & North Star (Long-Term)'
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {t(
                  'focus.wizard.tier1Tip',
                  'Anchor your goal in the person you wish to become. Goals framed around identity and a strong "Why" have 2.5x higher long-term adherence.'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('focus.wizard.lifePillar', 'Life Pillar / Domain')}
              </Label>
              <Input
                value={pillarName}
                onChange={(e) => setPillarName(e.target.value)}
                placeholder="e.g. Health & Vitality, Strength & Muscle, Mindset"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t(
                  'focus.wizard.northStarStatement',
                  'North Star Statement (Identity / Wish)'
                )}
              </Label>
              <Input
                value={longTermStatement}
                onChange={(e) => setLongTermStatement(e.target.value)}
                placeholder="e.g. Cultivate a strong, capable body that handles life with vigor and confidence."
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t(
                  'focus.wizard.northStarWhy',
                  'Your "Why" / Core Motivation (Outcome)'
                )}
              </Label>
              <Textarea
                value={longTermWhy}
                onChange={(e) => setLongTermWhy(e.target.value)}
                placeholder="e.g. To feel energized, prevent injury, and be physically present and strong for my family."
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Weekly Milestone (Tactical) */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/20 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Target className="h-4 w-4" />
                {t(
                  'focus.wizard.tier2Title',
                  'Tier 2: Weekly Focus & Milestone'
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {t(
                  'focus.wizard.tier2Tip',
                  'Translate your North Star into 1-2 concrete, measurable targets for this week. Keep it realistic and achievable.'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t(
                  'focus.wizard.weeklyStatement',
                  'This Week’s Focus Statement'
                )}
              </Label>
              <Input
                value={weeklyStatement}
                onChange={(e) => setWeeklyStatement(e.target.value)}
                placeholder="e.g. Complete 3 focused resistance training sessions"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t('focus.wizard.weeklyTarget', 'Weekly Target Metric')}
                </Label>
                <Input
                  type="number"
                  value={weeklyTargetValue}
                  onChange={(e) => setWeeklyTargetValue(e.target.value)}
                  placeholder="3"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t('focus.wizard.weeklyUnit', 'Unit')}
                </Label>
                <Input
                  value={weeklyUnit}
                  onChange={(e) => setWeeklyUnit(e.target.value)}
                  placeholder="sessions, days, or hours"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Daily WOOP Habit & If-Then Plan */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/20 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <ShieldAlert className="h-4 w-4" />
                {t(
                  'focus.wizard.tier3Title',
                  'Tier 3: Daily Implementation & Obstacle Plan (WOOP)'
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {t(
                  'focus.wizard.tier3Tip',
                  'Research shows pre-planning for the #1 obstacle increases habit adherence by over 300%.'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('focus.wizard.dailyStatement', 'Daily Habit Statement')}
              </Label>
              <Input
                value={dailyStatement}
                onChange={(e) => setDailyStatement(e.target.value)}
                placeholder="e.g. Execute scheduled strength workout with high intent"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t(
                  'focus.wizard.dailyCue',
                  'Trigger / Implementation Cue ("When / Where")'
                )}
              </Label>
              <Input
                value={dailyCue}
                onChange={(e) => setDailyCue(e.target.value)}
                placeholder="e.g. When my alarm rings at 6:30 AM / right after arriving home from work"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-status-moderate">
                {t(
                  'focus.wizard.dailyObstacle',
                  'Anticipated Obstacle ("What might get in the way?")'
                )}
              </Label>
              <Input
                value={dailyObstacle}
                onChange={(e) => setDailyObstacle(e.target.value)}
                placeholder="e.g. Feeling exhausted or low motivation after a busy day"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-metric-recovery">
                {t(
                  'focus.wizard.dailyPlan',
                  'If-Then Backup Plan ("If obstacle occurs, I will...")'
                )}
              </Label>
              <Input
                value={dailyPlan}
                onChange={(e) => setDailyPlan(e.target.value)}
                placeholder="e.g. If low energy, commit to doing just the 10-minute warmup and 2 sets"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-medium">
                {t('focus.wizard.targetDays', 'Target Days of the Week')}
              </Label>
              <WeekdayToggle
                selected={recurrenceDays}
                onChange={setRecurrenceDays}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between border-t pt-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={isSubmitting}
              className="gap-1 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('common.back', 'Back')}
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={step === 2 && !longTermStatement.trim()}
              className="gap-1 text-xs"
            >
              {t('common.continue', 'Next Step')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleFinish}
              disabled={isSubmitting || !dailyStatement.trim()}
              className="gap-1 text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting
                ? t('common.saving', 'Creating Goals...')
                : t('focus.wizard.finishBtn', 'Activate Goal Framework')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
