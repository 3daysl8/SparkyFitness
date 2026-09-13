import { useTranslation } from 'react-i18next';
import { Pause, Play, Plus, SkipForward, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkoutPlaybackRestState } from '@/utils/workoutPlayback';

interface WorkoutPlaybackFloatingRestTimerProps {
  restState: WorkoutPlaybackRestState;
  restRemaining: string;
  onPauseResume: () => void;
  onSkip: () => void;
  onExtend: () => void;
}

/** A small floating countdown that stays reachable while scrolling the
 * exercise list — the inline "Rest" stat tile at the top of the page
 * scrolls out of view the moment there's more than a couple of exercises,
 * which is exactly when a rest countdown matters most. Hidden entirely when
 * the timer is idle (nothing to show/control). Positioned to clear both
 * MainLayout's mobile nav (h-14 + its own safe-area inset) and this page's
 * own sticky action bar stacked above it — see WorkoutPlaybackStickyBar —
 * hence the tall mobile offset that collapses back down on desktop, where
 * neither bar exists. */
const WorkoutPlaybackFloatingRestTimer = ({
  restState,
  restRemaining,
  onPauseResume,
  onSkip,
  onExtend,
}: WorkoutPlaybackFloatingRestTimerProps) => {
  const { t } = useTranslation();

  if (restState === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-1.5 rounded-full border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur sm:bottom-6">
      <Timer className="h-4 w-4 text-metric-workout" />
      <span className="min-w-[2.5rem] text-sm font-semibold tabular-nums">
        {restRemaining}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={t('exercise.workoutPlaybackDialog.extendRest', '+30s')}
        onClick={onExtend}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', restState === 'paused' && 'text-amber-500')}
        aria-label={
          restState === 'running'
            ? t('common.pause', 'Pause')
            : t('common.resume', 'Resume')
        }
        onClick={onPauseResume}
      >
        {restState === 'running' ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={t('common.skip', 'Skip')}
        onClick={onSkip}
      >
        <SkipForward className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default WorkoutPlaybackFloatingRestTimer;
