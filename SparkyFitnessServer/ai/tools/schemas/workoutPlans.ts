import { z } from 'zod';
import { uuidSchema } from './common.js';

// workout_plan_templates.id is a SERIAL PRIMARY KEY (integer), so plan_id must be
// a positive integer, not a UUID. z.coerce accepts the numeric string the model
// echoes back from list_workout_plans output.
const planIdSchema = z.coerce
  .number()
  .int()
  .positive('Workout plan ID must be a positive integer');

// day_of_week is stored 0 (Sunday) .. 6 (Saturday) — see DAYS_OF_WEEK in the
// frontend's constants/exercises.ts, which this must stay in sync with. Models
// routinely say "Monday" instead of 1, so accept common day names/abbreviations
// too rather than failing the call.
const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const dayOfWeekSchema = z
  .preprocess((val) => {
    if (typeof val === 'string') {
      const key = val.trim().toLowerCase();
      if (key in DAY_NAME_TO_NUMBER) {
        return DAY_NAME_TO_NUMBER[key];
      }
    }
    return val;
  }, z.coerce.number().int().min(0).max(6))
  .describe('Day of week: 0=Sunday..6=Saturday, or a day name like "Monday"');

// Workout plan templates carry nested day-of-week assignment and set arrays that
// do not map cleanly onto a flat chatbot tool schema, so full authoring
// (creating a plan, or hand-editing custom sets) is left to the web UI. The AI
// surface additionally exposes one flat, safe write: assigning a saved preset
// or a single exercise to one day of an existing plan (or clearing that day).
export const WORKOUT_PLAN_ACTIONS = [
  'list_workout_plans',
  'get_workout_plan',
  'delete_workout_plan',
  'set_day_assignment',
  'clear_day_assignment',
] as const;

const listWorkoutPlansSchema = z
  .object({
    action: z.literal('list_workout_plans'),
  })
  .strict();

const getWorkoutPlanSchema = z
  .object({
    action: z.literal('get_workout_plan'),
    plan_id: planIdSchema.describe(
      'ID of the workout plan template to inspect'
    ),
  })
  .strict();

const deleteWorkoutPlanSchema = z
  .object({
    action: z.literal('delete_workout_plan'),
    plan_id: planIdSchema.describe('ID of the workout plan template to delete'),
  })
  .strict();

const setDayAssignmentSchema = z
  .object({
    action: z.literal('set_day_assignment'),
    plan_id: planIdSchema.describe('ID of the workout plan template to modify'),
    day_of_week: dayOfWeekSchema,
    preset_id: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('ID of a saved workout preset to assign to this day'),
    preset_name: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Name of a saved workout preset to assign to this day (used if preset_id is not given)'
      ),
    exercise_id: uuidSchema
      .optional()
      .describe(
        'UUID of a single exercise to assign directly to this day (no preset)'
      ),
    exercise_name: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Name of a single exercise to assign directly to this day (used if exercise_id is not given)'
      ),
  })
  .strict()
  .describe(
    'Provide exactly one of a preset (preset_id or preset_name) or an exercise (exercise_id or exercise_name). Replaces any existing assignment(s) on that day — it does not add alongside them.'
  );

const clearDayAssignmentSchema = z
  .object({
    action: z.literal('clear_day_assignment'),
    plan_id: planIdSchema.describe('ID of the workout plan template to modify'),
    day_of_week: dayOfWeekSchema,
  })
  .strict();

export const manageWorkoutPlansSchema = z.discriminatedUnion('action', [
  listWorkoutPlansSchema,
  getWorkoutPlanSchema,
  deleteWorkoutPlanSchema,
  setDayAssignmentSchema,
  clearDayAssignmentSchema,
]);

export type ManageWorkoutPlansInput = z.infer<typeof manageWorkoutPlansSchema>;

// Flat, published schema (all fields optional) — real validation is the strict
// union above inside the handler.
export const manageWorkoutPlansInput = z.object({
  action: z.enum(WORKOUT_PLAN_ACTIONS).optional(),
  plan_id: z.union([z.string(), z.number()]).optional(),
  day_of_week: z.union([z.string(), z.number()]).optional(),
  preset_id: z.union([z.string(), z.number()]).optional(),
  preset_name: z.string().optional(),
  exercise_id: z.string().optional(),
  exercise_name: z.string().optional(),
});
