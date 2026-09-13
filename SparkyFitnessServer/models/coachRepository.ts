import { getClient } from '../db/poolManager.js';

// Aggregate queries backing the chatbot coach tools (sparky_get_health_summary,
// sparky_analyze_trends, sparky_get_30day_trends, sparky_generate_coaching_plan).
// Trend math and pattern classification live in ai/tools/coachTools.ts; this
// file only holds the SQL.
//
// Food/nutrition tracking was hard-deleted from this fork (Ouroboros Life
// restructure) -- this used to also aggregate food_entries (nutrition
// totals, daily calorie series, 30-day food averages, frequent high-protein
// foods, and a nutrition arm of the daily correlation rows). All of that is
// gone; what remains is exercise/weight/water/sleep/mood.

async function getExerciseAggregates(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
        COALESCE(SUM(calories_burned), 0)::numeric AS total_calories_burned,
        COUNT(*)::int AS workout_count
       FROM exercise_entries
       WHERE user_id = $1 AND entry_date >= $2 AND entry_date <= $3`,
      [userId, startDate, endDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getLatestWeightInRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT weight, entry_date
       FROM check_in_measurements
       WHERE user_id = $1 AND weight IS NOT NULL AND entry_date >= $2 AND entry_date <= $3
       ORDER BY entry_date DESC
       LIMIT 1`,
      [userId, startDate, endDate]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getWaterIntakeTotal(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT COALESCE(SUM(water_ml), 0)::numeric AS total_water
       FROM water_intake
       WHERE user_id = $1 AND entry_date >= $2 AND entry_date <= $3`,
      [userId, startDate, endDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Trailing windows anchor on `today`, the caller's user-timezone day string.
async function getWeightSeries(userId: string, days: number, today: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT weight, entry_date
       FROM check_in_measurements
       WHERE user_id = $1 AND weight IS NOT NULL AND entry_date >= ($3::date - $2::int)
       ORDER BY entry_date ASC`,
      [userId, days, today]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function get30DayExerciseAggregates(userId: string, endDate: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
        COUNT(*)::int AS total_workouts,
        COUNT(DISTINCT entry_date)::int AS active_days,
        COALESCE(SUM(calories_burned), 0)::numeric AS total_calories_burned
       FROM exercise_entries
       WHERE user_id = $1 AND entry_date > ($2::date - INTERVAL '30 days') AND entry_date <= $2::date`,
      [userId, endDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function get30DayMoodAggregates(userId: string, endDate: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
        COUNT(*)::int AS entries,
        COALESCE(AVG(mood_value), 0)::numeric AS avg_mood
       FROM mood_entries
       WHERE user_id = $1 AND entry_date > ($2::date - INTERVAL '30 days') AND entry_date <= $2::date`,
      [userId, endDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function get30DaySleepAggregates(userId: string, endDate: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
        COUNT(*)::int AS entries,
        COALESCE(AVG(duration_in_seconds), 0)::numeric AS avg_duration_seconds,
        COALESCE(AVG(sleep_score), 0)::numeric AS avg_sleep_score
       FROM sleep_entries
       WHERE user_id = $1 AND entry_date > ($2::date - INTERVAL '30 days') AND entry_date <= $2::date`,
      [userId, endDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function get30DayWeightSeries(userId: string, endDate: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT weight, entry_date
       FROM check_in_measurements
       WHERE user_id = $1 AND weight IS NOT NULL AND entry_date > ($2::date - INTERVAL '30 days') AND entry_date <= $2::date
       ORDER BY entry_date ASC`,
      [userId, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// sparky_detect_patterns (the caller of a daily_food/sleep/mood correlation
// query that used to live here) was removed: its entire methodology was
// correlating food_entries nutrients against sleep/mood, and food/nutrition
// tracking was hard-deleted from this fork. No non-food replacement pattern
// was implemented (that would be new coaching logic, not a straight port).

export {
  getExerciseAggregates,
  getLatestWeightInRange,
  getWaterIntakeTotal,
  getWeightSeries,
  get30DayExerciseAggregates,
  get30DayMoodAggregates,
  get30DaySleepAggregates,
  get30DayWeightSeries,
};
export default {
  getExerciseAggregates,
  getLatestWeightInRange,
  getWaterIntakeTotal,
  getWeightSeries,
  get30DayExerciseAggregates,
  get30DayMoodAggregates,
  get30DaySleepAggregates,
  get30DayWeightSeries,
};
