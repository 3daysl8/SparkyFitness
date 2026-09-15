import { z } from "zod";
import { WORKOUT_TYPES } from "../../constants/exercise.ts";
import { MAX_ENTRY_DURATION_MINUTES } from "../../utils/workoutPlausibility.ts";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const timeStringSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "Must be 24-hour HH:MM (optionally HH:MM:SS)",
  );

export const plannedWorkoutStatusSchema = z.enum([
  "planned",
  "started",
  "completed",
  "skipped",
]);
export const plannedWorkoutOriginSchema = z.enum([
  "template",
  "manual",
  "coach",
]);
export const workoutTypeSchema = z.enum(WORKOUT_TYPES);

// --- Response ---

export const plannedWorkoutResponseSchema = z
  .object({
    id: z.string().uuid(),
    planned_date: dateStringSchema,
    planned_time: timeStringSchema.nullable(),
    duration_estimate_minutes: z.number().int().nullable(),
    title: z.string(),
    workout_preset_id: z.number().int().nullable(),
    exercise_id: z.string().uuid().nullable(),
    workout_type: workoutTypeSchema.nullable(),
    notes: z.string().nullable(),
    status: plannedWorkoutStatusSchema,
    // Derived on read, never stored: a planned/started row whose planned_date
    // is strictly before "today" in the user's timezone.
    is_missed: z.boolean(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    completed_session_id: z.string().uuid().nullable(),
    origin: plannedWorkoutOriginSchema,
    template_id: z.number().int().nullable(),
    assignment_id: z.number().int().nullable(),
    user_modified: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

// --- Requests ---

export const createPlannedWorkoutRequestSchema = z
  .object({
    planned_date: dateStringSchema,
    planned_time: timeStringSchema.nullable().optional(),
    duration_estimate_minutes: z
      .number()
      .int()
      .positive()
      .max(MAX_ENTRY_DURATION_MINUTES)
      .nullable()
      .optional(),
    title: z.string().min(1),
    workout_preset_id: z.number().int().positive().nullable().optional(),
    exercise_id: z.string().uuid().nullable().optional(),
    workout_type: workoutTypeSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export const updatePlannedWorkoutRequestSchema = z
  .object({
    planned_date: dateStringSchema.optional(),
    planned_time: timeStringSchema.nullable().optional(),
    duration_estimate_minutes: z
      .number()
      .int()
      .positive()
      .max(MAX_ENTRY_DURATION_MINUTES)
      .nullable()
      .optional(),
    title: z.string().min(1).optional(),
    workout_preset_id: z.number().int().positive().nullable().optional(),
    exercise_id: z.string().uuid().nullable().optional(),
    workout_type: workoutTypeSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided.",
      });
    }
  });

// A move is a patch restricted to the fields the "Move to today" / reschedule
// UI actually changes, kept separate from the general patch so the route
// (and the user_modified bookkeeping it triggers) reads as its own intent.
export const movePlannedWorkoutRequestSchema = z
  .object({
    planned_date: dateStringSchema,
    planned_time: timeStringSchema.nullable().optional(),
  })
  .strict();

// Completing outside the normal "finish a session that carries
// planned_workout_id" path — e.g. linking a plan to a session that already
// exists. The session must belong to the caller and not already complete a
// different plan; the route refuses a future planned_date.
export const completePlannedWorkoutRequestSchema = z
  .object({
    session_id: z.string().uuid(),
  })
  .strict();

export const listPlannedWorkoutsQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
  })
  .strict();

// --- Types ---

export type PlannedWorkoutStatus = z.infer<typeof plannedWorkoutStatusSchema>;
export type PlannedWorkoutOrigin = z.infer<typeof plannedWorkoutOriginSchema>;
export type PlannedWorkoutResponse = z.infer<
  typeof plannedWorkoutResponseSchema
>;
export type CreatePlannedWorkoutRequest = z.infer<
  typeof createPlannedWorkoutRequestSchema
>;
export type UpdatePlannedWorkoutRequest = z.infer<
  typeof updatePlannedWorkoutRequestSchema
>;
export type MovePlannedWorkoutRequest = z.infer<
  typeof movePlannedWorkoutRequestSchema
>;
export type CompletePlannedWorkoutRequest = z.infer<
  typeof completePlannedWorkoutRequestSchema
>;
export type ListPlannedWorkoutsQuery = z.infer<
  typeof listPlannedWorkoutsQuerySchema
>;
