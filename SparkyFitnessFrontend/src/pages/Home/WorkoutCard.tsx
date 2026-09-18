import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  todayInZone,
  type WeeklyWorkoutGoalProgressResponse,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { cn } from '@/lib/utils';
import { MetricCard } from '@/components/biometric/MetricCard';
import { Dumbbell, AlertTriangle } from 'lucide-react';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import { useWorkoutPreset } from '@/hooks/Exercises/useWorkoutPresets';
import { usePlannedWorkoutDayView } from '@/hooks/Exercises/usePlannedWorkouts';
import { useWeeklyWorkoutGoal } from '@/hooks/Reports/useReports';
import {
  loadWorkoutPlaybackDraftFromStorage,
  getWorkoutPlaybackStats,
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
  type WorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import { summarizeWorkoutSessions } from '@/utils/workoutSessionSummary';
import { formatWeight } from '@/utils/numberFormatting';

/**
 * Compact "This week: 2/4 · S 1/2 · C 1/1" line summarizing progress against
 * whichever weekly targets are actually set -- a leg with no target is
 * omitted entirely (a user who only set a total goal never sees blank
 * strength/cardio rows), and the whole chip renders nothing for a user who
 * hasn't set any weekly goal at all. Colored to match this card's own
 * metric-workout accent once every set leg is met, muted otherwise. Kept as
 * its own component (rather than inline JSX) so it can be reused unchanged
 * across this file's several early-return card variants below.
 */
function WeeklyGoalChip({
  progress,
}: {
  progress: WeeklyWorkoutGoalProgressResponse | undefined;
}) {
  const { t } = useTranslation();
  if (!progress) return null;

  const legs = [
    {
      active: progress.target_total !== null,
      met: progress.total_met,
      text: t('exercise.workoutCard.weeklyGoalTotal', {
        defaultValue: '{{completed}}/{{target}}',
        completed: progress.completed_total,
        target: progress.target_total,
      }),
    },
    {
      active: progress.target_strength !== null,
      met: progress.strength_met,
      text: t('exercise.workoutCard.weeklyGoalStrength', {
        defaultValue: 'S {{completed}}/{{target}}',
        completed: progress.completed_strength,
        target: progress.target_strength,
      }),
    },
    {
      active: progress.target_cardio !== null,
      met: progress.cardio_met,
      text: t('exercise.workoutCard.weeklyGoalCardio', {
        defaultValue: 'C {{completed}}/{{target}}',
        completed: progress.completed_cardio,
        target: progress.target_cardio,
      }),
    },
  ].filter((leg) => leg.active);

  if (legs.length === 0) return null;

  const allMet = legs.every((leg) => leg.met === true);

  return (
    <p
      className={cn(
        'text-[9px] font-medium leading-tight',
        allMet ? 'text-metric-workout' : 'text-muted-foreground'
      )}
    >
      {t('exercise.workoutCard.weeklyGoalThisWeek', 'This week')}:{' '}
      {legs.map((leg) => leg.text).join(' · ')}
    </p>
  );
}

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

  // Keyed off selectedDate like the rest of this component, not necessarily
  // today -- browsing a past/future date shows that date's own week.
  const { data: weeklyGoal } = useWeeklyWorkoutGoal(
    selectedDate,
    activeUserId ?? undefined
  );

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeDraft) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [activeDraft]);

  if (activeDraft) {
    const startedMs = Date.parse(activeDraft.started_at);
    const elapsedMinutes = Number.isNaN(startedMs)
      ? 0
      : Math.max(0, Math.floor((nowTick - startedMs) / 60000));
    const stats = getWorkoutPlaybackStats(activeDraft);

    return (
      <MetricCard
        layout="tile"
        label="Workout"
        value={`Active · ${elapsedMinutes}m`}
        progress={stats.completionRate * 100}
        metric="workout"
        icon={Dumbbell}
        cornerIndicator
        onSelect={() => navigate(`/workout-playback?date=${selectedDate}`)}
      >
        <WeeklyGoalChip progress={weeklyGoal} />
      </MetricCard>
    );
  }

  const summary = summarizeWorkoutSessions(exerciseEntries);

  if (summary.count > 0) {
    return (
      <MetricCard
        layout="tile"
        label="Workout"
        value={summary.name}
        progress={100}
        metric="workout"
        icon={Dumbbell}
        onSelect={() => navigate('/workouts')}
      >
        <p className="text-[10px] text-muted-foreground">
          {summary.durationMinutes} min
          {summary.durationMinutes === 1 ? '' : 's'} •{' '}
          {formatWeight(summary.volumeKg, weightUnit)}
        </p>
        <WeeklyGoalChip progress={weeklyGoal} />
      </MetricCard>
    );
  }

  if (primaryPlanned) {
    const exerciseCount = scheduledPreset?.exercises?.length;

    // Starting playback only makes sense for today's own plan — browsing a
    // past/future date's plan is informational only (no navigation target
    // that would make sense: a past plan is either done or missed, a future
    // one isn't here yet).
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
      <MetricCard
        layout="tile"
        label="Workout"
        value={primaryPlanned.title}
        progress={0}
        metric="workout"
        icon={Dumbbell}
        onSelect={isToday ? handleStartScheduled : undefined}
      >
        {exerciseCount !== undefined && (
          <p className="text-[10px] text-muted-foreground">
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          </p>
        )}
        <WeeklyGoalChip progress={weeklyGoal} />
      </MetricCard>
    );
  }

  // No plan for the date being viewed. On today specifically, unaddressed
  // missed workouts from earlier dates take priority over the plain "+ Start
  // Workout" invite — full detail (with Move-to-today/Skip actions) lives in
  // the separate MissedWorkoutsNudge card; this tile just signals the count.
  if (isToday && missed.length > 0) {
    return (
      <MetricCard
        layout="tile"
        label="Workout"
        value={`${missed.length} Missed`}
        progress={0}
        metric="warning"
        icon={AlertTriangle}
      >
        <WeeklyGoalChip progress={weeklyGoal} />
      </MetricCard>
    );
  }

  return (
    <MetricCard
      layout="tile"
      label="Workout"
      value="+ Start Workout"
      progress={0}
      metric="workout"
      icon={Dumbbell}
      emptyBorder
      onSelect={() =>
        navigate('/workouts', { state: { openStartWorkout: true } })
      }
    >
      <WeeklyGoalChip progress={weeklyGoal} />
    </MetricCard>
  );
}
