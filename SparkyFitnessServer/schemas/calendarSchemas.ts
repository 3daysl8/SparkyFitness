import { z } from 'zod/v4';
import { isDayString } from '@workspace/shared';

const dayString = z
  .string()
  .refine((v) => isDayString(v), { message: 'Expected YYYY-MM-DD' });

// ics_url is further checked server-side (http/https only, no embedded
// credentials, no private/internal address) by outboundUrlPolicy before any
// fetch is attempted — this is just request-shape validation.
export const CreateCalendarFeedBodySchema = z
  .object({
    name: z.string().min(1).max(100),
    ics_url: z.string().url().max(2000),
    color: z.string().nullable().optional(),
    is_enabled: z.boolean().optional(),
  })
  .loose();
export type CreateCalendarFeedBody = z.infer<
  typeof CreateCalendarFeedBodySchema
>;

export const UpdateCalendarFeedBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    ics_url: z.string().url().max(2000).optional(),
    color: z.string().nullable().optional(),
    is_enabled: z.boolean().optional(),
  })
  .loose();
export type UpdateCalendarFeedBody = z.infer<
  typeof UpdateCalendarFeedBodySchema
>;

// Inclusive day range for both the Day view (start === end) and the Week
// view (7-day span) — kept as plain day strings, same convention as
// focusSchemas' dayString, so the route stays timezone-naive and lets the
// caller (which already knows the user's timezone) resolve "today".
export const AgendaQuerySchema = z
  .object({
    start: dayString,
    end: dayString,
  })
  .loose();
export type AgendaQuery = z.infer<typeof AgendaQuerySchema>;
