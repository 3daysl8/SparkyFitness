import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getWorkoutPlanTemplates,
  createWorkoutPlanTemplate,
  updateWorkoutPlanTemplate,
  deleteWorkoutPlanTemplate,
  getActiveWorkoutPlanTemplate,
} from '@/api/Exercises/workoutPlanTemplates';
import { plannedWorkoutKeys } from '@/api/keys/exercises';
import type { WorkoutPlanTemplate } from '@/types/workout';

export const workoutPlanKeys = {
  all: ['workoutPlanTemplates'] as const,
  lists: () => [...workoutPlanKeys.all, 'list'] as const,
  details: () => [...workoutPlanKeys.all, 'detail'] as const,
  detail: (id: string) => [...workoutPlanKeys.details(), id] as const,
  active: (date: string) => [...workoutPlanKeys.all, 'active', date] as const,
};

// --- Queries ---

export const useWorkoutPlanTemplates = (userId?: string) => {
  const { t } = useTranslation();
  return useQuery({
    queryKey: workoutPlanKeys.lists(),
    queryFn: async () => {
      const plans = await getWorkoutPlanTemplates();
      return plans.sort((a, b) => a.plan_name.localeCompare(b.plan_name));
    },
    enabled: !!userId,
    meta: {
      errorMessage: t(
        'workoutPlansManager.failedToLoadPlans',
        'Failed to load workout plans.'
      ),
    },
  });
};

/** The active program (with all its day-of-week assignments) for a given
 * date, or null when no program is active. Shared by the Active Program
 * Widget and the Home dashboard's "Today's Planned Workout" card so both
 * read the exact same query/cache entry. */
export const useActiveWorkoutPlan = (date: string, userId?: string) => {
  return useQuery({
    queryKey: workoutPlanKeys.active(date),
    queryFn: () => getActiveWorkoutPlanTemplate(date),
    enabled: !!date && !!userId,
  });
};

// --- Mutations ---

export const useCreateWorkoutPlanTemplateMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: Omit<
        WorkoutPlanTemplate,
        'id' | 'user_id' | 'created_at' | 'updated_at'
      >;
    }) => createWorkoutPlanTemplate(userId, data),
    onSuccess: () => {
      // Invalidates the whole workoutPlanTemplates prefix, not just .lists()
      // — a new plan can be created active, which the Active Program Widget
      // reads via workoutPlanKeys.active(date), a sibling key under the same
      // prefix.
      queryClient.invalidateQueries({ queryKey: workoutPlanKeys.all });
      // Creating (and, per syncTemplatePlannedWorkouts, especially activating)
      // a template regenerates its planned_workouts rows server-side, so any
      // planned-workouts list/day-view reader must refetch too.
      queryClient.invalidateQueries({ queryKey: plannedWorkoutKeys.all });
    },
    meta: {
      successMessage: t(
        'workoutPlansManager.createSuccess',
        'Workout plan created successfully.'
      ),
      errorMessage: t(
        'workoutPlansManager.createError',
        'Failed to create workout plan.'
      ),
    },
  });
};

export const useUpdateWorkoutPlanTemplateMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<WorkoutPlanTemplate>;
    }) => updateWorkoutPlanTemplate(id, data),
    onSuccess: (_data, variables) => {
      // Covers .lists() and .active(date) too — activating/deactivating a
      // plan (the common case for this mutation) changes what the Active
      // Program Widget's active-date query should return.
      queryClient.invalidateQueries({ queryKey: workoutPlanKeys.all });
      queryClient.invalidateQueries({
        queryKey: workoutPlanKeys.detail(variables.id),
      });
      // Activating/deactivating/editing a template resyncs its
      // planned_workouts rows server-side (syncTemplatePlannedWorkouts).
      queryClient.invalidateQueries({ queryKey: plannedWorkoutKeys.all });
    },
    meta: {
      errorMessage: t(
        'workoutPlansManager.updateError',
        'Failed to update workout plan.'
      ),
      successMessage: (_data, variables) => {
        const typedVars = variables as { data: Partial<WorkoutPlanTemplate> };

        if (
          Object.keys(typedVars.data).length === 1 &&
          'is_active' in typedVars.data
        ) {
          return t('workoutPlansManager.toggleStatusSuccess', {
            status: typedVars.data.is_active ? 'activated' : 'deactivated',
            defaultValue: `Workout plan ${typedVars.data.is_active ? 'activated' : 'deactivated'} successfully.`,
          });
        }

        return t(
          'workoutPlansManager.updateSuccess',
          'Workout plan updated successfully.'
        );
      },
    },
  });
};

export const useDeleteWorkoutPlanTemplateMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => deleteWorkoutPlanTemplate(id),
    onSuccess: () => {
      // Deleting the active plan should clear it from the Active Program
      // Widget too, not just the manage-schedules list.
      queryClient.invalidateQueries({ queryKey: workoutPlanKeys.all });
      // A deleted template's future planned_workouts rows are also cleaned
      // up server-side (syncTemplatePlannedWorkouts) — refetch so a planned
      // list/day-view stops showing them.
      queryClient.invalidateQueries({ queryKey: plannedWorkoutKeys.all });
    },
    meta: {
      successMessage: t(
        'workoutPlansManager.deleteSuccess',
        'Workout plan deleted successfully.'
      ),
      errorMessage: t(
        'workoutPlansManager.deleteError',
        'Failed to delete workout plan.'
      ),
    },
  });
};
