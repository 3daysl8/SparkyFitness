import reportRepository from '../models/reportRepository.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import measurementRepository from '../models/measurementRepository.js';
import userRepository from '../models/userRepository.js';
import preferenceRepository from '../models/preferenceRepository.js';
import * as genericHealthRepository from '../models/genericHealthRepository.js';
import { log } from '../config/logging.js';
import { resolveBackgroundStepCalories } from '@workspace/shared';
import {
  computeCalorieBalance,
  resolveDeviceProjectionSnapshot,
} from './calorieBalanceService.js';

// The stored, per-user calorie goal (user_goals/goalService) was hard-deleted
// along with food/nutrition tracking -- there is no more per-user target to
// read here. This is the same flat fallback every calorie-balance call site
// already used when no goal could be resolved.
const DEFAULT_CALORIE_GOAL_KCAL = 2000;

/**
 * Aggregates stats for external dashboards (like gethomepage.dev).
 *
 * Delegates the arithmetic to `computeCalorieBalance`, the same function behind
 * `/api/daily-summary` and `/api/daily-summary/range`, so a Homepage widget shows the
 * number the Diary shows. This file used to hand-inline its own copy of that math, which
 * had drifted in four ways: it never subtracted workout steps from check-in steps (its
 * `activitySteps` was always 0 because the query it read does not select `steps`), it
 * carried its own copy of the stride formula, it clamped progress to 100 where the app
 * does not, and it read the wall clock even when asked for a past date.
 */
async function getDashboardStats(
  userId: string,
  date: string,
  includeCheckin = true
) {
  try {
    const [
      nutritionData,
      exerciseSplits,
      userProfile,
      userPreferences,
      measurements,
      checkInMeasurements,
      latestWeightHeight,
      healthConnectTotalRows,
    ] = await Promise.all([
      reportRepository.getNutritionData(userId, date, date, []),
      // Replaces a forEach over `reportRepository.getExerciseEntries`, whose SELECT omits
      // `steps` — so the old `activitySteps` was always 0 and every step a logged workout
      // already accounted for was charged a second time as "background".
      exerciseEntryRepository.getDailyExerciseCalorieSplitRange(
        userId,
        date,
        date
      ),
      userRepository.getUserProfile(userId),
      preferenceRepository.getUserPreferences(userId),
      includeCheckin
        ? measurementRepository.getLatestCheckInMeasurementsOnOrBeforeDate(
            userId,
            date
          )
        : null,
      includeCheckin
        ? measurementRepository.getCheckInMeasurementsByDate(userId, date)
        : null,
      includeCheckin
        ? measurementRepository.getLatestWeightHeight(userId, date)
        : { weightKg: null, heightCm: null },
      includeCheckin
        ? genericHealthRepository
            .getHealthConnectTotalCaloriesByDateRange(
              userId,
              userId,
              date,
              date
            )
            .catch((error: unknown) => {
              log(
                'warn',
                `Health Connect total-calorie dashboard fetch failed for user ${userId} on ${date}:`,
                error
              );
              return [];
            })
        : [],
    ]);

    const split = exerciseSplits[0];
    const exercise = {
      activeCalories: Number(split?.active_calories) || 0,
      otherCalories: Number(split?.other_calories) || 0,
      activitySteps: Number(split?.activity_steps) || 0,
    };

    const steps = parseInt(String(checkInMeasurements?.steps ?? '0'), 10) || 0;
    const stepCalories = includeCheckin
      ? resolveBackgroundStepCalories({
          totalSteps: steps,
          activitySteps: exercise.activitySteps,
          weightKg: latestWeightHeight.weightKg,
          heightCm: latestWeightHeight.heightCm,
        })
      : 0;

    const healthConnectTotal = healthConnectTotalRows[0];
    const timezone = userPreferences?.timezone || 'UTC';
    const deviceProjectionSnapshot = resolveDeviceProjectionSnapshot({
      date,
      timezone,
      deviceTotal: healthConnectTotal
        ? {
            totalCalories: healthConnectTotal.total_calories,
            capturedAt: healthConnectTotal.captured_at,
          }
        : null,
    });

    const balance = computeCalorieBalance({
      eatenCalories:
        nutritionData.length > 0
          ? parseFloat(nutritionData[0].calories) || 0
          : 0,
      exercise,
      backgroundStepCalories: stepCalories,
      adjustedGoalCalories: DEFAULT_CALORIE_GOAL_KCAL,
      userProfile,
      userPreferences,
      measurements,
      ...deviceProjectionSnapshot,
    });

    return {
      eaten: balance.eaten,
      burned: balance.burned,
      remaining: balance.remaining,
      goal: balance.goal,
      net: balance.net,
      progress: balance.progress,
      steps,
      stepCalories,
      bmr: balance.bmr,
      unit: 'kcal',
      // The per-user calorie-goal-type configuration (nutrientGoalPreferenceService)
      // was dropped along with the food/goals domain -- nothing left to report here.
      calorieGoalType: undefined,
    };
  } catch (error) {
    log(
      'error',
      `Error calculating Dashboard stats for user ${userId}:`,
      error
    );
    throw error;
  }
}

export { getDashboardStats };
export default {
  getDashboardStats,
};
