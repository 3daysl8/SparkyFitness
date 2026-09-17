import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pause,
  Play,
  Plus,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkoutPlaybackRestState } from '@/utils/workoutPlayback';
import {
  isRestTimerAudioEnabled,
  setRestTimerAudioEnabled,
} from '@/utils/audioFeedback';

interface WorkoutPlaybackFloatingRestTimerProps {
  restState: WorkoutPlaybackRestState;
  restRemaining: string;
  restRemainingSeconds?: number;
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
  restRemainingSeconds = 90,
  onPauseResume,
  onSkip,
  onExtend,
}: WorkoutPlaybackFloatingRestTimerProps) => {
  const { t } = useTranslation();
  const [audioEnabled, setAudioEnabled] = useState(isRestTimerAudioEnabled);

  const handleToggleAudio = useCallback(() => {
    const next = !audioEnabled;
    setRestTimerAudioEnabled(next);
    setAudioEnabled(next);
  }, [audioEnabled]);

  if (restState === 'idle') {
    return null;
  }

  const isUrgent =
    restState === 'running' &&
    restRemainingSeconds <= 5 &&
    restRemainingSeconds > 0;

  return (
    <div
      className={cn(
        'fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-1 rounded-full border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur transition-all duration-300 sm:bottom-6',
        isUrgent
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-amber-500/20 shadow-md animate-pulse'
          : 'border-border'
      )}
    >
      <Timer
        className={cn(
          'h-4 w-4',
          isUrgent ? 'text-amber-500' : 'text-metric-workout'
        )}
      />
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

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7',
          !audioEnabled && 'text-muted-foreground opacity-60'
        )}
        aria-label={
          audioEnabled
            ? t('exercise.workoutPlaybackPage.muteAudio', 'Mute rest timer')
            : t('exercise.workoutPlaybackPage.unmuteAudio', 'Unmute rest timer')
        }
        onClick={handleToggleAudio}
      >
        {audioEnabled ? (
          <Volume2 className="h-3.5 w-3.5 text-primary" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
};

export default WorkoutPlaybackFloatingRestTimer;
