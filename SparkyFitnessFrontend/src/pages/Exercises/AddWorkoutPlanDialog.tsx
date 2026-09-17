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
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Clipboard,
  Copy,
  Trash2,
  Dumbbell,
  Coffee,
  Sparkles,
} from 'lucide-react';
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

type DurationPreset = '1w' | '4w' | '6w' | '8w' | '12w' | 'ongoing' | 'custom';

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
    copiedDay,
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
    handleCopyDay,
    handlePasteDay,
    handleClearDay,
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
    return addDays(formatDateToYYYYMMDD(new Date()), 28);
  });

  const [isActive, setIsActive] = useState(
    () => initialData?.is_active ?? true
  );

  const durationPreset: DurationPreset = !endDate
    ? 'ongoing'
    : endDate === addDays(startDate, 7)
      ? '1w'
      : endDate === addDays(startDate, 28)
        ? '4w'
        : endDate === addDays(startDate, 42)
          ? '6w'
          : endDate === addDays(startDate, 56)
            ? '8w'
            : endDate === addDays(startDate, 84)
              ? '12w'
              : 'custom';

  const durationPills: { id: DurationPreset; label: string }[] = [
    { id: '1w', label: t('addWorkoutPlanDialog.duration1Week', '1 Week') },
    { id: '4w', label: t('addWorkoutPlanDialog.duration4Weeks', '4 Weeks') },
    { id: '6w', label: t('addWorkoutPlanDialog.duration6Weeks', '6 Weeks') },
    { id: '8w', label: t('addWorkoutPlanDialog.duration8Weeks', '8 Weeks') },
    { id: '12w', label: t('addWorkoutPlanDialog.duration12Weeks', '12 Weeks') },
    {
      id: 'ongoing',
      label: t('addWorkoutPlanDialog.durationOngoing', 'Ongoing'),
    },
    { id: 'custom', label: t('addWorkoutPlanDialog.durationCustom', 'Custom') },
  ];

  const handleDurationPillClick = (preset: DurationPreset) => {
    if (preset === '1w') setEndDate(addDays(startDate, 7));
    else if (preset === '4w') setEndDate(addDays(startDate, 28));
    else if (preset === '6w') setEndDate(addDays(startDate, 42));
    else if (preset === '8w') setEndDate(addDays(startDate, 56));
    else if (preset === '12w') setEndDate(addDays(startDate, 84));
    else if (preset === 'ongoing') setEndDate('');
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

  const activeDaysCount = useMemo(() => {
    const activeDays = new Set(
      assignments
        .filter((a) => a.workout_preset_id || a.exercise_id)
        .map((a) => a.day_of_week)
    );
    return activeDays.size;
  }, [assignments]);

  const restDaysCount = 7 - activeDaysCount;

  const handleSave = () => {
    if (planName.trim() === '' || startDate?.trim() === '') {
      toast({
        title: t(
          'addWorkoutPlanDialog.validationErrorTitle',
          'Validation Error'
        ),
        description: t(
          'addWorkoutPlanDialog.validationErrorDescription',
          'Program Name and Start Date are required.'
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
                ? t('addWorkoutPlanDialog.editTitle', 'Edit Training Program')
                : t(
                    'addWorkoutPlanDialog.addTitle',
                    'Create Training Program / Split'
                  )}
            </DialogTitle>
            <DialogDescription>
              {initialData
                ? t(
                    'addWorkoutPlanDialog.editDescription',
                    'Edit the details for your multi-day training program and daily routine assignments.'
                  )
                : t(
                    'addWorkoutPlanDialog.addDescription',
                    'Define your training program / split and assign workout routines to specific days of the week.'
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Step 1: Program Meta */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border">
              <div className="space-y-2">
                <Label htmlFor="planName">
                  {t('addWorkoutPlanDialog.planNameLabel', 'Program Name')}
                </Label>
                <Input
                  id="planName"
                  placeholder="e.g., Phase 1: 4-Day Upper/Lower Split"
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
                  placeholder="e.g., 4-week hypertrophy block focusing on progressive overload..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none h-16"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    {t('addWorkoutPlanDialog.startDateLabel', 'Start Date')}
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    {t(
                      'addWorkoutPlanDialog.endDateLabel',
                      'End Date (Optional)'
                    )}
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('addWorkoutPlanDialog.phaseDuration', 'Phase Duration')}
                </Label>
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
                          'border-primary bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {pill.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {t(
                    'addWorkoutPlanDialog.setActiveLabel',
                    'Set as active program'
                  )}
                </Label>
              </div>
            </div>

            {/* Step 2: Weekly Split Matrix Overview */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/40 rounded-xl border">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  <span>{activeDaysCount} Training Days</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Coffee className="w-4 h-4 text-emerald-500" />
                  <span>{restDaysCount} Rest Days</span>
                </div>
              </div>

              {copiedDay && (
                <Badge
                  variant="outline"
                  className="text-[11px] gap-1 bg-primary/5 text-primary border-primary/30"
                >
                  <Clipboard className="w-3 h-3" />
                  Copied:{' '}
                  {DAYS_OF_WEEK.find((d) => d.id === copiedDay.dayOfWeek)?.name}
                </Badge>
              )}
            </div>

            {/* Step 3: Daily Split & Routine Assignments */}
            <div className="space-y-4 min-w-0">
              <h4 className="text-base font-semibold">
                {t(
                  'addWorkoutPlanDialog.assignmentsTitle',
                  'Daily Split & Routine Assignments'
                )}
              </h4>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
<<<<<<< HEAD
                {orderedDays.map((day) => {
                  const dayAssignments = assignments.filter(
                    (assignment) => assignment.day_of_week === day.id
                  );
                  return (
                    <Card key={day.name} className="p-4 bg-muted/30">
                      <SortableContext
                        items={dayAssignments.map((a) => a.id as string)}
=======
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayAssignments = assignments.filter(
                      (assignment) => assignment.day_of_week === day.id
                    );
                    const isRestDay = dayAssignments.length === 0;

                    return (
                      <Card
                        key={day.name}
                        className={cn(
                          'p-4 transition-all',
                          isRestDay
                            ? 'bg-muted/10 border-dashed'
                            : 'bg-muted/30 border-solid'
                        )}
>>>>>>> b995027e6 (feat(workouts): add set tagging, barbell plate calculator, in-workout 1RM history, and routine template library)
                      >
                        <SortableContext
                          items={dayAssignments.map((a) => a.id as string)}
                        >
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-foreground">
                                  {day.name}
                                </h3>
                                {isRestDay ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal text-muted-foreground"
                                  >
                                    Rest Day
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] font-medium"
                                  >
                                    {dayAssignments.length}{' '}
                                    {dayAssignments.length === 1
                                      ? 'item'
                                      : 'items'}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isRestDay && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      title="Copy all workouts on this day"
                                      onClick={() => handleCopyDay(day.id)}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">
                                        Copy Day
                                      </span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                                      title="Clear workouts and set to Rest"
                                      onClick={() => handleClearDay(day.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">
                                        Clear
                                      </span>
                                    </Button>
                                  </>
                                )}

                                {copiedDay && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                                    onClick={() => handlePasteDay(day.id)}
                                  >
                                    <Clipboard className="h-3.5 w-3.5" />
                                    <span>
                                      Paste{' '}
                                      {
                                        DAYS_OF_WEEK.find(
                                          (d) => d.id === copiedDay.dayOfWeek
                                        )?.name
                                      }
                                    </span>
                                  </Button>
                                )}

                                {copiedAssignment && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() =>
                                      handlePasteAssignment(day.id)
                                    }
                                  >
                                    <Clipboard className="h-3.5 w-3.5" />
                                    <span>Paste Item</span>
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setSelectedDayForAssignment(day.id);
                                    setIsAddExerciseDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>
                                    {isRestDay ? 'Assign Routine' : 'Add Item'}
                                  </span>
                                </Button>
                              </div>
                            </div>

                            {isRestDay ? (
                              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background/50 text-xs text-muted-foreground italic">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>
                                  Scheduled Rest & Active Recovery Day. Click
                                  "Assign Routine" to schedule a workout.
                                </span>
                              </div>
                            ) : (
                              dayAssignments.map((assignment) => {
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
                              })
                            )}
                          </div>
                        </SortableContext>
                      </Card>
                    );
                  })}
                </div>
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
              {t('addWorkoutPlanDialog.saveButton', 'Save Program')}
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
