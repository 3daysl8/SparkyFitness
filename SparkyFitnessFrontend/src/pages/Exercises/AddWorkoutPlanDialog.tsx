import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipProvider } from '@/components/ui/tooltip';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  SortableExerciseItemData,
  WorkoutPlanTemplate,
} from '@/types/workout';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, Clipboard } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import AddExerciseDialog from './AddExerciseDialog';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatDateToYYYYMMDD, cn } from '@/lib/utils';
import { addDays, orderedDaysOfWeek } from '@workspace/shared';
import { DAYS_OF_WEEK } from '@/constants/exercises';
import { useWorkoutPlanAssignments } from '@/hooks/Exercises/useWorkoutPlanAssignments';
import { SortableExerciseItem } from './SortableExerciseItem';

type DurationPreset = '1w' | '4w' | 'ongoing' | 'custom';

interface AddWorkoutPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    newPlan: Omit<
      WorkoutPlanTemplate,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
  initialData?: WorkoutPlanTemplate | null;
  onUpdate?: (
    planId: string,
    updatedPlan: Partial<WorkoutPlanTemplate>
  ) => void;
}

const AddWorkoutPlanDialog = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  onUpdate,
}: AddWorkoutPlanDialogProps) => {
  const {
    assignments,
    workoutPresets,
    copiedAssignment,
    isAddExerciseDialogOpen,
    setIsAddExerciseDialogOpen,
    setSelectedDayForAssignment,
    handleRemoveAssignment,
    handleSetChangeInPlan,
    handleAddSetInPlan,
    handleDuplicateSetInPlan,
    handleRemoveSetInPlan,
    handleDragEnd,
    handleAddExerciseOrPreset,
    handleCopyAssignment,
    handlePasteAssignment,
    buildAssignmentsForSave,
  } = useWorkoutPlanAssignments(initialData);
  const { t } = useTranslation();
  const { weightUnit, firstDayOfWeek } = usePreferences();
  const [planName, setPlanName] = useState(() => initialData?.plan_name || '');
  const [description, setDescription] = useState(
    () => initialData?.description || ''
  );

  const [startDate, setStartDate] = useState(() => {
    if (initialData?.start_date) {
      return String(initialData.start_date).split('T')[0] ?? '';
    }
    return formatDateToYYYYMMDD(new Date());
  });

  const [endDate, setEndDate] = useState(() => {
    if (initialData?.end_date) {
      return String(initialData.end_date).split('T')[0] ?? '';
    }
    return addDays(formatDateToYYYYMMDD(new Date()), 7);
  });

  const [isActive, setIsActive] = useState(
    () => initialData?.is_active ?? true
  );

  // Derived, not stored: whichever preset the current start/end dates
  // happen to match is "selected" — editing the date fields directly falls
  // through to 'custom' automatically, no separate state to keep in sync.
  const durationPreset: DurationPreset = !endDate
    ? 'ongoing'
    : endDate === addDays(startDate, 7)
      ? '1w'
      : endDate === addDays(startDate, 28)
        ? '4w'
        : 'custom';

  const durationPills: { id: DurationPreset; label: string }[] = [
    { id: '1w', label: t('addWorkoutPlanDialog.duration1Week', '1 Week') },
    { id: '4w', label: t('addWorkoutPlanDialog.duration4Weeks', '4 Weeks') },
    {
      id: 'ongoing',
      label: t('addWorkoutPlanDialog.durationOngoing', 'Ongoing'),
    },
    { id: 'custom', label: t('addWorkoutPlanDialog.durationCustom', 'Custom') },
  ];

  const handleDurationPillClick = (preset: DurationPreset) => {
    if (preset === '1w') setEndDate(addDays(startDate, 7));
    else if (preset === '4w') setEndDate(addDays(startDate, 28));
    else if (preset === 'ongoing') setEndDate('');
    // 'custom' has no action of its own — it's already reachable by typing
    // directly into the End Date field below.
  };

  // Display order only — the underlying day_of_week values (and DAYS_OF_WEEK
  // itself) stay Sunday-indexed; this just reorders which card renders first
  // to match the user's preferred week start.
  const orderedDays = useMemo(
    () =>
      orderedDaysOfWeek(firstDayOfWeek)
        .map((id) => DAYS_OF_WEEK.find((day) => day.id === id))
        .filter((day): day is (typeof DAYS_OF_WEEK)[number] => day != null),
    [firstDayOfWeek]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSave = () => {
    if (planName.trim() === '' || startDate?.trim() === '') {
      toast({
        title: t(
          'addWorkoutPlanDialog.validationErrorTitle',
          'Validation Error'
        ),
        description: t(
          'addWorkoutPlanDialog.validationErrorDescription',
          'Plan Name and Start Date are required.'
        ),
        variant: 'destructive',
      });
      return;
    }

    const planData = {
      plan_name: planName,
      description,
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive,
      assignments: buildAssignmentsForSave(),
    };

    if (initialData && onUpdate) {
      onUpdate(initialData.id, planData);
    } else {
      onSave(planData);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <TooltipProvider>
        <DialogContent
          requireConfirmation
          className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {initialData
                ? t('addWorkoutPlanDialog.editTitle', 'Edit Workout Plan')
                : t('addWorkoutPlanDialog.addTitle', 'Add New Workout Plan')}
            </DialogTitle>
            <DialogDescription>
              {initialData
                ? t(
                    'addWorkoutPlanDialog.editDescription',
                    'Edit the details for your workout plan and its assignments.'
                  )
                : t(
                    'addWorkoutPlanDialog.addDescription',
                    'Enter the details for your new workout plan and assign workouts to days.'
                  )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="planName">
                {t('addWorkoutPlanDialog.planNameLabel', 'Plan Name')}
              </Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                {t('addWorkoutPlanDialog.descriptionLabel', 'Description')}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  {t('addWorkoutPlanDialog.startDateLabel', 'Start Date')}
                </Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pr-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">
                  {t(
                    'addWorkoutPlanDialog.endDateLabel',
                    'End Date (Optional)'
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pr-8"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {durationPills.map((pill) => (
                <Button
                  key={pill.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDurationPillClick(pill.id)}
                  className={cn(
                    'h-7 rounded-full px-3 text-xs',
                    durationPreset === pill.id &&
                      'border-primary bg-primary/10 text-primary'
                  )}
                >
                  {pill.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked as boolean)}
              />
              <Label htmlFor="isActive">
                {t('addWorkoutPlanDialog.setActiveLabel', 'Set as active plan')}
              </Label>
            </div>

            <div className="space-y-4 min-w-0">
              <h4 className="mb-2 text-lg font-medium">
                {t('addWorkoutPlanDialog.assignmentsTitle', 'Assignments')}
              </h4>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                {orderedDays.map((day) => {
                  const dayAssignments = assignments.filter(
                    (assignment) => assignment.day_of_week === day.id
                  );
                  return (
                    <Card key={day.name} className="p-4 bg-muted/30">
                      <SortableContext
                        items={dayAssignments.map((a) => a.id as string)}
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-primary">
                              {day.name}
                            </h3>
                            <div className="flex items-center space-x-2">
                              {copiedAssignment && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePasteAssignment(day.id)}
                                >
                                  <Clipboard className="h-4 w-4 mr-2" />{' '}
                                  {t(
                                    'addWorkoutPlanDialog.pasteButton',
                                    'Paste'
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDayForAssignment(day.id);
                                  setIsAddExerciseDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />{' '}
                                {t(
                                  'addWorkoutPlanDialog.addExerciseButtonInDay',
                                  'Add Exercise'
                                )}
                              </Button>
                            </div>
                          </div>
                          {dayAssignments.map((assignment) => {
                            const originalIndex = assignments.findIndex(
                              (a) => a.id === assignment.id
                            );
                            return (
                              <SortableExerciseItem
                                key={assignment.id}
                                ex={assignment}
                                exerciseIndex={originalIndex}
                                weightUnit={weightUnit}
                                workoutPresets={workoutPresets}
                                onRemoveExercise={handleRemoveAssignment}
                                onSetChange={handleSetChangeInPlan}
                                onDuplicateSet={handleDuplicateSetInPlan}
                                onRemoveSet={handleRemoveSetInPlan}
                                onAddSet={handleAddSetInPlan}
                                onCopyExercise={
                                  handleCopyAssignment as (
                                    ex: SortableExerciseItemData
                                  ) => void
                                }
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </Card>
                  );
                })}
              </DndContext>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={onClose}>
                {t('addWorkoutPlanDialog.cancelButton', 'Cancel')}
              </Button>
            </DialogClose>
            <Button onClick={handleSave}>
              {t('addWorkoutPlanDialog.saveButton', 'Save Plan')}
            </Button>
          </DialogFooter>
        </DialogContent>

        <AddExerciseDialog
          open={isAddExerciseDialogOpen}
          onOpenChange={setIsAddExerciseDialogOpen}
          onExerciseAdded={(exercise, sourceMode) => {
            if (exercise && sourceMode) {
              handleAddExerciseOrPreset(exercise, sourceMode);
            }
          }}
          onWorkoutPresetSelected={(preset) =>
            handleAddExerciseOrPreset(preset, 'preset')
          }
          mode="workout-plan"
        />
      </TooltipProvider>
    </Dialog>
  );
};

export default AddWorkoutPlanDialog;
