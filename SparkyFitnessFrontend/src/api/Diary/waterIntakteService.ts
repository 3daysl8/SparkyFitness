import { apiCall } from '@/api/api';
import type {
  UpsertWaterIntakeBody,
  WaterIntakeDayTotals,
  WaterIntakeLogEntry,
} from '@workspace/shared';

export type { WaterIntakeDayTotals, WaterIntakeLogEntry };
export type UpdateWaterPayload = UpsertWaterIntakeBody;

/**
 * The daily water goal, decoupled from the legacy nutrition-goals table
 * (`user_goals` via `GET /goals/for-date`) so it survives that table being
 * dropped -- see db/migrations/20260913120000_add_water_goal_to_preferences.sql.
 * It now lives on `user_preferences.water_goal_ml`, a flat per-user
 * preference (not per-date), so `date`/`userId` are accepted only to keep
 * this a drop-in replacement for callers built around the old per-date
 * signature -- the underlying `/user-preferences` endpoint always resolves
 * to the authenticated user, regardless of these values.
 */
export const getWaterGoalForDate = async (_date: string, _userId: string) => {
  const preferences = await apiCall('/user-preferences', {
    suppress404Toast: true,
  });
  return { water_goal_ml: preferences?.water_goal_ml };
};

export const getWaterIntakeForDate = async (
  date: string,
  userId: string
): Promise<WaterIntakeDayTotals | WaterIntakeDayTotals[]> => {
  return apiCall(`/measurements/water-intake/${date}?userId=${userId}`);
};

export const updateWaterIntake = async (payload: UpdateWaterPayload) => {
  return apiCall('/measurements/water-intake', {
    method: 'POST',
    body: payload,
  });
};

export const getWaterIntakeLog = async (
  date: string,
  userId: string
): Promise<WaterIntakeLogEntry[]> => {
  return apiCall(`/v2/measurements/water-intake/${date}/log?userId=${userId}`);
};

export const deleteWaterIntakeLogEntry = async (logId: string) => {
  return apiCall(`/v2/measurements/water-intake/log/${logId}`, {
    method: 'DELETE',
    // Deleting a linked food entry cascades to its water log row, so a diary
    // page opened before that can still show a drink the server has already
    // dropped. Gone is the outcome the user asked for, so a 404 refreshes the
    // list instead of raising an error.
    suppress404Toast: true,
  });
};

export const updateWaterIntakeLogTime = async (
  logId: string,
  loggedAt: string
) => {
  return apiCall(`/v2/measurements/water-intake/log/${logId}`, {
    method: 'PATCH',
    body: { loggedAt },
  });
};
