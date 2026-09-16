/**
 * Weekly workout goal progress — integration test.
 *
 * Proves against real Postgres what mocked unit tests share the same blind
 * spot on: `weeklyWorkoutGoalRepository.getWeeklySessions` must count BOTH a
 * non-empty `exercise_preset_entries` session AND a standalone
 * `exercise_entries` row with no preset parent (`exercise_preset_entry_id
 * IS NULL` — the shape a bare `log_exercise` MCP call or manual single-
 * exercise log writes). An earlier version of this repository queried only
 * `exercise_preset_entries` and silently excluded every standalone entry
 * from every leg of weekly-goal counting; a mocked-repository unit test
 * cannot catch this because the mock already assumes the (wrong) query
 * shape. Found live against the real dev database while verifying Phase 5.
 *
 * Also proves the `any_strength` vs `explicit_only` counting-mode
 * distinction end to end: an untagged cardio-modality exercise is inferred
 * as cardio under the default `any_strength` policy but not under
 * `explicit_only`, while an explicitly-tagged strength exercise counts under
 * both (the tag cascade, not the modality guess, is what finds it).
 *
 * Seeds and deletes only its own synthetic @example.test rows, and skips
 * when no database is reachable (mirrors workoutSessionIntegrity.integration.test.ts).
 */
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSystemClient, endPool } from '../db/poolManager.js';
import weeklyWorkoutGoalService from '../services/weeklyWorkoutGoalService.js';

async function dbReachable(): Promise<boolean> {
  if (process.env.SKIP_RLS_MATRIX === '1') return false;
  if (
    !process.env.SPARKY_FITNESS_APP_DB_USER ||
    !process.env.SPARKY_FITNESS_DB_HOST
  ) {
    return false;
  }
  const probe = new pg.Client({
    host: process.env.SPARKY_FITNESS_DB_HOST,
    port: Number(process.env.SPARKY_FITNESS_DB_PORT) || 5432,
    database: process.env.SPARKY_FITNESS_DB_NAME,
    user: process.env.SPARKY_FITNESS_APP_DB_USER,
    password: process.env.SPARKY_FITNESS_APP_DB_PASSWORD,
    connectionTimeoutMillis: 2000,
  });
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

const RUN = await dbReachable();

const USER_A = '00000000-0000-4000-c000-0000000000f1';
const EX_STRENGTH = '00000000-0000-4000-c000-0000000000f2';
const EX_CARDIO_UNTAGGED = '00000000-0000-4000-c000-0000000000f3';
const STANDALONE_ENTRY_ID = '00000000-0000-4000-c000-0000000000f4';
const PRESET_SESSION_ID = '00000000-0000-4000-c000-0000000000f5';
const PRESET_SESSION_CHILD_ID = '00000000-0000-4000-c000-0000000000f6';

// 2026-07-06 is a Monday; with the default first_day_of_week (0/Sunday) the
// containing week is 2026-07-05..2026-07-11 -- fixed dates keep this test
// independent of whatever "today" happens to be.
const ENTRY_DATE = '2026-07-06';

async function cleanup() {
  const sys = await getSystemClient();
  try {
    await sys.query('DELETE FROM public.exercise_entries WHERE user_id = $1', [
      USER_A,
    ]);
    await sys.query(
      'DELETE FROM public.exercise_preset_entries WHERE user_id = $1',
      [USER_A]
    );
    await sys.query('DELETE FROM public.exercises WHERE id = ANY($1::uuid[])', [
      [EX_STRENGTH, EX_CARDIO_UNTAGGED],
    ]);
    await sys.query('DELETE FROM public.user_preferences WHERE user_id = $1', [
      USER_A,
    ]);
    await sys.query('DELETE FROM public."user" WHERE id = $1', [USER_A]);
  } finally {
    sys.release();
  }
}

describe.runIf(RUN)('weekly workout goal progress (real database)', () => {
  beforeAll(async () => {
    await cleanup();
    const sys = await getSystemClient();
    try {
      await sys.query(
        'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
        [USER_A, `weekly-goal-${USER_A}@example.test`]
      );
      await sys.query(
        `INSERT INTO public.exercises (id, name, source, user_id, is_custom, shared_with_public, workout_type, modality)
         VALUES ($1, $2, 'test', $3, true, true, 'strength', 'weight_reps')`,
        [EX_STRENGTH, 'Weekly Goal Test Squat', USER_A]
      );
      await sys.query(
        `INSERT INTO public.exercises (id, name, source, user_id, is_custom, shared_with_public, workout_type, modality)
         VALUES ($1, $2, 'test', $3, true, true, NULL, 'duration_distance')`,
        [EX_CARDIO_UNTAGGED, 'Weekly Goal Test Row Erg', USER_A]
      );

      // Standalone entry: no exercise_preset_entries parent -- the shape a
      // bare log_exercise call writes. Explicitly tagged strength, so it
      // should count as strength under either counting mode.
      await sys.query(
        `INSERT INTO public.exercise_entries
           (id, user_id, exercise_id, entry_date, duration_minutes, calories_burned, source, exercise_preset_entry_id)
         VALUES ($1, $2, $3, $4, 12, 50, 'test', NULL)`,
        [STANDALONE_ENTRY_ID, USER_A, EX_STRENGTH, ENTRY_DATE]
      );

      // Preset-linked session with an untagged cardio-modality child at
      // exactly the default 20-minute cardio floor -- boundary case for
      // ">= cardio_min_minutes".
      await sys.query(
        `INSERT INTO public.exercise_preset_entries (id, user_id, entry_date, name, workout_type, workout_preset_id)
         VALUES ($1, $2, $3, $4, NULL, NULL)`,
        [PRESET_SESSION_ID, USER_A, ENTRY_DATE, 'Weekly Goal Test Session']
      );
      await sys.query(
        `INSERT INTO public.exercise_entries
           (id, user_id, exercise_id, entry_date, duration_minutes, calories_burned, source, exercise_preset_entry_id)
         VALUES ($1, $2, $3, $4, 20, 150, 'test', $5)`,
        [
          PRESET_SESSION_CHILD_ID,
          USER_A,
          EX_CARDIO_UNTAGGED,
          ENTRY_DATE,
          PRESET_SESSION_ID,
        ]
      );
    } finally {
      sys.release();
    }
  });

  afterAll(async () => {
    await cleanup();
    await endPool();
  });

  it('counts both a standalone log_exercise entry and a preset session, with no weekly-goal preferences set (any_strength default)', async () => {
    const progress =
      await weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress(
        USER_A,
        ENTRY_DATE
      );

    expect(progress.week_start).toBe('2026-07-05');
    expect(progress.week_end).toBe('2026-07-11');
    expect(progress.strength_counting).toBe('any_strength');
    expect(progress.cardio_min_minutes).toBe(20);
    // The bug this test guards: completed_total must include the standalone
    // entry, not just the preset session.
    expect(progress.completed_total).toBe(2);
    expect(progress.completed_strength).toBe(1);
    // Untagged duration_distance exercise inferred as cardio via the
    // any_strength default's modality fallback, and its 20-minute duration
    // exactly meets the default cardio_min_minutes floor.
    expect(progress.completed_cardio).toBe(1);
  });

  it('suppresses the modality-inferred cardio session under explicit_only, but keeps the explicitly-tagged strength one', async () => {
    const sys = await getSystemClient();
    try {
      await sys.query(
        `INSERT INTO public.user_preferences (user_id, weekly_strength_counting)
         VALUES ($1, 'explicit_only')`,
        [USER_A]
      );
    } finally {
      sys.release();
    }

    const progress =
      await weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress(
        USER_A,
        ENTRY_DATE
      );

    expect(progress.strength_counting).toBe('explicit_only');
    // Total is type-agnostic -- unaffected by counting mode.
    expect(progress.completed_total).toBe(2);
    // Found via the exercise-tag cascade tier, not the modality guess --
    // still counts under explicit_only.
    expect(progress.completed_strength).toBe(1);
    // Only reachable via the modality-fallback tier, which explicit_only
    // skips -- no longer counted.
    expect(progress.completed_cardio).toBe(0);
  });
});
