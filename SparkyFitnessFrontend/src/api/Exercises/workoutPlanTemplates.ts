import { apiCall } from '@/api/api';
import type { WorkoutPlanTemplate } from '@/types/workout';

export const getWorkoutPlanTemplates = async (): Promise<
  WorkoutPlanTemplate[]
> => {
  return apiCall('/workout-plan-templates', {
    method: 'GET',
  });
};

export const createWorkoutPlanTemplate = async (
  userId: string,
  planData: Omit<
    WorkoutPlanTemplate,
    'id' | 'user_id' | 'created_at' | 'updated_at'
  >
): Promise<WorkoutPlanTemplate> => {
  return apiCall('/workout-plan-templates', {
    method: 'POST',
    body: JSON.stringify({ ...planData, user_id: userId }),
  });
};

export const updateWorkoutPlanTemplate = async (
  id: string,
  planData: Partial<WorkoutPlanTemplate>
): Promise<WorkoutPlanTemplate> => {
  return apiCall(`/workout-plan-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(planData),
  });
};

export const deleteWorkoutPlanTemplate = async (
  id: string
): Promise<{ message: string }> => {
  return apiCall(`/workout-plan-templates/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Resolves the user's active workout plan (with all its day-of-week
 * assignments) for a given date. When no plan is active, the server returns
 * an empty body, which `apiCall` normalizes to `{}` — not `null` — so that
 * shape is checked for here rather than left for callers to rediscover.
 */
export const getActiveWorkoutPlanTemplate = async (
  date: string
): Promise<WorkoutPlanTemplate | null> => {
  const response = await apiCall(`/workout-plan-templates/active/${date}`, {
    method: 'GET',
  });
  return response && response.id ? response : null;
};
