import { vi, beforeEach, describe, expect, it } from 'vitest';
import { todayInZone } from '@workspace/shared';
import { buildCoachTools } from '../ai/tools/coachTools.js';
import coachRepository from '../models/coachRepository.js';
import adaptiveTdeeService from '../services/AdaptiveTdeeService.js';
import { getResolvedExerciseCaloriesTotal } from '../services/exerciseCalorieRangeService.js';

// Food/nutrition tracking was hard-deleted from this fork (Ouroboros Life
// restructure): sparky_get_health_summary no longer reports a nutrition
// section, sparky_analyze_trends no longer reports calories, sparky_get_30_
// day_trends no longer reports a food section, sparky_detect_patterns
// (nutrient-vs-sleep/mood correlations) was removed outright, and
// sparky_generate_coaching_plan now derives its TDEE from AdaptiveTdeeService
// (weight-trend/BMR based) instead of a food-diary calorie average, and no
// longer returns a food shopping list.
vi.mock('../models/coachRepository', () => ({
  default: {
    getExerciseAggregates: vi.fn(),
    getLatestWeightInRange: vi.fn(),
    getWaterIntakeTotal: vi.fn(),
    getWeightSeries: vi.fn(),
    get30DayExerciseAggregates: vi.fn(),
    get30DayMoodAggregates: vi.fn(),
    get30DaySleepAggregates: vi.fn(),
    get30DayWeightSeries: vi.fn(),
  },
}));
vi.mock('../services/AdaptiveTdeeService', () => ({
  default: {
    calculateAdaptiveTdee: vi.fn(),
  },
}));
vi.mock('../services/exerciseCalorieRangeService', () => ({
  getResolvedExerciseCaloriesRange: vi.fn(),
  getResolvedExerciseCaloriesTotal: vi.fn(),
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));

const opts = { toolCallId: 'tc-1', messages: [] };
const DB_ERROR_TEXT =
  'Error [DB_ERROR]: A database error occurred.\n\nSuggestion: Do NOT retry the same call — it will fail the same way. Tell the user what failed and stop.';

let tools: ReturnType<typeof buildCoachTools>;

beforeEach(() => {
  // These fixtures contain no device "Active Calories" row, so the resolved total and
  // the raw SUM agree. Tracking the repo mock keeps every existing golden intact while
  // routing the tool through the resolver it now uses.
  vi.mocked(getResolvedExerciseCaloriesTotal).mockImplementation(async () => {
    const agg = await coachRepository.getExerciseAggregates('', '', '');
    return Number(agg.total_calories_burned) || 0;
  });
  vi.clearAllMocks();
  tools = buildCoachTools('user-1', 'UTC');
});

describe('sparky_get_health_summary', () => {
  it('renders fitness, vitals, and hydration as JSON', async () => {
    vi.mocked(coachRepository.getExerciseAggregates).mockResolvedValue({
      total_calories_burned: '3200',
      workout_count: 5,
    });
    vi.mocked(coachRepository.getLatestWeightInRange).mockResolvedValue({
      weight: '81.5',
      entry_date: '2026-06-07',
    });
    vi.mocked(coachRepository.getWaterIntakeTotal).mockResolvedValue({
      total_water: '14000',
    });

    const result = await tools.sparky_get_health_summary.execute!(
      { start_date: '2026-06-01', end_date: '2026-06-07' },
      opts
    );

    expect(result).toBe(
      '# Health Summary\n\n' +
        JSON.stringify(
          {
            period: { start_date: '2026-06-01', end_date: '2026-06-07' },
            fitness: {
              total_calories_burned: 3200,
              workout_count: 5,
            },
            vitals: {
              latest_weight: { weight: 81.5, date: '2026-06-07' },
            },
            hydration: {
              total_water_ml: 14000,
            },
          },
          null,
          2
        )
    );
    expect(coachRepository.getWaterIntakeTotal).toHaveBeenCalledWith(
      'user-1',
      '2026-06-01',
      '2026-06-07'
    );
  });

  it('renders a pg local-midnight Date weight date as a calendar-day string', async () => {
    vi.mocked(coachRepository.getExerciseAggregates).mockResolvedValue({
      total_calories_burned: '0',
      workout_count: 0,
    });
    vi.mocked(coachRepository.getLatestWeightInRange).mockResolvedValue({
      weight: '81.5',
      entry_date: new Date(2026, 5, 10),
    });
    vi.mocked(coachRepository.getWaterIntakeTotal).mockResolvedValue({
      total_water: '0',
    });

    const result = await tools.sparky_get_health_summary.execute!(
      { start_date: '2026-06-10' },
      opts
    );

    expect(result).toBe(
      '# Health Summary\n\n' +
        JSON.stringify(
          {
            period: { start_date: '2026-06-10', end_date: '2026-06-10' },
            fitness: {
              total_calories_burned: 0,
              workout_count: 0,
            },
            vitals: {
              latest_weight: { weight: 81.5, date: '2026-06-10' },
            },
            hydration: {
              total_water_ml: 0,
            },
          },
          null,
          2
        )
    );
  });

  it('defaults end_date to start_date and renders a null latest weight', async () => {
    vi.mocked(coachRepository.getExerciseAggregates).mockResolvedValue({
      total_calories_burned: '0',
      workout_count: 0,
    });
    vi.mocked(coachRepository.getLatestWeightInRange).mockResolvedValue(null);
    vi.mocked(coachRepository.getWaterIntakeTotal).mockResolvedValue({
      total_water: '0',
    });

    const result = await tools.sparky_get_health_summary.execute!(
      { start_date: '2026-06-10' },
      opts
    );

    expect(result).toBe(
      '# Health Summary\n\n' +
        JSON.stringify(
          {
            period: { start_date: '2026-06-10', end_date: '2026-06-10' },
            fitness: {
              total_calories_burned: 0,
              workout_count: 0,
            },
            vitals: {
              latest_weight: null,
            },
            hydration: {
              total_water_ml: 0,
            },
          },
          null,
          2
        )
    );
    expect(coachRepository.getLatestWeightInRange).toHaveBeenCalledWith(
      'user-1',
      '2026-06-10',
      '2026-06-10'
    );
  });

  it('defaults to today when start_date is missing', async () => {
    vi.mocked(coachRepository.getExerciseAggregates).mockResolvedValue({
      workouts: 1,
      active_calories: 300,
      duration_minutes: 45,
    });
    vi.mocked(coachRepository.getLatestWeightInRange).mockResolvedValue({
      weight: 75,
    });
    vi.mocked(coachRepository.getWaterIntakeTotal).mockResolvedValue({
      water_ml: 2000,
    });

    const result = await tools.sparky_get_health_summary.execute!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      opts
    );

    expect(result).toContain('Health Summary');
  });

  it('maps repository failures to DB_ERROR', async () => {
    vi.mocked(coachRepository.getExerciseAggregates).mockRejectedValue(
      new Error('boom')
    );

    const result = await tools.sparky_get_health_summary.execute!(
      { start_date: '2026-06-01' },
      opts
    );

    expect(result).toBe(DB_ERROR_TEXT);
  });
});

describe('sparky_analyze_trends', () => {
  it('classifies a small weight change as stable', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockResolvedValue([
      { entry_date: '2026-06-01', weight: '80.0' },
      { entry_date: '2026-06-07', weight: '80.3' },
    ]);

    const result = await tools.sparky_analyze_trends.execute!(
      { days: 14 },
      opts
    );

    expect(result).toBe(
      '# Trend Analysis\n\n' +
        JSON.stringify(
          {
            period_days: 14,
            weight: {
              trend: 'stable',
              data_points: 2,
              entries: [
                { date: '2026-06-01', weight: 80 },
                { date: '2026-06-07', weight: 80.3 },
              ],
            },
          },
          null,
          2
        )
    );
    expect(coachRepository.getWeightSeries).toHaveBeenCalledWith(
      'user-1',
      14,
      todayInZone('UTC')
    );
  });

  it('classifies a falling series as decreasing', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockResolvedValue([
      { entry_date: '2026-06-01', weight: '82' },
      { entry_date: '2026-06-07', weight: '80.5' },
    ]);

    const result = await tools.sparky_analyze_trends.execute!(
      { days: 7 },
      opts
    );

    expect(result).toContain('"trend": "decreasing"');
  });

  it('defaults days to 7 and reports insufficient data with no entries', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockResolvedValue([]);

    const result = await tools.sparky_analyze_trends.execute!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      opts
    );

    expect(result).toBe(
      '# Trend Analysis\n\n' +
        JSON.stringify(
          {
            period_days: 7,
            weight: {
              trend: 'insufficient_data',
              data_points: 0,
              entries: [],
            },
          },
          null,
          2
        )
    );
    expect(coachRepository.getWeightSeries).toHaveBeenCalledWith(
      'user-1',
      7,
      todayInZone('UTC')
    );
  });

  it('maps repository failures to DB_ERROR', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockRejectedValue(
      new Error('boom')
    );

    const result = await tools.sparky_analyze_trends.execute!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      opts
    );

    expect(result).toBe(DB_ERROR_TEXT);
  });
});

describe('sparky_get_30_day_trends', () => {
  it('renders exercise/mood/sleep/biometrics sections with unit conversions', async () => {
    vi.mocked(coachRepository.get30DayExerciseAggregates).mockResolvedValue({
      total_workouts: 8,
      active_days: 6,
      total_calories_burned: '2400',
    });
    // The 30-day tool resolves over its own window rather than reusing the range
    // aggregate; no device summary in this fixture, so the two agree.
    vi.mocked(getResolvedExerciseCaloriesTotal).mockResolvedValue(2400);
    vi.mocked(coachRepository.get30DayMoodAggregates).mockResolvedValue({
      entries: 10,
      avg_mood: '7.44',
    });
    vi.mocked(coachRepository.get30DaySleepAggregates).mockResolvedValue({
      entries: 9,
      avg_duration_seconds: '27000',
      avg_sleep_score: '82.6',
    });
    vi.mocked(coachRepository.get30DayWeightSeries).mockResolvedValue([
      { entry_date: '2026-05-20', weight: '82' },
      { entry_date: '2026-06-05', weight: '81.2' },
    ]);

    const result = await tools.sparky_get_30_day_trends.execute!(
      { end_date: '2026-06-10' },
      opts
    );

    expect(result).toBe(
      '# 30-Day Trends\n\n' +
        JSON.stringify(
          {
            period: { end_date: '2026-06-10', days: 30 },
            exercise: {
              total_workouts: 8,
              active_days: 6,
              total_calories_burned: 2400,
            },
            mood: {
              entries: 10,
              avg_mood: 7.4,
            },
            sleep: {
              entries: 9,
              avg_duration_hours: 7.5,
              avg_sleep_score: 83,
            },
            biometrics: {
              weight_entries: 2,
              weights: [
                { date: '2026-05-20', weight: 82 },
                { date: '2026-06-05', weight: 81.2 },
              ],
            },
          },
          null,
          2
        )
    );
    expect(coachRepository.get30DayExerciseAggregates).toHaveBeenCalledWith(
      'user-1',
      '2026-06-10'
    );
  });

  it('defaults end_date to today (UTC)', async () => {
    vi.mocked(coachRepository.get30DayExerciseAggregates).mockResolvedValue({
      total_workouts: 0,
      active_days: 0,
      total_calories_burned: '0',
    });
    vi.mocked(coachRepository.get30DayMoodAggregates).mockResolvedValue({
      entries: 0,
      avg_mood: '0',
    });
    vi.mocked(coachRepository.get30DaySleepAggregates).mockResolvedValue({
      entries: 0,
      avg_duration_seconds: '0',
      avg_sleep_score: '0',
    });
    vi.mocked(coachRepository.get30DayWeightSeries).mockResolvedValue([]);

    await tools.sparky_get_30_day_trends.execute!({}, opts);

    expect(coachRepository.get30DayExerciseAggregates).toHaveBeenCalledWith(
      'user-1',
      todayInZone('UTC')
    );
  });

  it('maps repository failures to DB_ERROR', async () => {
    vi.mocked(coachRepository.get30DayExerciseAggregates).mockRejectedValue(
      new Error('boom')
    );

    const result = await tools.sparky_get_30_day_trends.execute!({}, opts);

    expect(result).toBe(DB_ERROR_TEXT);
  });
});

describe('sparky_generate_coaching_plan', () => {
  it('uses AdaptiveTdeeService and applies the weight_loss deficit', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockResolvedValue([
      { entry_date: '2026-05-28', weight: '80' },
      { entry_date: '2026-06-10', weight: '81' },
    ]);
    vi.mocked(adaptiveTdeeService.calculateAdaptiveTdee).mockResolvedValue({
      tdee: 1971,
      confidence: 'MEDIUM',
      isFallback: false,
      daysOfData: 14,
      lastCalculated: '2026-06-10T00:00:00.000Z',
    });

    const result = await tools.sparky_generate_coaching_plan.execute!(
      { goal: 'weight_loss', target_weight: 75 },
      opts
    );

    expect(result).toBe(
      '# Coaching Plan\n\n' +
        JSON.stringify(
          {
            goal: 'weight_loss',
            current_estimated_tdee: 1971,
            tdee_confidence: 'MEDIUM',
            recommended_targets: {
              daily_calories: 1471,
              protein_grams: 110,
              carbs_grams: 147,
              fat_grams: 49,
            },
            coaching_insight:
              'Your weight is currently trending up. To hit your weight loss goal, we need to bring daily calories down to 1471.',
          },
          null,
          2
        )
    );
    expect(adaptiveTdeeService.calculateAdaptiveTdee).toHaveBeenCalledWith(
      'user-1',
      todayInZone('UTC')
    );
  });

  it('reflects a fallback TDEE and the default maintenance goal', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockResolvedValue([]);
    vi.mocked(adaptiveTdeeService.calculateAdaptiveTdee).mockResolvedValue({
      tdee: 2200,
      confidence: 'LOW',
      isFallback: true,
      fallbackReason: 'insufficient_data',
      daysOfData: 0,
      lastCalculated: '2026-06-10T00:00:00.000Z',
    });

    const result = await tools.sparky_generate_coaching_plan.execute!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      opts
    );

    expect(result).toBe(
      '# Coaching Plan\n\n' +
        JSON.stringify(
          {
            goal: 'maintenance',
            current_estimated_tdee: 2200,
            tdee_confidence: 'LOW',
            recommended_targets: {
              daily_calories: 2200,
              protein_grams: 165,
              carbs_grams: 220,
              fat_grams: 73,
            },
            coaching_insight:
              'You are on the right track for your maintenance goal.',
          },
          null,
          2
        )
    );
  });

  it('maps repository failures to DB_ERROR', async () => {
    vi.mocked(coachRepository.getWeightSeries).mockRejectedValue(
      new Error('boom')
    );

    const result = await tools.sparky_generate_coaching_plan.execute!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      opts
    );

    expect(result).toBe(DB_ERROR_TEXT);
  });
});
