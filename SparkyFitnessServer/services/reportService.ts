import reportRepository from '../models/reportRepository.js';
import measurementRepository from '../models/measurementRepository.js';
import userRepository from '../models/userRepository.js';
import preferenceRepository from '../models/preferenceRepository.js';
import bmrService from './bmrService.js';
import sleepAnalyticsService from './sleepAnalyticsService.js';
import medicationRepository from '../models/medicationRepository.js';
import medicationEntryRepository from '../models/medicationEntryRepository.js';
import { log } from '../config/logging.js';
import { addDays, todayInZone, isUsableMeasuredBmr } from '@workspace/shared';
import { userAge } from '../utils/dateHelpers.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { parseJsonArrayField } from '../utils/exerciseJsonFields.js';

interface MeasurementEntry {
  entry_date: string | Date;
  weight?: number | string | null;
  height?: number | string | null;
  body_fat_percentage?: number | string | null;
  bmr?: number | string | null;
  [key: string]: unknown;
}

interface WorkoutEntry {
  entry_date: string | Date;
  exercise_name: string;
  exercise_id?: string;
  exercise_category?: string;
  exercise_calories_per_hour?: number;
  exercise_equipment?: string;
  exercise_primary_muscles?: string;
  exercise_secondary_muscles?: string;
  exercise_instructions?: string;
  exercise_images?: string;
  exercise_source?: string;
  exercise_source_id?: string;
  exercise_user_id?: string;
  exercise_is_custom?: boolean;
  exercise_level?: string;
  exercise_force?: string;
  exercise_mechanic?: string;
  sets?: Array<{
    weight?: string | number;
    reps?: string | number;
  }>;
  exercises?: {
    primary_muscles?: string;
  };
}

interface PrRecord {
  date: string | Date;
  oneRM: number;
  maxWeight: number;
  maxReps: number;
}

interface SetData {
  reps: number[];
  weight: number[];
  avgReps?: number;
  avgWeight?: number;
}

interface ExercisePerformance {
  firstSet: SetData;
  middleSet: SetData;
  lastSet: SetData;
}

async function getReportsData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authenticatedUserId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetUserId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startDate: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  endDate: any
) {
  try {
    const [
      fetchedNutritionData,
      exerciseEntriesRaw,
      measurementData,
      customCategoriesResult,
      userProfile,
      userPreferences,
      sleepAnalyticsData,
      medications,
      medicationEntries,
      waterTotals,
    ] = await Promise.all([
      // Custom-nutrient catalog was dropped along with the food domain that
      // defined it; this is now supplement-only (see reportRepository.js).
      reportRepository.getNutritionData(targetUserId, startDate, endDate, []),
      reportRepository.getExerciseEntries(targetUserId, startDate, endDate),
      reportRepository.getMeasurementData(targetUserId, startDate, endDate),
      measurementRepository.getCustomCategories(targetUserId),
      userRepository.getUserProfile(targetUserId),
      preferenceRepository.getUserPreferences(targetUserId),
      sleepAnalyticsService.getSleepAnalytics(targetUserId, startDate, endDate),
      medicationRepository.listMedications(targetUserId),
      medicationEntryRepository.listEntries(targetUserId, {
        fromDate: startDate,
        toDate: endDate,
      }),
      measurementRepository.getWaterTotalsByDateRange(
        targetUserId,
        startDate,
        endDate
      ),
    ]);
    const waterByDate = new Map<string, number>();
    for (const row of waterTotals as Array<{
      entry_date: string;
      total_ml: string | number;
    }>) {
      waterByDate.set(row.entry_date, Number(row.total_ml) || 0);
    }
    const customMeasurementsData = [];
    for (const category of customCategoriesResult) {
      const customMeasurementResult =
        await reportRepository.getCustomMeasurementsData(
          targetUserId,
          category.id,
          startDate,
          endDate
        );
      for (let i = 0; i < customMeasurementResult.length; i++) {
        customMeasurementsData.push(customMeasurementResult[i]);
      }
    }
    // Supplement-adherence nutrient totals (food's own contribution is gone
    // along with the food domain -- see reportRepository.getNutritionData).
    const nutritionData = fetchedNutritionData.map(
      (item: Record<string, string | number>) => ({
        date: item.date,
        calories: parseFloat(String(item.calories)) || 0,
        protein: parseFloat(String(item.protein)) || 0,
        carbs: parseFloat(String(item.carbs)) || 0,
        fat: parseFloat(String(item.fat)) || 0,
        saturated_fat: parseFloat(String(item.saturated_fat)) || 0,
        polyunsaturated_fat: parseFloat(String(item.polyunsaturated_fat)) || 0,
        monounsaturated_fat: parseFloat(String(item.monounsaturated_fat)) || 0,
        trans_fat: parseFloat(String(item.trans_fat)) || 0,
        cholesterol: parseFloat(String(item.cholesterol)) || 0,
        sodium: parseFloat(String(item.sodium)) || 0,
        potassium: parseFloat(String(item.potassium)) || 0,
        dietary_fiber: parseFloat(String(item.dietary_fiber)) || 0,
        sugars: parseFloat(String(item.sugars)) || 0,
        vitamin_a: parseFloat(String(item.vitamin_a)) || 0,
        vitamin_c: parseFloat(String(item.vitamin_c)) || 0,
        calcium: parseFloat(String(item.calcium)) || 0,
        iron: parseFloat(String(item.iron)) || 0,
        caffeine_mg: parseFloat(String(item.caffeine_mg)) || 0,
        alcohol_g: parseFloat(String(item.alcohol_g)) || 0,
        water: waterByDate.get(String(item.date)) || 0,
      })
    );
    // BMR Calculation
    if (userProfile && userPreferences) {
      const tz = userPreferences?.timezone || 'UTC';
      const age = userAge(userProfile.date_of_birth, tz);
      const gender = userProfile.gender;
      const bmrAlgorithm = userPreferences.bmr_algorithm;
      nutritionData.forEach((day: Record<string, unknown>) => {
        // Find the most recent measurement on or before the current day
        const relevantMeasurements = (measurementData as MeasurementEntry[])
          .filter(
            (m: MeasurementEntry) =>
              new Date(m.entry_date as string) <= new Date(day.date as string)
          )

          .sort(
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) => new Date(b.entry_date) - new Date(a.entry_date)
          );
        const latestMeasurement = relevantMeasurements[0];
        const weight =
          latestMeasurement?.weight !== null &&
          latestMeasurement?.weight !== undefined
            ? Number(latestMeasurement.weight)
            : undefined;
        const height =
          latestMeasurement?.height !== null &&
          latestMeasurement?.height !== undefined
            ? Number(latestMeasurement.height)
            : undefined;
        const bodyFat =
          latestMeasurement?.body_fat_percentage !== null &&
          latestMeasurement?.body_fat_percentage !== undefined
            ? Number(latestMeasurement.body_fat_percentage)
            : undefined;
        // Exact date, unlike the body metrics above: a measured BMR describes the
        // day it was taken, so it is never carried forward onto later days.
        const measuredBmr = (measurementData as MeasurementEntry[]).find(
          (m: MeasurementEntry) =>
            String(m.entry_date).slice(0, 10) ===
              String(day.date).slice(0, 10) &&
            m.bmr !== null &&
            m.bmr !== undefined
        )?.bmr;
        let formulaBmr: number | null = null;
        if (weight && height && age && gender && bmrAlgorithm) {
          try {
            formulaBmr = bmrService.calculateBmr(
              bmrAlgorithm,
              weight,
              height,
              age,
              gender,
              bodyFat
            );
          } catch (error) {
            log(
              'warn',
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
              `Could not calculate BMR for user ${targetUserId} on date ${day.date}: ${error.message}`
            );
            formulaBmr = null;
          }
        }
        // The measured reading wins only if it is plausible against this person's
        // own formula estimate; with no estimate to compare, the absolute bounds
        // decide on their own.
        day.bmr =
          userPreferences?.use_external_bmr &&
          isUsableMeasuredBmr(measuredBmr, formulaBmr)
            ? Number(measuredBmr)
            : formulaBmr;
        day.include_bmr_in_net_calories =
          userPreferences.include_bmr_in_net_calories;
      });
    }
    const exerciseEntries = exerciseEntriesRaw.map((entry: WorkoutEntry) => ({
      ...entry,

      exercises: {
        id: entry.exercise_id,
        name: entry.exercise_name,
        category: entry.exercise_category,
        calories_per_hour: entry.exercise_calories_per_hour,
        equipment: parseJsonArrayField(entry.exercise_equipment),
        primary_muscles: parseJsonArrayField(entry.exercise_primary_muscles),
        secondary_muscles: parseJsonArrayField(
          entry.exercise_secondary_muscles
        ),
        instructions: parseJsonArrayField(entry.exercise_instructions),
        images: parseJsonArrayField(entry.exercise_images),
        source: entry.exercise_source,
        source_id: entry.exercise_source_id,
        user_id: entry.exercise_user_id,
        is_custom: entry.exercise_is_custom,
        level: entry.exercise_level,
        force: entry.exercise_force,
        mechanic: entry.exercise_mechanic,
      },
    }));

    return {
      nutritionData,
      exerciseEntries, // Include exercise entries
      measurementData,
      customCategories: customCategoriesResult,
      customMeasurementsData,
      sleepAnalyticsData, // New: Include sleep analytics data
      medications,
      medicationEntries,
    };
  } catch (error) {
    log(
      'error',
      `Error fetching reports data for user ${targetUserId} by ${authenticatedUserId}:`,
      error
    );
    throw error;
  }
}
// Helper function to calculate 1RM using the Epley formula
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculate1RM(weight: any, reps: any) {
  if (reps === 0) return 0;
  return weight * (1 + reps / 30);
}
// Helper function to categorize rep ranges
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRepRangeCategory(reps: any) {
  if (reps >= 1 && reps <= 5) return '1-5 Reps';
  if (reps >= 6 && reps <= 8) return '6-8 Reps';
  if (reps >= 9 && reps <= 12) return '9-12 Reps';
  if (reps > 12) return '12+ Reps';
  return 'N/A';
}
// Helper function to calculate workout consistency
function calculateWorkoutConsistency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exerciseEntries: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startDate: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  endDate: any,
  timezone = 'UTC'
) {
  if (!exerciseEntries || exerciseEntries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      weeklyFrequency: 0,
      monthlyFrequency: 0,
    };
  }
  const workoutDates = [
    ...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exerciseEntries.map((e: any) => {
        const d = String(e.entry_date);
        return d.length === 10 ? d : d.slice(0, 10);
      })
    ),
  ].sort();
  let currentStreak = 0;
  let longestStreak = 0;
  if (workoutDates.length > 0) {
    // Calculate streaks using string-based day comparison
    let streak = 1;
    for (let i = 1; i < workoutDates.length; i++) {
      const prev = workoutDates[i - 1];
      // @ts-expect-error
      const next = addDays(prev, 1);
      if (workoutDates[i] === next) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
    // Check if the most recent workout was yesterday or today to determine current streak
    const lastWorkout = workoutDates[workoutDates.length - 1];
    const today = todayInZone(timezone);
    const yesterday = addDays(today, -1);
    if (lastWorkout === today || lastWorkout === yesterday) {
      currentStreak = streak;
    } else {
      currentStreak = 0;
    }
  }
  // Calculate frequencies
  const start = new Date(startDate);
  const end = new Date(endDate);
  // @ts-expect-error TS(2362): The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const totalWorkouts = workoutDates.length;
  const weeklyFrequency = (totalWorkouts / diffDays) * 7;
  const monthlyFrequency = (totalWorkouts / diffDays) * 30;
  return {
    currentStreak,
    longestStreak,
    weeklyFrequency: isNaN(weeklyFrequency) ? 0 : weeklyFrequency,
    monthlyFrequency: isNaN(monthlyFrequency) ? 0 : monthlyFrequency,
  };
}
// Helper function to calculate muscle group recovery
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateMuscleGroupRecovery(exerciseEntries: any) {
  const recoveryData = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exerciseEntries.forEach((entry: any) => {
    const muscles = entry.exercises
      ? JSON.parse(entry.exercises.primary_muscles || '[]')
      : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    muscles.forEach((muscle: any) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (!recoveryData[muscle] || entry.entry_date > recoveryData[muscle]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        recoveryData[muscle] = entry.entry_date;
      }
    });
  });
  return recoveryData;
}
// Helper function to calculate exercise variety
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateExerciseVariety(exerciseEntries: any) {
  const varietyData = {};
  const muscleExerciseMap = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exerciseEntries.forEach((entry: any) => {
    if (entry.exercises && entry.exercises.primary_muscles) {
      const primaryMuscles = JSON.parse(
        entry.exercises.primary_muscles || '[]'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      primaryMuscles.forEach((muscle: any) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (!muscleExerciseMap[muscle]) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          muscleExerciseMap[muscle] = new Set();
        }
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        muscleExerciseMap[muscle].add(entry.exercise_name);
      });
    }
  });
  for (const muscle in muscleExerciseMap) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    varietyData[muscle] = muscleExerciseMap[muscle].size;
  }
  return varietyData;
}
// Helper function to calculate PR progression
function calculatePrProgression(exerciseEntries: WorkoutEntry[]) {
  const progression: Record<string, PrRecord[]> = {};
  // Sort entries by date ascending to process in chronological order
  const sortedEntries = [...exerciseEntries].sort(
    (a, b) =>
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  );
  sortedEntries.forEach((entry) => {
    if (entry.sets && entry.sets.length > 0) {
      entry.sets.forEach((set) => {
        const weight = parseFloat(String(set.weight)) || 0;
        const reps = parseInt(String(set.reps)) || 0;
        const oneRM = calculate1RM(weight, reps);
        if (!progression[entry.exercise_name]) {
          progression[entry.exercise_name] = [];
        }
        const exerciseProgression = progression[entry.exercise_name];
        const lastPr =
          exerciseProgression.length > 0
            ? exerciseProgression[exerciseProgression.length - 1]
            : null;
        if (
          !lastPr ||
          oneRM > lastPr.oneRM ||
          weight > lastPr.maxWeight ||
          reps > lastPr.maxReps
        ) {
          progression[entry.exercise_name].push({
            date: entry.entry_date,
            oneRM: oneRM,
            maxWeight: weight,
            maxReps: reps,
          });
        }
      });
    }
  });
  return progression;
}
// Helper function to analyze set performance (first vs. middle vs. last sets)
function calculateSetPerformance(exerciseEntries: WorkoutEntry[]) {
  const setPerformance: Record<string, ExercisePerformance> = {};
  exerciseEntries.forEach((entry) => {
    if (entry.sets && entry.sets.length >= 3) {
      const exerciseName = entry.exercise_name;
      if (!setPerformance[exerciseName]) {
        setPerformance[exerciseName] = {
          firstSet: { reps: [], weight: [] },
          middleSet: { reps: [], weight: [] },
          lastSet: { reps: [], weight: [] },
        };
      }
      const firstSet = entry.sets[0];
      const lastSet = entry.sets[entry.sets.length - 1];
      const middleIndex = Math.floor(entry.sets.length / 2);
      const middleSet = entry.sets[middleIndex];
      setPerformance[exerciseName].firstSet.reps.push(Number(firstSet.reps));
      setPerformance[exerciseName].firstSet.weight.push(
        Number(firstSet.weight)
      );
      setPerformance[exerciseName].middleSet.reps.push(Number(middleSet.reps));
      setPerformance[exerciseName].middleSet.weight.push(
        Number(middleSet.weight)
      );
      setPerformance[exerciseName].lastSet.reps.push(Number(lastSet.reps));
      setPerformance[exerciseName].lastSet.weight.push(Number(lastSet.weight));
    }
  });
  // Averaging the results for a cleaner data structure
  for (const exercise in setPerformance) {
    const data = setPerformance[exercise];
    data.firstSet.avgReps =
      data.firstSet.reps.reduce((a, b) => a + b, 0) / data.firstSet.reps.length;
    data.firstSet.avgWeight =
      data.firstSet.weight.reduce((a, b) => a + b, 0) /
      data.firstSet.weight.length;
    data.middleSet.avgReps =
      data.middleSet.reps.reduce((a, b) => a + b, 0) /
      data.middleSet.reps.length;
    data.middleSet.avgWeight =
      data.middleSet.weight.reduce((a, b) => a + b, 0) /
      data.middleSet.weight.length;
    data.lastSet.avgReps =
      data.lastSet.reps.reduce((a, b) => a + b, 0) / data.lastSet.reps.length;
    data.lastSet.avgWeight =
      data.lastSet.weight.reduce((a, b) => a + b, 0) /
      data.lastSet.weight.length;
  }
  return setPerformance;
}
async function getExerciseDashboardData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authenticatedUserId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetUserId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startDate: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  endDate: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  equipment: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  muscle: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exercise: any
) {
  try {
    const allExerciseEntries = await reportRepository.getExerciseEntries(
      targetUserId,
      startDate,
      endDate,
      equipment,
      muscle,
      exercise
    );
    // Synced device calorie summaries (e.g. Apple Health "Active Calories") are
    // logged as exercise entries but aren't true workouts — exclude them so
    // every counter on the Exercise Reports dashboard matches user expectations.
    const exerciseEntries = allExerciseEntries.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => entry.exercise_name !== 'Active Calories'
    );
    let totalVolume = 0;
    let totalReps = 0;
    const totalWorkouts = new Set(); // To count unique workout days
    const prData = {}; // Stores max 1RM for each exercise
    const bestSetRepRange = {}; // Stores max weight for each exercise and rep range
    const muscleGroupVolume = {}; // Stores total volume per muscle group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exerciseEntries.forEach((entry: any) => {
      totalWorkouts.add(entry.entry_date); // Add unique dates
      if (entry.sets && entry.sets.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entry.sets.forEach((set: any) => {
          const weight = parseFloat(set.weight) || 0;
          const reps = parseInt(set.reps) || 0;
          // Calculate total volume and reps
          totalVolume += weight * reps;
          totalReps += reps;
          // Calculate 1RM and track PRs
          const oneRM = calculate1RM(weight, reps);
          if (
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            !prData[entry.exercise_name] ||
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            oneRM > prData[entry.exercise_name].oneRM
          ) {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            prData[entry.exercise_name] = {
              oneRM,
              date: entry.entry_date,
              weight,
              reps,
            };
          }
          // Best set per rep range
          const repRange = getRepRangeCategory(reps);
          if (repRange !== 'N/A') {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            if (!bestSetRepRange[entry.exercise_name]) {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              bestSetRepRange[entry.exercise_name] = {};
            }
            if (
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              !bestSetRepRange[entry.exercise_name][repRange] ||
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              weight > bestSetRepRange[entry.exercise_name][repRange].weight
            ) {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              bestSetRepRange[entry.exercise_name][repRange] = {
                weight,
                reps,
                date: entry.entry_date,
              };
            }
          }
          // Muscle group volume
          if (entry.exercises && entry.exercises.primary_muscles) {
            // It's already parsed in getReportsData, so no need to parse again
            const primaryMuscles = entry.exercises.primary_muscles;
            if (Array.isArray(primaryMuscles)) {
              primaryMuscles.forEach((muscle) => {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                muscleGroupVolume[muscle] =
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  (muscleGroupVolume[muscle] || 0) + weight * reps;
              });
            }
          }
        });
      }
    });
    const timezone = await loadUserTimezone(targetUserId);
    const consistencyData = calculateWorkoutConsistency(
      exerciseEntries,
      startDate,
      endDate,
      timezone
    );
    const recoveryData = calculateMuscleGroupRecovery(exerciseEntries);
    const prProgressionData = calculatePrProgression(exerciseEntries);
    const exerciseVarietyData = calculateExerciseVariety(exerciseEntries);
    const setPerformanceData = calculateSetPerformance(exerciseEntries);
    return {
      keyStats: {
        totalWorkouts: totalWorkouts.size,
        totalVolume: totalVolume,
        totalReps: totalReps,
      },
      prData,
      bestSetRepRange,
      muscleGroupVolume,
      consistencyData, // Add consistency data to the response
      recoveryData, // Add recovery data to the response
      prProgressionData, // Add PR progression data to the response
      exerciseVarietyData, // Add exercise variety data
      setPerformanceData, // Add set performance data
      exerciseEntries, // Return raw entries for tabular display
    };
  } catch (error) {
    log(
      'error',
      `Error fetching exercise dashboard data for user ${targetUserId} by ${authenticatedUserId}:`,
      error
    );
    throw error;
  }
}
export { getReportsData };
export { getExerciseDashboardData };
export default {
  getReportsData,
  getExerciseDashboardData,
};
