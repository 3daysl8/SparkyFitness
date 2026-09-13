import { tool } from 'ai';
import { addDays, todayInZone } from '@workspace/shared';
import { log } from '../../config/logging.js';
import coachRepository from '../../models/coachRepository.js';
import adaptiveTdeeService from '../../services/AdaptiveTdeeService.js';
import { ERRORS, formatZodError } from './errors.js';
import { normalizeDayKeywords } from './dates.js';
import { getResolvedExerciseCaloriesTotal } from '../../services/exerciseCalorieRangeService.js';
import { dayString, formatSuccess } from './formatting.js';
import {
  GetHealthSummarySchema,
  AnalyzeTrendsSchema,
  Get30DayTrendsSchema,
  GenerateCoachingPlanSchema,
} from './schemas/coach.js';

// Trend math ported from MCP's coachService; the SQL lives in
// models/coachRepository.ts.
//
// sparky_detect_patterns (nutrient-vs-sleep/mood correlation) was removed:
// food/nutrition tracking was hard-deleted from this fork, and that tool's
// entire methodology was correlating food_entries nutrients against sleep
// and mood. No non-food replacement pattern was implemented (that would be
// new coaching logic, not a straight port).

/**
 * Inclusive start of the 30-day window `get30DayExerciseAggregates` uses.
 *
 * That query bounds on `entry_date > (end - INTERVAL '30 days') AND entry_date <= end`,
 * i.e. 30 days ending on `end`, so the first included day is `end - 29`.
 */
function thirtyDayWindowStart(end: string): string {
  return addDays(end, -29);
}

async function getHealthSummary(
  userId: string,
  startDate: string,
  endDate?: string
): Promise<Record<string, unknown>> {
  const end = endDate || startDate;

  const exercise = await coachRepository.getExerciseAggregates(
    userId,
    startDate,
    end
  );
  const weight = await coachRepository.getLatestWeightInRange(
    userId,
    startDate,
    end
  );
  const water = await coachRepository.getWaterIntakeTotal(
    userId,
    startDate,
    end
  );
  // Resolved rather than summed: a device "Active Calories" row already contains the
  // logged workouts beside it, so SUM(calories_burned) overstates the period.
  const resolvedBurned = await getResolvedExerciseCaloriesTotal(
    userId,
    startDate,
    end
  );

  return {
    period: { start_date: startDate, end_date: end },
    fitness: {
      total_calories_burned: resolvedBurned,
      workout_count: exercise.workout_count,
    },
    vitals: {
      latest_weight: weight
        ? { weight: Number(weight.weight), date: dayString(weight.entry_date) }
        : null,
    },
    hydration: {
      total_water_ml: Number(water.total_water),
    },
  };
}

async function analyzeTrends(userId: string, tz: string, days: number) {
  const today = todayInZone(tz);
  const weightRows = await coachRepository.getWeightSeries(userId, days, today);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weights = weightRows.map((r: any) => ({
    date: dayString(r.entry_date),
    weight: Number(r.weight),
  }));

  let weightTrend:
    'increasing' | 'decreasing' | 'stable' | 'insufficient_data' =
    'insufficient_data';
  if (weights.length >= 2) {
    const first = weights[0].weight;
    const last = weights[weights.length - 1].weight;
    const diff = last - first;
    if (Math.abs(diff) < 0.5) {
      weightTrend = 'stable';
    } else if (diff > 0) {
      weightTrend = 'increasing';
    } else {
      weightTrend = 'decreasing';
    }
  }

  return {
    period_days: days,
    weight: {
      trend: weightTrend,
      data_points: weights.length,
      entries: weights,
    },
  };
}

async function get30DayTrends(
  userId: string,
  tz: string,
  endDate?: string
): Promise<Record<string, unknown>> {
  const end = endDate || todayInZone(tz);

  const exercise = await coachRepository.get30DayExerciseAggregates(
    userId,
    end
  );
  const mood = await coachRepository.get30DayMoodAggregates(userId, end);
  const sleep = await coachRepository.get30DaySleepAggregates(userId, end);
  const weightRows = await coachRepository.get30DayWeightSeries(userId, end);
  // Same resolution as the health summary; the 30-day window starts the day after
  // `end - 30 days`, matching get30DayExerciseAggregates' own bounds.
  const resolvedBurned = await getResolvedExerciseCaloriesTotal(
    userId,
    thirtyDayWindowStart(end),
    end
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weights = weightRows.map((r: any) => ({
    date: dayString(r.entry_date),
    weight: Number(r.weight),
  }));

  return {
    period: { end_date: end, days: 30 },
    exercise: {
      total_workouts: exercise.total_workouts,
      active_days: exercise.active_days,
      total_calories_burned: resolvedBurned,
    },
    mood: {
      entries: mood.entries,
      avg_mood: Number(Number(mood.avg_mood).toFixed(1)),
    },
    sleep: {
      entries: sleep.entries,
      avg_duration_hours: Number(
        (Number(sleep.avg_duration_seconds) / 3600).toFixed(1)
      ),
      avg_sleep_score: Number(Number(sleep.avg_sleep_score).toFixed(0)),
    },
    biometrics: {
      weight_entries: weights.length,
      weights,
    },
  };
}

async function generateCoachingPlan(
  userId: string,
  tz: string,
  goal: 'weight_loss' | 'muscle_gain' | 'maintenance'
): Promise<Record<string, unknown>> {
  // 1. TDEE: delegate to AdaptiveTdeeService (weight-trend + BMR/activity based,
  // with its own BMR x activity-multiplier fallback when there isn't enough
  // weight-trend data yet) rather than the food-diary-derived estimate this
  // used to compute inline -- food/nutrition tracking was hard-deleted from
  // this fork, so there is no daily calorie series left to derive a TDEE from
  // that way.
  const trends = await analyzeTrends(userId, tz, 14);
  const today = todayInZone(tz);
  const tdeeResult = await adaptiveTdeeService.calculateAdaptiveTdee(
    userId,
    today
  );
  const estimatedTdee = tdeeResult.tdee;

  // 2. Set targets
  let targetCals = estimatedTdee;
  if (goal === 'weight_loss') targetCals -= 500;
  if (goal === 'muscle_gain') targetCals += 300;

  return {
    goal,
    current_estimated_tdee: estimatedTdee,
    tdee_confidence: tdeeResult.confidence,
    recommended_targets: {
      daily_calories: targetCals,
      protein_grams: Math.round((targetCals * 0.3) / 4), // 30% protein
      carbs_grams: Math.round((targetCals * 0.4) / 4), // 40% carbs
      fat_grams: Math.round((targetCals * 0.3) / 9), // 30% fat
    },
    coaching_insight:
      goal === 'weight_loss' && trends.weight.trend === 'increasing'
        ? 'Your weight is currently trending up. To hit your weight loss goal, we need to bring daily calories down to ' +
          targetCals +
          '.'
        : 'You are on the right track for your ' + goal + ' goal.',
  };
}

export function buildCoachTools(userId: string, tz: string) {
  return {
    sparky_get_health_summary: tool({
      description:
        "Get a summary of the user's health status (Fitness, Vitals, Hydration) for a specific date range.",
      inputSchema: GetHealthSummarySchema,
      execute: async (rawArgs) => {
        const rawArgsWithDefaults = {
          start_date: rawArgs.start_date || 'today',
          end_date: rawArgs.end_date,
        };
        const parsed = GetHealthSummarySchema.safeParse(
          normalizeDayKeywords(rawArgsWithDefaults, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const result = await getHealthSummary(
            userId,
            parsed.data.start_date!,
            parsed.data.end_date
          );
          return formatSuccess(result, 'Health Summary');
        } catch (error) {
          log('error', '[Coach Tool] getHealthSummary error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_analyze_trends: tool({
      description:
        'Analyze the weight trend (increasing/decreasing/stable) over a specified number of days.',
      inputSchema: AnalyzeTrendsSchema,
      execute: async (rawArgs) => {
        const parsed = AnalyzeTrendsSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const result = await analyzeTrends(userId, tz, parsed.data.days);
          return formatSuccess(result, 'Trend Analysis');
        } catch (error) {
          log('error', '[Coach Tool] analyzeTrends error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_30_day_trends: tool({
      description:
        'Get comprehensive trends for the last 30 days including exercise, mood, sleep, and biometrics.',
      inputSchema: Get30DayTrendsSchema,
      execute: async (rawArgs) => {
        const parsed = Get30DayTrendsSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const result = await get30DayTrends(userId, tz, parsed.data.end_date);
          return formatSuccess(result, '30-Day Trends');
        } catch (error) {
          log('error', '[Coach Tool] get30DayTrends error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_generate_coaching_plan: tool({
      description:
        'Auto-Coach: Generates a 7-day macro plan and shopping list based on your goal and weight trends.',
      inputSchema: GenerateCoachingPlanSchema,
      execute: async (rawArgs) => {
        const parsed = GenerateCoachingPlanSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          // target_weight is accepted by the schema but unused, as in MCP.
          const result = await generateCoachingPlan(
            userId,
            tz,
            parsed.data.goal
          );
          return formatSuccess(result, 'Coaching Plan');
        } catch (error) {
          log('error', '[Coach Tool] generateCoachingPlan error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
