import { getClient } from '../db/poolManager.js';
import { FOOD_VARIANT_NUTRIENT_FIELDS } from '@workspace/shared';
import type { FoodVariantNutrientField } from '@workspace/shared';
import {
  supplementScanWhere,
  supplementFixedAgg,
  supplementCustomTotals,
} from './supplementSql.js';

/**
 * The supplement arm of a day's intake, on its own.
 *
 * Food/nutrition tracking was hard-deleted from this fork (Ouroboros Life
 * restructure) -- this file used to also carry the food-diary half of this
 * query (and a large amount of unrelated food-catalog querying: recent/top/
 * favorite foods, diary snapshot rewrites, food-derived water). All of that
 * is gone; this is the one piece still called (supplement-adherence
 * reporting) now that there is no food arm left to correlate it against.
 *
 * Fields are `FOOD_VARIANT_NUTRIENT_FIELDS`, the same list `reportRepository`
 * applies `supplementFixedSubquery` to for the range query. Returns zeros
 * rather than nulls on a day with no supplements, so callers can add
 * unconditionally.
 *
 * Custom nutrients come back alongside them, aggregated by name.
 */
async function getDailySupplementTotals(userId: string, date: string) {
  const client = await getClient(userId);
  try {
    const sums = FOOD_VARIANT_NUTRIENT_FIELDS.map(
      (field) => `${supplementFixedAgg(field, 'me')} AS ${field}`
    ).join(',\n          ');
    const selects = FOOD_VARIANT_NUTRIENT_FIELDS.map(
      (field) => `COALESCE(supplement_fixed.${field}, 0) AS ${field}`
    ).join(',\n        ');
    const result = await client.query(
      `SELECT
        ${selects},
        ${supplementCustomTotals('$1', '$2')} AS custom_nutrients
      FROM (
        SELECT
          ${sums}
        FROM medication_entries me
        WHERE ${supplementScanWhere('me', '$1', '$2')}
      ) supplement_fixed`,
      [userId, date]
    );
    const row = result.rows[0] ?? {};
    const customRow = (row.custom_nutrients ?? {}) as Record<string, unknown>;
    return {
      ...(Object.fromEntries(
        FOOD_VARIANT_NUTRIENT_FIELDS.map((field) => [
          field,
          Number(row[field]) || 0,
        ])
      ) as Record<FoodVariantNutrientField, number>),
      // A key whose every contribution failed `sf_try_numeric` sums to NULL and arrives as
      // JSON null, so these are coerced the same way the fixed columns are.
      custom_nutrients: Object.fromEntries(
        Object.entries(customRow).map(([name, value]) => [
          name,
          Number(value) || 0,
        ])
      ),
    };
  } finally {
    client.release();
  }
}

export interface RawCaffeineDose {
  source: 'supplement';
  entry_date: string;
  entry_time: string | null;
  meal_default_time: string | null;
  taken_at: Date | string | null;
  caffeine_mg: number;
  name: string;
}

/**
 * Caffeine doses in a window, from supplements only.
 *
 * Used to also UNION in a food arm (caffeinated food/drink entries); food/
 * nutrition tracking was hard-deleted from this fork, so this is now
 * supplement-only. Callers (caffeineKineticsService) already branch on
 * `source` per-row rather than assuming both are present.
 */
async function getCaffeineDosesForWindow(
  userId: string,
  startDate: string,
  endDate: string
): Promise<RawCaffeineDose[]> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
        'supplement' AS source,
        me.entry_date::text AS entry_date,
        NULL::text AS entry_time,
        NULL::text AS meal_default_time,
        me.taken_at,
        (public.sf_try_numeric(me.nutrients_snapshot->>'caffeine_mg') * GREATEST(COALESCE(me.dose_amount_snapshot, 1), 0))::numeric AS caffeine_mg,
        COALESCE(me.med_name_snapshot, 'Supplement') AS name
      FROM medication_entries me
      WHERE me.user_id = $1
        AND me.entry_date >= $2
        AND me.entry_date <= $3
        AND me.status IN ('taken', 'prn_taken')
        AND me.nutrients_snapshot IS NOT NULL
        AND public.sf_try_numeric(me.nutrients_snapshot->>'caffeine_mg') > 0
      ORDER BY entry_date ASC, taken_at ASC`,
      [userId, startDate, endDate]
    );
    return result.rows.map(
      (r: {
        source: 'supplement';
        entry_date: string;
        entry_time: string | null;
        meal_default_time: string | null;
        taken_at: Date | string | null;
        caffeine_mg: string | number;
        name: string;
      }) => ({
        source: r.source,
        entry_date:
          typeof r.entry_date === 'string' && r.entry_date.includes('T')
            ? r.entry_date.split('T')[0]
            : String(r.entry_date),
        entry_time: r.entry_time ? String(r.entry_time).slice(0, 5) : null,
        meal_default_time: r.meal_default_time
          ? String(r.meal_default_time).slice(0, 5)
          : null,
        taken_at: r.taken_at,
        caffeine_mg: Number(r.caffeine_mg) || 0,
        name: r.name,
      })
    );
  } finally {
    client.release();
  }
}

export { getDailySupplementTotals };
export { getCaffeineDosesForWindow };
export default {
  getDailySupplementTotals,
  getCaffeineDosesForWindow,
};
