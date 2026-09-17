import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Heart, Dumbbell, ChevronRight } from 'lucide-react';
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

const PHASE_COLORS: Record<
  CyclePhase,
  {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    indicator: string;
  }
> = {
  menstrual: {
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900/50',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
    badgeText: 'text-rose-800 dark:text-rose-200',
    indicator: 'bg-rose-500',
  },
  follicular: {
    bg: 'bg-violet-500/10 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-900/50',
    badgeBg:
      'bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200',
    badgeText: 'text-violet-800 dark:text-violet-200',
    indicator: 'bg-violet-500',
  },
  ovulatory: {
    bg: 'bg-teal-500/10 dark:bg-teal-950/30',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-900/50',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200',
    badgeText: 'text-teal-800 dark:text-teal-200',
    indicator: 'bg-teal-500',
  },
  luteal: {
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/50',
    badgeBg:
      'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
    badgeText: 'text-amber-800 dark:text-amber-200',
    indicator: 'bg-amber-500',
  },
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

  const phaseColors = PHASE_COLORS[phaseInfo.phase] || PHASE_COLORS.follicular;

  return (
    <>
      <Card
        className={cn(
          'transition-all duration-200 shadow-sm border overflow-hidden hover:shadow-md cursor-pointer',
          phaseColors.border,
          className
        )}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  phaseColors.bg
                )}
              >
                <Heart className={cn('w-4 h-4', phaseColors.text)} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  {t('cycle.title', 'Cycle & Phase')}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium border-0',
                      phaseColors.badgeBg
                    )}
                  >
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
              className="h-1.5 bg-muted"
            />
          </div>

          {/* Actionable Training Focus Banner */}
          <div
            className={cn(
              'rounded-md p-2.5 flex items-start gap-2 text-xs',
              phaseColors.bg
            )}
          >
            <Dumbbell
              className={cn('w-4 h-4 shrink-0 mt-0.5', phaseColors.text)}
            />
            <div className="flex-1 min-w-0">
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
