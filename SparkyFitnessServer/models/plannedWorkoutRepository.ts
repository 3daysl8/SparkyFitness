import format from 'pg-format';
import { getClient } from '../db/poolManager.js';
import type { PlannedWorkoutRow } from '../services/plannedWorkoutService.types.js';

const PLANNED_WORKOUT_COLS = `id, user_id, planned_date, planned_time,
  duration_estimate_minutes, title, workout_preset_id, exercise_id,
  workout_type, notes, status, started_at, completed_at,
  completed_session_id, origin, template_id, assignment_id,
  generated_for_date, slot, user_modified, dismissed_at, created_at,
  updated_at`;

// Missed rows only ever look this far back — an older unaddressed plan stops
// being "missed" and just quietly stays planned/started in history.
const MISSED_LOOKBACK_DAYS = 7;

export interface PlannedWorkoutCreateInput {
  planned_date: string;
  planned_time?: string | null;
  duration_estimate_minutes?: number | null;
  title: string;
  workout_preset_id?: number | null;
  exercise_id?: string | null;
  workout_type?: string | null;
  notes?: string | null;
}

export interface PlannedWorkoutPatchInput {
  planned_date?: string;
  planned_time?: string | null;
  duration_estimate_minutes?: number | null;
  title?: string;
  workout_preset_id?: number | null;
  exercise_id?: string | null;
  workout_type?: string | null;
  notes?: string | null;
}

/** One desired (template, date, slot) row, computed by the service from live assignments. */
export interface DesiredTemplateRow {
  templateId: number;
  generatedForDate: string;
  slot: number;
  assignmentId: number;
  title: string;
  workoutPresetId: number | null;
  exerciseId: string | null;
  workoutType: string | null;
}

async function listPlannedWorkouts(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<PlannedWorkoutRow[]> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${PLANNED_WORKOUT_COLS} FROM planned_workouts
       WHERE user_id = $1 AND dismissed_at IS NULL
         AND planned_date BETWEEN $2 AND $3
       ORDER BY planned_date ASC, planned_time ASC NULLS LAST, created_at ASC`,
      [userId, fromDate, toDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Everything a "for date" view needs: rows actually planned for `date`, plus
 * still-open (planned/started) rows from the preceding week that are now
 * "missed" — carried forward for a Move-to-today/Skip prompt rather than
 * silently dropped.
 */
async function getDayView(
  userId: string,
  date: string
): Promise<{ forDate: PlannedWorkoutRow[]; missed: PlannedWorkoutRow[] }> {
  const client = await getClient(userId);
  try {
    const [forDate, missed] = await Promise.all([
      client.query(
        `SELECT ${PLANNED_WORKOUT_COLS} FROM planned_workouts
         WHERE user_id = $1 AND dismissed_at IS NULL AND planned_date = $2
         ORDER BY planned_time ASC NULLS LAST, created_at ASC`,
        [userId, date]
      ),
      client.query(
        `SELECT ${PLANNED_WORKOUT_COLS} FROM planned_workouts
         WHERE user_id = $1 AND dismissed_at IS NULL
           AND status IN ('planned', 'started')
           AND planned_date < $2
           AND planned_date >= ($2::date - $3::int)
         ORDER BY planned_date ASC, planned_time ASC NULLS LAST`,
        [userId, date, MISSED_LOOKBACK_DAYS]
      ),
    ]);
    return { forDate: forDate.rows, missed: missed.rows };
  } finally {
    client.release();
  }
}

async function getPlannedWorkoutById(
  userId: string,
  id: string
): Promise<PlannedWorkoutRow | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${PLANNED_WORKOUT_COLS} FROM planned_workouts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function createPlannedWorkout(
  userId: string,
  data: PlannedWorkoutCreateInput,
  origin: 'manual' | 'coach' = 'manual'
): Promise<PlannedWorkoutRow> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO planned_workouts (
         user_id, planned_date, planned_time, duration_estimate_minutes,
         title, workout_preset_id, exercise_id, workout_type, notes, origin
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [
        userId,
        data.planned_date,
        data.planned_time ?? null,
        data.duration_estimate_minutes ?? null,
        data.title,
        data.workout_preset_id ?? null,
        data.exercise_id ?? null,
        data.workout_type ?? null,
        data.notes ?? null,
        origin,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Patches only the fields the caller sent (an omitted field keeps its stored
 * value — mirrors focusRepository.updateFocus's convention) and marks the
 * row user-modified, so template regeneration leaves it alone from here on.
 * Only touches rows still in 'planned' status; a started/completed/skipped
 * plan's schedule fields are frozen.
 */
async function updatePlannedWorkout(
  userId: string,
  id: string,
  data: PlannedWorkoutPatchInput
): Promise<PlannedWorkoutRow | null> {
  const client = await getClient(userId);
  try {
    const cols = Object.keys(data).filter((k) =>
      [
        'planned_date',
        'planned_time',
        'duration_estimate_minutes',
        'title',
        'workout_preset_id',
        'exercise_id',
        'workout_type',
        'notes',
      ].includes(k)
    ) as (keyof PlannedWorkoutPatchInput)[];
    if (cols.length === 0) {
      return getPlannedWorkoutById(userId, id);
    }
    const assignments = cols.map((col, i) => `${col} = $${i + 3}`);
    const values = cols.map((col) => data[col] ?? null);
    const result = await client.query(
      `UPDATE planned_workouts SET ${[...assignments, 'user_modified = true'].join(', ')}
       WHERE id = $1 AND user_id = $2 AND status = 'planned'
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [id, userId, ...values]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function startPlannedWorkout(
  userId: string,
  id: string
): Promise<PlannedWorkoutRow | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE planned_workouts
       SET status = 'started', started_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'planned'
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

/**
 * Undoes start: only a currently-started row reverts to planned, with
 * started_at cleared. Lets a coaching-tool caller (or a future frontend
 * affordance) back out of a start() that shouldn't have happened, instead of
 * leaving the row stranded in 'started' with no way back — see Phase 4's
 * MCP start/revert pairing.
 */
async function revertPlannedWorkout(
  userId: string,
  id: string
): Promise<PlannedWorkoutRow | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE planned_workouts
       SET status = 'planned', started_at = NULL
       WHERE id = $1 AND user_id = $2 AND status = 'started'
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function skipPlannedWorkout(
  userId: string,
  id: string
): Promise<PlannedWorkoutRow | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE planned_workouts
       SET status = 'skipped'
       WHERE id = $1 AND user_id = $2 AND status IN ('planned', 'started')
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export type CompletionOutcome =
  | { outcome: 'completed'; row: PlannedWorkoutRow }
  | { outcome: 'not_found' }
  | { outcome: 'future' }
  | { outcome: 'already_linked' }
  | { outcome: 'session_not_found' };

/**
 * Links an already-existing session to a plan (the standalone REST/MCP
 * "complete" action — distinct from exercisePresetEntryRepository's
 * linkPlannedWorkoutWithClient, which completes a plan as part of creating a
 * brand-new session in the same transaction). Refuses a future planned_date
 * and never overwrites an existing link.
 */
async function completePlannedWorkoutWithSession(
  userId: string,
  id: string,
  sessionId: string,
  today: string
): Promise<CompletionOutcome> {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const plan = await client.query(
      `SELECT id, planned_date, completed_session_id FROM planned_workouts
       WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId]
    );
    if (plan.rows.length === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'not_found' };
    }
    if (plan.rows[0].completed_session_id) {
      await client.query('ROLLBACK');
      return { outcome: 'already_linked' };
    }
    if (plan.rows[0].planned_date > today) {
      await client.query('ROLLBACK');
      return { outcome: 'future' };
    }
    const session = await client.query(
      'SELECT id FROM exercise_preset_entries WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (session.rows.length === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'session_not_found' };
    }
    const result = await client.query(
      `UPDATE planned_workouts
       SET status = 'completed', completed_at = NOW(), completed_session_id = $3
       WHERE id = $1 AND user_id = $2
       RETURNING ${PLANNED_WORKOUT_COLS}`,
      [id, userId, sessionId]
    );
    await client.query('COMMIT');
    return { outcome: 'completed', row: result.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type DeleteOutcome =
  | { outcome: 'deleted' }
  | { outcome: 'dismissed'; row: PlannedWorkoutRow }
  | { outcome: 'not_found' }
  | { outcome: 'refused'; reason: string };

/**
 * Deletion is reserved for planned/skipped rows with no linked session — a
 * started or completed plan is history, not deletable. A template-generated
 * row is soft-dismissed (dismissed_at) instead of hard-deleted, so
 * regeneration never resurrects it; manual/coach rows are removed outright.
 */
async function deletePlannedWorkout(
  userId: string,
  id: string
): Promise<DeleteOutcome> {
  const client = await getClient(userId);
  try {
    const existing = await client.query(
      `SELECT status, origin, completed_session_id FROM planned_workouts
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existing.rows.length === 0) {
      return { outcome: 'not_found' };
    }
    const row = existing.rows[0];
    if (row.completed_session_id || row.status === 'completed') {
      return {
        outcome: 'refused',
        reason: 'A completed plan cannot be deleted.',
      };
    }
    if (row.status === 'started') {
      return {
        outcome: 'refused',
        reason:
          'An in-progress plan cannot be deleted; skip or finish it first.',
      };
    }
    if (row.origin === 'template') {
      const result = await client.query(
        `UPDATE planned_workouts SET dismissed_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING ${PLANNED_WORKOUT_COLS}`,
        [id, userId]
      );
      return { outcome: 'dismissed', row: result.rows[0] };
    }
    await client.query(
      'DELETE FROM planned_workouts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return { outcome: 'deleted' };
  } finally {
    client.release();
  }
}

/**
 * Refreshes a template's generated rows for the given window in one
 * transaction: upserts every desired (date, slot) row — a conflict on the
 * partial (template_id, generated_for_date, slot) index only overwrites a
 * still-planned, unmodified, undismissed existing row, per the DO UPDATE...
 * WHERE guard — then deletes any existing template row in the window whose
 * (date, slot) is no longer desired (its assignment was removed or the
 * window shrank), subject to the identical safety guard so a completed,
 * started, user-modified, or already-dismissed row is never touched either
 * way.
 */
async function syncTemplateGeneratedRows(
  userId: string,
  templateId: number,
  windowStart: string,
  windowEnd: string,
  desired: DesiredTemplateRow[]
): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    if (desired.length > 0) {
      const values = desired.map((d) => [
        userId,
        d.generatedForDate,
        d.slot,
        d.title,
        d.workoutPresetId,
        d.exerciseId,
        d.workoutType,
        'template',
        d.templateId,
        d.assignmentId,
        d.generatedForDate,
      ]);
      const upsertQuery = format(
        `INSERT INTO planned_workouts (
             user_id, planned_date, slot, title, workout_preset_id,
             exercise_id, workout_type, origin, template_id, assignment_id,
             generated_for_date
           ) VALUES %L
           ON CONFLICT (template_id, generated_for_date, slot) WHERE origin = 'template'
           DO UPDATE SET
             title = EXCLUDED.title,
             workout_preset_id = EXCLUDED.workout_preset_id,
             exercise_id = EXCLUDED.exercise_id,
             workout_type = EXCLUDED.workout_type,
             assignment_id = EXCLUDED.assignment_id,
             planned_date = EXCLUDED.planned_date
           WHERE planned_workouts.status = 'planned'
             AND planned_workouts.user_modified = false
             AND planned_workouts.dismissed_at IS NULL`,
        values
      );
      await client.query(upsertQuery);
    }
    // slot is only unique per generated_for_date (each day-of-week's
    // assignments are independently 0-indexed — see the slot-assignment
    // comment in plannedWorkoutService.ts), so a stale row must be identified
    // by the (date, slot) *pair*, not by slot alone; comparing slot alone
    // would treat every day's "slot 0" as the same desired slot and wrongly
    // spare a different day's stale row.
    const desiredDates = desired.map((d) => d.generatedForDate);
    const desiredSlots = desired.map((d) => d.slot);
    await client.query(
      `DELETE FROM planned_workouts pw
       WHERE pw.user_id = $1 AND pw.template_id = $2 AND pw.origin = 'template'
         AND pw.generated_for_date BETWEEN $3 AND $4
         AND pw.status = 'planned' AND pw.user_modified = false AND pw.dismissed_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM unnest($5::date[], $6::smallint[]) AS desired_row(gen_date, slot)
           WHERE desired_row.gen_date = pw.generated_for_date AND desired_row.slot = pw.slot
         )`,
      [userId, templateId, windowStart, windowEnd, desiredDates, desiredSlots]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * On template deletion: dismiss/delete its still-safe-to-touch generated
 * rows from `fromDate` on, matching the safety guard everywhere else. A
 * completed/started/user-modified row is left as history — the FK's ON
 * DELETE SET NULL (not exercised here; the template row itself is deleted by
 * the caller afterward) nulls its template_id automatically.
 */
async function deletePlannedWorkoutsByTemplateId(
  userId: string,
  templateId: number,
  fromDate: string
): Promise<number> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `DELETE FROM planned_workouts
       WHERE user_id = $1 AND template_id = $2 AND origin = 'template'
         AND generated_for_date >= $3
         AND status = 'planned' AND user_modified = false AND dismissed_at IS NULL`,
      [userId, templateId, fromDate]
    );
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

export default {
  listPlannedWorkouts,
  getDayView,
  getPlannedWorkoutById,
  createPlannedWorkout,
  updatePlannedWorkout,
  startPlannedWorkout,
  revertPlannedWorkout,
  skipPlannedWorkout,
  completePlannedWorkoutWithSession,
  deletePlannedWorkout,
  syncTemplateGeneratedRows,
  deletePlannedWorkoutsByTemplateId,
};
