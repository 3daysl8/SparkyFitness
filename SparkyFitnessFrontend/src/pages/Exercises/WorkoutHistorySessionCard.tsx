import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  Clock,
  Layers,
  Dumbbell,
  Trophy,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { ExerciseSessionResponse } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatMinutesToHHMM } from '@/utils/timeFormatters';
import { formatWeight } from '@/utils/numberFormatting';
import { SET_TYPE_STYLES } from '@/constants/exercises';

interface WorkoutHistorySessionCardProps {
  session: ExerciseSessionResponse;
  onRepeat: () => void;
  onDelete: () => void;
}

const WorkoutHistorySessionCard = ({
  session,
  onRepeat,
  onDelete,
}: WorkoutHistorySessionCardProps) => {
  const { t } = useTranslation();
  const { weightUnit, formatDateInUserTimezone } = usePreferences();
  const [isExpanded, setIsExpanded] = useState(false);

  const exercises = session.type === 'preset' ? session.exercises : [session];
  const name =
    (session.type === 'preset' ? session.name : session.name) ||
    exercises[0]?.exercise_snapshot?.name ||
    t('exercise.workoutsHistory.untitledWorkout', 'Workout');
  const durationMinutes =
    session.type === 'preset'
      ? session.total_duration_minutes
      : session.duration_minutes;
  const totalSets = exercises.reduce(
    (sum, ex) => sum + (ex.sets?.length ?? 0),
    0
  );
  const totalVolume = exercises.reduce((sum, ex) => {
    const vol =
      ex.sets?.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0) ??
      0;
    return sum + vol;
  }, 0);
  const hasPr = exercises.some((ex) => ex.sets?.some((set) => set.is_pr));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{name}</span>
                {hasPr && (
                  <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {session.entry_date
                  ? formatDateInUserTimezone(session.entry_date, 'MMM dd, yyyy')
                  : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <div className="hidden sm:flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatMinutesToHHMM(durationMinutes ?? 0)}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>{totalSets} sets</span>
            </div>
            {totalVolume > 0 && (
              <div className="hidden md:flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5" />
                <span>{formatWeight(totalVolume, weightUnit)}</span>
              </div>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t space-y-3">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {exercise.exercise_snapshot?.name ||
                    t('exercise.workoutsHistory.exercise', 'Exercise')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.sets?.map((set) => (
                    <Badge
                      key={set.id}
                      variant="secondary"
                      className={`font-normal text-[10px] ${
                        set.set_type ? SET_TYPE_STYLES[set.set_type] : ''
                      }`}
                    >
                      {set.weight != null && set.reps != null
                        ? `${formatWeight(set.weight, weightUnit)} × ${set.reps}`
                        : set.duration != null
                          ? formatMinutesToHHMM(Math.round(set.duration / 60))
                          : `Set ${set.set_number}`}
                      {set.is_pr && (
                        <Trophy className="ml-1 h-2.5 w-2.5 inline text-amber-500" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={onRepeat}
              >
                <RotateCcw className="h-4 w-4" />
                {t('exercise.workoutsHistory.repeatWorkout', 'Repeat Workout')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">
                  {t('exercise.workoutsHistory.deleteWorkout', 'Delete')}
                </span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkoutHistorySessionCard;
