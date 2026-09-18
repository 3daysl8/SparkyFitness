import { useTranslation } from 'react-i18next';
import { memo, useState } from 'react';
import type { WeightUnit } from '@/contexts/PreferencesContext';
import {
  Dumbbell,
  MessageSquare,
  Minus,
  Plus,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react';
import { formatWeight } from '@/utils/numberFormatting';
import { lbsToKg } from '@/utils/unitConversions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UnitInput } from '@/components/ui/UnitInput';
import BarbellPlateCalculatorModal from '@/components/BarbellPlateCalculatorModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { excerciseWorkoutSetTypes } from '@/constants/excerciseWorkoutSetTypes';
import { formatSecondsClock } from '@/utils/timeFormatters';
import {
  DEFAULT_REST_SECONDS,
  WORKOUT_PLAYBACK_SET_GRID_CLASSES,
  type WorkoutSetPointer,
} from '@/utils/workoutPlayback';

function formatRestChip(seconds: number | null | undefined): string {
  const value = seconds ?? DEFAULT_REST_SECONDS;
  if (value < 60) {
    return `${value}s`;
  }

  return formatSecondsClock(value);
}

function parseNullableInteger(raw: string): number | null {
  if (raw.trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Clamp to RPE's 1-10 scale in 0.5 steps. */
function clampRpe(value: number): number {
  const snapped = Math.round(value * 2) / 2;
  return Math.min(10, Math.max(1, snapped));
}

function formatRpe(rpe: number | null | undefined): string {
  if (rpe == null) return '—';
  return Number.isInteger(rpe) ? String(rpe) : rpe.toFixed(1);
}

interface WorkoutPlaybackSetRowProps {
  exerciseName: string;
  exerciseKey: string;
  exerciseIndex: number;
  setIndex: number;
  setNumber: number;
  setType: string | null | undefined;
  isTimedExercise: boolean;
  reps: number | null | undefined;
  weight: number | null | undefined;
  duration: number | null | undefined;
  restTime: number | null | undefined;
  notes: string | null | undefined;
  rpe: number | null | undefined;
  completed: boolean;
  isNotesVisible: boolean;
  onToggleNotesVisibility: (setKey: string) => void;
  onSelectSet: (pointer: WorkoutSetPointer) => void;
  onCompleteSet: (pointer: WorkoutSetPointer) => void;
  onUncompleteSet: (pointer: WorkoutSetPointer) => void;
  onSetFieldChange: (
    pointer: WorkoutSetPointer,
    field:
      | 'reps'
      | 'weight'
      | 'duration'
      | 'rest_time'
      | 'set_type'
      | 'notes'
      | 'rpe',
    value: number | string | null
  ) => void;
  onOpenRestEditor: (pointer: WorkoutSetPointer) => void;
  onRemoveSet: (pointer: WorkoutSetPointer) => void;
  canRemove: boolean;
  weightUnit: WeightUnit;
  /** This same set number's weight/reps from the most recent prior session
   * for this exercise (see exerciseStatsQueryOptions' recentSessions) — null
   * when there's no history to compare against yet. */
  previousSet?: { weight: number | null; reps: number | null } | null;
  /** Whether completing this set beat the PR baseline (utils/workoutPlayback's
   * isPrSet), stamped onto the draft when it was checked off. */
  isPr?: boolean;
}

const WorkoutPlaybackSetRow = ({
  exerciseName,
  exerciseKey,
  exerciseIndex,
  setIndex,
  setNumber,
  setType,
  isTimedExercise,
  reps,
  weight,
  duration,
  restTime,
  notes,
  rpe,
  completed,
  isNotesVisible,
  onToggleNotesVisibility,
  onSelectSet,
  onCompleteSet,
  onUncompleteSet,
  onSetFieldChange,
  onOpenRestEditor,
  onRemoveSet,
  canRemove,
  weightUnit,
  previousSet,
  isPr,
}: WorkoutPlaybackSetRowProps) => {
  const { t } = useTranslation();
  const pointer: WorkoutSetPointer = { exerciseIndex, setIndex };
  const notesKey = `${exerciseKey}-${setIndex}`;
  const hasPreviousSet =
    !isTimedExercise &&
    previousSet &&
    (previousSet.weight != null || previousSet.reps != null);

  // "+2.5kg" for kg users; the lbs equivalent of a round +5lb plate jump for
  // lbs users (weight is always stored/edited in kg — see UnitInput).
  const weightStepKg = weightUnit === 'lbs' ? lbsToKg(5) : 2.5;
  const weightStepLabel =
    weightUnit === 'lbs' ? '5' : Number(weightStepKg.toFixed(1)).toString();

  const [isPlateCalculatorOpen, setIsPlateCalculatorOpen] = useState(false);

  const stepReps = (delta: number) => {
    onSetFieldChange(pointer, 'reps', Math.max(0, (reps ?? 0) + delta));
  };
  const stepRpe = (delta: number) => {
    onSetFieldChange(pointer, 'rpe', clampRpe((rpe ?? 0) + delta));
  };
  const stepWeight = (delta: number) => {
    const next = Math.max(0, (weight ?? 0) + delta);
    onSetFieldChange(pointer, 'weight', Math.round(next * 100) / 100);
  };

  return (
    <div>
      <div
        className={`w-full rounded-sm border px-2 py-1.5 text-left ${
          completed
            ? 'border-border-strong bg-muted/40 text-muted-foreground'
            : 'border-border-strong bg-background'
        }`}
      >
        <div className={WORKOUT_PLAYBACK_SET_GRID_CLASSES}>
          <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-start-1 sm:col-span-1 sm:justify-start">
            <div className="flex min-w-0 items-center gap-1.5">
              <Checkbox
                aria-label={`Complete set ${setNumber}`}
                checked={completed}
                className="data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    onCompleteSet(pointer);
                  } else {
                    onUncompleteSet(pointer);
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-auto p-0 text-sm font-medium hover:bg-transparent flex items-center gap-1"
                aria-label={`Select set ${setNumber} for ${exerciseName}`}
                onClick={() => onSelectSet(pointer)}
              >
                {setType === 'Warm-up' ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    W
                  </span>
                ) : setType === 'Drop Set' ? (
                  <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-400 border border-purple-500/30">
                    D
                  </span>
                ) : setType === 'Failure' ? (
                  <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400 border border-rose-500/30">
                    F
                  </span>
                ) : (
                  <span>
                    {t(
                      'exercise.workoutPlaybackDialog.setRow',
                      'Set {{setNumber}}',
                      {
                        setNumber,
                      }
                    )}
                  </span>
                )}
              </Button>
              {isPr && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
                  <Trophy className="h-3 w-3 fill-amber-500/20" />
                  {t('exercise.workoutPlaybackDialog.prBadge', 'PR')}
                </span>
              )}
            </div>
          </div>

          <Select
            value={setType ?? 'Working Set'}
            onValueChange={(value) =>
              onSetFieldChange(pointer, 'set_type', value)
            }
          >
            <SelectTrigger
              aria-label={`Type set ${setNumber}`}
              onClick={(event) => event.stopPropagation()}
              className="col-span-2 border-border-strong bg-transparent shadow-none outline-none ring-0 focus:border-border-strong focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-border-strong data-[state=open]:outline-none data-[state=open]:ring-0 data-[state=open]:shadow-none sm:col-start-2 sm:col-span-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {excerciseWorkoutSetTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`workout.setType.${type}`, type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isTimedExercise ? (
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              aria-label={t(
                'workout.durationSet',
                'Duration set {{setNumber}}',
                { setNumber }
              )}
              value={duration ?? ''}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                onSetFieldChange(
                  pointer,
                  'duration',
                  parseNullableInteger(event.target.value)
                )
              }
              placeholder={t('workout.durationSec', 'Duration (s)')}
              className="col-span-2 w-full focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:col-start-3 sm:col-span-2"
            />
          ) : (
            <>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                aria-label={`Reps set ${setNumber}`}
                value={reps ?? ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onSetFieldChange(
                    pointer,
                    'reps',
                    parseNullableInteger(event.target.value)
                  )
                }
                placeholder={
                  previousSet?.reps != null
                    ? String(previousSet.reps)
                    : t('common.reps', 'reps')
                }
                className="col-span-1 w-full focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:col-start-3"
              />

              <div
                className="col-span-1 w-full sm:col-start-4 relative flex items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <UnitInput
                  value={weight ?? ''}
                  unit={weightUnit}
                  type="weight"
                  placeholder={t('common.weight', 'Weight')}
                  placeholderValue={previousSet?.weight}
                  onChange={(value) =>
                    onSetFieldChange(pointer, 'weight', value)
                  }
                  inputClassName="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 pr-6"
                  aria-label={`Weight set ${setNumber}`}
                />
                <button
                  type="button"
                  onClick={() => setIsPlateCalculatorOpen(true)}
                  aria-label={t(
                    'exercise.plateCalculator.open',
                    'Plate Calculator'
                  )}
                  title={t('exercise.plateCalculator.open', 'Plate Calculator')}
                  className="absolute right-1.5 h-6 w-6 text-muted-foreground/60 hover:text-primary transition-colors flex items-center justify-center rounded"
                >
                  <Dumbbell className="h-3 w-3" />
                </button>
              </div>
            </>
          )}

          {!isTimedExercise && (
            <div
              className="col-span-4 -mt-1 flex items-center justify-between gap-2 px-1 sm:col-start-3 sm:col-span-2 sm:mt-0"
              onClick={(event) => event.stopPropagation()}
            >
              {hasPreviousSet ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (previousSet?.reps != null) {
                      onSetFieldChange(pointer, 'reps', previousSet.reps);
                    }
                    if (previousSet?.weight != null) {
                      onSetFieldChange(pointer, 'weight', previousSet.weight);
                    }
                  }}
                  title={t(
                    'exercise.workoutPlaybackDialog.fillPrevious',
                    'Fill previous values'
                  )}
                  className="group flex items-center gap-1 text-left min-w-0 truncate text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <span className="truncate group-hover:underline">
                    {t(
                      'exercise.workoutPlaybackDialog.previousSet',
                      'Previous: {{weight}} × {{reps}}',
                      {
                        weight:
                          previousSet?.weight != null
                            ? formatWeight(previousSet.weight, weightUnit)
                            : '—',
                        reps: previousSet?.reps ?? '—',
                      }
                    )}
                  </span>
                </button>
              ) : (
                <span className="min-w-0 truncate text-[10px] text-muted-foreground" />
              )}
              <div className="flex shrink-0 items-center gap-2.5">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Decrease reps for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepReps(-1)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-[9px] text-muted-foreground">
                    1{t('exercise.workoutPlaybackDialog.repsAbbrev', 'rep')}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase reps for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepReps(1)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Decrease weight for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepWeight(-weightStepKg)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-[9px] text-muted-foreground">
                    {weightStepLabel}
                    {weightUnit === 'lbs' ? 'lb' : 'kg'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase weight for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepWeight(weightStepKg)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Decrease RPE for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepRpe(-0.5)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-9 text-center text-[9px] tabular-nums text-metric-workout">
                    RPE {formatRpe(rpe)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase RPE for set ${setNumber}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => stepRpe(0.5)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {isTimedExercise && (
            <div
              className="col-span-4 -mt-1 flex items-center justify-end gap-2 px-1 sm:col-start-3 sm:col-span-2 sm:mt-0"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Decrease RPE for set ${setNumber}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => stepRpe(-0.5)}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-9 text-center text-[9px] tabular-nums text-metric-workout">
                  RPE {formatRpe(rpe)}
                </span>
                <button
                  type="button"
                  aria-label={`Increase RPE for set ${setNumber}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => stepRpe(0.5)}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="col-span-1 w-full min-w-0 justify-center px-2 text-xs tabular-nums sm:col-start-5 sm:col-span-1"
            aria-label={`Edit rest for set ${setNumber}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenRestEditor(pointer);
            }}
          >
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            {formatRestChip(restTime)}
          </Button>

          <div className="col-span-1 flex items-center justify-end gap-1 sm:col-start-6 sm:col-span-1 sm:justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              aria-label={`Toggle notes for set ${setNumber}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleNotesVisibility(notesKey);
              }}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              disabled={!canRemove}
              aria-label={`Remove set ${setNumber} for ${exerciseName}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveSet(pointer);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {isNotesVisible && (
            <Textarea
              aria-label={`Set notes ${setNumber}`}
              value={notes ?? ''}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                onSetFieldChange(pointer, 'notes', event.target.value)
              }
              placeholder={t(
                'workout.notesPlaceholder',
                'Add a note for this set...'
              )}
              className="min-h-16 resize-none text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          )}
        </div>
      </div>

      <BarbellPlateCalculatorModal
        open={isPlateCalculatorOpen}
        onOpenChange={setIsPlateCalculatorOpen}
        initialWeight={weight ?? previousSet?.weight ?? 60}
        weightUnit={weightUnit}
        onApplyWeight={(newWeight) =>
          onSetFieldChange(pointer, 'weight', newWeight)
        }
      />
    </div>
  );
};

export default memo(WorkoutPlaybackSetRow);
