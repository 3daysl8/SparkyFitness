import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Plus, Zap, Sparkles } from 'lucide-react';

interface ProgramsActionBarProps {
  onAddSchedule: () => void;
  onCreateProgram: () => void;
  onPlanWorkout?: () => void;
  onStartBlankWorkout?: () => void;
  onExploreTemplates?: () => void;
}

const ProgramsActionBar = ({
  onAddSchedule,
  onCreateProgram,
  onPlanWorkout,
  onStartBlankWorkout,
  onExploreTemplates,
}: ProgramsActionBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onStartBlankWorkout && (
        <Button
          onClick={onStartBlankWorkout}
          className="gap-2 font-semibold shadow-sm"
        >
          <Zap className="h-4 w-4 fill-current" />
          {t('exercise.workoutsPage.quickStart', 'Quick Start')}
        </Button>
      )}
      {onExploreTemplates && (
        <Button
          variant="outline"
          onClick={onExploreTemplates}
          className="gap-2 border-primary/40 hover:bg-primary/5 text-primary font-medium"
        >
          <Sparkles className="h-4 w-4" />
          {t('routineTemplates.exploreTemplates', 'Explore Templates')}
        </Button>
      )}
      <Button variant="outline" onClick={onAddSchedule} className="gap-2">
        <Plus className="h-4 w-4" />
        {t(
          'exercise.workoutsPage.addTrainingSchedule',
          'Create Program / Split'
        )}
      </Button>
      <Button variant="outline" onClick={onCreateProgram} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('exercise.workoutsPage.createRoutine', 'New Routine')}
      </Button>
      {onPlanWorkout && (
        <Button variant="outline" onClick={onPlanWorkout} className="gap-2">
          <Plus className="h-4 w-4" />
          {t(
            'exercise.addPlannedWorkoutDialog.triggerButton',
            'Plan a Workout'
          )}
        </Button>
      )}
    </div>
  );
};

export default ProgramsActionBar;
