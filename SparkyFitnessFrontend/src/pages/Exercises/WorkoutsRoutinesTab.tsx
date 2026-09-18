import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { error } from '@/utils/logging';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import { createBlankWorkoutPlaybackDraft } from '@/utils/workoutPlayback';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isPlanWorkoutOpen, setIsPlanWorkoutOpen] = useState(false);
  const [isExploreTemplatesOpen, setIsExploreTemplatesOpen] = useState(false);

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

  const handleStartBlankWorkout = () => {
    const today = formatDateToYYYYMMDD(new Date());
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/workout-playback?date=${today}`, {
      state: { returnTo, draft: createBlankWorkoutPlaybackDraft(today) },
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Start sits right below the page header (above the widgets
          below, which can grow tall) so it stays visible and clickable
          without scrolling. */}
      <ProgramsActionBar
        onStartBlankWorkout={handleStartBlankWorkout}
        onAddSchedule={() => setIsAddScheduleOpen(true)}
        onCreateProgram={() => setIsAddProgramOpen(true)}
        onPlanWorkout={() => setIsPlanWorkoutOpen(true)}
        onExploreTemplates={() => setIsExploreTemplatesOpen(true)}
      />
      <ActiveProgramWidget />
      <PlannedWorkoutsList />
      <MyProgramsGrid
        isAddOpen={isAddProgramOpen}
        onAddOpenChange={setIsAddProgramOpen}
        isExploreTemplatesOpen={isExploreTemplatesOpen}
        onExploreTemplatesOpenChange={setIsExploreTemplatesOpen}
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
