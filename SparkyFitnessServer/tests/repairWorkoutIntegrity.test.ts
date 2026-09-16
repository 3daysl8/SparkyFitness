import { describe, it, expect, vi } from 'vitest';
import {
  evaluateStrictPhantomRule,
  evaluatePhantomCandidate,
  buildIntegrityReport,
  applyRepairs,
  type PhantomCandidateRow,
} from '../scripts/workoutIntegrity/repairWorkoutIntegrity.js';

const USER_ID = 'user-1';

function phantomRow(
  overrides: Partial<PhantomCandidateRow> = {}
): PhantomCandidateRow {
  return {
    id: 'phantom-1',
    entry_date: '2026-09-20',
    exercise_id: 'exercise-1',
    exercise_name: 'Bodyweight Squat HD',
    duration_minutes: 30,
    calories_burned: 161,
    notes: null,
    source: 'Manual',
    source_id: null,
    created_by_user_id: USER_ID,
    updated_by_user_id: null,
    created_at: '2026-09-12T10:20:42.000Z',
    updated_at: '2026-09-12T10:20:42.000Z',
    workout_plan_assignment_id: 1,
    active_set_count: 0,
    activity_detail_count: 0,
    lap_count: 0,
    gps_count: 0,
    hr_zone_count: 0,
    planned_workout_overlap_count: 0,
    ...overrides,
  };
}

describe('evaluateStrictPhantomRule', () => {
  it('qualifies a clean phantom row with no signs of real activity', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow(),
      USER_ID
    );
    expect(qualifies).toBe(true);
    expect(reasons).toEqual([]);
  });

  it('rejects a row created by someone other than the target user', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ created_by_user_id: 'someone-else' }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('created_by_user_id'))).toBe(true);
  });

  it('rejects a row updated 5 or more seconds after creation', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({
        created_at: '2026-09-12T10:20:42.000Z',
        updated_at: '2026-09-12T10:20:47.500Z',
      }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('updated_at'))).toBe(true);
  });

  it('allows updated_by_user_id to be the same user, not just null', () => {
    const { qualifies } = evaluateStrictPhantomRule(
      phantomRow({ updated_by_user_id: USER_ID }),
      USER_ID
    );
    expect(qualifies).toBe(true);
  });

  it('rejects a row updated by a different user', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ updated_by_user_id: 'someone-else' }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('updated_by_user_id'))).toBe(true);
  });

  it('rejects a row with notes', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ notes: 'felt great today' }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('notes'))).toBe(true);
  });

  it('rejects a row with source_id set, e.g. copied from the exercise catalog', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ source_id: '1312' }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('source_id'))).toBe(true);
  });

  it('rejects a row with sets carrying rpe/completed_at/is_pr', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ active_set_count: 2 }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('set(s)'))).toBe(true);
  });

  it('rejects a row with activity details, laps, gps, or hr zones', () => {
    expect(
      evaluateStrictPhantomRule(
        phantomRow({ activity_detail_count: 1 }),
        USER_ID
      ).qualifies
    ).toBe(false);
    expect(
      evaluateStrictPhantomRule(phantomRow({ lap_count: 1 }), USER_ID).qualifies
    ).toBe(false);
    expect(
      evaluateStrictPhantomRule(phantomRow({ gps_count: 1 }), USER_ID).qualifies
    ).toBe(false);
    expect(
      evaluateStrictPhantomRule(phantomRow({ hr_zone_count: 1 }), USER_ID)
        .qualifies
    ).toBe(false);
  });

  it('rejects a row that already overlaps an existing planned_workouts row', () => {
    const { qualifies, reasons } = evaluateStrictPhantomRule(
      phantomRow({ planned_workout_overlap_count: 1 }),
      USER_ID
    );
    expect(qualifies).toBe(false);
    expect(reasons.some((r) => r.includes('planned_workouts'))).toBe(true);
  });
});

describe('evaluatePhantomCandidate', () => {
  const TODAY = '2026-09-16';

  it('buckets a future-dated row as future and makes it eligible when it qualifies', () => {
    const evaluation = evaluatePhantomCandidate(
      phantomRow({ entry_date: '2026-09-20' }),
      USER_ID,
      TODAY,
      false
    );
    expect(evaluation.bucket).toBe('future');
    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.eligibleForApply).toBe(true);
  });

  it('buckets today itself as past_or_today', () => {
    const evaluation = evaluatePhantomCandidate(
      phantomRow({ entry_date: TODAY }),
      USER_ID,
      TODAY,
      false
    );
    expect(evaluation.bucket).toBe('past_or_today');
  });

  it('a qualifying past row is not eligible without --include-past', () => {
    const evaluation = evaluatePhantomCandidate(
      phantomRow({ entry_date: '2026-09-13' }),
      USER_ID,
      TODAY,
      false
    );
    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.eligibleForApply).toBe(false);
  });

  it('a qualifying past row becomes eligible with --include-past', () => {
    const evaluation = evaluatePhantomCandidate(
      phantomRow({ entry_date: '2026-09-13' }),
      USER_ID,
      TODAY,
      true
    );
    expect(evaluation.eligibleForApply).toBe(true);
  });

  it('a non-qualifying row is never eligible, past or future, regardless of --include-past', () => {
    const badRow = phantomRow({ source_id: '1312' });
    expect(
      evaluatePhantomCandidate(
        { ...badRow, entry_date: '2026-09-20' },
        USER_ID,
        TODAY,
        true
      ).eligibleForApply
    ).toBe(false);
    expect(
      evaluatePhantomCandidate(
        { ...badRow, entry_date: '2026-09-13' },
        USER_ID,
        TODAY,
        true
      ).eligibleForApply
    ).toBe(false);
  });
});

// A minimal fake `pg`-shaped client that routes each query by matching a
// keyword unique to each of the 5 report SQL statements / the mutation
// statements applyRepairs issues, rather than depending on call order.
function makeFakeClient(routes: Array<[RegExp, unknown[]]>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [pattern, rows] of routes) {
      if (pattern.test(sql)) return { rows, rowCount: rows.length };
    }
    throw new Error(`No route matched for SQL: ${sql}`);
  });
  return { query, calls };
}

describe('buildIntegrityReport', () => {
  it('assembles all five categories from the client, evaluating phantom candidates', async () => {
    const client = makeFakeClient([
      [
        /FROM exercise_entries ee\s+WHERE ee\.user_id = \$1\s+AND ee\.exercise_preset_entry_id IS NULL/,
        [phantomRow()],
      ],
      [
        /FROM exercise_preset_entries epe/,
        [
          {
            id: 'session-1',
            entry_date: '2026-09-14',
            name: 'Phase 1. Lower Body (A)',
            created_at: '2026-09-14T10:56:22Z',
            linked_from_planned_workouts: 0,
          },
        ],
      ],
      [
        /JOIN exercises e ON e\.id = ee\.exercise_id/,
        [
          {
            id: 'stale-1',
            entry_date: '2026-09-14',
            exercise_name: 'Slow Squat',
            duration_minutes: 6,
            calories_burned: 2181.53,
            calories_source: null,
            calories_per_hour: 322,
            recomputed_calories: 32.2,
          },
        ],
      ],
      [
        /ee\.duration_minutes > 0 AND ee\.duration_minutes < 1\.5/,
        [
          {
            id: 'short-1',
            entry_date: '2026-09-15',
            exercise_name: 'Barbell Shoulder Press',
            duration_minutes: 0.11,
            calories_burned: 0.77,
          },
        ],
      ],
      [
        /e\.workout_type IS NULL/,
        [
          {
            id: 'ex-1',
            name: 'Treadmill',
            category: 'general',
            modality: 'duration',
            recent_uses: 1,
          },
        ],
      ],
    ]);

    const report = await buildIntegrityReport(
      client,
      USER_ID,
      '2026-09-16',
      false
    );

    expect(report.phantom_candidates).toHaveLength(1);
    expect(report.phantom_candidates[0]!.qualifies).toBe(true);
    expect(report.empty_sessions).toHaveLength(1);
    expect(report.stale_calories).toHaveLength(1);
    expect(report.implausible_durations).toHaveLength(1);
    expect(report.untyped_exercises).toHaveLength(1);
  });
});

describe('applyRepairs', () => {
  it('converts an eligible future phantom, deletes an empty session, and recomputes calories when asked', async () => {
    const phantom = phantomRow({ id: 'phantom-1', entry_date: '2026-09-20' });
    const emptySession = {
      id: 'session-1',
      entry_date: '2026-09-14',
      name: 'Empty',
      created_at: '2026-09-14T10:56:22Z',
      linked_from_planned_workouts: 0,
    };
    const staleCalorie = {
      id: 'stale-1',
      entry_date: '2026-09-14',
      exercise_name: 'Slow Squat',
      duration_minutes: 6,
      calories_burned: 2181.53,
      calories_source: null,
      calories_per_hour: 322,
      recomputed_calories: 32.2,
    };

    const client = makeFakeClient([
      [
        /FROM exercise_entries ee\s+WHERE ee\.user_id = \$1\s+AND ee\.exercise_preset_entry_id IS NULL/,
        [phantom],
      ],
      [/FROM exercise_preset_entries epe/, [emptySession]],
      [
        /INSERT INTO planned_workouts/,
        [
          {
            id: 'pw-1',
            user_id: USER_ID,
            planned_date: phantom.entry_date,
            title: phantom.exercise_name,
            exercise_id: phantom.exercise_id,
            status: 'planned',
          },
        ],
      ],
      [/DELETE FROM exercise_entries WHERE id = \$1/, [{ id: phantom.id }]],
      [
        /DELETE FROM exercise_preset_entries WHERE id = \$1/,
        [{ id: emptySession.id }],
      ],
      [/JOIN exercises e ON e\.id = ee\.exercise_id/, [staleCalorie]],
      [
        /SELECT \* FROM exercise_entries WHERE id = \$1 AND user_id = \$2/,
        [
          {
            id: staleCalorie.id,
            calories_burned: staleCalorie.calories_burned,
            calories_source: null,
          },
        ],
      ],
      [
        /UPDATE exercise_entries\s+SET calories_burned/,
        [
          {
            id: staleCalorie.id,
            calories_burned: staleCalorie.recomputed_calories,
            calories_source: 'derived',
          },
        ],
      ],
    ]);

    const summary = await applyRepairs(client, USER_ID, '2026-09-16', {
      includePast: false,
      recomputeCalories: true,
    });

    expect(summary.phantomsConverted).toBe(1);
    expect(summary.emptySessionsDeleted).toBe(1);
    expect(summary.caloriesRecomputed).toBe(1);
    expect(summary.backup).toHaveLength(4);
    expect(
      summary.backup.find((e) => e.table === 'planned_workouts')?.operation
    ).toBe('insert');
    expect(
      summary.backup.filter(
        (e) => e.table === 'exercise_entries' && e.operation === 'delete'
      )
    ).toHaveLength(1);
    expect(
      summary.backup.filter(
        (e) => e.table === 'exercise_preset_entries' && e.operation === 'delete'
      )
    ).toHaveLength(1);
    expect(
      summary.backup.filter(
        (e) => e.table === 'exercise_entries' && e.operation === 'update'
      )
    ).toHaveLength(1);
  });

  it('never touches calories when recomputeCalories is false', async () => {
    const client = makeFakeClient([
      [
        /FROM exercise_entries ee\s+WHERE ee\.user_id = \$1\s+AND ee\.exercise_preset_entry_id IS NULL/,
        [],
      ],
      [/FROM exercise_preset_entries epe/, []],
    ]);

    const summary = await applyRepairs(client, USER_ID, '2026-09-16', {
      includePast: false,
      recomputeCalories: false,
    });

    expect(summary.caloriesRecomputed).toBe(0);
    expect(
      client.calls.some((c) =>
        /JOIN exercises e ON e\.id = ee\.exercise_id/.test(c.sql)
      )
    ).toBe(false);
  });

  it('skips a non-qualifying phantom even though it is date-eligible', async () => {
    const badPhantom = phantomRow({
      id: 'phantom-bad',
      entry_date: '2026-09-20',
      source_id: '1312',
    });
    const client = makeFakeClient([
      [
        /FROM exercise_entries ee\s+WHERE ee\.user_id = \$1\s+AND ee\.exercise_preset_entry_id IS NULL/,
        [badPhantom],
      ],
      [/FROM exercise_preset_entries epe/, []],
    ]);

    const summary = await applyRepairs(client, USER_ID, '2026-09-16', {
      includePast: false,
      recomputeCalories: false,
    });

    expect(summary.phantomsConverted).toBe(0);
    expect(
      client.calls.some((c) => /INSERT INTO planned_workouts/.test(c.sql))
    ).toBe(false);
    expect(
      client.calls.some((c) => /DELETE FROM exercise_entries/.test(c.sql))
    ).toBe(false);
  });

  it('throws if the delete count assertion for a phantom does not match', async () => {
    const phantom = phantomRow({ id: 'phantom-1', entry_date: '2026-09-20' });
    const client = makeFakeClient([
      [
        /FROM exercise_entries ee\s+WHERE ee\.user_id = \$1\s+AND ee\.exercise_preset_entry_id IS NULL/,
        [phantom],
      ],
      [/INSERT INTO planned_workouts/, [{ id: 'pw-1' }]],
      [/DELETE FROM exercise_entries WHERE id = \$1/, []], // rowCount 0, simulating a race
    ]);

    await expect(
      applyRepairs(client, USER_ID, '2026-09-16', {
        includePast: false,
        recomputeCalories: false,
      })
    ).rejects.toThrow(/Expected to delete exactly 1 phantom entry/);
  });
});
