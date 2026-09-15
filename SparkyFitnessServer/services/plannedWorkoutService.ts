import { getClient } from '../db/poolManager.js';
import plannedWorkoutRepository, {
  type DesiredTemplateRow,
  type PlannedWorkoutCreateInput,
  type PlannedWorkoutPatchInput,
} from '../models/plannedWorkoutRepository.js';
import { log } from '../config/logging.js';
import {
  addDays,
  compareDays,
  daysBetween,
  dayOfWeek,
} from '@workspace/shared';
import type { PlannedWorkoutRow } from './plannedWorkoutService.types.js';

// A template edit eagerly regenerates this many days (today inclusive); a
// caller asking for a further-out date (e.g. Workouts > History paging, or
// the future MCP list_planned) extends the horizon lazily, capped here.
const EAGER_WINDOW_DAYS = 28;
const MAX_HORIZON_DAYS = 90;

function createServiceError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

/** Whether the given plan row is unaddressed past its own date. Derived on every read, never stored. */
function isMissed(row: PlannedWorkoutRow, today: string): boolean {
  return (
    (row.status === 'planned' || row.status === 'started') &&
    compareDays(row.planned_date, today) < 0
  );
}

async function listPlannedWorkouts(
  userId: string,
  fromDate: string,
  toDate: string,
  today: string
) {
  await ensureUserTemplatesSyncedThrough(userId, toDate, today);
  const rows = await plannedWorkoutRepository.listPlannedWorkouts(
    userId,
    fromDate,
    toDate
  );
  return rows.map((row) => ({ ...row, is_missed: isMissed(row, today) }));
}

async function getDayView(userId: string, date: string, today: string) {
  await ensureUserTemplatesSyncedThrough(userId, date, today);
  const { forDate, missed } = await plannedWorkoutRepository.getDayView(
    userId,
    date
  );
  return {
    for_date: forDate.map((row) => ({ ...row, is_missed: false })),
    missed: missed.map((row) => ({ ...row, is_missed: true })),
  };
}

async function getPlannedWorkoutById(
  userId: string,
  id: string,
  today: string
) {
  const row = await plannedWorkoutRepository.getPlannedWorkoutById(userId, id);
  if (!row) {
    throw createServiceError(404, 'Planned workout not found.');
  }
  return { ...row, is_missed: isMissed(row, today) };
}

async function createPlannedWorkout(
  userId: string,
  data: PlannedWorkoutCreateInput,
  today: string
) {
  const row = await plannedWorkoutRepository.createPlannedWorkout(
    userId,
    data,
    'manual'
  );
  return { ...row, is_missed: isMissed(row, today) };
}

async function updatePlannedWorkout(
  userId: string,
  id: string,
  patch: PlannedWorkoutPatchInput,
  today: string
) {
  const row = await plannedWorkoutRepository.updatePlannedWorkout(
    userId,
    id,
    patch
  );
  if (!row) {
    const existing = await plannedWorkoutRepository.getPlannedWorkoutById(
      userId,
      id
    );
    if (!existing) {
      throw createServiceError(404, 'Planned workout not found.');
    }
    throw createServiceError(
      409,
      `Cannot edit a plan that is already ${existing.status}.`
    );
  }
  return { ...row, is_missed: isMissed(row, today) };
}

async function movePlannedWorkout(
  userId: string,
  id: string,
  plannedDate: string,
  plannedTime: string | null | undefined,
  today: string
) {
  return updatePlannedWorkout(
    userId,
    id,
    { planned_date: plannedDate, planned_time: plannedTime },
    today
  );
}

async function startPlannedWorkout(userId: string, id: string, today: string) {
  const row = await plannedWorkoutRepository.startPlannedWorkout(userId, id);
  if (!row) {
    const existing = await plannedWorkoutRepository.getPlannedWorkoutById(
      userId,
      id
    );
    if (!existing) {
      throw createServiceError(404, 'Planned workout not found.');
    }
    throw createServiceError(
      409,
      `Cannot start a plan that is already ${existing.status}.`
    );
  }
  return { ...row, is_missed: isMissed(row, today) };
}

async function skipPlannedWorkout(userId: string, id: string, today: string) {
  const row = await plannedWorkoutRepository.skipPlannedWorkout(userId, id);
  if (!row) {
    const existing = await plannedWorkoutRepository.getPlannedWorkoutById(
      userId,
      id
    );
    if (!existing) {
      throw createServiceError(404, 'Planned workout not found.');
    }
    throw createServiceError(
      409,
      `Cannot skip a plan that is already ${existing.status}.`
    );
  }
  return { ...row, is_missed: isMissed(row, today) };
}

async function completePlannedWorkout(
  userId: string,
  id: string,
  sessionId: string,
  today: string
) {
  const result =
    await plannedWorkoutRepository.completePlannedWorkoutWithSession(
      userId,
      id,
      sessionId,
      today
    );
  switch (result.outcome) {
    case 'completed':
      return { ...result.row, is_missed: false };
    case 'not_found':
      throw createServiceError(404, 'Planned workout not found.');
    case 'future':
      throw createServiceError(
        400,
        'Cannot complete a plan dated in the future.'
      );
    case 'already_linked':
      throw createServiceError(
        409,
        'This plan was already completed by another session.'
      );
    case 'session_not_found':
      throw createServiceError(
        404,
        'Session not found, or it does not belong to you.'
      );
  }
}

async function deletePlannedWorkout(userId: string, id: string) {
  const result = await plannedWorkoutRepository.deletePlannedWorkout(
    userId,
    id
  );
  switch (result.outcome) {
    case 'deleted':
      return { message: 'Planned workout deleted.' };
    case 'dismissed':
      return { message: 'Planned workout dismissed.' };
    case 'not_found':
      throw createServiceError(404, 'Planned workout not found.');
    case 'refused':
      throw createServiceError(409, result.reason);
  }
}

// --- Template sync (replaces the old phantom-materialization path) --------

interface TemplateAssignmentRow {
  id: number;
  day_of_week: number;
  sort_order: number;
  workout_preset_id: number | null;
  exercise_id: string | null;
}

/**
 * Refreshes one template's generated planned_workouts rows for a rolling
 * window starting today (clipped to the template's own start/end_date).
 * Only ever touches rows still 'planned', unmodified, and undismissed — see
 * plannedWorkoutRepository.syncTemplateGeneratedRows. A deactivated template
 * has its still-safe future rows removed outright instead of regenerated.
 */
async function syncTemplatePlannedWorkouts(
  userId: string,
  templateId: number,
  today: string,
  horizonDays: number = EAGER_WINDOW_DAYS
): Promise<void> {
  const client = await getClient(userId);
  let template: {
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  } | null;
  let assignments: TemplateAssignmentRow[];
  try {
    const templateResult = await client.query(
      `SELECT is_active, start_date, end_date FROM workout_plan_templates
       WHERE id = $1 AND user_id = $2`,
      [templateId, userId]
    );
    template = templateResult.rows[0] ?? null;
    if (!template) {
      log(
        'info',
        `syncTemplatePlannedWorkouts: template ${templateId} not found for user ${userId}; nothing to sync.`
      );
      return;
    }
    if (!template.is_active) {
      const removed =
        await plannedWorkoutRepository.deletePlannedWorkoutsByTemplateId(
          userId,
          templateId,
          today
        );
      log(
        'info',
        `syncTemplatePlannedWorkouts: template ${templateId} inactive; removed ${removed} future generated rows.`
      );
      return;
    }
    const assignmentsResult = await client.query(
      `SELECT id, day_of_week, sort_order, workout_preset_id, exercise_id
       FROM workout_plan_template_assignments
       WHERE template_id = $1
       ORDER BY day_of_week ASC, sort_order ASC, id ASC`,
      [templateId]
    );
    assignments = assignmentsResult.rows;
  } finally {
    client.release();
  }

  const clampedHorizon = Math.min(horizonDays, MAX_HORIZON_DAYS);
  const windowStart =
    compareDays(template.start_date ?? today, today) > 0
      ? (template.start_date as string)
      : today;
  let windowEnd = addDays(today, clampedHorizon - 1);
  if (template.end_date && compareDays(template.end_date, windowEnd) < 0) {
    windowEnd = template.end_date;
  }
  if (compareDays(windowStart, windowEnd) > 0) {
    // The template's own date range doesn't reach the sync window at all
    // (e.g. it ended before today) — nothing to generate; existing rows
    // outside the (now-empty) desired set are still cleaned up below.
    await plannedWorkoutRepository.syncTemplateGeneratedRows(
      userId,
      templateId,
      today,
      addDays(today, clampedHorizon - 1),
      []
    );
    return;
  }

  // Stable slot = position within that day_of_week's own assignment list
  // (by sort_order, then id) — NOT the assignment's own id, which is
  // replaced wholesale on every template edit (see workoutPlanTemplateRepository
  // .updateWorkoutPlanTemplate) and so cannot anchor regeneration identity.
  const slotByAssignmentId = new Map<number, number>();
  const assignmentsByDay = new Map<number, TemplateAssignmentRow[]>();
  for (const a of assignments) {
    const list = assignmentsByDay.get(a.day_of_week) ?? [];
    list.push(a);
    assignmentsByDay.set(a.day_of_week, list);
  }
  for (const [, list] of assignmentsByDay) {
    list.forEach((a, index) => slotByAssignmentId.set(a.id, index));
  }

  const metaByAssignmentId = await loadAssignmentMeta(userId, assignments);

  const desired: DesiredTemplateRow[] = [];
  let cursor = windowStart;
  while (compareDays(cursor, windowEnd) <= 0) {
    const dow = dayOfWeek(cursor);
    for (const a of assignmentsByDay.get(dow) ?? []) {
      const meta = metaByAssignmentId.get(a.id)!;
      desired.push({
        templateId,
        generatedForDate: cursor,
        slot: slotByAssignmentId.get(a.id)!,
        assignmentId: a.id,
        title: meta.title,
        workoutPresetId: a.workout_preset_id,
        exerciseId: a.exercise_id,
        workoutType: meta.workoutType,
      });
    }
    cursor = addDays(cursor, 1);
  }

  await plannedWorkoutRepository.syncTemplateGeneratedRows(
    userId,
    templateId,
    windowStart,
    windowEnd,
    desired
  );
  log(
    'info',
    `syncTemplatePlannedWorkouts: template ${templateId} for user ${userId} synced ${desired.length} rows over ${windowStart}..${windowEnd}.`
  );
}

/** Resolves each assignment's preset/exercise name (used as the generated row's title) and workout_type in as few queries as possible. */
async function loadAssignmentMeta(
  userId: string,
  assignments: TemplateAssignmentRow[]
): Promise<Map<number, { title: string; workoutType: string | null }>> {
  const client = await getClient(userId);
  try {
    const presetIds = [
      ...new Set(
        assignments
          .map((a) => a.workout_preset_id)
          .filter((id): id is number => id !== null)
      ),
    ];
    const exerciseIds = [
      ...new Set(
        assignments
          .map((a) => a.exercise_id)
          .filter((id): id is string => id !== null)
      ),
    ];
    interface NamedTypedRow {
      id: number | string;
      name: string;
      workout_type: string | null;
    }
    let presetRows: NamedTypedRow[] = [];
    let exerciseRows: NamedTypedRow[] = [];
    if (presetIds.length > 0) {
      const result = await client.query(
        'SELECT id, name, workout_type FROM workout_presets WHERE id = ANY($1::int[])',
        [presetIds]
      );
      presetRows = result.rows;
    }
    if (exerciseIds.length > 0) {
      const result = await client.query(
        'SELECT id, name, workout_type FROM exercises WHERE id = ANY($1::uuid[])',
        [exerciseIds]
      );
      exerciseRows = result.rows;
    }
    const presetById = new Map(presetRows.map((r) => [r.id as number, r]));
    const exerciseById = new Map(exerciseRows.map((r) => [r.id as string, r]));
    const meta = new Map<
      number,
      { title: string; workoutType: string | null }
    >();
    for (const a of assignments) {
      if (a.workout_preset_id !== null) {
        const preset = presetById.get(a.workout_preset_id);
        meta.set(a.id, {
          title: preset?.name ?? 'Workout',
          workoutType: preset?.workout_type ?? null,
        });
      } else if (a.exercise_id !== null) {
        const exercise = exerciseById.get(a.exercise_id);
        meta.set(a.id, {
          title: exercise?.name ?? 'Workout',
          workoutType: exercise?.workout_type ?? null,
        });
      } else {
        meta.set(a.id, { title: 'Workout', workoutType: null });
      }
    }
    return meta;
  } finally {
    client.release();
  }
}

async function getActiveTemplateIds(userId: string): Promise<number[]> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'SELECT id FROM workout_plan_templates WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return result.rows.map((r: { id: number }) => r.id);
  } finally {
    client.release();
  }
}

/**
 * Lazily extends generation for every active template so a read (list/day
 * view) covering a date beyond what's already been generated still finds
 * rows there, without eagerly generating the full 90-day ceiling on every
 * template edit.
 */
async function ensureUserTemplatesSyncedThrough(
  userId: string,
  throughDate: string,
  today: string
): Promise<void> {
  if (compareDays(throughDate, today) <= 0) {
    // Nothing in the past needs generating.
    return;
  }
  const horizonDays = Math.min(
    MAX_HORIZON_DAYS,
    // +1: the window is inclusive of both today and throughDate.
    daysBetween(today, throughDate) + 1
  );
  const templateIds = await getActiveTemplateIds(userId);
  for (const templateId of templateIds) {
    await syncTemplatePlannedWorkouts(userId, templateId, today, horizonDays);
  }
}

export {
  listPlannedWorkouts,
  getDayView,
  getPlannedWorkoutById,
  createPlannedWorkout,
  updatePlannedWorkout,
  movePlannedWorkout,
  startPlannedWorkout,
  skipPlannedWorkout,
  completePlannedWorkout,
  deletePlannedWorkout,
  syncTemplatePlannedWorkouts,
  ensureUserTemplatesSyncedThrough,
};
export default {
  listPlannedWorkouts,
  getDayView,
  getPlannedWorkoutById,
  createPlannedWorkout,
  updatePlannedWorkout,
  movePlannedWorkout,
  startPlannedWorkout,
  skipPlannedWorkout,
  completePlannedWorkout,
  deletePlannedWorkout,
  syncTemplatePlannedWorkouts,
  ensureUserTemplatesSyncedThrough,
};
