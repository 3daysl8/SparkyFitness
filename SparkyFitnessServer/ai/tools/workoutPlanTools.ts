import { tool } from 'ai';
import { addDays, todayInZone } from '@workspace/shared';
import { log } from '../../config/logging.js';
import workoutPlanTemplateService, {
  type WorkoutPlanAssignmentSetInput,
} from '../../services/workoutPlanTemplateService.js';
import workoutPresetRepository from '../../models/workoutPresetRepository.js';
import plannedWorkoutService from '../../services/plannedWorkoutService.js';
import { findExerciseByExactName } from './exerciseTools.js';
import { ERRORS, formatZodError } from './errors.js';
import { formatConfirmation, formatList } from './formatting.js';
import {
  manageWorkoutPlansSchema,
  manageWorkoutPlansInput,
  WORKOUT_PLAN_ACTIONS,
  type ManageWorkoutPlansInput,
} from './schemas/workoutPlans.js';
import { normalizeActionArgs } from './dates.js';

const VALID_ACTIONS = [...WORKOUT_PLAN_ACTIONS];

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Only the fields the tool renders/round-trips are declared; extra columns
// (exercise modality, audit timestamps, ...) are ignored.
interface WorkoutPlanAssignmentRow {
  id?: number | string | null;
  day_of_week: number;
  workout_preset_id?: number | string | null;
  workout_preset_name?: string | null;
  exercise_id?: string | null;
  exercise_name?: string | null;
  sort_order?: number | null;
  sets?: WorkoutPlanAssignmentSetInput[] | null;
}

interface WorkoutPlanTemplateRow {
  id: string;
  plan_name: string;
  description?: string | null;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: boolean;
  assignments?: WorkoutPlanAssignmentRow[];
}

// set_day_assignment/clear_day_assignment resync planned_workouts server-side
// (workoutPlanTemplateService.updateWorkoutPlanTemplate calls
// syncTemplatePlannedWorkouts internally), so by the time this runs the
// change is already live — echoing it back saves the model a follow-up
// sparky_manage_planned_workouts.list_planned call to see the effect.
const UPCOMING_SCHEDULE_DAYS = 28;

function formatUpcomingPlannedWorkout(row: {
  id: string;
  title: string;
  status: string;
  planned_date: string;
  planned_time: string | null;
}): string {
  const time = row.planned_time ? ` at ${row.planned_time}` : '';
  return `**${row.title}** (${row.status})${time} — ${row.planned_date}\n  ID: ${row.id}`;
}

async function formatUpcomingSchedule(
  userId: string,
  tz: string
): Promise<string> {
  const today = todayInZone(tz);
  const rows = await plannedWorkoutService.listPlannedWorkouts(
    userId,
    today,
    addDays(today, UPCOMING_SCHEDULE_DAYS - 1),
    today
  );
  return formatList(
    rows as Parameters<typeof formatUpcomingPlannedWorkout>[0][],
    'Upcoming Planned Workouts (next 4 weeks)',
    formatUpcomingPlannedWorkout
  );
}

function formatAssignment(a: WorkoutPlanAssignmentRow): string {
  const day = DAY_NAMES[a.day_of_week] ?? `Day ${a.day_of_week}`;
  const item = a.workout_preset_name ?? a.exercise_name ?? 'Unknown item';
  const setCount = a.sets?.length ?? 0;
  const sets =
    setCount > 0 ? ` — ${setCount} set${setCount === 1 ? '' : 's'}` : '';
  return `${day}: ${item}${sets}`;
}

// updateWorkoutPlanTemplate treats `assignments` as the FULL desired set for
// the plan (anything omitted gets deleted) and every top-level field
// (plan_name/description/dates/is_active) as a full replace, not a patch — see
// workoutPlanTemplateRepository.ts's updateWorkoutPlanTemplate. So a
// single-day edit has to read the whole plan first and echo every other field
// and every other day's assignment back unchanged.
function toAssignmentInput(a: WorkoutPlanAssignmentRow) {
  return {
    id: a.id ?? null,
    day_of_week: a.day_of_week,
    workout_preset_id: a.workout_preset_id ?? null,
    exercise_id: a.exercise_id ?? null,
    sort_order: a.sort_order ?? null,
    sets: a.sets ?? null,
  };
}

type ResolvedAssignmentTarget =
  | { ok: true; workout_preset_id: number | null; exercise_id: string | null }
  | { ok: false; error: string };

// Resolves the day's new content from a set_day_assignment call: exactly one
// of a preset (by id or name) or an exercise (by id or name) must be given.
async function resolveAssignmentTarget(
  userId: string,
  args: {
    preset_id?: number;
    preset_name?: string;
    exercise_id?: string;
    exercise_name?: string;
  }
): Promise<ResolvedAssignmentTarget> {
  const hasPreset =
    (args.preset_id !== undefined && args.preset_id !== null) ||
    !!args.preset_name;
  const hasExercise =
    (args.exercise_id !== undefined && args.exercise_id !== null) ||
    !!args.exercise_name;

  if (hasPreset && hasExercise) {
    return {
      ok: false,
      error: ERRORS.VALIDATION(
        'Provide either a preset (preset_id/preset_name) or an exercise (exercise_id/exercise_name) for the day, not both.'
      ),
    };
  }
  if (!hasPreset && !hasExercise) {
    return {
      ok: false,
      error: ERRORS.MISSING_PARAMS([
        'preset_id or preset_name or exercise_id or exercise_name',
      ]),
    };
  }

  if (hasPreset) {
    let presetId = args.preset_id ?? null;
    if (!presetId && args.preset_name) {
      const preset = await workoutPresetRepository.getWorkoutPresetByName(
        userId,
        args.preset_name
      );
      if (!preset) {
        return {
          ok: false,
          error: ERRORS.NOT_FOUND('Workout preset', args.preset_name),
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

export function buildWorkoutPlanTools(userId: string, tz: string) {
  return {
    sparky_manage_workout_plans: tool({
      description: `Workout plan templates: list the user's saved workout plans, inspect one in detail, delete a plan, or change what's scheduled on a single day.

This tool takes a FLAT object with an "action" field. Do NOT nest fields under the action name.

Building a plan from scratch, or hand-authoring custom per-set reps/weight for a day, is done in the app UI, not here.

Actions:
- action: 'list_workout_plans' — returns every saved workout plan template (name, active state, assignment count, ID)
- action: 'get_workout_plan' (fields: plan_id) — returns one plan with its full day-by-day assignments
- action: 'delete_workout_plan' (fields: plan_id) — permanently deletes the plan with the given ID
- action: 'set_day_assignment' (fields: plan_id, day_of_week, and exactly one of preset_id/preset_name or exercise_id/exercise_name) — assigns a saved preset or a single exercise to that day. REPLACES anything already assigned to that day, it does not add alongside it.
- action: 'clear_day_assignment' (fields: plan_id, day_of_week) — removes whatever is assigned to that day, making it a rest day

day_of_week is 0=Sunday..6=Saturday, or a day name like "Monday" (case-insensitive, both accepted).

Editing a day's assignment regenerates the user's actual scheduled workouts for that weekday going forward (a separate planned_workouts list — see sparky_manage_planned_workouts), so set_day_assignment and clear_day_assignment both return the next 4 weeks of that resulting schedule alongside the confirmation.`,
      inputSchema: manageWorkoutPlansInput,
      execute: async (rawArgs) => {
        const normalized = normalizeActionArgs(
          rawArgs,
          tz,
          VALID_ACTIONS,
          () => 'list_workout_plans'
        );
        const parsed = manageWorkoutPlansSchema.safeParse(normalized);
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        const args: ManageWorkoutPlansInput = parsed.data;
        try {
          switch (args.action) {
            case 'list_workout_plans': {
              const rows =
                (await workoutPlanTemplateService.getWorkoutPlanTemplatesByUserId(
                  userId
                )) as unknown as WorkoutPlanTemplateRow[];
              return formatList(rows, 'Workout Plans', (row) => {
                const count = row.assignments?.length ?? 0;
                const state = row.is_active ? 'active' : 'inactive';
                return `**${row.plan_name}** (${state}, ${count} assignment${count === 1 ? '' : 's'})\n  ID: ${row.id}`;
              });
            }

            case 'get_workout_plan': {
              const plan =
                (await workoutPlanTemplateService.getWorkoutPlanTemplateById(
                  userId,
                  args.plan_id
                )) as unknown as WorkoutPlanTemplateRow;
              const assignments = plan.assignments ?? [];
              return formatList(
                assignments,
                `Workout Plan: ${plan.plan_name}`,
                formatAssignment
              );
            }

            case 'delete_workout_plan': {
              await workoutPlanTemplateService.deleteWorkoutPlanTemplate(
                userId,
                args.plan_id
              );
              return formatConfirmation('Workout plan deleted.');
            }

            case 'set_day_assignment': {
              const target = await resolveAssignmentTarget(userId, args);
              if (!target.ok) {
                return target.error;
              }
              const plan =
                (await workoutPlanTemplateService.getWorkoutPlanTemplateById(
                  userId,
                  args.plan_id
                )) as unknown as WorkoutPlanTemplateRow;
              const otherDays = (plan.assignments ?? [])
                .filter((a) => a.day_of_week !== args.day_of_week)
                .map(toAssignmentInput);
              await workoutPlanTemplateService.updateWorkoutPlanTemplate(
                userId,
                args.plan_id,
                {
                  plan_name: plan.plan_name,
                  description: plan.description,
                  start_date: plan.start_date as string | null,
                  end_date: plan.end_date as string | null,
                  is_active: plan.is_active,
                  assignments: [
                    ...otherDays,
                    {
                      day_of_week: args.day_of_week,
                      workout_preset_id: target.workout_preset_id,
                      exercise_id: target.exercise_id,
                      sort_order: 0,
                    },
                  ],
                }
              );
              const dayName =
                DAY_NAMES[args.day_of_week] ?? `Day ${args.day_of_week}`;
              const confirmation = formatConfirmation(
                `${dayName} set on "${plan.plan_name}".`
              );
              const upcoming = await formatUpcomingSchedule(userId, tz);
              return `${confirmation}\n\n${upcoming}`;
            }

            case 'clear_day_assignment': {
              const plan =
                (await workoutPlanTemplateService.getWorkoutPlanTemplateById(
                  userId,
                  args.plan_id
                )) as unknown as WorkoutPlanTemplateRow;
              const otherDays = (plan.assignments ?? [])
                .filter((a) => a.day_of_week !== args.day_of_week)
                .map(toAssignmentInput);
              await workoutPlanTemplateService.updateWorkoutPlanTemplate(
                userId,
                args.plan_id,
                {
                  plan_name: plan.plan_name,
                  description: plan.description,
                  start_date: plan.start_date as string | null,
                  end_date: plan.end_date as string | null,
                  is_active: plan.is_active,
                  assignments: otherDays,
                }
              );
              const dayName =
                DAY_NAMES[args.day_of_week] ?? `Day ${args.day_of_week}`;
              const confirmation = formatConfirmation(
                `${dayName} cleared on "${plan.plan_name}" — now a rest day.`
              );
              const upcoming = await formatUpcomingSchedule(userId, tz);
              return `${confirmation}\n\n${upcoming}`;
            }

            default:
              return ERRORS.INVALID_ACTION(
                String((args as ManageWorkoutPlansInput).action),
                VALID_ACTIONS
              );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Workout plan',
              'plan_id' in args ? String(args.plan_id) : ''
            );
          }
          log('error', '[Workout Plan Tool] Error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
