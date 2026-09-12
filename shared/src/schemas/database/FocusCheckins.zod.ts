import { z } from "zod";

export const focusCheckinsIdSchema = z.string().or(z.number());

export const focusCheckinsSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  focus_id: z.string(),
  checkin_date: z.date(),
  progress_value: z.number().nullable().optional(),
  completed: z.boolean().nullable().optional(),
  reflection_note: z.string().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusCheckinsInitializerSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  focus_id: z.string(),
  checkin_date: z.date(),
  progress_value: z.number().nullable().optional(),
  completed: z.boolean().nullable().optional(),
  reflection_note: z.string().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusCheckinsMutatorSchema = focusCheckinsInitializerSchema.partial();

export type FocusCheckins = z.infer<typeof focusCheckinsSchema>;
export type FocusCheckinsInitializer = z.infer<typeof focusCheckinsInitializerSchema>;
export type FocusCheckinsMutator = z.infer<typeof focusCheckinsMutatorSchema>;
