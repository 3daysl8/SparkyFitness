import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Settings2,
  Dumbbell,
  Coffee,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
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
  const [selectedDayDow, setSelectedDayDow] = useState<number>(todayDow);
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

  const { data: todayPlannedView } = usePlannedWorkoutDayView(today, user?.id);
  const todaysPlanned = todayPlannedView?.for_date ?? [];
  const startablePlanned =
    todaysPlanned.find((row) => row.workout_preset_id != null) ??
    todaysPlanned[0];

  const selectedAssignments = assignmentsByDay.get(selectedDayDow) ?? [];
  const selectedPresetAssignment = selectedAssignments.find(
    (a) => a.workout_preset_id
  );
  const { data: selectedPreset } = useWorkoutPreset(
    selectedPresetAssignment?.workout_preset_id ?? startablePlanned?.workout_preset_id ?? undefined
  );

  const totalWeeks = (() => {
    if (!plan?.start_date || !plan?.end_date) return null;
    const start = new Date(plan.start_date);
    const end = new Date(plan.end_date);
    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeks = Math.round(diffDays / 7);
    return weeks > 0 ? weeks : null;
  })();

  const currentWeekNumber = (() => {
    if (!plan?.start_date) return null;
    const start = new Date(plan.start_date);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) return 1;
    const week = Math.floor(diffDays / 7) + 1;
    if (totalWeeks) {
      return Math.min(week, totalWeeks);
    }
    return week;
  })();

  if (isLoading) {
    return null;
  }

  const handleStartBlankWorkout = () => {
    const returnTo = `${location.pathname}${location.search}`;
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

  if (!plan) {
    return (
      <Card className="border-dashed bg-gradient-to-br from-card/80 to-muted/20">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">
              {t(
                'exercise.activeProgramWidget.noActivePlan',
                'No active training program.'
              )}
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">
              {t(
                'exercise.activeProgramWidget.noActivePlanDesc',
                'Set up a structured weekly split or jump straight into an empty workout session.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsManageOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              {t(
                'exercise.activeProgramWidget.chooseOrActivateProgram',
                'Browse & Activate Program'
              )}
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleStartBlankWorkout}
            >
              <Play className="h-4 w-4" />
              {t(
                'exercise.activeProgramWidget.startBlankWorkout',
                'Start Freestyle Workout'
              )}
            </Button>
          </div>
        </CardContent>
        <ManageSchedulesDialog
          isOpen={isManageOpen}
          onOpenChange={setIsManageOpen}
        />
      </Card>
    );
  }

  const handleStartSelected = () => {
    const returnTo = `${location.pathname}${location.search}`;
    if (selectedPreset) {
      const routeState = createWorkoutPlaybackRouteState(
        selectedPreset,
        today,
        returnTo,
        startablePlanned?.id
      );
      navigate(`/workout-playback?date=${today}`, { state: routeState });
      return;
    }
    handleStartBlankWorkout();
  };

  const isTodaySelected = selectedDayDow === todayDow;
  const hasSelectedWorkout = selectedAssignments.length > 0;
  const selectedDayName =
    DAYS_OF_WEEK.find((d) => d.id === selectedDayDow)?.name ?? '';

  return (
    <Card className="overflow-hidden shadow-sm border-primary/20">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-primary text-[11px] font-medium"
              >
                {t(
                  'exercise.activeProgramWidget.activeProgram',
                  'Active Program'
                )}
              </Badge>
              {currentWeekNumber !== null && (
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {totalWeeks
                    ? `Week ${currentWeekNumber} of ${totalWeeks}`
                    : `Week ${currentWeekNumber}`}
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-bold tracking-tight truncate">
              {plan.plan_name}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsManageOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('exercise.activeProgramWidget.manage', 'Manage')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* 7-Day Interactive Strip */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {orderedDays.map((day) => {
            const dayAssignments = assignmentsByDay.get(day.id) ?? [];
            const isToday = day.id === todayDow;
            const isSelected = day.id === selectedDayDow;
            const hasWorkout = dayAssignments.length > 0;
            const label =
              dayAssignments
                .map((a) => a.workout_preset_name || a.exercise_name)
                .filter(Boolean)
                .join(', ') || t('exercise.activeProgramWidget.rest', 'Rest');

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDayDow(day.id)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary ring-offset-1'
                    : isToday
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted/40 hover:bg-muted/80 text-foreground'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'text-primary-foreground'
                        : isToday
                          ? 'text-primary font-extrabold'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {day.name.slice(0, 3)}
                  </span>
                  {isToday && !isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={`text-[10px] leading-tight truncate w-full max-w-[58px] sm:max-w-full ${
                    isSelected
                      ? 'text-primary-foreground/90 font-medium'
                      : !hasWorkout
                        ? 'text-muted-foreground italic'
                        : 'font-medium'
                  }`}
                  title={label}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Day Mission / Detail Card */}
        {hasSelectedWorkout ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedDayName}
                </span>
                {isTodaySelected && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    Today
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary shrink-0" />
                <h4 className="text-sm font-semibold truncate">
                  {selectedAssignments
                    .map((a) => a.workout_preset_name || a.exercise_name)
                    .filter(Boolean)
                    .join(', ')}
                </h4>
              </div>
            </div>

            <Button
              onClick={handleStartSelected}
              className="w-full sm:w-auto gap-2 shrink-0 shadow-sm"
            >
              <Play className="h-4 w-4 fill-current" />
              {isTodaySelected
                ? t(
                    'exercise.activeProgramWidget.startTodaysWorkout',
                    "Start Today's Workout"
                  )
                : t(
                    'exercise.activeProgramWidget.startThisWorkoutToday',
                    'Start This Workout Today'
                  )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/10 p-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Coffee className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {selectedDayName}
                  </span>
                  {isTodaySelected && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4"
                    >
                      Today
                    </Badge>
                  )}
                </div>
                <h4 className="text-xs font-medium text-foreground">
                  {t(
                    'exercise.activeProgramWidget.restDayTitle',
                    'Rest & Active Recovery'
                  )}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'exercise.activeProgramWidget.restDayDesc',
                    'Give your muscles time to repair and adapt.'
                  )}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStartBlankWorkout}
              className="w-full sm:w-auto gap-2 shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              {t(
                'exercise.activeProgramWidget.startBlankWorkout',
                'Start Freestyle Workout'
              )}
            </Button>
          </div>
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
