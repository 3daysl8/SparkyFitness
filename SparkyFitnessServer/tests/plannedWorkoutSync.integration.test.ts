/**
 * Planned workout template sync — integration test.
 *
 * Proves against real Postgres the core promise that replaces the old
 * phantom-materialization bug: regenerating a template's planned workouts
 * only ever touches rows still 'planned', unmodified, and undismissed. A
 * completed, started, user-edited, or dismissed row survives a resync
 * completely untouched, even when the assignment that originally generated
 * it is edited or removed. Assertions read database state, not service
 * return shapes.
 *
 * Seeds and deletes only its own synthetic @example.test rows, and skips
 * when no database is reachable (mirrors workoutSessionIntegrity.integration.test.ts).
 */
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSystemClient, endPool } from '../db/poolManager.js';
import plannedWorkoutService from '../services/plannedWorkoutService.js';

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

const USER_A = '00000000-0000-4000-c000-0000000000d1';
const EX_1 = '00000000-0000-4000-c000-0000000000d2';
const EX_2 = '00000000-0000-4000-c000-0000000000d3';

// 2026-07-06 is a Monday; assignments below target Monday (1) and
// Wednesday (3) so the window math is easy to reason about by hand.
const TODAY = '2026-07-06';

interface PlannedWorkoutTestRow {
  id: string;
  planned_date: string;
  slot: number | null;
  status: string;
  origin: string;
  user_modified: boolean;
  dismissed_at: string | null;
  title: string;
  exercise_id: string | null;
  completed_session_id: string | null;
}

async function rowsForTemplate(
  templateId: number
): Promise<PlannedWorkoutTestRow[]> {
  const sys = await getSystemClient();
  try {
    const result = await sys.query(
      `SELECT id, planned_date::text, slot, status, origin, user_modified,
              dismissed_at, title, exercise_id, completed_session_id
       FROM public.planned_workouts
       WHERE user_id = $1 AND template_id = $2
       ORDER BY planned_date, slot`,
      [USER_A, templateId]
    );
    return result.rows;
  } finally {
    sys.release();
  }
}

async function cleanup(templateIds: number[]) {
  const sys = await getSystemClient();
  try {
    await sys.query('DELETE FROM public.planned_workouts WHERE user_id = $1', [
      USER_A,
    ]);
    if (templateIds.length > 0) {
      await sys.query(
        'DELETE FROM public.workout_plan_template_assignments WHERE template_id = ANY($1::int[])',
        [templateIds]
      );
      await sys.query(
        'DELETE FROM public.workout_plan_templates WHERE id = ANY($1::int[])',
        [templateIds]
      );
    }
    await sys.query('DELETE FROM public.exercises WHERE id = ANY($1::uuid[])', [
      [EX_1, EX_2],
    ]);
    await sys.query('DELETE FROM public."user" WHERE id = $1', [USER_A]);
  } finally {
    sys.release();
  }
}

async function createTemplate(
  assignments: {
    dayOfWeek: number;
    exerciseId: string;
  }[]
): Promise<number> {
  const sys = await getSystemClient();
  try {
    const templateResult = await sys.query(
      `INSERT INTO public.workout_plan_templates (user_id, plan_name, is_active)
       VALUES ($1, 'Integrity Sync Test Plan', true) RETURNING id`,
      [USER_A]
    );
    const templateId = templateResult.rows[0].id;
    for (const a of assignments) {
      await sys.query(
        `INSERT INTO public.workout_plan_template_assignments
           (template_id, day_of_week, exercise_id, sort_order)
         VALUES ($1, $2, $3, 0)`,
        [templateId, a.dayOfWeek, a.exerciseId]
      );
    }
    return templateId;
  } finally {
    sys.release();
  }
}

async function setAssignments(
  templateId: number,
  assignments: { dayOfWeek: number; exerciseId: string }[]
) {
  const sys = await getSystemClient();
  try {
    await sys.query(
      'DELETE FROM public.workout_plan_template_assignments WHERE template_id = $1',
      [templateId]
    );
    for (const a of assignments) {
      await sys.query(
        `INSERT INTO public.workout_plan_template_assignments
           (template_id, day_of_week, exercise_id, sort_order)
         VALUES ($1, $2, $3, 0)`,
        [templateId, a.dayOfWeek, a.exerciseId]
      );
    }
  } finally {
    sys.release();
  }
}

describe.runIf(RUN)('planned workout template sync (real database)', () => {
  const createdTemplateIds: number[] = [];

  beforeAll(async () => {
    await cleanup([]);
    const sys = await getSystemClient();
    try {
      await sys.query(
        'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true) ON CONFLICT (id) DO NOTHING',
        [USER_A, 'planned-workout-sync@example.test']
      );
      for (const [id, name] of [
        [EX_1, 'Sync Test Squat'],
        [EX_2, 'Sync Test Row'],
      ] as const) {
        await sys.query(
          'INSERT INTO public.exercises (id, name, source, user_id, is_custom) VALUES ($1, $2, $3, $4, true)',
          [id, name, 'test', USER_A]
        );
      }
    } finally {
      sys.release();
    }
  });

  afterAll(async () => {
    await cleanup(createdTemplateIds);
    await endPool();
  });

  it('generates one row per matching assignment across the eager window', async () => {
    const templateId = await createTemplate([
      { dayOfWeek: 1, exerciseId: EX_1 },
    ]);
    createdTemplateIds.push(templateId);

    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );

    const rows = await rowsForTemplate(templateId);
    // 28-day eager window starting Monday 2026-07-06: Mondays land on
    // 07-06, 07-13, 07-20, 07-27 -> 4 rows.
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.status === 'planned')).toBe(true);
    expect(rows.every((r) => r.origin === 'template')).toBe(true);
    expect(rows.every((r) => r.title === 'Sync Test Squat')).toBe(true);
    expect(rows.map((r) => r.planned_date)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
  });

  it('refreshes a still-planned row but never touches a completed, started, user-modified, or dismissed one', async () => {
    const templateId = await createTemplate([
      { dayOfWeek: 1, exerciseId: EX_1 },
    ]);
    createdTemplateIds.push(templateId);
    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );
    const initial = await rowsForTemplate(templateId);
    expect(initial).toHaveLength(4);

    const sys = await getSystemClient();
    try {
      // Simulate real history on three of the four generated rows before the
      // next sync: one completed (fake-linked to a session id — FK doesn't
      // matter for this assertion since we're not exercising the trigger
      // here), one started, one user-edited (title changed, user_modified
      // set), leaving the fourth (07-27) genuinely untouched.
      await sys.query(
        `UPDATE public.planned_workouts SET status = 'started', started_at = NOW()
         WHERE id = $1`,
        [initial[1]!.id] // 07-13
      );
      await sys.query(
        `UPDATE public.planned_workouts SET title = 'My Own Title', user_modified = true
         WHERE id = $1`,
        [initial[2]!.id] // 07-20
      );
      await sys.query(
        `UPDATE public.planned_workouts SET dismissed_at = NOW()
         WHERE id = $1`,
        [initial[3]!.id] // 07-27
      );
    } finally {
      sys.release();
    }

    // Now change the assignment's exercise — a genuinely different
    // template, which should refresh the still-safe row's title only.
    await setAssignments(templateId, [{ dayOfWeek: 1, exerciseId: EX_2 }]);
    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );

    const after = await rowsForTemplate(templateId);
    expect(after).toHaveLength(4);
    const byDate = new Map(after.map((r) => [r.planned_date, r]));

    // Untouched (still planned, no history): refreshed to the new exercise.
    expect(byDate.get('2026-07-06')!.title).toBe('Sync Test Row');
    expect(byDate.get('2026-07-06')!.exercise_id).toBe(EX_2);

    // Started: left completely alone (still the old exercise/title).
    expect(byDate.get('2026-07-13')!.status).toBe('started');
    expect(byDate.get('2026-07-13')!.title).toBe('Sync Test Squat');
    expect(byDate.get('2026-07-13')!.exercise_id).toBe(EX_1);

    // User-modified: left alone.
    expect(byDate.get('2026-07-20')!.user_modified).toBe(true);
    expect(byDate.get('2026-07-20')!.title).toBe('My Own Title');

    // Dismissed: left alone (still dismissed, still the old exercise).
    expect(byDate.get('2026-07-27')!.dismissed_at).not.toBeNull();
    expect(byDate.get('2026-07-27')!.exercise_id).toBe(EX_1);
  });

  it('removes a still-planned row whose assignment was deleted, but keeps a completed one', async () => {
    const templateId = await createTemplate([
      { dayOfWeek: 1, exerciseId: EX_1 },
      { dayOfWeek: 3, exerciseId: EX_2 },
    ]);
    createdTemplateIds.push(templateId);
    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );
    const initial = await rowsForTemplate(templateId);
    // Mondays (4) + Wednesdays (07-08, 07-15, 07-22, 07-29 = 4) = 8 rows.
    expect(initial).toHaveLength(8);

    const wednesdayRow = initial.find((r) => r.planned_date === '2026-07-08')!;
    const sys = await getSystemClient();
    try {
      await sys.query(
        `UPDATE public.planned_workouts SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [wednesdayRow.id]
      );
    } finally {
      sys.release();
    }

    // Remove the Wednesday assignment entirely.
    await setAssignments(templateId, [{ dayOfWeek: 1, exerciseId: EX_1 }]);
    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );

    const after = await rowsForTemplate(templateId);
    // 4 Monday rows remain, plus the one completed Wednesday row that must
    // survive even though its assignment is gone.
    expect(after).toHaveLength(5);
    const completedSurvivor = after.find((r) => r.id === wednesdayRow.id);
    expect(completedSurvivor).toBeDefined();
    expect(completedSurvivor!.status).toBe('completed');
    // Every other Wednesday (still-planned, its assignment now gone) was
    // removed — the 5 that remain are the 4 Mondays plus this one survivor.
    expect(after.filter((r) => r.planned_date === '2026-07-08')).toHaveLength(
      1
    );
  });

  it('removes future planned rows but keeps history when the template is deactivated', async () => {
    const templateId = await createTemplate([
      { dayOfWeek: 1, exerciseId: EX_1 },
    ]);
    createdTemplateIds.push(templateId);
    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );
    const initial = await rowsForTemplate(templateId);
    expect(initial).toHaveLength(4);

    const sys = await getSystemClient();
    try {
      await sys.query(
        "UPDATE public.planned_workouts SET status = 'skipped' WHERE id = $1",
        [initial[0]!.id]
      );
      await sys.query(
        'UPDATE public.workout_plan_templates SET is_active = false WHERE id = $1',
        [templateId]
      );
    } finally {
      sys.release();
    }

    await plannedWorkoutService.syncTemplatePlannedWorkouts(
      USER_A,
      templateId,
      TODAY
    );

    const after = await rowsForTemplate(templateId);
    // Only the skipped row (history) survives; the 3 still-planned ones were
    // removed since the template is no longer active.
    expect(after).toHaveLength(1);
    expect(after[0]!.status).toBe('skipped');
  });
});
