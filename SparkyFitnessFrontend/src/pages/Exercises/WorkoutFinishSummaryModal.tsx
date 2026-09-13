import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Layers, Dumbbell } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatWeight } from '@/utils/numberFormatting';
import { formatMinutesToHHMM } from '@/utils/timeFormatters';

export interface WorkoutFinishSummary {
  name: string;
  prCount: number;
  totalVolume: number;
  elapsedSeconds: number;
  setsCompleted: number;
  totalSets: number;
}

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

  if (!summary) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-center">
            {t('exercise.workoutFinishSummary.title', 'Workout Complete!')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">{summary.name}</p>

        {summary.prCount > 0 && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 py-3">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {t('exercise.workoutFinishSummary.prCount', {
                count: summary.prCount,
                defaultValue:
                  summary.prCount === 1
                    ? '1 Personal Record!'
                    : `${summary.prCount} Personal Records!`,
              })}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="flex flex-col items-center gap-1">
            <Clock className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold">
              {formatMinutesToHHMM(Math.round(summary.elapsedSeconds / 60))}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              {t('exercise.workoutFinishSummary.duration', 'Duration')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Layers className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold">
              {summary.setsCompleted}/{summary.totalSets}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              {t('exercise.workoutFinishSummary.sets', 'Sets')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Dumbbell className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold">
              {formatWeight(summary.totalVolume, weightUnit)}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              {t('exercise.workoutFinishSummary.volume', 'Volume')}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={onDone}>
            {t('common.done', 'Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkoutFinishSummaryModal;
