import { useTranslation } from 'react-i18next';
import { Flag, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkoutPlaybackStickyBarProps {
  onAddExercise: () => void;
  onFinishWorkout: () => void;
  isSaving: boolean;
  isWorkoutPaused?: boolean;
  onTogglePause?: () => void;
}

/** Mobile-only sticky action bar so "+ Add Exercise" and "Finish Workout" (or "Resume Workout" when paused)
 * stay reachable with one thumb while scrolling a long exercise list,
 * instead of only living in the header at the top of the page. Same
 * fixed-bottom-with-safe-area structural pattern as MainLayout's mobile nav
 * (layouts/MainLayout.tsx) — stacked directly above it (that nav is `h-14`
 * plus its own safe-area inset) rather than overlapping it, since MainLayout
 * always renders its nav regardless of route. */
const WorkoutPlaybackStickyBar = ({
  onAddExercise,
  onFinishWorkout,
  isSaving,
  isWorkoutPaused = false,
  onTogglePause,
}: WorkoutPlaybackStickyBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
      <Button
        type="button"
        variant="outline"
        className="flex-1 gap-2"
        onClick={onAddExercise}
      >
        <Plus className="h-4 w-4" />
        {t('exercise.workoutPlaybackDialog.addExercise', 'Add Exercise')}
      </Button>
      {isWorkoutPaused ? (
        <Button
          type="button"
          className="flex-1 gap-2 bg-amber-600 text-white hover:bg-amber-700"
          onClick={onTogglePause}
        >
          <Play className="h-4 w-4 fill-current" />
          {t('exercise.workoutPlaybackPage.resumeWorkout', 'Resume Workout')}
        </Button>
      ) : (
        <Button
          type="button"
          className="flex-1 gap-2"
          onClick={onFinishWorkout}
          disabled={isSaving}
        >
          <Flag className="h-4 w-4" />
          {isSaving
            ? t('exercise.workoutPlaybackDialog.finishing', 'Saving...')
            : t('exercise.workoutPlaybackDialog.finish', 'Finish Workout')}
        </Button>
      )}
    </div>
  );
};

export default WorkoutPlaybackStickyBar;
