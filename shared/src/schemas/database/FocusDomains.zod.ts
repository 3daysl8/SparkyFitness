import { z } from "zod";

export const focusDomainsIdSchema = z.string().or(z.number());

export const focusDomainsSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sort_order: z.number(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusDomainsInitializerSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sort_order: z.number().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const focusDomainsMutatorSchema = focusDomainsInitializerSchema.partial();

export type FocusDomains = z.infer<typeof focusDomainsSchema>;
export type FocusDomainsInitializer = z.infer<typeof focusDomainsInitializerSchema>;
export type FocusDomainsMutator = z.infer<typeof focusDomainsMutatorSchema>;
