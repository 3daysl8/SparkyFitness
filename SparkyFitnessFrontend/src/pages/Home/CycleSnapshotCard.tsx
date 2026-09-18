import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dumbbell, ChevronRight } from 'lucide-react';
import {
  useCycleActive,
  useCyclePhase,
  useCycleDailyEntry,
} from '@/hooks/useCycle';
import { CycleTrackerDialog } from '@/pages/Cycle/CycleTrackerDialog';
import { CyclePhase } from '@/types/cycle';
import { cn } from '@/lib/utils';

interface CycleSnapshotCardProps {
  date?: string;
  className?: string;
}

// A single dot colour per phase — the only place phase colour appears. Every
// other surface (background, border, badge) stays neutral, per the "accent
// is for data, not decoration" rule.
const PHASE_DOT: Record<CyclePhase, string> = {
  menstrual: 'bg-status-low',
  follicular: 'bg-metric-sleep',
  ovulatory: 'bg-metric-recovery',
  luteal: 'bg-metric-fasting',
};

export const CycleSnapshotCard: React.FC<CycleSnapshotCardProps> = ({
  date,
  className,
}) => {
  const { t } = useTranslation();
  const { isCycleActive } = useCycleActive();
  const phaseInfo = useCyclePhase(date);
  const { entry } = useCycleDailyEntry(date);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Hidden if cycle tracking is not active for this user profile
  if (!isCycleActive) {
    return null;
  }

  const dotColor = PHASE_DOT[phaseInfo.phase] ?? PHASE_DOT.follicular;

  return (
    <>
      <Card
        className={cn('cursor-pointer transition-colors', className)}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor)}
              />
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {t('cycle.title', 'Cycle & Phase')}
                  <Badge variant="secondary" className="text-xs font-medium">
                    {t(`cycle.phases.${phaseInfo.phase}`, phaseInfo.phaseName)}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('cycle.dayOfCycle', 'Day {{day}} of {{total}}', {
                    day: phaseInfo.cycleDay,
                    total: phaseInfo.totalCycleDays,
                  })}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsDialogOpen(true);
              }}
            >
              {entry?.flow
                ? t('cycle.flowLogged', 'Flow Logged')
                : t('cycle.logToday', 'Log Today')}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Progress Strip */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{t('cycle.progress', 'Cycle Progress')}</span>
              <span>
                {phaseInfo.daysUntilNextPeriod === 0
                  ? t('cycle.periodExpectedToday', 'Period expected today')
                  : t('cycle.nextPeriodIn', 'Next period in ~{{days}}d', {
                      days: phaseInfo.daysUntilNextPeriod,
                    })}
              </span>
            </div>
            <Progress
              value={phaseInfo.phaseProgressPercent}
              className="h-1.5"
            />
          </div>

          {/* Actionable Training Focus */}
          <div className="flex items-start gap-2 border-t border-border pt-3 text-xs">
            <Dumbbell
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-foreground">
                {phaseInfo.trainingGuidance.title}:{' '}
              </span>
              <span className="text-muted-foreground">
                {phaseInfo.trainingGuidance.focus}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <CycleTrackerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        date={date}
      />
    </>
  );
};

export default CycleSnapshotCard;
