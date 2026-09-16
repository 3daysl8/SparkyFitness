import { tool } from 'ai';
import { addDays, daysBetween, todayInZone } from '@workspace/shared';
import { log } from '../../config/logging.js';
import plannedWorkoutService from '../../services/plannedWorkoutService.js';
import weeklyWorkoutGoalService from '../../services/weeklyWorkoutGoalService.js';
import workoutPresetRepository from '../../models/workoutPresetRepository.js';
import type { PlannedWorkoutPatchInput } from '../../models/plannedWorkoutRepository.js';
import type { PlannedWorkoutRow } from '../../services/plannedWorkoutService.types.js';
import { findExerciseByExactName } from './exerciseTools.js';
import { ERRORS, toolError } from './errors.js';
import { formatConfirmation, formatList, formatRecord } from './formatting.js';
import {
  managePlannedWorkoutsSchema,
  managePlannedWorkoutsInput,
  PLANNED_WORKOUT_ACTIONS,
  type ManagePlannedWorkoutsInput,
} from './schemas/plannedWorkouts.js';
import { normalizeActionArgs } from './dates.js';

const VALID_ACTIONS = [...PLANNED_WORKOUT_ACTIONS];

// A list_planned call with no explicit end_date gets this many extra days
// (a 2-week window, start_date inclusive); the hard cap below stops a wide
// explicit range from returning an unbounded result.
const LIST_PLANNED_DEFAULT_SPAN_DAYS = 13;
const LIST_PLANNED_MAX_RANGE_DAYS = 62;

type PlannedWorkoutRowWithMissed = PlannedWorkoutRow & { is_missed: boolean };

function isSet<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function logMutation(
  userId: string,
  action: string,
  ids: Record<string, unknown>
) {
  const detail = Object.entries(ids)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  log(
    'info',
    `[Planned Workout Tool] tool=sparky_manage_planned_workouts action=${action} userId=${userId} ${detail}`
  );
}

// Service errors from plannedWorkoutService carry a numeric .status (404 not
// found, 409 conflicting state, 400 e.g. a future completion) with a message
// already worded safely for the end user — see createServiceError in
// plannedWorkoutService.ts. Mapped 1:1 rather than free-text matched, unlike
// the message-substring checks elsewhere in this file's sibling tools, since
// this is the first domain whose service layer throws typed HTTP-style
// errors for an MCP tool to consume.
function isStatusError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

function mapServiceError(error: Error & { status: number }): string {
  const code = STATUS_CODES[error.status] ?? 'VALIDATION';
  return toolError(code, error.message);
}

type ResolvedWorkoutTarget =
  | { ok: true; workout_preset_id: number | null; exercise_id: string | null }
  | { ok: false; error: string };

// Resolves at most one of a preset or an exercise from create/update args.
// Unlike workoutPlanTools' resolveAssignmentTarget (which requires exactly
// one), a planned workout may carry neither — a bare-title plan is valid.
async function resolveOptionalWorkoutTarget(
  userId: string,
  args: {
    workout_preset_id?: number;
    workout_preset_name?: string;
    exercise_id?: string;
    exercise_name?: string;
  }
): Promise<ResolvedWorkoutTarget> {
  const hasPreset = isSet(args.workout_preset_id) || !!args.workout_preset_name;
  const hasExercise = isSet(args.exercise_id) || !!args.exercise_name;

  if (hasPreset && hasExercise) {
    return {
      ok: false,
      error: ERRORS.VALIDATION(
        'Provide either a workout preset (workout_preset_id/workout_preset_name) or an exercise (exercise_id/exercise_name), not both.'
      ),
    };
  }
  if (!hasPreset && !hasExercise) {
    return { ok: true, workout_preset_id: null, exercise_id: null };
  }

  if (hasPreset) {
    let presetId = args.workout_preset_id ?? null;
    if (!presetId && args.workout_preset_name) {
      const preset = await workoutPresetRepository.getWorkoutPresetByName(
        userId,
        args.workout_preset_name
      );
      if (!preset) {
        return {
          ok: false,
          error: ERRORS.NOT_FOUND('Workout preset', args.workout_preset_name),
        };
      }
      presetId = preset.id;
    }
    return { ok: true, workout_preset_id: presetId, exercise_id: null };
  }

  let exerciseId = args.exercise_id ?? null;
  if (!exerciseId && args.exercise_name) {
    const exercise = await findExerciseByExactName(userId, args.exercise_name);
    if (!exercise) {
      return {
        ok: false,
        error: ERRORS.NOT_FOUND('Exercise', args.exercise_name),
      };
    }
    exerciseId = exercise.id;
  }
  return { ok: true, workout_preset_id: null, exercise_id: exerciseId };
}

function toWeeklyProgressFields(progress: {
  week_start: string;
  week_end: string;
  target_total: number | null;
  target_strength: number | null;
  target_cardio: number | null;
  cardio_min_minutes: number;
  strength_counting: string;
  completed_total: number;
  completed_strength: number;
  completed_cardio: number;
  total_met: boolean | null;
  strength_met: boolean | null;
  cardio_met: boolean | null;
}) {
  return {
    week_start: progress.week_start,
    week_end: progress.week_end,
    strength_counting: progress.strength_counting,
    cardio_min_minutes: progress.cardio_min_minutes,
    completed_total: progress.completed_total,
    target_total: progress.target_total,
    total_met: progress.total_met,
    completed_strength: progress.completed_strength,
    target_strength: progress.target_strength,
    strength_met: progress.strength_met,
    completed_cardio: progress.completed_cardio,
    target_cardio: progress.target_cardio,
    cardio_met: progress.cardio_met,
  };
}

function formatPlannedWorkoutLine(row: PlannedWorkoutRowWithMissed): string {
  const time = row.planned_time ? ` at ${row.planned_time}` : '';
  const label = row.is_missed ? 'missed' : row.status;
  return `**${row.title}** (${label})${time} — ${row.planned_date}\n  ID: ${row.id}`;
}

function toRecordFields(row: PlannedWorkoutRowWithMissed) {
  return {
    id: row.id,
    title: row.title,
    planned_date: row.planned_date,
    planned_time: row.planned_time,
    status: row.status,
    is_missed: row.is_missed,
    workout_preset_id: row.workout_preset_id,
    exercise_id: row.exercise_id,
    workout_type: row.workout_type,
    duration_estimate_minutes: row.duration_estimate_minutes,
    notes: row.notes,
    started_at: row.started_at,
    completed_at: row.completed_at,
    completed_session_id: row.completed_session_id,
  };
}

type PlannedRangeResult =
  | { ok: true; startDate: string; endDate: string }
  | { ok: false; error: string };

function resolvePlannedRange(
  args: { start_date?: string; end_date?: string },
  tz: string
): PlannedRangeResult {
  const today = todayInZone(tz);
  const startDate = args.start_date || today;
  const endDate =
    args.end_date || addDays(startDate, LIST_PLANNED_DEFAULT_SPAN_DAYS);
  if (daysBetween(startDate, endDate) > LIST_PLANNED_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: ERRORS.VALIDATION(
        `Date range cannot exceed ${LIST_PLANNED_MAX_RANGE_DAYS} days (got ${startDate} to ${endDate}).`
      ),
    };
  }
  return { ok: true, startDate, endDate };
}

export function buildPlannedWorkoutTools(userId: string, tz: string) {
  return {
    sparky_manage_planned_workouts: tool({
      description: `Planned/scheduled workouts (a dated to-do list, distinct from workout plan templates — sparky_manage_workout_plans) — a coach's view onto what the user has coming up, what's missed, and what got done.

This tool takes a FLAT object with an "action" field. Do NOT nest fields under the action name.

Actions:
- action: 'list_planned' (fields: start_date?, end_date?) — planned/started/completed/skipped workouts in a date range. Defaults to today through +13 days; range is capped at 62 days.
- action: 'get_day' (fields: date?) — everything scheduled for one date (defaults to today), plus still-open workouts from the past week carried forward as "missed" (needs a Move or Skip decision — never auto-moved).
- action: 'create' (fields: planned_date, title, planned_time?, duration_estimate_minutes?, workout_type?, notes?, and at most one of workout_preset_id/workout_preset_name or exercise_id/exercise_name) — schedules a new workout.
- action: 'update' (fields: id, plus any of the create fields to change) — only a still-planned workout can be edited; at least one field besides id must be given.
- action: 'move' (fields: id, planned_date, planned_time?) — reschedules a still-planned workout to a new date/time.
- action: 'delete' (fields: id) — removes a planned or skipped workout with no linked session; a started or completed one refuses.
- action: 'start' (fields: id) — marks a plan in progress. Only a plan dated TODAY can be started; move a missed plan to today first.
- action: 'revert' (fields: id) — undoes start, back to planned. Use this instead of leaving a mistaken start() in place.
- action: 'complete' (fields: id, session_id) — links an already-logged session to this plan. Refuses a future planned_date and never overwrites an existing link. (A session logged with planned_workout_id set completes its plan automatically — this action is for linking an existing session after the fact.)
- action: 'skip' (fields: id) — marks a planned or started workout skipped.
- action: 'get_weekly_progress' (fields: date?) — sessions/week progress against the user's weekly workout-goal targets (total/strength/cardio, if set) for the 7-day week containing date (defaults to today), aligned to the user's first day of week. A cardio session only counts once it meets the user's minimum cardio duration.

Every write returns the saved record. Dates accept YYYY-MM-DD or "today"/"yesterday"/"tomorrow".`,
      inputSchema: managePlannedWorkoutsInput,
      execute: async (rawArgs) => {
        const normalized = normalizeActionArgs(
          rawArgs,
          tz,
          VALID_ACTIONS,
          () => 'list_planned'
        );
        const parsed = managePlannedWorkoutsSchema.safeParse(normalized);
        if (!parsed.success) {
          return ERRORS.VALIDATION(
            parsed.error.issues
              .map((i) =>
                i.path.length > 0
                  ? `${i.path.join('.')}: ${i.message}`
                  : i.message
              )
              .join('; ')
          );
        }
        const args: ManagePlannedWorkoutsInput = parsed.data;
        const today = todayInZone(tz);
        try {
          switch (args.action) {
            case 'list_planned': {
              const range = resolvePlannedRange(args, tz);
              if (!range.ok) return range.error;
              const rows = (await plannedWorkoutService.listPlannedWorkouts(
                userId,
                range.startDate,
                range.endDate,
                today
              )) as PlannedWorkoutRowWithMissed[];
              return formatList(
                rows,
                `Planned Workouts: ${range.startDate} to ${range.endDate}`,
                formatPlannedWorkoutLine
              );
            }

            case 'get_day': {
              const date = args.date || today;
              const { for_date, missed } =
                await plannedWorkoutService.getDayView(userId, date, today);
              const forText = formatList(
                for_date as PlannedWorkoutRowWithMissed[],
                `Planned for ${date}`,
                formatPlannedWorkoutLine
              );
              if (missed.length === 0) return forText;
              const missedText = formatList(
                missed as PlannedWorkoutRowWithMissed[],
                'Missed — needs Move or Skip',
                formatPlannedWorkoutLine
              );
              return `${forText}\n\n${missedText}`;
            }

            case 'create': {
              const target = await resolveOptionalWorkoutTarget(userId, args);
              if (!target.ok) return target.error;
              const row = (await plannedWorkoutService.createPlannedWorkout(
                userId,
                {
                  planned_date: args.planned_date,
                  planned_time: args.planned_time ?? null,
                  duration_estimate_minutes:
                    args.duration_estimate_minutes ?? null,
                  title: args.title,
                  workout_preset_id: target.workout_preset_id,
                  exercise_id: target.exercise_id,
                  workout_type: args.workout_type ?? null,
                  notes: args.notes ?? null,
                },
                today,
                'coach'
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'create', { id: row.id });
              return formatRecord(
                'Planned workout created',
                toRecordFields(row)
              );
            }

            case 'update': {
              const patch: PlannedWorkoutPatchInput = {};
              if (args.planned_date !== undefined)
                patch.planned_date = args.planned_date;
              if (args.planned_time !== undefined)
                patch.planned_time = args.planned_time;
              if (args.duration_estimate_minutes !== undefined)
                patch.duration_estimate_minutes =
                  args.duration_estimate_minutes;
              if (args.title !== undefined) patch.title = args.title;
              if (args.workout_type !== undefined)
                patch.workout_type = args.workout_type;
              if (args.notes !== undefined) patch.notes = args.notes;

              const hasPresetField =
                isSet(args.workout_preset_id) || !!args.workout_preset_name;
              const hasExerciseField =
                isSet(args.exercise_id) || !!args.exercise_name;
              if (hasPresetField || hasExerciseField) {
                const target = await resolveOptionalWorkoutTarget(userId, args);
                if (!target.ok) return target.error;
                patch.workout_preset_id = target.workout_preset_id;
                patch.exercise_id = target.exercise_id;
              }

              if (Object.keys(patch).length === 0) {
                return ERRORS.VALIDATION(
                  'At least one field must be provided to update.'
                );
              }
              const row = (await plannedWorkoutService.updatePlannedWorkout(
                userId,
                args.id,
                patch,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'update', { id: args.id });
              return formatRecord(
                'Planned workout updated',
                toRecordFields(row)
              );
            }

            case 'move': {
              const row = (await plannedWorkoutService.movePlannedWorkout(
                userId,
                args.id,
                args.planned_date,
                args.planned_time,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'move', {
                id: args.id,
                planned_date: args.planned_date,
              });
              return formatRecord('Planned workout moved', toRecordFields(row));
            }

            case 'delete': {
              const result = await plannedWorkoutService.deletePlannedWorkout(
                userId,
                args.id
              );
              logMutation(userId, 'delete', { id: args.id });
              return formatConfirmation(result.message);
            }

            case 'start': {
              const existing =
                (await plannedWorkoutService.getPlannedWorkoutById(
                  userId,
                  args.id,
                  today
                )) as PlannedWorkoutRowWithMissed;
              if (existing.planned_date !== today) {
                return ERRORS.VALIDATION(
                  `Only a plan dated today (${today}) can be started; this plan is dated ${existing.planned_date}. Move it to today first if you want to start it now.`
                );
              }
              const row = (await plannedWorkoutService.startPlannedWorkout(
                userId,
                args.id,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'start', { id: args.id });
              return formatRecord('Workout started', toRecordFields(row));
            }

            case 'revert': {
              const row = (await plannedWorkoutService.revertPlannedWorkout(
                userId,
                args.id,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'revert', { id: args.id });
              return formatRecord(
                'Workout reverted to planned',
                toRecordFields(row)
              );
            }

            case 'complete': {
              const row = (await plannedWorkoutService.completePlannedWorkout(
                userId,
                args.id,
                args.session_id,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'complete', {
                id: args.id,
                session_id: args.session_id,
              });
              return formatRecord('Workout completed', toRecordFields(row));
            }

            case 'skip': {
              const row = (await plannedWorkoutService.skipPlannedWorkout(
                userId,
                args.id,
                today
              )) as PlannedWorkoutRowWithMissed;
              logMutation(userId, 'skip', { id: args.id });
              return formatRecord('Workout skipped', toRecordFields(row));
            }

            case 'get_weekly_progress': {
              const date = args.date || today;
              const progress =
                await weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress(
                  userId,
                  date
                );
              return formatRecord(
                `Weekly Workout Goal Progress: ${progress.week_start} to ${progress.week_end}`,
                toWeeklyProgressFields(progress)
              );
            }

            default:
              return ERRORS.INVALID_ACTION(
                String((args as ManagePlannedWorkoutsInput).action),
                VALID_ACTIONS
              );
          }
        } catch (error) {
          if (isStatusError(error)) {
            return mapServiceError(error);
          }
          log('error', '[Planned Workout Tool] Error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
