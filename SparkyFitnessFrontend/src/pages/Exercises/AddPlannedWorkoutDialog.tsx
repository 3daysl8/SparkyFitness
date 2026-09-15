import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  todayInZone,
  WORKOUT_TYPES,
  type WorkoutType,
} from '@workspace/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { error } from '@/utils/logging';
import { useCreatePlannedWorkoutMutation } from '@/hooks/Exercises/usePlannedWorkouts';
import type { CreatePlannedWorkoutRequest } from '@workspace/shared';
import type { Exercise } from '@/types/exercises';
import type { WorkoutPreset } from '@/types/workout';
import AddExerciseDialog from './AddExerciseDialog';

interface AddPlannedWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Defaults to today (in the user's timezone) when omitted. */
  initialDate?: string;
}

type Selection =
  | { kind: 'preset'; preset: WorkoutPreset }
  | { kind: 'exercise'; exercise: Exercise };

// Sentinel for the "no type selected" Select option — Radix Select can't
// carry an empty-string item value, so 'none' is mapped back to null on
// submit. Same convention as ExerciseDashboardFilters/ScheduleManager.
const WORKOUT_TYPE_NONE = 'none';

const AddPlannedWorkoutDialog = ({
  isOpen,
  onClose,
  initialDate,
}: AddPlannedWorkoutDialogProps) => {
  const { t } = useTranslation();
  const { timezone, loggingLevel } = usePreferences();

  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState(
    () => initialDate || todayInZone(timezone)
  );
  const [plannedTime, setPlannedTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType | 'none'>(
    WORKOUT_TYPE_NONE
  );
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { mutateAsync: createPlannedWorkout, isPending } =
    useCreatePlannedWorkoutMutation();

  const handleSave = async () => {
    if (title.trim() === '' || plannedDate.trim() === '') {
      toast({
        title: t(
          'exercise.addPlannedWorkoutDialog.validationErrorTitle',
          'Validation Error'
        ),
        description: t(
          'exercise.addPlannedWorkoutDialog.validationErrorDescription',
          'Title and Date are required.'
        ),
        variant: 'destructive',
      });
      return;
    }

    const parsedDuration = Number(durationMinutes);
    const data: CreatePlannedWorkoutRequest = {
      title: title.trim(),
      planned_date: plannedDate,
      planned_time: plannedTime || null,
      duration_estimate_minutes:
        durationMinutes.trim() !== '' && Number.isFinite(parsedDuration)
          ? parsedDuration
          : null,
      workout_type: workoutType === WORKOUT_TYPE_NONE ? null : workoutType,
      workout_preset_id:
        selection?.kind === 'preset' ? Number(selection.preset.id) : null,
      exercise_id:
        selection?.kind === 'exercise' ? selection.exercise.id : null,
      notes: notes.trim() !== '' ? notes.trim() : null,
    };

    try {
      await createPlannedWorkout(data);
      resetForm();
      onClose();
    } catch (err) {
      // The mutation's own meta.errorMessage already surfaced a toast
      // (including the status-gated 409 message where applicable) — this
      // just keeps the dialog open with the user's input intact so they can
      // retry, and logs for diagnostics.
      error(loggingLevel, 'Error creating planned workout:', err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPlannedDate(initialDate || todayInZone(timezone));
    setPlannedTime('');
    setDurationMinutes('');
    setWorkoutType(WORKOUT_TYPE_NONE);
    setNotes('');
    setSelection(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectionLabel =
    selection?.kind === 'preset'
      ? selection.preset.name
      : selection?.kind === 'exercise'
        ? selection.exercise.name
        : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent requireConfirmation className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t('exercise.addPlannedWorkoutDialog.title', 'Plan a Workout')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'exercise.addPlannedWorkoutDialog.description',
              'Add a workout to your calendar for a specific date.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="plannedWorkoutTitle">
              {t('exercise.addPlannedWorkoutDialog.titleLabel', 'Title')}
            </Label>
            <Input
              id="plannedWorkoutTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                'exercise.addPlannedWorkoutDialog.titlePlaceholder',
                'e.g. Leg Day'
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plannedWorkoutDate">
                {t('exercise.addPlannedWorkoutDialog.dateLabel', 'Date')}
              </Label>
              <Input
                id="plannedWorkoutDate"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWorkoutTime">
                {t(
                  'exercise.addPlannedWorkoutDialog.timeLabel',
                  'Time (optional)'
                )}
              </Label>
              <Input
                id="plannedWorkoutTime"
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plannedWorkoutDuration">
                {t(
                  'exercise.addPlannedWorkoutDialog.durationLabel',
                  'Duration (minutes, optional)'
                )}
              </Label>
              <Input
                id="plannedWorkoutDuration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWorkoutType">
                {t(
                  'exercise.addPlannedWorkoutDialog.typeLabel',
                  'Workout Type (optional)'
                )}
              </Label>
              <Select
                value={workoutType}
                onValueChange={(value) =>
                  setWorkoutType(value as WorkoutType | 'none')
                }
              >
                <SelectTrigger id="plannedWorkoutType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WORKOUT_TYPE_NONE}>
                    {t(
                      'exercise.addPlannedWorkoutDialog.workoutTypeNone',
                      'No type'
                    )}
                  </SelectItem>
                  {WORKOUT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(
                        `exercise.addPlannedWorkoutDialog.workoutTypeOptions.${type}`,
                        type.charAt(0).toUpperCase() + type.slice(1)
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {t(
                'exercise.addPlannedWorkoutDialog.linkLabel',
                'Link to a preset or exercise (optional)'
              )}
            </Label>
            {selectionLabel ? (
              <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm truncate">{selectionLabel}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPickerOpen(true)}
                  >
                    {t(
                      'exercise.addPlannedWorkoutDialog.changeButton',
                      'Change'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelection(null)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">
                      {t(
                        'exercise.addPlannedWorkoutDialog.clearButton',
                        'Clear'
                      )}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                onClick={() => setIsPickerOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t(
                  'exercise.addPlannedWorkoutDialog.chooseButton',
                  'Choose Exercise or Preset'
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plannedWorkoutNotes">
              {t('exercise.addPlannedWorkoutDialog.notesLabel', 'Notes')}
            </Label>
            <Textarea
              id="plannedWorkoutNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                'exercise.addPlannedWorkoutDialog.notesPlaceholder',
                'Add any notes...'
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleClose}>
              {t('exercise.addPlannedWorkoutDialog.cancelButton', 'Cancel')}
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending}>
            {t('exercise.addPlannedWorkoutDialog.saveButton', 'Save Plan')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AddExerciseDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        mode="workout-plan"
        onExerciseAdded={(exercise) => {
          if (exercise) {
            setSelection({ kind: 'exercise', exercise });
            setTitle((prev) => prev || exercise.name);
          }
        }}
        onWorkoutPresetSelected={(preset) => {
          setSelection({ kind: 'preset', preset });
          setTitle((prev) => prev || preset.name);
        }}
      />
    </Dialog>
  );
};

export default AddPlannedWorkoutDialog;
