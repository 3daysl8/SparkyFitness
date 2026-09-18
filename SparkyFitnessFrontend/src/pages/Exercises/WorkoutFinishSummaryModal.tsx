import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Clock,
  Layers,
  Dumbbell,
  Award,
  Zap,
  Sparkles,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatWeight } from '@/utils/numberFormatting';
import { formatMinutesToHHMM } from '@/utils/timeFormatters';
import {
  formatWorkoutSummaryText,
  type WorkoutFinishSummary,
} from '@/utils/workoutPlayback';
import WorkoutConfetti from '@/components/WorkoutConfetti';
import { toast } from 'sonner';

export type { WorkoutFinishSummary } from '@/utils/workoutPlayback';

interface WorkoutFinishSummaryModalProps {
  summary: WorkoutFinishSummary | null;
  onDone: () => void;
}

const WorkoutFinishSummaryModal = ({
  summary,
  onDone,
}: WorkoutFinishSummaryModalProps) => {
  const { t } = useTranslation();
  const { weightUnit } = usePreferences();
  const [isCopied, setIsCopied] = useState(false);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);

  const handleCopySummary = useCallback(() => {
    if (!summary) return;
    const text = formatWorkoutSummaryText(summary, weightUnit);
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      toast.success(
        t(
          'exercise.workoutFinishSummary.copiedToast',
          'Workout summary copied to clipboard!'
        )
      );
      setTimeout(() => setIsCopied(false), 2500);
    });
  }, [summary, weightUnit, t]);

  if (!summary) return null;

  const hasPrs = summary.prCount > 0;
  const durationMinutes = Math.round(summary.elapsedSeconds / 60);
  const completionRate =
    summary.totalSets > 0
      ? Math.round((summary.setsCompleted / summary.totalSets) * 100)
      : 100;
  const workoutDensity =
    durationMinutes > 0 ? Math.round(summary.totalVolume / durationMinutes) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className="relative max-h-[90vh] overflow-y-auto sm:max-w-lg text-center">
        {/* Confetti Celebration Burst */}
        <WorkoutConfetti />

        <DialogHeader className="space-y-2 pt-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500/20 to-yellow-500/30 border border-amber-500/30 shadow-inner">
            {hasPrs ? (
              <Trophy className="h-7 w-7 text-amber-500 animate-bounce" />
            ) : (
              <Sparkles className="h-7 w-7 text-primary" />
            )}
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-center">
            {hasPrs
              ? t(
                  'exercise.workoutFinishSummary.prTitle',
                  'Personal Records Smashed!'
                )
              : t('exercise.workoutFinishSummary.title', 'Workout Complete!')}
          </DialogTitle>
          <p className="text-sm font-medium text-muted-foreground">
            {summary.name}
          </p>
        </DialogHeader>

        {/* PR Showcase Card */}
        {hasPrs && (
          <div className="space-y-2 rounded-xl bg-gradient-to-b from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 p-3.5 text-left shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">
                  {t('exercise.workoutFinishSummary.prCount', {
                    count: summary.prCount,
                    defaultValue:
                      summary.prCount === 1
                        ? '1 Personal Record!'
                        : `${summary.prCount} Personal Records!`,
                  })}
                </span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20">
                {t('exercise.workoutFinishSummary.newBest', 'New Best')}
              </span>
            </div>

            {summary.prAchievements && summary.prAchievements.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {summary.prAchievements.map((pr, index) => (
                  <div
                    key={`${pr.exerciseName}-${index}`}
                    className="flex items-center justify-between text-xs bg-background/80 backdrop-blur-xs rounded-lg px-3 py-2 border border-border-strong"
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate max-w-[150px] sm:max-w-[200px]">
                        {pr.exerciseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pr.estimated1Rm != null && pr.reps && pr.reps > 1 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          ~{formatWeight(pr.estimated1Rm, weightUnit)} 1RM
                        </span>
                      )}
                      <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {formatWeight(pr.weight, weightUnit)}{' '}
                        {pr.reps ? `× ${pr.reps}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4 Core Workout Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* Duration */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border-strong bg-card/60 p-2.5">
            <Clock className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold tabular-nums">
              {formatMinutesToHHMM(durationMinutes)}
            </span>
            <span className="text-[10px] uppercase font-medium text-muted-foreground">
              {t('exercise.workoutFinishSummary.duration', 'Duration')}
            </span>
          </div>

          {/* Volume */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border-strong bg-card/60 p-2.5">
            <Dumbbell className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold tabular-nums">
              {formatWeight(summary.totalVolume, weightUnit)}
            </span>
            <span className="text-[10px] uppercase font-medium text-muted-foreground">
              {t('exercise.workoutFinishSummary.volume', 'Volume')}
            </span>
          </div>

          {/* Sets & Completion */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border-strong bg-card/60 p-2.5">
            <Layers className="h-4 w-4 text-blue-500" />
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold tabular-nums">
                {summary.setsCompleted}/{summary.totalSets}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ({completionRate}%)
              </span>
            </div>
            <span className="text-[10px] uppercase font-medium text-muted-foreground">
              {t('exercise.workoutFinishSummary.sets', 'Sets')}
            </span>
          </div>

          {/* Intensity / Density or Supersets */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border-strong bg-card/60 p-2.5">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold tabular-nums">
              {summary.supersetsCompleted && summary.supersetsCompleted > 0
                ? `${summary.supersetsCompleted}`
                : `${workoutDensity}`}
            </span>
            <span className="text-[10px] uppercase font-medium text-muted-foreground">
              {summary.supersetsCompleted && summary.supersetsCompleted > 0
                ? t('exercise.workoutFinishSummary.supersets', 'Supersets')
                : `${weightUnit}/min`}
            </span>
          </div>
        </div>

        {/* Exercise Performance Breakdown (Toggleable) */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div className="space-y-2 pt-1 text-left">
            <button
              type="button"
              onClick={() => setShowExerciseDetails((prev) => !prev)}
              className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-1 py-1"
            >
              <span>
                {t(
                  'exercise.workoutFinishSummary.exerciseBreakdown',
                  'Exercise Breakdown'
                )}{' '}
                ({summary.exercises.length})
              </span>
              {showExerciseDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showExerciseDetails && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-border-strong bg-card/40 p-2">
                {summary.exercises.map((ex, idx) => (
                  <div
                    key={`${ex.name}-${idx}`}
                    className="flex items-center justify-between text-xs rounded bg-background/60 px-2.5 py-1.5 border border-border-strong"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-foreground truncate">
                        {ex.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {ex.completedSets}/{ex.totalSets}{' '}
                        {t('exercise.workoutFinishSummary.setsLabel', 'sets')}
                        {ex.topWeight != null && (
                          <span>
                            {' '}
                            • {t(
                              'exercise.workoutFinishSummary.top',
                              'Top'
                            )}: {formatWeight(ex.topWeight, weightUnit)}
                            {ex.topReps ? ` × ${ex.topReps}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                      {formatWeight(ex.totalVolume, weightUnit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopySummary}
            className="w-full sm:w-auto gap-1.5 text-xs"
          >
            {isCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {t('exercise.workoutFinishSummary.copied', 'Copied!')}
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                {t('exercise.workoutFinishSummary.copySummary', 'Copy Summary')}
              </>
            )}
          </Button>
          <Button type="button" className="w-full sm:w-auto" onClick={onDone}>
            {t('common.done', 'Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkoutFinishSummaryModal;
