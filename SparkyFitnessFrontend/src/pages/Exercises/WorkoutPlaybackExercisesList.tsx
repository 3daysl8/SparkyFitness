import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  MoreVertical,
  ArrowLeftRight,
  Trash2,
  Plus,
  Dumbbell,
  TrendingUp,
  Link2,
  Link2Off,
} from 'lucide-react';
import type { WeightUnit } from '@/contexts/PreferencesContext';
import type { Exercise } from '@/types/exercises';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ExerciseStatsResponse } from '@workspace/shared';
import { getSupersetDisplayMap } from '@/utils/workoutSupersets';
import {
  WORKOUT_PLAYBACK_SET_GRID_CLASSES,
  type WorkoutPlaybackExerciseDraft,
  type WorkoutSetPointer,
} from '@/utils/workoutPlayback';
import WorkoutPlaybackSetRow from './WorkoutPlaybackSetRow';

interface WorkoutPlaybackExercisesListProps {
  exercises: WorkoutPlaybackExerciseDraft[];
  setNotesVisibility: Record<string, boolean>;
  onToggleSetNotesVisibility: (setKey: string) => void;
  onSelectSet: (pointer: WorkoutSetPointer) => void;
  onCompleteSet: (pointer: WorkoutSetPointer) => void;
  onUncompleteSet: (pointer: WorkoutSetPointer) => void;
  onSetFieldChange: (
    pointer: WorkoutSetPointer,
    field: 'reps' | 'weight' | 'duration' | 'rest_time' | 'set_type' | 'notes',
    value: number | string | null
  ) => void;
  onOpenRestEditor: (pointer: WorkoutSetPointer) => void;
  onRemoveSet: (pointer: WorkoutSetPointer) => void;
  onAddSet: (exerciseIndex: number) => void;
  onAddExercise?: () => void;
  onSwapExercise?: (exerciseIndex: number) => void;
  onRemoveExercise?: (exerciseIndex: number) => void;
  onInspectExercise?: (exercise: Exercise) => void;
  onSupersetWithNext?: (exerciseIndex: number) => void;
  onUngroupExercise?: (exerciseIndex: number) => void;
  weightUnit: WeightUnit;
  /** Per-exercise best/last/recent-session stats (see exerciseStatsQueryOptions),
   * keyed by exercise_id — drives each row's "Previous: …" hint. */
  statsByExerciseId: Record<string, ExerciseStatsResponse | undefined>;
}

/** The same set number's weight/reps from the most recent prior session for
 * this exercise, or null when there's no matching history yet. */
function findPreviousSet(
  stats: ExerciseStatsResponse | undefined,
  setNumber: number
): { weight: number | null; reps: number | null } | null {
  const mostRecentSession = stats?.recentSessions[0];
  if (!mostRecentSession) return null;
  const match = mostRecentSession.sets.find((s) => s.setNumber === setNumber);
  return match ? { weight: match.weight, reps: match.reps } : null;
}

const WorkoutPlaybackExercisesList = ({
  exercises,
  setNotesVisibility,
  onToggleSetNotesVisibility,
  onSelectSet,
  onCompleteSet,
  onUncompleteSet,
  onSetFieldChange,
  onOpenRestEditor,
  onRemoveSet,
  onAddSet,
  onAddExercise,
  onSwapExercise,
  onRemoveExercise,
  onInspectExercise,
  onSupersetWithNext,
  onUngroupExercise,
  weightUnit,
  statsByExerciseId,
}: WorkoutPlaybackExercisesListProps) => {
  const { t } = useTranslation();
  const [expandedCompletedExercises, setExpandedCompletedExercises] = useState<
    Record<string, boolean>
  >({});

  const supersetDisplayMap = useMemo(
    () => getSupersetDisplayMap(exercises, t),
    [exercises, t]
  );

  if (exercises.length === 0) {
    return (
      <Card className="border-dashed border-border/80 bg-gradient-to-br from-card/80 to-muted/20">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Dumbbell className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-semibold text-foreground">
              {t(
                'exercise.workoutPlaybackPage.emptyExercisesTitle',
                'No exercises in this session yet'
              )}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'exercise.workoutPlaybackPage.emptyExercisesDesc',
                'Freestyle Workout — Add exercises as you train to log your sets, reps, and weights on the go.'
              )}
            </p>
          </div>
          {onAddExercise && (
            <Button
              onClick={onAddExercise}
              size="default"
              className="gap-2 font-semibold shadow-sm mt-2"
            >
              <Plus className="h-4 w-4" />
              {t(
                'exercise.workoutPlaybackPage.addFirstExercise',
                'Add Exercise'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {exercises.map((exercise, exerciseIndex) => {
        const isTimedExercise = exercise.modality
          ? exercise.modality === 'duration' ||
            exercise.modality === 'duration_distance'
          : exercise.sets.some(
              (set) => set.duration != null && set.reps == null
            );
        const exerciseStats = statsByExerciseId[exercise.exercise_id];
        const completedSets = exercise.sets.filter(
          (set) => set.completed
        ).length;
        const totalSets = exercise.sets.length;
        const isComplete = totalSets > 0 && completedSets === totalSets;
        const exerciseKey = `${exercise.exercise_id}-${exerciseIndex}`;
        const isExpanded =
          !isComplete || expandedCompletedExercises[exerciseKey] === true;
        const toggleLabel = isExpanded
          ? t('common.collapse', 'Collapse')
          : t('common.expand', 'Expand');

        const handleInspect = () => {
          if (!onInspectExercise) return;
          onInspectExercise({
            id: String(exercise.exercise_id),
            name: exercise.exercise_name,
            category: exercise.category,
            modality: exercise.modality,
          } as Exercise);
        };

        const supersetInfo = supersetDisplayMap.get(exerciseIndex) ?? null;
        const canSupersetWithNext = exerciseIndex < exercises.length - 1;

        return (
          <Card
            key={`${exercise.exercise_id}-${exerciseIndex}`}
            className={`border-border/70 shadow-none transition-colors ${
              supersetInfo ? `border-l-4 ${supersetInfo.colorClass}` : ''
            }`}
          >
            <CardHeader className="px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="truncate text-sm font-medium">
                      {exercise.exercise_name}
                    </h3>
                    {supersetInfo && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border ${supersetInfo.badgeClass}`}
                      >
                        {supersetInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {completedSets}/{totalSets}{' '}
                    {t('exercise.workoutPlaybackDialog.sets', 'sets')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {onInspectExercise && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                      aria-label={`${t(
                        'exercise.workoutPlaybackDialog.viewProgression',
                        'PRs & Progression'
                      )} ${exercise.exercise_name}`}
                      title={t(
                        'exercise.workoutPlaybackDialog.viewProgression',
                        'PRs & Progression'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspect();
                      }}
                    >
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                  )}
                  {(onSwapExercise ||
                    onRemoveExercise ||
                    onInspectExercise ||
                    onSupersetWithNext ||
                    onUngroupExercise) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          aria-label={`${t(
                            'exercise.workoutPlaybackDialog.exerciseActions',
                            'Exercise Actions'
                          )} ${exercise.exercise_name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {onInspectExercise && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={handleInspect}
                          >
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            {t(
                              'exercise.workoutPlaybackDialog.viewProgression',
                              'PRs & Progression'
                            )}
                          </DropdownMenuItem>
                        )}
                        {canSupersetWithNext && onSupersetWithNext && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onSupersetWithNext(exerciseIndex)}
                          >
                            <Link2 className="h-3.5 w-3.5 text-primary" />
                            {t(
                              'exercise.workoutPlaybackDialog.supersetWithNext',
                              'Superset with Next'
                            )}
                          </DropdownMenuItem>
                        )}
                        {supersetInfo && onUngroupExercise && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-muted-foreground focus:text-foreground"
                            onClick={() => onUngroupExercise(exerciseIndex)}
                          >
                            <Link2Off className="h-3.5 w-3.5" />
                            {t(
                              'exercise.workoutPlaybackDialog.removeFromSuperset',
                              'Remove from Superset'
                            )}
                          </DropdownMenuItem>
                        )}
                        {onSwapExercise && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onSwapExercise(exerciseIndex)}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                            {t(
                              'exercise.workoutPlaybackDialog.swapExercise',
                              'Swap Exercise'
                            )}
                          </DropdownMenuItem>
                        )}
                        {onRemoveExercise && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => onRemoveExercise(exerciseIndex)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t(
                              'exercise.workoutPlaybackDialog.removeExercise',
                              'Remove Exercise'
                            )}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1.5 text-left"
                    aria-label={`${toggleLabel} ${exercise.exercise_name}`}
                    onClick={() => {
                      if (!isComplete) return;
                      setExpandedCompletedExercises((current) => ({
                        ...current,
                        [exerciseKey]: !current[exerciseKey],
                      }));
                    }}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      } ${isComplete ? 'text-emerald-500' : ''}`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {isComplete
                        ? t(
                            'exercise.workoutPlaybackPage.completed',
                            'Completed'
                          )
                        : t(
                            'exercise.workoutPlaybackPage.inProgress',
                            'In Progress'
                          )}
                    </span>
                  </button>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="px-3 pb-2 pt-0">
                <div className="space-y-1">
                  <div className="hidden overflow-x-auto pb-1 sm:block">
                    <div
                      className={`text-[10px] font-medium text-muted-foreground ${WORKOUT_PLAYBACK_SET_GRID_CLASSES}`}
                    >
                      <div className="flex justify-center px-3">
                        {t('exercise.workoutPlaybackPage.columnSet', 'Set')}
                      </div>
                      <div className="flex justify-center px-3">
                        {t('exercise.workoutPlaybackPage.columnType', 'Type')}
                      </div>
                      {isTimedExercise ? (
                        <div className="flex justify-center px-3 sm:col-span-2">
                          {t('workout.durationSec', 'Duration (s)')}
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-center px-3">
                            {t(
                              'exercise.workoutPlaybackPage.columnReps',
                              'Reps'
                            )}
                          </div>
                          <div className="flex justify-center px-3">
                            {t(
                              'exercise.workoutPlaybackPage.columnWeight',
                              'Weight'
                            )}
                          </div>
                        </>
                      )}
                      <div className="flex justify-center px-3">
                        {t('exercise.workoutPlaybackPage.columnRest', 'Rest')}
                      </div>
                      <div className="flex justify-end px-3">
                        {t('common.actions', 'Actions')}
                      </div>
                    </div>
                  </div>

                  {exercise.sets.map((set, setIndex) => {
                    return (
                      <WorkoutPlaybackSetRow
                        key={`${exercise.exercise_id}-${exerciseIndex}-${setIndex}`}
                        exerciseName={exercise.exercise_name}
                        exerciseKey={exerciseKey}
                        exerciseIndex={exerciseIndex}
                        setIndex={setIndex}
                        setNumber={set.set_number}
                        setType={set.set_type}
                        isTimedExercise={isTimedExercise}
                        reps={set.reps}
                        weight={set.weight}
                        duration={set.duration}
                        restTime={set.rest_time}
                        notes={set.notes}
                        completed={set.completed}
                        isNotesVisible={
                          setNotesVisibility[`${exerciseKey}-${setIndex}`] ??
                          false
                        }
                        onToggleNotesVisibility={onToggleSetNotesVisibility}
                        onSelectSet={onSelectSet}
                        onCompleteSet={onCompleteSet}
                        onUncompleteSet={onUncompleteSet}
                        onSetFieldChange={onSetFieldChange}
                        onOpenRestEditor={onOpenRestEditor}
                        onRemoveSet={onRemoveSet}
                        canRemove={exercise.sets.length > 1}
                        weightUnit={weightUnit}
                        previousSet={findPreviousSet(
                          exerciseStats,
                          set.set_number
                        )}
                        isPr={set.is_pr}
                      />
                    );
                  })}
                </div>

                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    aria-label={`Add set for ${exercise.exercise_name}`}
                    className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => onAddSet(exerciseIndex)}
                  >
                    {t('exercise.workoutPlaybackPage.addSet', 'Add Set')}
                  </button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {onAddExercise && (
        <div className="pt-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 font-medium"
            onClick={onAddExercise}
          >
            <Plus className="h-4 w-4" />
            {t(
              'exercise.workoutPlaybackPage.addAnotherExercise',
              'Add Exercise'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(WorkoutPlaybackExercisesList);
