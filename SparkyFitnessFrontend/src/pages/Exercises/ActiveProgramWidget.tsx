import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Settings2 } from 'lucide-react';
import { dayOfWeek, orderedDaysOfWeek, todayInZone } from '@workspace/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveWorkoutPlan } from '@/hooks/Exercises/useWorkoutPlans';
import { useWorkoutPreset } from '@/hooks/Exercises/useWorkoutPresets';
import { usePlannedWorkoutDayView } from '@/hooks/Exercises/usePlannedWorkouts';
import { DAYS_OF_WEEK } from '@/constants/exercises';
import {
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import type { WorkoutPlanAssignment } from '@/types/workout';
import ManageSchedulesDialog from './ManageSchedulesDialog';

const ActiveProgramWidget = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { timezone, firstDayOfWeek } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const today = useMemo(() => todayInZone(timezone), [timezone]);
  const todayDow = dayOfWeek(today);
  const orderedDays = useMemo(() => {
    const byId = new Map(DAYS_OF_WEEK.map((day) => [day.id, day]));
    return orderedDaysOfWeek(firstDayOfWeek).map((id) => byId.get(id)!);
  }, [firstDayOfWeek]);
  const [isManageOpen, setIsManageOpen] = useState(false);

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

  // The grid above still reflects the template's static day-of-week
  // assignments (what the plan *says* about each day), but the actual
  // "Start Today's Workout" button resolves a real planned_workouts row —
  // that's what carries the id the playback draft needs (see
  // planned_workout_id) to auto-complete the plan on save. By the time this
  // widget renders, the day-view read's lazy template sync should already
  // have generated today's row if the template has an assignment for today.
  const { data: todayPlannedView } = usePlannedWorkoutDayView(today, user?.id);
  const todaysPlanned = todayPlannedView?.for_date ?? [];
  // The common case (per the spec) is one routine per day; when a day has
  // several planned rows, the first preset-backed one drives "Start Workout."
  // A day scheduled with only a raw exercise (no preset) still displays, but
  // Start falls back to a blank workout rather than pre-populating it — full
  // fidelity for that ad-hoc path is a follow-up, not the common case here.
  const startablePlanned =
    todaysPlanned.find((row) => row.workout_preset_id != null) ??
    todaysPlanned[0];
  const { data: startablePreset } = useWorkoutPreset(
    startablePlanned?.workout_preset_id ?? undefined
  );

  if (isLoading) {
    return null;
  }

  if (!plan) {
    // No active schedule — still surface a way in to activate an existing
    // (inactive) one or create a fresh one, rather than vanishing entirely.
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              'exercise.activeProgramWidget.noActivePlan',
              'No active training schedule.'
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsManageOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
            {t(
              'exercise.activeProgramWidget.manageSchedules',
              'Manage Schedules'
            )}
          </Button>
        </CardContent>
        <ManageSchedulesDialog
          isOpen={isManageOpen}
          onOpenChange={setIsManageOpen}
        />
      </Card>
    );
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
    if (startablePlanned && startablePreset) {
      const routeState = createWorkoutPlaybackRouteState(
        startablePreset,
        today,
        returnTo,
        startablePlanned.id
      );
      navigate(`/workout-playback?date=${today}`, { state: routeState });
      return;
    }
    navigate(`/workout-playback?date=${today}`, {
      state: {
        returnTo,
        draft: createBlankWorkoutPlaybackDraft(
          today,
          startablePlanned?.id ?? null
        ),
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
          <span className="truncate">{plan.plan_name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsManageOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('exercise.activeProgramWidget.manage', 'Manage')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5">
          {orderedDays.map((day) => {
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

        {todaysPlanned.length > 0 && (
          <Button onClick={handleStart} className="w-full gap-2">
            <Play className="h-4 w-4" />
            {t(
              'exercise.activeProgramWidget.startTodaysWorkout',
              "Start Today's Workout"
            )}
          </Button>
        )}
      </CardContent>
      <ManageSchedulesDialog
        isOpen={isManageOpen}
        onOpenChange={setIsManageOpen}
      />
    </Card>
  );
};

export default ActiveProgramWidget;
