import { FOOD_VARIANT_NUTRIENT_FIELDS } from '@workspace/shared';
import type { FoodVariantNutrientField } from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import {
  doseScale,
  supplementCountable,
  supplementFixedSubquery,
} from './supplementSql.js';
// Per-day supplement-only nutrient totals over a date range.
//
// Food/nutrition tracking was hard-deleted from this fork (Ouroboros Life
// restructure) -- this used to UNION food_entries/food_entry_meals nutrient
// sums with the supplement contribution below (see models/supplementSql.ts);
// the food half is gone, so this is now just the supplement side, kept
// because it's the one surviving contributor to a day's nutrient totals
// (supplement-adherence reporting, per the restructure plan).
async function getNutritionData(
  userId: string,
  startDate: string,
  endDate: string,
  customNutrients: Array<{ name: string }> = []
) {
  const client = await getClient(userId); // User-specific operation
  try {
    const params: (string | number)[] = [userId, startDate, endDate];
    const customNutrientParamIndexes: number[] = [];
    customNutrients.forEach((cn) => {
      params.push(cn.name);
      customNutrientParamIndexes.push(params.length);
    });

    const standardNutrientsSelectOuter = FOOD_VARIANT_NUTRIENT_FIELDS.map(
      (nutrient) => `SUM(${nutrient}) AS ${nutrient}`
    ).join(',\n         ');
    // Generate dynamic SQL parts for custom nutrients
    const customNutrientsSelectOuter = customNutrients
      .map((cn) => {
        const ident = cn.name.replace(/"/g, '""');
        return `SUM("${ident}") AS "${ident}"`;
      })
      .join(',\n         ');
    // Each snapshot holds ONE dose's payload; multiply by the dose count taken in this
    // entry. For a supplement `dose_amount` is a count (its strength is forced to 1), so
    // `dose_amount_snapshot` — which createEntry derives from the schedule's dose override
    // (COALESCE(ms.dose_amount, m.dose_amount)) — is the number of units this entry logged.
    // Manual/unscheduled entries snapshot 1, so this is a no-op there. NULL-safe to 1, and
    // GREATEST(..., 0) so a non-positive legacy value neutralises instead of subtracting.
    // (This is NOT the previously-rejected scaling by a medication's mg strength.)
    // Values are read from the immutable per-entry snapshot and parsed defensively so one
    // malformed JSONB value can't error the whole query.
    const standardNutrientsSelectSupplement = FOOD_VARIANT_NUTRIENT_FIELDS.map(
      (nutrient) =>
        `(COALESCE(public.sf_try_numeric(me.nutrients_snapshot->>'${nutrient}'), 0) * ${doseScale('me')}) AS ${nutrient}`
    ).join(',\n           ');
    const customNutrientsSelectSupplement = customNutrients
      .map((cn, idx) => {
        const ident = cn.name.replace(/"/g, '""');
        const paramIdx = customNutrientParamIndexes[idx];
        return `(COALESCE(public.sf_try_numeric(me.nutrients_snapshot->'custom_nutrients'->>$${paramIdx}), 0) * ${doseScale('me')}) AS "${ident}"`;
      })
      .join(',\n           ');
    const result = await client.query(
      `SELECT
         TO_CHAR(entry_date, 'YYYY-MM-DD') AS date,
         ${standardNutrientsSelectOuter}${
           customNutrientsSelectOuter
             ? ',\n         ' + customNutrientsSelectOuter
             : ''
         }
       FROM (
         SELECT
           me.entry_date,
           ${standardNutrientsSelectSupplement}${
             customNutrientsSelectSupplement
               ? ',\n           ' + customNutrientsSelectSupplement
               : ''
           }
         FROM medication_entries me
         WHERE me.user_id = $1
           AND me.entry_date BETWEEN $2 AND $3
           AND ${supplementCountable('me')}
       ) AS combined_nutrition
       GROUP BY entry_date
       ORDER BY entry_date`,
      params
    );
    return result.rows;
  } finally {
    client.release();
  }
}
async function getMeasurementData(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId); // User-specific operation
  try {
    const result = await client.query(
      "SELECT TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date, weight, neck, waist, hips, steps, height, body_fat_percentage, muscle_mass_kg, bone_mass_kg, body_water_percentage, bmr FROM check_in_measurements WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date",
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
async function getCustomMeasurementsData(
  userId: string,
  categoryId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId); // User-specific operation
  try {
    // Cap the points returned per category so large datasets (e.g. years of
    // intraday heart-rate samples) do not blow up the call stack or payload.
    // When the range exceeds maxPoints rows, return an evenly-spaced sample
    // (always including the first row) so charts keep the overall trend.
    const maxPoints = 3000;
    const result = await client.query(
      `WITH ranked AS (
           SELECT category_id,
                  TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
                  entry_hour, value, notes, entry_timestamp,
                  row_number() OVER (ORDER BY entry_date, entry_timestamp) AS rn,
                  count(*) OVER () AS total
           FROM custom_measurements
           WHERE user_id = $1 AND category_id = $2 AND entry_date BETWEEN $3 AND $4
         )
         SELECT category_id, entry_date, entry_hour, value, notes, entry_timestamp
         FROM ranked
         WHERE total <= $5 OR (rn - 1) % GREATEST(1, CEIL(total::float / $5)::bigint) = 0
         ORDER BY entry_date, entry_timestamp`,
      [userId, categoryId, startDate, endDate, maxPoints]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
async function getExerciseEntries(
  userId: string,
  startDate: string,
  endDate: string,
  equipment?: string | null,
  muscle?: string | null,
  exercise?: string | null
) {
  const client = await getClient(userId); // User-specific operation
  try {
    let query = `SELECT
         ee.id,
         TO_CHAR(ee.entry_date, 'YYYY-MM-DD') AS entry_date,
         ee.duration_minutes,
         ee.calories_burned,
         ee.notes,
         ee.exercise_id,
         ee.exercise_name,
         ee.category AS exercise_category,
         ee.calories_per_hour AS exercise_calories_per_hour,
         ee.equipment AS exercise_equipment,
         ee.primary_muscles AS exercise_primary_muscles,
         ee.secondary_muscles AS exercise_secondary_muscles,
         ee.instructions AS exercise_instructions,
         ee.images AS exercise_images,
         ee.source AS exercise_source,
         ee.source_id AS exercise_source_id,
         ee.user_id AS exercise_user_id,
         ee.level AS exercise_level,
         ee.force AS exercise_force,
         ee.mechanic AS exercise_mechanic,
         COALESCE(
           (SELECT json_agg(set_data ORDER BY set_data.set_number)
            FROM (
              SELECT ees.id, ees.set_number, ees.set_type, ees.reps, ees.weight, ees.duration, ees.rest_time, ees.notes, ees.distance
              FROM exercise_entry_sets ees
              WHERE ees.exercise_entry_id = ee.id
            ) AS set_data
           ), '[]'::json
         ) AS sets
       FROM exercise_entries ee
       WHERE ee.user_id = $1 AND ee.entry_date BETWEEN $2 AND $3`;
    const params: (string | number)[] = [userId, startDate, endDate];
    let paramIndex = 4;
    if (equipment) {
      query += ` AND ee.equipment ILIKE $${paramIndex}`;
      params.push(`%${equipment}%`);
      paramIndex++;
    }
    if (muscle) {
      query += ` AND ee.primary_muscles ILIKE $${paramIndex}`;
      params.push(`%${muscle}%`);
      paramIndex++;
    }
    if (exercise) {
      query += ` AND ee.exercise_name = $${paramIndex}`;
      params.push(exercise);
      paramIndex++;
    }
    query += ' ORDER BY ee.entry_date DESC, ee.created_at DESC';
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
async function getExerciseNames(
  userId: string,
  muscle?: string | null,
  equipment?: string | null
) {
  const client = await getClient(userId); // User-specific operation
  try {
    // Exclude synced device calorie summaries (e.g. Apple Health "Active
    // Calories") — they show up as exercise entries but aren't true workouts,
    // and the Exercise Reports dashboard filters them out of its aggregates.
    let query =
      "SELECT DISTINCT exercise_id as id, exercise_name as name FROM exercise_entries WHERE user_id = $1 AND exercise_name <> 'Active Calories'";
    const params: string[] = [userId];
    let paramIndex = 2;
    if (muscle) {
      query += ` AND primary_muscles ILIKE $${paramIndex}`;
      params.push(`%${muscle}%`);
      paramIndex++;
    }
    if (equipment) {
      query += ` AND equipment ILIKE $${paramIndex}`;
      params.push(`%${equipment}%`);
      paramIndex++;
    }
    query += ' ORDER BY name';
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
// The range query's output names differ from the column names for exactly two fields, and
// its consumers read the aliases (foodTools reads row.fiber and row.sugar). Anything without
// an entry here is aliased to itself.
const RANGE_COL_ALIASES: Partial<Record<FoodVariantNutrientField, string>> = {
  dietary_fiber: 'fiber',
  sugars: 'sugar',
};
// Derived rather than hand-listed: this was a second copy of the seventeen fields with
// nothing enforcing that it stayed in step, so a field added to the shared list would have
// silently dropped out of trends and the chatbot's nutrition rows.
const RANGE_COLS: [FoodVariantNutrientField, string][] =
  FOOD_VARIANT_NUTRIENT_FIELDS.map((col) => [
    col,
    RANGE_COL_ALIASES[col] ?? col,
  ]);

// Per-day supplement-only nutrient totals over a date range. Backs the
// chatbot get_nutritional_summary action and report tools.
//
// Used to also scale/sum food_entries (quantity / serving_size) with the
// dose-scaled supplement contribution added on top; food/nutrition tracking
// was hard-deleted from this fork, so this is now just the supplement side --
// the date set is every date a supplement was taken in range, rather than the
// prior UNION with food_entries dates.
async function getDailyNutritionTotalsRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getClient(userId);
  try {
    const rangeSelects = RANGE_COLS.map(
      ([col, alias]) =>
        `${supplementFixedSubquery(col, '$1', 'd.entry_date')} as ${alias}`
    ).join(',\n              ');
    const result = await client.query(
      `SELECT d.entry_date,
              ${rangeSelects}
       FROM (
         SELECT DISTINCT entry_date
           FROM medication_entries me
          WHERE me.user_id = $1 AND me.entry_date BETWEEN $2 AND $3
            AND ${supplementCountable('me')}
       ) d
       ORDER BY d.entry_date ASC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export { getNutritionData };
export { getMeasurementData };
export { getCustomMeasurementsData };
export { getExerciseEntries };
export { getExerciseNames };
export { getDailyNutritionTotalsRange };
export default {
  getNutritionData,
  getMeasurementData,
  getCustomMeasurementsData,
  getExerciseEntries,
  getExerciseNames,
  getDailyNutritionTotalsRange,
};
