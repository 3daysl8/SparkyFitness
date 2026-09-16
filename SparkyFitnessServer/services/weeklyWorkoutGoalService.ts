import {
  classifySession,
  computeWeeklyProgress,
  resolveWeeklyGoalPolicy,
  weekBounds,
  type ClassifiableSession,
  type WeeklyClassifiedSession,
  type WeeklyGoalPreferencesSource,
  type WeeklyGoalProgress,
} from '@workspace/shared';
import preferenceRepository from '../models/preferenceRepository.js';
import weeklyWorkoutGoalRepository from '../models/weeklyWorkoutGoalRepository.js';

/**
 * Computes weekly workout-goal progress for the 7-day window containing
 * `date`, aligned to the user's preferred first day of the week — same shape
 * as alcoholWeekService.getAlcoholWeek.
 *
 * @param userId - ID of the target user
 * @param date - calendar day string YYYY-MM-DD
 */
export async function getWeeklyWorkoutGoalProgress(
  userId: string,
  date: string
): Promise<WeeklyGoalProgress> {
  const prefs = await preferenceRepository.getUserPreferences(userId);
  const policy = resolveWeeklyGoalPolicy(
    prefs as WeeklyGoalPreferencesSource | null | undefined
  );
  const firstDayOfWeek =
    prefs?.first_day_of_week !== null && prefs?.first_day_of_week !== undefined
      ? Number(prefs.first_day_of_week)
      : 0;

  const { weekStart, weekEnd } = weekBounds(date, firstDayOfWeek);

  const sessions = await weeklyWorkoutGoalRepository.getWeeklySessions(
    userId,
    weekStart,
    weekEnd
  );

  const classifiedSessions: WeeklyClassifiedSession[] = sessions.map(
    (session) => {
      const classifiable: ClassifiableSession = {
        workout_type: session.session_workout_type,
        preset_workout_type: session.preset_workout_type,
        exercises: session.exercises.map((exercise) => ({
          workout_type: exercise.workout_type,
          modality: exercise.modality,
          duration_minutes: exercise.duration_minutes,
        })),
      };
      const classification = classifySession(
        classifiable,
        policy.strength_counting
      );
      const duration_minutes = session.exercises.reduce(
        (sum, exercise) => sum + (exercise.duration_minutes ?? 0),
        0
      );
      return { classification, duration_minutes };
    }
  );

  return computeWeeklyProgress(policy, classifiedSessions, weekStart, weekEnd);
}

export default {
  getWeeklyWorkoutGoalProgress,
};
