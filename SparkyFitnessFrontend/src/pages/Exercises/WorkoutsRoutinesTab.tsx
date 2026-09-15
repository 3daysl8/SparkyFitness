import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { error } from '@/utils/logging';
import type { WorkoutPlanTemplate } from '@/types/workout';
import { useCreateWorkoutPlanTemplateMutation } from '@/hooks/Exercises/useWorkoutPlans';
import ActiveProgramWidget from './ActiveProgramWidget';
import ProgramsActionBar from './ProgramsActionBar';
import MyProgramsGrid from './MyProgramsGrid';
import AddWorkoutPlanDialog from './AddWorkoutPlanDialog';
import PlannedWorkoutsList from './PlannedWorkoutsList';
import AddPlannedWorkoutDialog from './AddPlannedWorkoutDialog';

const WorkoutsRoutinesTab = () => {
  const { user } = useAuth();
  const { loggingLevel } = usePreferences();
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isPlanWorkoutOpen, setIsPlanWorkoutOpen] = useState(false);

  const { mutateAsync: createWorkoutPlanTemplate } =
    useCreateWorkoutPlanTemplateMutation();

  const handleCreateSchedule = async (
    newPlanData: Omit<
      WorkoutPlanTemplate,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => {
    if (!user?.id) return;
    try {
      await createWorkoutPlanTemplate({ userId: user.id, data: newPlanData });
      setIsAddScheduleOpen(false);
    } catch (err) {
      error(loggingLevel, 'Error creating workout plan:', err);
    }
  };

  return (
    <div className="space-y-6">
      <ActiveProgramWidget />
      <PlannedWorkoutsList />
      <ProgramsActionBar
        onAddSchedule={() => setIsAddScheduleOpen(true)}
        onCreateProgram={() => setIsAddProgramOpen(true)}
        onPlanWorkout={() => setIsPlanWorkoutOpen(true)}
      />
      <MyProgramsGrid
        isAddOpen={isAddProgramOpen}
        onAddOpenChange={setIsAddProgramOpen}
      />

      <AddWorkoutPlanDialog
        key={isAddScheduleOpen ? 'add-open' : 'add-closed'}
        isOpen={isAddScheduleOpen}
        onClose={() => setIsAddScheduleOpen(false)}
        onSave={handleCreateSchedule}
        initialData={null}
      />
      <AddPlannedWorkoutDialog
        key={isPlanWorkoutOpen ? 'plan-open' : 'plan-closed'}
        isOpen={isPlanWorkoutOpen}
        onClose={() => setIsPlanWorkoutOpen(false)}
      />
    </div>
  );
};

export default WorkoutsRoutinesTab;
