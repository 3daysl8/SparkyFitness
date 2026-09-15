import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
const PRESET_ENTRY_SELECT = `
  SELECT id, user_id, workout_preset_id, name, description, entry_date, created_at,
         updated_at, created_by_user_id, notes, source
  FROM exercise_preset_entries
`;

async function getExercisePresetEntryByIdWithClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any
) {
  const result = await client.query(
    `${PRESET_ENTRY_SELECT}
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}
async function createExercisePresetEntryWithClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entryData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdByUserId: any
) {
  const result = await client.query(
    `INSERT INTO exercise_preset_entries (user_id, workout_preset_id, name, description, entry_date, created_by_user_id, notes, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      userId,
      entryData.workout_preset_id ?? null,
      entryData.name,
      entryData.description ?? null,
      entryData.entry_date,
      createdByUserId,
      entryData.notes ?? null,
      entryData.source ?? 'manual',
    ]
  );
  return getExercisePresetEntryByIdWithClient(
    client,
    result.rows[0].id,
    userId
  );
}

/**
 * Inserts a session header keyed by the client's idempotency id. A repeated
 * key returns the row the first request created (`created: false`) together
 * with the fingerprint stored with it, so the caller can reject a key reused
 * for a different payload.
 */
async function insertExercisePresetEntryIdempotentWithClient(
  client: PoolClient,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entryData: any,
  createdByUserId: string
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry: any;
  created: boolean;
  storedFingerprint: string | null;
}> {
  const inserted = await client.query(
    `INSERT INTO exercise_preset_entries (user_id, workout_preset_id, name, description, entry_date, created_by_user_id, notes, source, client_request_id, client_request_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      userId,
      entryData.workout_preset_id ?? null,
      entryData.name,
      entryData.description ?? null,
      entryData.entry_date,
      createdByUserId,
      entryData.notes ?? null,
      entryData.source ?? 'manual',
      entryData.client_request_id,
      entryData.client_request_fingerprint,
    ]
  );
  if (inserted.rows.length > 0) {
    return {
      entry: await getExercisePresetEntryByIdWithClient(
        client,
        inserted.rows[0].id,
        userId
      ),
      created: true,
      storedFingerprint: entryData.client_request_fingerprint,
    };
  }
  const existing = await client.query(
    `SELECT id, client_request_fingerprint FROM exercise_preset_entries
     WHERE user_id = $1 AND client_request_id = $2`,
    [userId, entryData.client_request_id]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(
      new Error(
        'Another save with this client_request_id conflicted and its workout could not be loaded.'
      ),
      { status: 409 }
    );
  }
  return {
    entry: await getExercisePresetEntryByIdWithClient(
      client,
      existing.rows[0].id,
      userId
    ),
    created: false,
    storedFingerprint: existing.rows[0].client_request_fingerprint ?? null,
  };
}

async function createExercisePresetEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entryData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdByUserId: any
) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const entry = await createExercisePresetEntryWithClient(
      client,
      userId,
      entryData,
      createdByUserId
    );
    await client.query('COMMIT');
    return entry;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', 'Error creating exercise preset entry:', error);
    throw error;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExercisePresetEntryById(id: any, userId: any) {
  const client = await getClient(userId);
  try {
    return getExercisePresetEntryByIdWithClient(client, id, userId);
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExercisePresetEntriesByDate(userId: any, entryDate: any) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `${PRESET_ENTRY_SELECT}
       WHERE user_id = $1 AND entry_date = $2
       ORDER BY created_at ASC`,
      [userId, entryDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
async function updateExercisePresetEntryWithClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateData: any
) {
  const existingEntry = await getExercisePresetEntryByIdWithClient(
    client,
    id,
    userId
  );
  if (!existingEntry) {
    return null;
  }
  const mergedEntry = {
    workout_preset_id:
      updateData.workout_preset_id !== undefined
        ? updateData.workout_preset_id
        : existingEntry.workout_preset_id,
    name: updateData.name !== undefined ? updateData.name : existingEntry.name,
    description:
      updateData.description !== undefined
        ? updateData.description
        : existingEntry.description,
    entry_date:
      updateData.entry_date !== undefined
        ? updateData.entry_date
        : existingEntry.entry_date,
    notes:
      updateData.notes !== undefined ? updateData.notes : existingEntry.notes,
    source:
      updateData.source !== undefined
        ? updateData.source
        : existingEntry.source,
  };
  const result = await client.query(
    `UPDATE exercise_preset_entries SET
       workout_preset_id = $1,
       name = $2,
       description = $3,
       entry_date = $4,
       notes = $5,
       source = $6,
       updated_at = now()
     WHERE id = $7 AND user_id = $8
     RETURNING id`,
    [
      mergedEntry.workout_preset_id,
      mergedEntry.name,
      mergedEntry.description,
      mergedEntry.entry_date,
      mergedEntry.notes,
      mergedEntry.source,
      id,
      userId,
    ]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return getExercisePresetEntryByIdWithClient(client, id, userId);
}

async function updateExercisePresetEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateData: any
) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const updatedEntry = await updateExercisePresetEntryWithClient(
      client,
      id,
      userId,
      updateData
    );
    await client.query('COMMIT');
    return updatedEntry;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error updating exercise preset entry ${id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteExercisePresetEntry(id: any, userId: any) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM exercise_preset_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error deleting exercise preset entry ${id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}
/**
 * Deletes a session header only when nothing still hangs off it: no exercise
 * entries and no session-level activity details. Returns whether it was
 * deleted.
 */
async function deleteSessionIfEmptyWithClient(
  client: PoolClient,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const result = await client.query(
    `DELETE FROM exercise_preset_entries epe
     WHERE epe.id = $1 AND epe.user_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM exercise_entries ee WHERE ee.exercise_preset_entry_id = epe.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM exercise_entry_activity_details ad WHERE ad.exercise_preset_entry_id = epe.id
       )
     RETURNING id`,
    [sessionId, userId]
  );
  return result.rows.length > 0;
}
/**
 * Marks a planned workout completed by the session just created, in the
 * caller's transaction. Scoped by user_id so a cross-user id can't link (the
 * WHERE clause is the ownership check); the `completed_session_id IS NULL`
 * guard means an already-linked plan is left alone rather than overwritten.
 * Returns `linked: false` with a reason instead of throwing — the session
 * itself must still save either way.
 */
async function linkPlannedWorkoutWithClient(
  client: PoolClient,
  userId: string,
  plannedWorkoutId: string,
  sessionId: string
): Promise<{ linked: boolean; warning?: string }> {
  const result = await client.query(
    `UPDATE planned_workouts
     SET status = 'completed', completed_at = NOW(), completed_session_id = $3
     WHERE id = $1 AND user_id = $2 AND completed_session_id IS NULL
     RETURNING id`,
    [plannedWorkoutId, userId, sessionId]
  );
  if (result.rows.length > 0) {
    return { linked: true };
  }
  const existing = await client.query(
    'SELECT id FROM planned_workouts WHERE id = $1 AND user_id = $2',
    [plannedWorkoutId, userId]
  );
  return {
    linked: false,
    warning:
      existing.rows.length === 0
        ? 'Planned workout not found; session saved without linking it.'
        : 'Planned workout was already completed by another session; this session was saved without linking it.',
  };
}

async function deleteExercisePresetEntriesByEntrySourceAndDateWithClient(
  client: PoolClient,
  userId: string,
  startDate: string,
  endDate: string,
  entrySource: string
) {
  // Get IDs of exercise preset entries to be deleted
  const presetEntryIdsResult = await client.query(
    `SELECT id FROM exercise_preset_entries
     WHERE user_id = $1
       AND entry_date BETWEEN $2 AND $3
       AND source = $4`,
    [userId, startDate, endDate, entrySource]
  );
  const presetEntryIds = presetEntryIdsResult.rows.map(
    (row: { id: string }) => row.id
  );
  if (presetEntryIds.length > 0) {
    // Delete associated activity details (if any, though currently full_activity_data is linked to exercise_entry)
    // This assumes exercise_entry_activity_details might eventually link to exercise_preset_entries directly.
    // For now, we'll just delete the preset entries.
    // If activity details are linked to preset entries, a similar deletion logic would be needed here.
    // Delete the exercise preset entries themselves
    const result = await client.query(
      'DELETE FROM exercise_preset_entries WHERE id = ANY($1::uuid[])',
      [presetEntryIds]
    );
    log(
      'info',
      `[exercisePresetEntryRepository] Deleted ${result.rowCount} exercise preset entries with source '${entrySource}' for user ${userId} from ${startDate} to ${endDate}.`
    );
    return result.rowCount;
  }
  log(
    'info',
    `[exercisePresetEntryRepository] No exercise preset entries with source '${entrySource}' found for user ${userId} from ${startDate} to ${endDate}.`
  );
  return 0;
}

async function deleteExercisePresetEntriesByEntrySourceAndDate(
  userId: string,
  startDate: string,
  endDate: string,
  entrySource: string
) {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const deletedCount =
      await deleteExercisePresetEntriesByEntrySourceAndDateWithClient(
        client,
        userId,
        startDate,
        endDate,
        entrySource
      );
    await client.query('COMMIT');
    return deletedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    log(
      'error',
      `Error deleting exercise preset entries by source and date: ${error instanceof Error ? error.message : String(error)}`,
      { userId, startDate, endDate, entrySource, error }
    );
    throw error;
  } finally {
    client.release();
  }
}
export { createExercisePresetEntry };
export { createExercisePresetEntryWithClient };
export { insertExercisePresetEntryIdempotentWithClient };
export { deleteSessionIfEmptyWithClient };
export { linkPlannedWorkoutWithClient };
export { getExercisePresetEntryById };
export { getExercisePresetEntryByIdWithClient };
export { getExercisePresetEntriesByDate };
export { updateExercisePresetEntry };
export { updateExercisePresetEntryWithClient };
export { deleteExercisePresetEntry };
export { deleteExercisePresetEntriesByEntrySourceAndDate };
export { deleteExercisePresetEntriesByEntrySourceAndDateWithClient };
export default {
  createExercisePresetEntry,
  createExercisePresetEntryWithClient,
  insertExercisePresetEntryIdempotentWithClient,
  deleteSessionIfEmptyWithClient,
  linkPlannedWorkoutWithClient,
  getExercisePresetEntryById,
  getExercisePresetEntryByIdWithClient,
  getExercisePresetEntriesByDate,
  updateExercisePresetEntry,
  updateExercisePresetEntryWithClient,
  deleteExercisePresetEntry,
  deleteExercisePresetEntriesByEntrySourceAndDate,
  deleteExercisePresetEntriesByEntrySourceAndDateWithClient,
};
