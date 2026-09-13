import { vi, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_SUPPLEMENT_TOTALS,
  FOOD_VARIANT_NUTRIENT_FIELDS,
} from '@workspace/shared';
import {
  createMockDbClient,
  type MockDbClient,
} from './helpers/mockDbClient.js';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/poolManager.js';
import { getDailySupplementTotals } from '../models/foodMisc.js';
import { getDailyNutritionTotalsRange } from '../models/reportRepository.js';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
}));

// getDailyNutritionSummary / getDailyNutritionSummariesByDates (the Diary's per-date and
// multi-date food+supplement aggregations, which used to drive their date set from a UNION
// of food_entries and taken-supplement dates) were hard-deleted along with the food domain --
// their only caller was services/dailySummaryService.ts, also deleted. getDailyNutritionTotalsRange
// survives as the sole remaining daily-total aggregation, now supplement-only with no UNION
// (medication_entries alone drives the date set), and is exercised below.
describe('getDailyNutritionTotalsRange includes supplement snapshots', () => {
  let mockClient: MockDbClient;
  const userId = uuidv4();

  beforeEach(() => {
    mockClient = createMockDbClient([{}]);
    vi.mocked(getClient).mockResolvedValue(mockClient);
  });

  afterEach(() => vi.clearAllMocks());

  const sqlOf = () => String(mockClient.query.mock.calls[0][0]);

  // This statement contains MANY medication_entries scans: seventeen fixed-nutrient
  // subqueries plus the date-set arm. Asserting that the filter or the clamp appears
  // *somewhere* in the string therefore proves almost nothing, because any one of the other
  // scans satisfies it. Dropping the status predicate from a single nutrient leaves the
  // other sixteen to keep such an assertion green while a skipped dose starts contributing
  // that nutrient. So: split the statement into its scans and check every one of them.
  // Matched as a UNIT, not by splitting on `FROM medication_entries`. The clamp and the
  // snapshot read sit BEFORE the FROM, so a split would test each chunk against the NEXT
  // subquery's expressions, and since the fixed subqueries all share one alias, a subquery
  // that had lost its filter would be covered by its neighbour. The backreference (\1) also
  // pins the read, the clamp and the scan to one alias.
  const FIXED_SUBQUERY =
    /\(SELECT SUM\(public\.sf_try_numeric\((\w+)\.nutrients_snapshot->>'(\w+)'\) \* GREATEST\(COALESCE\(\1\.dose_amount_snapshot, 1\), 0\)\) FROM medication_entries \1 WHERE (.+?)\), 0\)/g;

  const expectEveryScanFiltered = (sql: string) => {
    const matches = [...sql.matchAll(FIXED_SUBQUERY)];
    // Every fixed snapshot read must belong to a subquery this regex actually matched,
    // or one could slip past the loop below and be silently unchecked.
    const reads = (sql.match(/nutrients_snapshot->>'/g) ?? []).length;
    expect(matches.length, 'a fixed subquery escaped the check').toBe(reads);
    expect(matches.length).toBeGreaterThan(0);
    for (const [, alias, key, where] of matches) {
      expect(where, `the ${key} subquery lost the status filter`).toContain(
        `${alias}.status IN ('taken', 'prn_taken')`
      );
    }
  };

  // A day on which the user logged only supplements must still produce a row: the date set
  // is driven entirely by taken-supplement dates now (no more food_entries to union with),
  // so that outer date scan must carry the same status/snapshot filter as the fixed arms --
  // otherwise a skipped or unsnapshotted dose would surface an empty row instead of none.
  it("drives the date set from medication_entries' own countable filter", async () => {
    await getDailyNutritionTotalsRange(userId, '2026-07-01', '2026-07-21');
    const sql = sqlOf();

    const dateArm = sql.match(
      /SELECT DISTINCT entry_date\s+FROM medication_entries \w+\s+WHERE (.+?)\)\s+d\b/s
    )?.[1];
    expect(
      dateArm,
      'no date-driving scan over medication_entries found'
    ).toBeTruthy();
    expect(dateArm).toMatch(/status IN \('taken', 'prn_taken'\)/);
    expect(dateArm).toMatch(/nutrients_snapshot IS NOT NULL/);
  });

  it('adds the supplement arm (fixed columns)', async () => {
    await getDailyNutritionTotalsRange(userId, '2026-07-01', '2026-07-21');
    const sql = sqlOf();
    expect(sql).toContain('medication_entries');
    expect(sql).toContain("nutrients_snapshot->>'calories'");
    expect(sql).toMatch(
      /GREATEST\(COALESCE\(\w+\.dose_amount_snapshot, 1\), 0\)/
    );
    expectEveryScanFiltered(sql);
  });
});

// The Diary needs the supplement arm on its own, because it computes eaten calories and
// its nutrition summary in JS from food entries rather than from the SQL above.
describe('getDailySupplementTotals', () => {
  let mockClient: MockDbClient;
  const userId = uuidv4();

  afterEach(() => vi.clearAllMocks());

  it('reads the same snapshot arm as the other aggregations', async () => {
    mockClient = createMockDbClient([{}]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    await getDailySupplementTotals(userId, '2026-08-06');

    const sql = String(mockClient.query.mock.calls[0][0]);
    expect(sql).toMatch(/\w+\.status IN \('taken', 'prn_taken'\)/);
    expect(sql).toMatch(
      /GREATEST\(COALESCE\(\w+\.dose_amount_snapshot, 1\), 0\)/
    );
    // Exactly the fields the nutrition summary sums for supplements. Offering the picker
    // a field this query does not read would let a user enter a number that goes nowhere.
    for (const key of [
      'calories',
      'protein',
      'carbs',
      'fat',
      'dietary_fiber',
    ]) {
      expect(sql).toContain(`nutrients_snapshot->>'${key}'`);
    }
  });

  // Only six catalog micronutrients have a fixed column. Magnesium, vitamin D, vitamin K,
  // zinc and the B vitamins are user-defined nutrients living in the snapshot's
  // custom_nutrients object, so the fixed columns above cannot carry them at all and the
  // Diary would still understate the typical multivitamin (#2145).
  it('aggregates the custom nutrients a dose carries', async () => {
    mockClient = createMockDbClient([{}]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    await getDailySupplementTotals(userId, '2026-08-06');

    const sql = String(mockClient.query.mock.calls[0][0]);
    expect(sql).toContain("nutrients_snapshot->'custom_nutrients'");
    expect(sql).toContain('jsonb_object_agg(key, value)');
    expect(sql).toContain('AS custom_nutrients');
    // The aggregate this test is NAMED for. Asserting only that a JSON aggregation exists
    // leaves the aggregation itself unchecked: swapping SUM(scaled) for MAX(scaled) keeps
    // every other assertion green, and two magnesium doses of 100mg and 200mg would then
    // report 200 instead of 300. The mock hands back an already-aggregated row, so no
    // downstream test notices either.
    expect(sql).toMatch(/SELECT key, SUM\(scaled\) AS value/);
    expect(sql).toContain('GROUP BY key');
    // Same status filter and dose clamp as the fixed arm, because the custom rows are the
    // shared fragment rather than a second copy that could drift from it.
    //
    // Asserted against the CUSTOM scan's own alias, derived from the query. This statement
    // holds two scans, so a bare /\w+\.status IN .../ is satisfied by the fixed one and
    // stays green even when the custom fragment loses its filter entirely. Deriving the
    // alias keeps the assertion pinned to the right scan without hardcoding its name.
    const customAlias = sql.match(
      /FROM medication_entries (\w+)\s+CROSS JOIN LATERAL jsonb_each_text/
    )?.[1];
    expect(customAlias, 'could not find the custom-nutrient scan').toBeTruthy();
    expect(sql).toContain(`${customAlias}.status IN ('taken', 'prn_taken')`);
    expect(sql).toContain(
      `GREATEST(COALESCE(${customAlias}.dose_amount_snapshot, 1), 0)`
    );
    // Supplements alone. Unioning the food rows in here, the way getDailyNutritionSummary
    // does, would double-count every custom nutrient: callers add this arm onto totals
    // they have already derived from food entries themselves.
    expect(sql).not.toContain('food_entries');
  });

  it('returns the custom nutrient map the query produced', async () => {
    mockClient = createMockDbClient([
      { calories: '0', custom_nutrients: { Magnesium: 400, 'Vitamin D': 50 } },
    ]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    const totals = await getDailySupplementTotals(userId, '2026-08-06');

    expect(totals.custom_nutrients).toEqual({
      Magnesium: 400,
      'Vitamin D': 50,
    });
  });

  it('coerces a custom nutrient that summed to null', async () => {
    // sf_try_numeric returns NULL for a value it cannot parse; a key whose contributions
    // are all NULL sums to NULL and jsonb_object_agg emits it as JSON null.
    mockClient = createMockDbClient([
      { custom_nutrients: { Magnesium: null, Zinc: '15' } },
    ]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    const totals = await getDailySupplementTotals(userId, '2026-08-06');

    expect(totals.custom_nutrients.Magnesium).toBe(0);
    expect(totals.custom_nutrients.Zinc).toBe(15);
  });

  it('returns zeros, not nulls, on a day with no supplements', async () => {
    // COALESCE makes the SQL emit 0, but an empty result set must not become NaN either:
    // callers add these to food totals unconditionally.
    mockClient = createMockDbClient([]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    const totals = await getDailySupplementTotals(userId, '2026-08-06');

    expect(totals).toEqual(EMPTY_SUPPLEMENT_TOTALS);
    // Full width, not just the macros: the Diary card renders whichever fixed nutrients
    // the user has enabled, so a narrow zero object reintroduces #2145 on an empty day.
    const { custom_nutrients, ...fixed } = totals;
    expect(Object.keys(fixed).sort()).toEqual(
      [...FOOD_VARIANT_NUTRIENT_FIELDS].sort()
    );
    // An empty map rather than undefined, so callers can iterate without checking.
    expect(custom_nutrients).toEqual({});
  });

  it('coerces numeric strings, which is what pg returns for numeric columns', async () => {
    mockClient = createMockDbClient([
      {
        calories: '15',
        protein: '0',
        carbs: '0',
        fat: '1.5',
        dietary_fiber: '0',
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    const totals = await getDailySupplementTotals(userId, '2026-08-06');

    expect(totals.calories).toBe(15);
    expect(totals.fat).toBe(1.5);
  });

  // Phase 3 (#1557): water_ml is deliberately excluded from
  // FOOD_VARIANT_NUTRIENT_FIELDS, so it must never show up as a "supplement
  // dose" here -- a vitamin gummy does not have a water content in the sense
  // this table means, and letting it in would create a second, uncoordinated
  // water total alongside the real hydration ring.
  it('never reads or reports a water_ml supplement dose', async () => {
    mockClient = createMockDbClient([{}]);
    vi.mocked(getClient).mockResolvedValue(mockClient);

    await getDailySupplementTotals(userId, '2026-08-06');

    const sql = String(mockClient.query.mock.calls[0][0]);
    expect(sql).not.toContain("nutrients_snapshot->>'water_ml'");
    expect(EMPTY_SUPPLEMENT_TOTALS).not.toHaveProperty('water_ml');
  });
});
