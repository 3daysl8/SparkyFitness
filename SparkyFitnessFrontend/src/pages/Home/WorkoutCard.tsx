import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayInZone } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { cn } from '@/lib/utils';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Dumbbell, AlertTriangle } from 'lucide-react';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import { useWorkoutPreset } from '@/hooks/Exercises/useWorkoutPresets';
import { usePlannedWorkoutDayView } from '@/hooks/Exercises/usePlannedWorkouts';
import {
  loadWorkoutPlaybackDraftFromStorage,
  getWorkoutPlaybackStats,
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
  type WorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import { summarizeWorkoutSessions } from '@/utils/workoutSessionSummary';
import { formatWeight } from '@/utils/numberFormatting';

/** Mirrors an in-progress playback draft persisted to localStorage for this
 * date, re-checked on storage events and tab-visibility changes (the same
 * pattern as the rest of this dashboard's "poll a cheap local signal rather
 * than a server round-trip" cards). Private to WorkoutCard. */
function useActiveWorkoutDraft(selectedDate: string) {
  const [draft, setDraft] = useState<WorkoutPlaybackDraft | null>(() =>
    loadWorkoutPlaybackDraftFromStorage(selectedDate)
  );

  useEffect(() => {
    const recheck = () =>
      setDraft(loadWorkoutPlaybackDraftFromStorage(selectedDate));
    recheck();
    window.addEventListener('storage', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('storage', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [selectedDate]);

  return draft;
}

export default function WorkoutCard({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const navigate = useNavigate();
  const { activeUserId } = useActiveUser();
  const { weightUnit, timezone } = usePreferences();
  const { data: exerciseEntries = [] } = useExerciseEntries(
    selectedDate,
    activeUserId ?? undefined
  );
  const activeDraft = useActiveWorkoutDraft(selectedDate);
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const isToday = selectedDate === todayIso;

  // Read for whichever date is selected, not just today — the planned/missed
  // split below decides what's shown, and browsing a non-today date is purely
  // informational (see the isToday gates further down).
  const { data: dayView } = usePlannedWorkoutDayView(
    selectedDate,
    activeUserId ?? undefined
  );
  const forDate = dayView?.for_date ?? [];
  const missed = dayView?.missed ?? [];
  const primaryPlanned =
    forDate.find((row) => row.workout_preset_id != null) ?? forDate[0];
  // Called unconditionally (rules-of-hooks) even though its result is only
  // used by the "scheduled" branch below, which may not be reached.
  const { data: scheduledPreset } = useWorkoutPreset(
    primaryPlanned?.workout_preset_id ?? undefined
  );

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeDraft) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [activeDraft]);

  const cardClassName =
    'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors';

  if (activeDraft) {
    const startedMs = Date.parse(activeDraft.started_at);
    const elapsedMinutes = Number.isNaN(startedMs)
      ? 0
      : Math.max(0, Math.floor((nowTick - startedMs) / 60000));
    const stats = getWorkoutPlaybackStats(activeDraft);

    return (
      <button
        onClick={() => navigate(`/workout-playback?date=${selectedDate}`)}
        className={cn(
          cardClassName,
          'border-metric-workout/40 bg-metric-workout/10'
        )}
      >
        <span className="absolute right-2.5 top-2.5 h-2 w-2 animate-pulse rounded-full bg-metric-workout" />
        <CircularProgress
          value={stats.completionRate * 100}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="text-sm font-semibold text-metric-workout">
            ⚡ Active ({elapsedMinutes} min{elapsedMinutes === 1 ? '' : 's'})
          </p>
        </div>
      </button>
    );
  }

  const summary = summarizeWorkoutSessions(exerciseEntries);

  if (summary.count > 0) {
    return (
      <button
        onClick={() => navigate('/workouts')}
        className={cn(
          cardClassName,
          'border-metric-workout/30 bg-metric-workout/10'
        )}
      >
        <CircularProgress
          value={100}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="max-w-[110px] truncate text-sm font-semibold text-metric-workout">
            {summary.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {summary.durationMinutes} min
            {summary.durationMinutes === 1 ? '' : 's'} •{' '}
            {formatWeight(summary.volumeKg, weightUnit)}
          </p>
        </div>
      </button>
    );
  }

  if (primaryPlanned) {
    const exerciseCount = scheduledPreset?.exercises?.length;
    const cardBody = (
      <>
        <CircularProgress
          value={0}
          size={52}
          strokeWidth={4}
          className="text-metric-workout"
        >
          <Dumbbell className="h-5 w-5 text-metric-workout" />
        </CircularProgress>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="max-w-[110px] truncate text-sm font-semibold text-metric-workout">
            {primaryPlanned.title}
          </p>
          {exerciseCount !== undefined && (
            <p className="text-[10px] text-muted-foreground">
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </p>
          )}
        </div>
      </>
    );

    // Starting playback only makes sense for today's own plan — browsing a
    // past/future date's plan is informational only (no navigation target
    // that would make sense: a past plan is either done or missed, a future
    // one isn't here yet).
    if (!isToday) {
      return (
        <div
          className={cn(
            cardClassName,
            'border-metric-workout/30 bg-metric-workout/10'
          )}
        >
          {cardBody}
        </div>
      );
    }

    const handleStartScheduled = () => {
      if (primaryPlanned.workout_preset_id && scheduledPreset) {
        const routeState = createWorkoutPlaybackRouteState(
          scheduledPreset,
          selectedDate,
          '/',
          primaryPlanned.id
        );
        navigate(`/workout-playback?date=${selectedDate}`, {
          state: routeState,
        });
        return;
      }
      navigate(`/workout-playback?date=${selectedDate}`, {
        state: {
          returnTo: '/',
          draft: createBlankWorkoutPlaybackDraft(
            selectedDate,
            primaryPlanned.id
          ),
        },
      });
    };

    return (
      <button
        onClick={handleStartScheduled}
        className={cn(
          cardClassName,
          'border-metric-workout/30 bg-metric-workout/10'
        )}
      >
        {cardBody}
      </button>
    );
  }

  // No plan for the date being viewed. On today specifically, unaddressed
  // missed workouts from earlier dates take priority over the plain "+ Start
  // Workout" invite — full detail (with Move-to-today/Skip actions) lives in
  // the separate MissedWorkoutsNudge card; this tile just signals the count.
  if (isToday && missed.length > 0) {
    return (
      <div className={cn(cardClassName, 'border-amber-500/30 bg-amber-500/10')}>
        <CircularProgress
          value={0}
          size={52}
          strokeWidth={4}
          className="text-amber-600"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </CircularProgress>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Workout</p>
          <p className="text-sm font-semibold text-amber-700">
            {missed.length} Missed
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        navigate('/workouts', { state: { openStartWorkout: true } })
      }
      className={cn(cardClassName, 'border-border hover:bg-muted/50')}
    >
      <CircularProgress
        value={0}
        size={52}
        strokeWidth={4}
        className="text-metric-workout"
      >
        <Dumbbell className="h-5 w-5 text-muted-foreground" />
      </CircularProgress>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Workout</p>
        <p className="text-sm font-semibold">+ Start Workout</p>
      </div>
    </button>
  );
}
