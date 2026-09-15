import { z } from "zod";

export const focusesIdSchema = z.string().or(z.number());

const focusTimeframeSchema = z.enum(["daily", "weekly", "long_term"]);
const focusTargetTypeSchema = z.enum(["none", "numeric", "boolean"]);
const focusStatusSchema = z.enum(["active", "completed", "archived"]);

export const focusesSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  domain_id: z.string().nullable().optional(),
  timeframe: focusTimeframeSchema,
  statement: z.string(),
  target_type: focusTargetTypeSchema,
  target_value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  parent_focus_id: z.string().nullable().optional(),
  period_date: z.date().nullable().optional(),
  due_time: z.string().nullable().optional(),
  recurrence_days_of_week: z.array(z.number().int()).nullable().optional(),
  recurrence_end_date: z.date().nullable().optional(),
  status: focusStatusSchema,
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusesInitializerSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  domain_id: z.string().nullable().optional(),
  timeframe: focusTimeframeSchema,
  statement: z.string(),
  target_type: focusTargetTypeSchema.optional(),
  target_value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  parent_focus_id: z.string().nullable().optional(),
  period_date: z.date().nullable().optional(),
  due_time: z.string().nullable().optional(),
  recurrence_days_of_week: z.array(z.number().int()).nullable().optional(),
  recurrence_end_date: z.date().nullable().optional(),
  status: focusStatusSchema.optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusesMutatorSchema = focusesInitializerSchema.partial();

export type Focuses = z.infer<typeof focusesSchema>;
export type FocusesInitializer = z.infer<typeof focusesInitializerSchema>;
export type FocusesMutator = z.infer<typeof focusesMutatorSchema>;
