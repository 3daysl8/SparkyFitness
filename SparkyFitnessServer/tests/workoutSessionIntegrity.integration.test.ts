/**
 * Workout session integrity — integration test.
 *
 * Proves against real Postgres what mocked unit tests cannot: a repeated
 * client_request_id yields exactly one session even when two saves race (the
 * partial unique index plus the post-conflict lookup), keys are scoped per
 * user, one session with many exercises stays one session, an empty session is
 * not reported as a workout, and deleting a session's last exercise removes the
 * emptied session. Assertions read database state, not service return shapes.
 *
 * Seeds and deletes only its own synthetic @example.test rows, and skips when
 * no database is reachable (mirrors exerciseEntryStats.integration.test.ts).
 */
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSystemClient, endPool } from '../db/poolManager.js';
import exerciseService from '../services/exerciseService.js';
import { getExerciseEntriesByDateV2 } from '../services/exerciseEntryHistoryService.js';

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

const USER_A = '00000000-0000-4000-c000-0000000000a1';
const USER_B = '00000000-0000-4000-c000-0000000000b1';
const USERS = [USER_A, USER_B];
const EX_1 = '00000000-0000-4000-c000-0000000000e1';
const EX_2 = '00000000-0000-4000-c000-0000000000e2';
const EX_3 = '00000000-0000-4000-c000-0000000000e3';
const EXERCISES = [EX_1, EX_2, EX_3];
const SHARED_KEY = '00000000-0000-4000-c000-00000000c0de';

type ServiceError = Error & { status?: number };

function sessionPayload(
  entryDate: string,
  exerciseIds: string[],
  extra: Record<string, unknown> = {}
) {
  return {
    name: 'Integrity Test Lower Body',
    entry_date: entryDate,
    source: 'sparky',
    exercises: exerciseIds.map((exerciseId, index) => ({
      exercise_id: exerciseId,
      sort_order: index,
      duration_minutes: 5,
      sets: [{ set_number: 1, reps: 5, weight: 50 }],
    })),
    ...extra,
  };
}

async function countRows(sql: string, params: unknown[]): Promise<number> {
  const sys = await getSystemClient();
  try {
    const result = await sys.query(sql, params);
    return Number(result.rows[0].count);
  } finally {
    sys.release();
  }
}

const sessionsFor = (userId: string, entryDate: string) =>
  countRows(
    'SELECT COUNT(*) FROM public.exercise_preset_entries WHERE user_id = $1 AND entry_date = $2',
    [userId, entryDate]
  );

const entriesFor = (userId: string, entryDate: string) =>
  countRows(
    'SELECT COUNT(*) FROM public.exercise_entries WHERE user_id = $1 AND entry_date = $2',
    [userId, entryDate]
  );

async function cleanup() {
  const sys = await getSystemClient();
  try {
    await sys.query(
      'DELETE FROM public.exercise_entries WHERE user_id = ANY($1::uuid[])',
      [USERS]
    );
    await sys.query(
      'DELETE FROM public.exercise_preset_entries WHERE user_id = ANY($1::uuid[])',
      [USERS]
    );
    await sys.query('DELETE FROM public.exercises WHERE id = ANY($1::uuid[])', [
      EXERCISES,
    ]);
    await sys.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [
      USERS,
    ]);
  } finally {
    sys.release();
  }
}

describe.runIf(RUN)('workout session integrity (real database)', () => {
  beforeAll(async () => {
    await cleanup();
    const sys = await getSystemClient();
    try {
      for (const userId of USERS) {
        await sys.query(
          'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true) ON CONFLICT (id) DO NOTHING',
          [userId, `session-integrity-${userId}@example.test`]
        );
      }
      for (const [id, name] of [
        [EX_1, 'Integrity Test Squat'],
        [EX_2, 'Integrity Test Lunge'],
        [EX_3, 'Integrity Test Leg Curl'],
      ] as const) {
        // shared_with_public: true — the "scopes client_request_id per user"
        // test logs these against USER_B too, whose RLS client otherwise
        // cannot see a custom exercise owned by USER_A.
        await sys.query(
          'INSERT INTO public.exercises (id, name, source, user_id, is_custom, shared_with_public) VALUES ($1, $2, $3, $4, true, true)',
          [id, name, 'test', USER_A]
        );
      }
    } finally {
      sys.release();
    }
  });

  afterAll(async () => {
    await cleanup();
    await endPool();
  });

  it('creates exactly one session when two saves with the same client_request_id race', async () => {
    const date = '2026-07-01';
    const payload = sessionPayload(date, [EX_1, EX_2], {
      client_request_id: SHARED_KEY,
    });

    const results = await Promise.allSettled([
      exerciseService.createGroupedWorkoutSession(USER_A, USER_A, payload),
      exerciseService.createGroupedWorkoutSession(USER_A, USER_A, payload),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await sessionsFor(USER_A, date)).toBe(1);
    expect(await entriesFor(USER_A, date)).toBe(2);
  });

  it('returns the original session on a sequential replay without adding exercises', async () => {
    const date = '2026-07-01';
    await exerciseService.createGroupedWorkoutSession(
      USER_A,
      USER_A,
      sessionPayload(date, [EX_1, EX_2], { client_request_id: SHARED_KEY })
    );
    expect(await sessionsFor(USER_A, date)).toBe(1);
    expect(await entriesFor(USER_A, date)).toBe(2);
  });

  it('rejects a replayed client_request_id carrying a different workout', async () => {
    const date = '2026-07-01';
    await expect(
      exerciseService.createGroupedWorkoutSession(
        USER_A,
        USER_A,
        sessionPayload(date, [EX_3], { client_request_id: SHARED_KEY })
      )
    ).rejects.toSatisfy((error: ServiceError) => error.status === 409);
    expect(await sessionsFor(USER_A, date)).toBe(1);
    expect(await entriesFor(USER_A, date)).toBe(2);
  });

  it('scopes client_request_id per user, so another user with the same key gets their own session', async () => {
    const date = '2026-07-01';
    await exerciseService.createGroupedWorkoutSession(
      USER_B,
      USER_B,
      sessionPayload(date, [EX_1, EX_2], { client_request_id: SHARED_KEY })
    );
    expect(await sessionsFor(USER_B, date)).toBe(1);
    expect(await sessionsFor(USER_A, date)).toBe(1);
  });

  it('still inserts separate sessions when no client_request_id is sent', async () => {
    const date = '2026-07-02';
    await exerciseService.createGroupedWorkoutSession(
      USER_A,
      USER_A,
      sessionPayload(date, [EX_1])
    );
    await exerciseService.createGroupedWorkoutSession(
      USER_A,
      USER_A,
      sessionPayload(date, [EX_1])
    );
    expect(await sessionsFor(USER_A, date)).toBe(2);
  });

  it('reports one session with many exercises as a single session', async () => {
    const date = '2026-07-03';
    await exerciseService.createGroupedWorkoutSession(
      USER_A,
      USER_A,
      sessionPayload(date, [EX_1, EX_2, EX_3])
    );

    const sessions = await getExerciseEntriesByDateV2(USER_A, date);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.type).toBe('preset');
    expect(
      sessions[0]!.type === 'preset' && sessions[0]!.exercises
    ).toHaveLength(3);
  });

  it('does not report an empty session as a workout', async () => {
    const date = '2026-07-04';
    const sys = await getSystemClient();
    try {
      await sys.query(
        'INSERT INTO public.exercise_preset_entries (user_id, name, entry_date, source) VALUES ($1, $2, $3, $4)',
        [USER_A, 'Integrity Test Empty Shell', date, 'manual']
      );
    } finally {
      sys.release();
    }
    expect(await getExerciseEntriesByDateV2(USER_A, date)).toEqual([]);
  });

  it('removes the emptied session when its last exercise is deleted, and keeps it while exercises remain', async () => {
    const date = '2026-07-05';
    await exerciseService.createGroupedWorkoutSession(
      USER_A,
      USER_A,
      sessionPayload(date, [EX_1, EX_2])
    );

    const sys = await getSystemClient();
    let entryIds: string[];
    try {
      const result = await sys.query(
        'SELECT id FROM public.exercise_entries WHERE user_id = $1 AND entry_date = $2 ORDER BY sort_order',
        [USER_A, date]
      );
      entryIds = result.rows.map((row: { id: string }) => row.id);
    } finally {
      sys.release();
    }
    expect(entryIds).toHaveLength(2);

    await exerciseService.deleteExerciseEntry(USER_A, entryIds[0]);
    expect(await sessionsFor(USER_A, date)).toBe(1);

    await exerciseService.deleteExerciseEntry(USER_A, entryIds[1]);
    expect(await sessionsFor(USER_A, date)).toBe(0);
    expect(await getExerciseEntriesByDateV2(USER_A, date)).toEqual([]);
  });
});
