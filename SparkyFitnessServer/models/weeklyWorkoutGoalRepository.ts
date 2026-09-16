import { getClient } from '../db/poolManager.js';

/** One child exercise entry's classification-relevant fields for weekly-goal rollup. */
export interface WeeklySessionExerciseRow {
  /** exercises.workout_type (joined via exercise_entries.exercise_id). */
  workout_type: string | null;
  /** exercises.modality — last-resort classification fallback only. */
  modality: string | null;
  /** exercise_entries.duration_minutes (numeric column; parsed to a JS number). */
  duration_minutes: number | null;
}

/** One completed workout session (exercise_preset_entries row) for weekly-goal rollup. */
export interface WeeklySessionRow {
  id: string;
  /** exercise_preset_entries.workout_type — the session's own explicit tag. */
  session_workout_type: string | null;
  /** workout_presets.workout_type, when the session was started from a preset. */
  preset_workout_type: string | null;
  exercises: WeeklySessionExerciseRow[];
}

// Mirrors NON_EMPTY_PRESET_SESSION in exerciseEntryHistoryService.ts (Phase 1's
// integrity fix): a session with no exercise entries AND no activity details is
// an empty shell and must not be counted. Duplicated here rather than imported
// since that constant is file-local there; keep both in sync if the definition
// of "empty session" ever changes.
const NON_EMPTY_PRESET_SESSION = `(
  EXISTS (SELECT 1 FROM exercise_entries ne WHERE ne.exercise_preset_entry_id = epe.id)
  OR EXISTS (SELECT 1 FROM exercise_entry_activity_details nad WHERE nad.exercise_preset_entry_id = epe.id)
)`;

/**
 * Fetches every real (non-empty) session in [weekStart, weekEnd] for a user,
 * with everything shared/src/workouts/weeklyGoal.ts's classifySession cascade
 * needs: the session's own workout_type tag, its preset's workout_type (if
 * started from one), and each child exercise's workout_type/modality/duration.
 *
 * "Session" here matches the established definition in
 * exerciseEntryHistoryService.ts's countExerciseEntrySessions/
 * getExerciseEntryHistorySessions (NON_EMPTY_PRESET_SESSION UNION ALL
 * standalone exercise_entries): a non-empty exercise_preset_entries row, OR a
 * plain exercise_entries row with no preset parent (exercise_preset_entry_id
 * IS NULL) -- the shape `log_exercise` writes for a bare, non-preset log.
 * Querying only exercise_preset_entries (an earlier version of this function)
 * silently excluded every standalone log_exercise entry from every leg of
 * weekly-goal counting, found live against a real dev-DB entry rather than by
 * the mocked-repository unit tests, which shared the same blind spot.
 *
 * A preset session with zero exercise_entries (but a real activity-detail
 * row, e.g. a raw provider sync with no structured entries) still appears,
 * with an empty `exercises` array — it can only classify via the session/
 * preset tag, and still counts toward completed_total either way
 * (computeWeeklyProgress's total is type-agnostic).
 */
async function getWeeklySessions(
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklySessionRow[]> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
         epe.id,
         epe.workout_type AS session_workout_type,
         wp.workout_type AS preset_workout_type,
         COALESCE(
           json_agg(
             json_build_object(
               'workout_type', e.workout_type,
               'modality', e.modality,
               'duration_minutes', ee.duration_minutes
             )
           ) FILTER (WHERE ee.id IS NOT NULL),
           '[]'::json
         ) AS exercises
       FROM exercise_preset_entries epe
       LEFT JOIN workout_presets wp ON wp.id = epe.workout_preset_id
       LEFT JOIN exercise_entries ee ON ee.exercise_preset_entry_id = epe.id
       LEFT JOIN exercises e ON e.id = ee.exercise_id
       WHERE epe.user_id = $1
         AND epe.entry_date BETWEEN $2 AND $3
         AND ${NON_EMPTY_PRESET_SESSION}
       GROUP BY epe.id, epe.workout_type, wp.workout_type

       UNION ALL

       SELECT
         standalone.id,
         NULL::text AS session_workout_type,
         NULL::text AS preset_workout_type,
         json_build_array(
           json_build_object(
             'workout_type', e.workout_type,
             'modality', e.modality,
             'duration_minutes', standalone.duration_minutes
           )
         ) AS exercises
       FROM exercise_entries standalone
       LEFT JOIN exercises e ON e.id = standalone.exercise_id
       WHERE standalone.user_id = $1
         AND standalone.entry_date BETWEEN $2 AND $3
         AND standalone.exercise_preset_entry_id IS NULL`,
      [userId, weekStart, weekEnd]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export { getWeeklySessions };
export default { getWeeklySessions };
