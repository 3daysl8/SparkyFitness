import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { dayOfWeek } from '@workspace/shared';
import { useAuth } from '@/hooks/useAuth';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import { useActiveWorkoutPlan } from '@/hooks/Exercises/useWorkoutPlans';
import { useWorkoutPreset } from '@/hooks/Exercises/useWorkoutPresets';
import { DAYS_OF_WEEK } from '@/constants/exercises';
import {
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import type { WorkoutPlanAssignment } from '@/types/workout';

const ActiveProgramWidget = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const today = formatDateToYYYYMMDD(new Date());
  const todayDow = dayOfWeek(today);

  const { data: plan, isLoading } = useActiveWorkoutPlan(today, user?.id);

  const assignmentsByDay = useMemo(() => {
    const map = new Map<number, WorkoutPlanAssignment[]>();
    (plan?.assignments ?? []).forEach((assignment) => {
      const list = map.get(assignment.day_of_week) ?? [];
      list.push(assignment);
      map.set(assignment.day_of_week, list);
    });
    return map;
  }, [plan]);

  const todaysAssignments = assignmentsByDay.get(todayDow) ?? [];
  // The common case (per the spec) is one routine per day; when a day has
  // several assignments, the first preset-backed one drives "Start Workout."
  // A day scheduled with only a raw exercise (no preset) still displays, but
  // Start falls back to a blank workout rather than pre-populating it — full
  // fidelity for that ad-hoc path is a follow-up, not the common case here.
  const startableAssignment = todaysAssignments.find(
    (a) => a.workout_preset_id
  );
  const { data: startablePreset } = useWorkoutPreset(
    startableAssignment?.workout_preset_id
  );

  if (isLoading || !plan) {
    // No active program: the widget has nothing useful to show. The
    // "Manage Programs" dialog (WorkoutPlansManager) is where one gets
    // created/activated.
    return null;
  }

  // NOTE: this does not yet detect/clear the "phantom" auto-materialized
  // diary entry that activating a program pre-creates for today (see the
  // Phase 0 finding) — doing that needs `workout_plan_assignment_id` on the
  // exercise-entry response, which the backend currently accepts on write
  // but never returns on read (`exerciseEntryResponseSchema` omits it), so
  // there is no contract to detect it from here yet. Flagged for a follow-up
  // rather than done silently.
  const handleStart = () => {
    const returnTo = `${location.pathname}${location.search}`;
    if (startableAssignment && startablePreset) {
      const routeState = createWorkoutPlaybackRouteState(
        startablePreset,
        today,
        returnTo
      );
      navigate(`/workout-playback?date=${today}`, { state: routeState });
      return;
    }
    navigate(`/workout-playback?date=${today}`, {
      state: { returnTo, draft: createBlankWorkoutPlaybackDraft(today) },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span>{plan.plan_name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const dayAssignments = assignmentsByDay.get(day.id) ?? [];
            const isToday = day.id === todayDow;
            const label =
              dayAssignments
                .map((a) => a.workout_preset_name || a.exercise_name)
                .filter(Boolean)
                .join(', ') || t('exercise.activeProgramWidget.rest', 'Rest');

            return (
              <div
                key={day.id}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center ${
                  isToday
                    ? 'bg-primary/10 ring-1 ring-primary/40'
                    : 'bg-muted/40'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day.name.slice(0, 3)}
                </span>
                <span
                  className={`text-[10px] leading-tight truncate w-full ${
                    dayAssignments.length === 0
                      ? 'text-muted-foreground italic'
                      : 'font-medium'
                  }`}
                  title={label}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {todaysAssignments.length > 0 && (
          <Button onClick={handleStart} className="w-full gap-2">
            <Play className="h-4 w-4" />
            {t('workoutPresetsManager.startWorkout', 'Start Workout')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveProgramWidget;
