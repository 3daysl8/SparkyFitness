// Phase 6 of the workout-mapping fix: data-repair for the known-bad rows left
// behind by the pre-Phase-2 phantom-materializer and pre-Phase-1 stale-calorie
// bug. See C:\Users\ICPET\.claude\plans\help-me-plan-splendid-sphinx.md's
// "Phase 6" section for the full design. This module holds only pure,
// unit-testable query/decision logic against an injected `client` (a real
// `pg` client or a test double) -- no CLI parsing, no file I/O, no process.env.
// The thin runner (`run.ts`) owns argv, transactions, and the JSON backup file.
//
// Every read here is scoped by `user_id = $1` in SQL even when the caller
// already used an RLS-scoped `getClient(userId)` connection -- explicit
// filters are cheap defense in depth for a script that can delete real rows.

export interface PhantomCandidateRow {
  id: string;
  entry_date: string;
  exercise_id: string;
  exercise_name: string | null;
  duration_minutes: number;
  calories_burned: number;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  workout_plan_assignment_id: number;
  active_set_count: number;
  activity_detail_count: number;
  lap_count: number;
  gps_count: number;
  hr_zone_count: number;
  planned_workout_overlap_count: number;
}

export type PhantomBucket = 'future' | 'past_or_today';

export interface PhantomEvaluation {
  row: PhantomCandidateRow;
  bucket: PhantomBucket;
  qualifies: boolean;
  reasons: string[];
  /** True only when this row would actually be touched by --apply given the flags passed. */
  eligibleForApply: boolean;
}

/**
 * The plan's "strict phantom rule": every check must hold for a row to be
 * auto-repairable; if any fails, the row is reported only, never mutated.
 * `userId` is the target user (already the sole owner of every row the query
 * fetched, but re-checked here since "created by the user" is a real rule
 * clause, not just a filter).
 */
export function evaluateStrictPhantomRule(
  row: PhantomCandidateRow,
  userId: string
): { qualifies: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (row.created_by_user_id !== userId) {
    reasons.push(
      `created_by_user_id (${row.created_by_user_id ?? 'null'}) is not the target user`
    );
  }
  const createdMs = Date.parse(row.created_at);
  const updatedMs = Date.parse(row.updated_at);
  if (updatedMs - createdMs >= 5000) {
    reasons.push(
      `updated_at is ${((updatedMs - createdMs) / 1000).toFixed(1)}s after created_at (must be < 5s)`
    );
  }
  if (row.updated_by_user_id !== null && row.updated_by_user_id !== userId) {
    reasons.push(
      `updated_by_user_id (${row.updated_by_user_id}) is neither null nor the target user`
    );
  }
  if (row.notes !== null && row.notes.trim() !== '') {
    reasons.push('notes is non-empty');
  }
  if (row.source_id !== null) {
    reasons.push(
      `source_id is set ('${row.source_id}') -- cannot auto-confirm this wasn't cross-linked to an external source (verify manually: this codebase also copies an exercise's own catalog source_id onto entries at creation time, which is a false positive for this check, not necessarily a real external sync)`
    );
  }
  if (row.active_set_count > 0) {
    reasons.push(
      `has ${row.active_set_count} set(s) carrying completed_at/rpe/is_pr -- shows real activity`
    );
  }
  if (row.activity_detail_count > 0) {
    reasons.push(`has ${row.activity_detail_count} activity-detail row(s)`);
  }
  if (row.lap_count > 0) reasons.push(`has ${row.lap_count} lap row(s)`);
  if (row.gps_count > 0) reasons.push(`has ${row.gps_count} GPS row(s)`);
  if (row.hr_zone_count > 0)
    reasons.push(`has ${row.hr_zone_count} HR-zone row(s)`);
  if (row.planned_workout_overlap_count > 0) {
    reasons.push(
      'a planned_workouts row already exists for this exercise/date -- converting would create a duplicate'
    );
  }

  return { qualifies: reasons.length === 0, reasons };
}

export function evaluatePhantomCandidate(
  row: PhantomCandidateRow,
  userId: string,
  today: string,
  includePast: boolean
): PhantomEvaluation {
  const { qualifies, reasons } = evaluateStrictPhantomRule(row, userId);
  const bucket: PhantomBucket =
    row.entry_date > today ? 'future' : 'past_or_today';
  const eligibleForApply = qualifies && (bucket === 'future' || includePast);
  return { row, bucket, qualifies, reasons, eligibleForApply };
}

const PHANTOM_CANDIDATES_SQL = `
  SELECT
    ee.id,
    ee.entry_date::text,
    ee.exercise_id,
    ee.exercise_name,
    ee.duration_minutes,
    ee.calories_burned,
    ee.notes,
    ee.source,
    ee.source_id,
    ee.created_by_user_id,
    ee.updated_by_user_id,
    ee.created_at,
    ee.updated_at,
    ee.workout_plan_assignment_id,
    (SELECT count(*) FROM exercise_entry_sets s
       WHERE s.exercise_entry_id = ee.id
         AND (s.completed_at IS NOT NULL OR s.rpe IS NOT NULL OR s.is_pr))::int
      AS active_set_count,
    (SELECT count(*) FROM exercise_entry_activity_details ad
       WHERE ad.exercise_entry_id = ee.id)::int AS activity_detail_count,
    (SELECT count(*) FROM exercise_entry_laps l
       WHERE l.exercise_entry_id = ee.id)::int AS lap_count,
    (SELECT count(*) FROM exercise_entry_gps_points g
       WHERE g.exercise_entry_id = ee.id)::int AS gps_count,
    (SELECT count(*) FROM exercise_entry_hr_zones h
       WHERE h.exercise_entry_id = ee.id)::int AS hr_zone_count,
    (SELECT count(*) FROM planned_workouts pw
       WHERE pw.user_id = ee.user_id
         AND pw.exercise_id = ee.exercise_id
         AND pw.planned_date = ee.entry_date)::int AS planned_workout_overlap_count
  FROM exercise_entries ee
  WHERE ee.user_id = $1
    AND ee.exercise_preset_entry_id IS NULL
    AND ee.workout_plan_assignment_id IS NOT NULL
  ORDER BY ee.entry_date ASC
`;

export interface EmptySessionRow {
  id: string;
  entry_date: string;
  name: string;
  created_at: string;
  linked_from_planned_workouts: number;
}

const EMPTY_SESSIONS_SQL = `
  SELECT
    epe.id,
    epe.entry_date::text,
    epe.name,
    epe.created_at,
    (SELECT count(*) FROM planned_workouts pw
       WHERE pw.completed_session_id = epe.id)::int AS linked_from_planned_workouts
  FROM exercise_preset_entries epe
  WHERE epe.user_id = $1
    AND NOT EXISTS (SELECT 1 FROM exercise_entries ee WHERE ee.exercise_preset_entry_id = epe.id)
    AND NOT EXISTS (SELECT 1 FROM exercise_entry_activity_details ad WHERE ad.exercise_preset_entry_id = epe.id)
  ORDER BY epe.entry_date ASC
`;

export interface StaleCalorieRow {
  id: string;
  entry_date: string;
  exercise_name: string | null;
  duration_minutes: number;
  calories_burned: number;
  calories_source: string | null;
  calories_per_hour: number;
  recomputed_calories: number;
}

// Only NULL (pre-dates the calories_source column) or 'derived' rows are
// candidates -- 'manual'/'device' values are the user's or a device's real
// number and must never be overwritten by a recompute.
const STALE_CALORIES_SQL = `
  SELECT
    ee.id,
    ee.entry_date::text,
    ee.exercise_name,
    ee.duration_minutes,
    ee.calories_burned,
    ee.calories_source,
    e.calories_per_hour,
    ROUND((e.calories_per_hour / 60.0 * ee.duration_minutes)::numeric, 2) AS recomputed_calories
  FROM exercise_entries ee
  JOIN exercises e ON e.id = ee.exercise_id
  WHERE ee.user_id = $1
    AND ee.calories_source IS DISTINCT FROM 'manual'
    AND ee.calories_source IS DISTINCT FROM 'device'
    AND e.calories_per_hour IS NOT NULL
    AND e.calories_per_hour > 0
    AND ABS(ee.calories_burned - (e.calories_per_hour / 60.0 * ee.duration_minutes))
        > GREATEST(20, ee.calories_burned * 0.5)
  ORDER BY ee.entry_date ASC
`;

export interface ImplausibleDurationRow {
  id: string;
  entry_date: string;
  exercise_name: string | null;
  duration_minutes: number;
  calories_burned: number;
}

const IMPLAUSIBLE_DURATIONS_SQL = `
  SELECT ee.id, ee.entry_date::text, ee.exercise_name, ee.duration_minutes, ee.calories_burned
  FROM exercise_entries ee
  WHERE ee.user_id = $1 AND ee.duration_minutes > 0 AND ee.duration_minutes < 1.5
  ORDER BY ee.entry_date ASC
`;

export interface UntypedExerciseRow {
  id: string;
  name: string;
  category: string | null;
  modality: string | null;
  recent_uses: number;
}

const UNTYPED_EXERCISES_SQL = `
  SELECT e.id, e.name, e.category, e.modality, count(ee.id)::int AS recent_uses
  FROM exercises e
  JOIN exercise_entries ee ON ee.exercise_id = e.id
  WHERE ee.user_id = $1
    AND e.workout_type IS NULL
    AND ee.entry_date >= (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY e.id, e.name, e.category, e.modality
  ORDER BY recent_uses DESC
`;

export interface IntegrityReport {
  user_id: string;
  today: string;
  include_past: boolean;
  phantom_candidates: PhantomEvaluation[];
  empty_sessions: EmptySessionRow[];
  stale_calories: StaleCalorieRow[];
  implausible_durations: ImplausibleDurationRow[];
  untyped_exercises: UntypedExerciseRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryableClient = { query: (sql: string, params?: any[]) => Promise<any> };

export async function buildIntegrityReport(
  client: QueryableClient,
  userId: string,
  today: string,
  includePast: boolean
): Promise<IntegrityReport> {
  const [phantomRes, emptyRes, staleRes, durationRes, untypedRes] =
    await Promise.all([
      client.query(PHANTOM_CANDIDATES_SQL, [userId]),
      client.query(EMPTY_SESSIONS_SQL, [userId]),
      client.query(STALE_CALORIES_SQL, [userId]),
      client.query(IMPLAUSIBLE_DURATIONS_SQL, [userId]),
      client.query(UNTYPED_EXERCISES_SQL, [userId]),
    ]);

  const phantom_candidates = (phantomRes.rows as PhantomCandidateRow[]).map(
    (row) => evaluatePhantomCandidate(row, userId, today, includePast)
  );

  return {
    user_id: userId,
    today,
    include_past: includePast,
    phantom_candidates,
    empty_sessions: emptyRes.rows,
    stale_calories: staleRes.rows,
    implausible_durations: durationRes.rows,
    untyped_exercises: untypedRes.rows,
  };
}

export interface BackupEntry {
  table: 'exercise_entries' | 'exercise_preset_entries' | 'planned_workouts';
  operation: 'delete' | 'update' | 'insert';
  before: unknown;
  after: unknown | null;
}

export interface ApplySummary {
  phantomsConverted: number;
  emptySessionsDeleted: number;
  caloriesRecomputed: number;
  backup: BackupEntry[];
}

/**
 * Applies the repair. Must run inside a real (non-read-only) transaction the
 * caller controls (BEGIN before, COMMIT/ROLLBACK after) -- this function does
 * not manage transaction boundaries itself so the runner can write the JSON
 * backup file from `summary.backup` before committing, per the plan's "backup
 * before any apply" requirement.
 *
 * Re-evaluates every candidate against fresh data inside the same
 * transaction rather than trusting a previously-built report object, closing
 * the TOCTOU gap between a dry-run and a later --apply invocation.
 */
export async function applyRepairs(
  client: QueryableClient,
  userId: string,
  today: string,
  options: { includePast: boolean; recomputeCalories: boolean }
): Promise<ApplySummary> {
  const backup: BackupEntry[] = [];
  let phantomsConverted = 0;
  let emptySessionsDeleted = 0;
  let caloriesRecomputed = 0;

  const phantomRes = await client.query(PHANTOM_CANDIDATES_SQL, [userId]);
  for (const row of phantomRes.rows as PhantomCandidateRow[]) {
    const evaluation = evaluatePhantomCandidate(
      row,
      userId,
      today,
      options.includePast
    );
    if (!evaluation.eligibleForApply) continue;

    const status = evaluation.bucket === 'future' ? 'planned' : 'skipped';
    const insertRes = await client.query(
      `INSERT INTO planned_workouts
         (user_id, planned_date, title, exercise_id, duration_estimate_minutes,
          status, origin, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7)
       RETURNING *`,
      [
        userId,
        row.entry_date,
        row.exercise_name ?? 'Workout',
        row.exercise_id,
        Math.round(row.duration_minutes),
        status,
        `Converted from legacy phantom exercise_entries row ${row.id} by repairWorkoutIntegrity (Phase 6).`,
      ]
    );
    const deleteRes = await client.query(
      'DELETE FROM exercise_entries WHERE id = $1 AND user_id = $2 RETURNING *',
      [row.id, userId]
    );
    if (deleteRes.rowCount !== 1) {
      throw new Error(
        `Expected to delete exactly 1 phantom entry ${row.id}, deleted ${deleteRes.rowCount}`
      );
    }
    backup.push({
      table: 'exercise_entries',
      operation: 'delete',
      before: deleteRes.rows[0],
      after: null,
    });
    backup.push({
      table: 'planned_workouts',
      operation: 'insert',
      before: null,
      after: insertRes.rows[0],
    });
    phantomsConverted++;
  }

  const emptyRes = await client.query(EMPTY_SESSIONS_SQL, [userId]);
  for (const row of emptyRes.rows as EmptySessionRow[]) {
    const deleteRes = await client.query(
      'DELETE FROM exercise_preset_entries WHERE id = $1 AND user_id = $2 RETURNING *',
      [row.id, userId]
    );
    if (deleteRes.rowCount !== 1) {
      throw new Error(
        `Expected to delete exactly 1 empty session ${row.id}, deleted ${deleteRes.rowCount}`
      );
    }
    backup.push({
      table: 'exercise_preset_entries',
      operation: 'delete',
      before: deleteRes.rows[0],
      after: null,
    });
    emptySessionsDeleted++;
  }

  if (options.recomputeCalories) {
    const staleRes = await client.query(STALE_CALORIES_SQL, [userId]);
    for (const row of staleRes.rows as StaleCalorieRow[]) {
      const beforeRes = await client.query(
        'SELECT * FROM exercise_entries WHERE id = $1 AND user_id = $2',
        [row.id, userId]
      );
      if (beforeRes.rowCount !== 1) {
        throw new Error(
          `Stale-calorie candidate ${row.id} vanished mid-transaction`
        );
      }
      const updateRes = await client.query(
        `UPDATE exercise_entries
           SET calories_burned = $1, calories_source = 'derived', updated_at = now()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [row.recomputed_calories, row.id, userId]
      );
      if (updateRes.rowCount !== 1) {
        throw new Error(
          `Expected to update exactly 1 stale-calorie entry ${row.id}, updated ${updateRes.rowCount}`
        );
      }
      backup.push({
        table: 'exercise_entries',
        operation: 'update',
        before: beforeRes.rows[0],
        after: updateRes.rows[0],
      });
      caloriesRecomputed++;
    }
  }

  return {
    phantomsConverted,
    emptySessionsDeleted,
    caloriesRecomputed,
    backup,
  };
}
