import { z } from "zod";
import { WEEKLY_STRENGTH_COUNTING_MODES } from "../../workouts/weeklyGoal.ts";

export const weeklyStrengthCountingSchema = z.enum(
  WEEKLY_STRENGTH_COUNTING_MODES,
);

export const weeklyWorkoutGoalProgressResponseSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  target_total: z.number().int().positive().nullable(),
  target_strength: z.number().int().positive().nullable(),
  target_cardio: z.number().int().positive().nullable(),
  cardio_min_minutes: z.number().int().positive(),
  strength_counting: weeklyStrengthCountingSchema,
  completed_total: z.number().int().nonnegative(),
  completed_strength: z.number().int().nonnegative(),
  completed_cardio: z.number().int().nonnegative(),
  total_met: z.boolean().nullable(),
  strength_met: z.boolean().nullable(),
  cardio_met: z.boolean().nullable(),
});

export type WeeklyWorkoutGoalProgressResponse = z.infer<
  typeof weeklyWorkoutGoalProgressResponseSchema
>;
