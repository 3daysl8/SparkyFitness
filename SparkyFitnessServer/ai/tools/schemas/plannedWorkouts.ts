import { z } from 'zod';
import { MAX_ENTRY_DURATION_MINUTES, WORKOUT_TYPES } from '@workspace/shared';
import { uuidSchema, dateSchema, optionalDateSchema } from './common.js';

// planned_workouts.id is a UUID (unlike workout_plan_templates.id, which is a
// serial integer) — see PlannedWorkouts.api.zod.ts.
const plannedWorkoutIdSchema = uuidSchema.describe('ID of the planned workout');

const plannedTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    'Time must be 24-hour HH:MM format.'
  )
  .nullable()
  .optional()
  .describe(
    'Time of day for the workout in 24-hour HH:MM format (e.g. "18:00"). Omit to leave unscheduled, or pass null to clear an existing time.'
  );

const workoutTypeFieldSchema = z
  .enum(WORKOUT_TYPES)
  .nullable()
  .optional()
  .describe(`Workout modality: ${WORKOUT_TYPES.join(', ')}`);

const durationEstimateSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_ENTRY_DURATION_MINUTES)
  .nullable()
  .optional()
  .describe('Estimated duration in minutes');

// Shared by create/update: at most one of a saved preset or a single exercise
// identifies what the plan is for; a plan may also carry neither (a bare
// title, e.g. "Rest day walk").
const workoutTargetFields = {
  workout_preset_id: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('ID of a saved workout preset for this planned workout'),
  workout_preset_name: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Name of a saved workout preset (used if workout_preset_id is not given)'
    ),
  exercise_id: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of a single exercise for this planned workout (no preset)'),
  exercise_name: z
    .string()
    .min(1)
    .optional()
    .describe('Name of a single exercise (used if exercise_id is not given)'),
};

export const PLANNED_WORKOUT_ACTIONS = [
  'list_planned',
  'get_day',
  'create',
  'update',
  'move',
  'delete',
  'start',
  'revert',
  'complete',
  'skip',
  'get_weekly_progress',
] as const;

const listPlannedSchema = z
  .object({
    action: z.literal('list_planned'),
    start_date: optionalDateSchema.describe(
      'Start of the range (defaults to today). Range is capped at 62 days.'
    ),
    end_date: optionalDateSchema.describe(
      'End of the range (defaults to 13 days after start_date, a 2-week window). Range is capped at 62 days.'
    ),
  })
  .strict();

const getDaySchema = z
  .object({
    action: z.literal('get_day'),
    date: optionalDateSchema.describe('Date to inspect (defaults to today)'),
  })
  .strict();

const getWeeklyProgressSchema = z
  .object({
    action: z.literal('get_weekly_progress'),
    date: optionalDateSchema.describe(
      'Any date within the target week (defaults to today)'
    ),
  })
  .strict()
  .describe(
    "Weekly workout-goal progress (sessions/week targets for total/strength/cardio) for the 7-day week containing `date`, aligned to the user's first day of week."
  );

const createSchema = z
  .object({
    action: z.literal('create'),
    planned_date: dateSchema,
    planned_time: plannedTimeSchema,
    duration_estimate_minutes: durationEstimateSchema,
    title: z.string().min(1).describe('Short title for the planned workout'),
    ...workoutTargetFields,
    workout_type: workoutTypeFieldSchema,
    notes: z.string().nullable().optional().describe('Free-text notes'),
  })
  .strict()
  .describe(
    'Provide at most one of a workout preset (workout_preset_id/workout_preset_name) or an exercise (exercise_id/exercise_name) — a plan can also carry just a title with neither.'
  );

const updateSchema = z
  .object({
    action: z.literal('update'),
    id: plannedWorkoutIdSchema,
    planned_date: dateSchema.optional(),
    planned_time: plannedTimeSchema,
    duration_estimate_minutes: durationEstimateSchema,
    title: z.string().min(1).optional(),
    ...workoutTargetFields,
    workout_type: workoutTypeFieldSchema,
    notes: z.string().nullable().optional(),
  })
  .strict()
  .describe(
    'Only a still-planned workout can be edited this way (a started/completed/skipped plan refuses). Only the fields provided are changed; at least one must be given.'
  );

const moveSchema = z
  .object({
    action: z.literal('move'),
    id: plannedWorkoutIdSchema,
    planned_date: dateSchema,
    planned_time: plannedTimeSchema,
  })
  .strict();

const deleteSchema = z
  .object({
    action: z.literal('delete'),
    id: plannedWorkoutIdSchema,
  })
  .strict()
  .describe(
    'Only a planned or skipped plan with no linked session can be removed; a started or completed plan refuses.'
  );

const startSchema = z
  .object({
    action: z.literal('start'),
    id: plannedWorkoutIdSchema,
  })
  .strict()
  .describe('Only a plan dated today can be started.');

const revertSchema = z
  .object({
    action: z.literal('revert'),
    id: plannedWorkoutIdSchema,
  })
  .strict()
  .describe(
    "Undoes start — reverts a currently-started plan back to 'planned'."
  );

const completeSchema = z
  .object({
    action: z.literal('complete'),
    id: plannedWorkoutIdSchema,
    session_id: z
      .string()
      .uuid()
      .describe('ID of an existing logged session to link to this plan'),
  })
  .strict()
  .describe(
    'Links an already-existing session to this plan. Refuses a future planned_date and never overwrites an existing link.'
  );

const skipSchema = z
  .object({
    action: z.literal('skip'),
    id: plannedWorkoutIdSchema,
  })
  .strict();

export const managePlannedWorkoutsSchema = z.discriminatedUnion('action', [
  listPlannedSchema,
  getDaySchema,
  createSchema,
  updateSchema,
  moveSchema,
  deleteSchema,
  startSchema,
  revertSchema,
  completeSchema,
  skipSchema,
  getWeeklyProgressSchema,
]);

export type ManagePlannedWorkoutsInput = z.infer<
  typeof managePlannedWorkoutsSchema
>;

// Flat, published schema (all fields optional) — real validation is the
// strict per-action union above inside the handler, matching
// manageWorkoutPlansInput's convention in schemas/workoutPlans.ts.
export const managePlannedWorkoutsInput = z.object({
  action: z.enum(PLANNED_WORKOUT_ACTIONS).optional(),
  id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  date: z.string().optional(),
  planned_date: z.string().optional(),
  planned_time: z.string().optional(),
  duration_estimate_minutes: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  workout_preset_id: z.union([z.string(), z.number()]).optional(),
  workout_preset_name: z.string().optional(),
  exercise_id: z.string().optional(),
  exercise_name: z.string().optional(),
  workout_type: z.string().optional(),
  notes: z.string().optional(),
  session_id: z.string().optional(),
});
