import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listPlannedWorkouts,
  getPlannedWorkoutDayView,
  getPlannedWorkoutById,
  createPlannedWorkout,
  updatePlannedWorkout,
  movePlannedWorkout,
  startPlannedWorkout,
  skipPlannedWorkout,
  completePlannedWorkout,
  deletePlannedWorkout,
} from '@/api/Exercises/plannedWorkouts';
import { plannedWorkoutKeys } from '@/api/keys/exercises';
import type {
  CompletePlannedWorkoutRequest,
  CreatePlannedWorkoutRequest,
  MovePlannedWorkoutRequest,
  UpdatePlannedWorkoutRequest,
} from '@workspace/shared';

export { plannedWorkoutKeys };

// --- Queries ---

/** A date-range read of planned workouts, e.g. for an upcoming-plans list. */
export const usePlannedWorkoutsRange = (
  from: string,
  to: string,
  userId?: string
) => {
  return useQuery({
    queryKey: plannedWorkoutKeys.list(from, to, userId),
    queryFn: () => listPlannedWorkouts(from, to),
    enabled: !!from && !!to && !!userId,
  });
};

/** A single date's planned rows plus any still-unaddressed missed rows from
 * earlier dates. Shared by the Home dashboard's WorkoutCard and the Active
 * Program Widget so both read the exact same query/cache entry. */
export const usePlannedWorkoutDayView = (date: string, userId?: string) => {
  return useQuery({
    queryKey: plannedWorkoutKeys.day(date, userId),
    queryFn: () => getPlannedWorkoutDayView(date),
    enabled: !!date && !!userId,
  });
};

export const usePlannedWorkout = (id?: string) => {
  return useQuery({
    queryKey: plannedWorkoutKeys.detail(id ?? ''),
    queryFn: () => getPlannedWorkoutById(id as string),
    enabled: !!id,
  });
};

// --- Mutations ---
// Every mutation below invalidates the whole `plannedWorkoutKeys.all` prefix
// rather than a narrower key: a change to one row can shift what both a
// day-view query and a range/list query should return (a moved date, a
// completed status, a newly-missed row), and this domain's queries are
// cheap/short-range, so over-invalidating isn't the perf concern it would be
// for workoutPlanTemplates.

const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: plannedWorkoutKeys.all });

export const useCreatePlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: CreatePlannedWorkoutRequest) =>
      createPlannedWorkout(data),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      successMessage: t(
        'exercise.plannedWorkouts.createSuccess',
        'Workout planned.'
      ),
      errorMessage: t(
        'exercise.plannedWorkouts.createError',
        'Failed to plan workout.'
      ),
    },
  });
};

export const useUpdatePlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePlannedWorkoutRequest;
    }) => updatePlannedWorkout(id, data),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      successMessage: t(
        'exercise.plannedWorkouts.updateSuccess',
        'Planned workout updated.'
      ),
      errorMessage: t(
        'exercise.plannedWorkouts.updateError',
        'Failed to update planned workout.'
      ),
    },
  });
};

export const useMovePlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: MovePlannedWorkoutRequest;
    }) => movePlannedWorkout(id, data),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      successMessage: t(
        'exercise.plannedWorkouts.moveSuccess',
        'Workout moved.'
      ),
      errorMessage: t(
        'exercise.plannedWorkouts.moveError',
        'Failed to move workout.'
      ),
    },
  });
};

export const useStartPlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => startPlannedWorkout(id),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      errorMessage: t(
        'exercise.plannedWorkouts.startError',
        'Failed to start workout.'
      ),
    },
  });
};

export const useSkipPlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => skipPlannedWorkout(id),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      successMessage: t(
        'exercise.plannedWorkouts.skipSuccess',
        'Workout skipped.'
      ),
      errorMessage: t(
        'exercise.plannedWorkouts.skipError',
        'Failed to skip workout.'
      ),
    },
  });
};

/** For linking an *existing* session to a plan. The normal completion path
 * is a session created with `planned_workout_id`, which auto-completes its
 * plan server-side without calling this at all. */
export const useCompletePlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CompletePlannedWorkoutRequest;
    }) => completePlannedWorkout(id, data),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      errorMessage: t(
        'exercise.plannedWorkouts.completeError',
        'Failed to complete planned workout.'
      ),
    },
  });
};

export const useDeletePlannedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deletePlannedWorkout(id),
    onSuccess: () => invalidateAll(queryClient),
    meta: {
      successMessage: t(
        'exercise.plannedWorkouts.deleteSuccess',
        'Planned workout removed.'
      ),
      errorMessage: t(
        'exercise.plannedWorkouts.deleteError',
        'Failed to remove planned workout.'
      ),
    },
  });
};
