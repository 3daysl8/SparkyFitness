import { z } from 'zod/v4';
import { isDayString } from '@workspace/shared';

const optionalNullableString = z.string().nullable().optional();
const dayString = z
  .string()
  .refine((v) => isDayString(v), { message: 'Expected YYYY-MM-DD' });
// 24h time-of-day, e.g. "07:00" or "07:00:00" (matches a Postgres TIME column).
const timeOfDayString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'Expected HH:MM or HH:MM:SS (24h)',
  });

const TIMEFRAMES = ['daily', 'weekly', 'long_term'] as const;
const TARGET_TYPES = ['none', 'numeric', 'boolean'] as const;
const STATUSES = ['active', 'completed', 'archived'] as const;

const recurrenceDaysOfWeekSchema = z
  .array(z.number().int().min(0).max(6))
  .nullable()
  .optional();

// --- Domains -----------------------------------------------------------------

export const UpsertFocusDomainBodySchema = z
  .object({
    name: z.string().min(1).max(100),
    color: optionalNullableString,
    icon: optionalNullableString,
    sort_order: z.number().int().optional(),
  })
  .loose();

export type UpsertFocusDomainBody = z.infer<typeof UpsertFocusDomainBodySchema>;

// --- Focuses ------------------------------------------------------------------

export const CreateFocusBodySchema = z
  .object({
    domain_id: z.string().uuid().nullable().optional(),
    timeframe: z.enum(TIMEFRAMES),
    statement: z.string().min(1),
    target_type: z.enum(TARGET_TYPES).optional(),
    target_value: z.number().nullable().optional(),
    unit: optionalNullableString,
    parent_focus_id: z.string().uuid().nullable().optional(),
    period_date: dayString.nullable().optional(),
    due_time: timeOfDayString.nullable().optional(),
    status: z.enum(STATUSES).optional(),
    recurrence_days_of_week: recurrenceDaysOfWeekSchema,
    recurrence_end_date: dayString.nullable().optional(),
  })
  .loose();

export type CreateFocusBody = z.infer<typeof CreateFocusBodySchema>;

export const UpdateFocusBodySchema = z
  .object({
    domain_id: z.string().uuid().nullable().optional(),
    statement: z.string().min(1).optional(),
    target_type: z.enum(TARGET_TYPES).optional(),
    target_value: z.number().nullable().optional(),
    unit: optionalNullableString,
    parent_focus_id: z.string().uuid().nullable().optional(),
    period_date: dayString.nullable().optional(),
    due_time: timeOfDayString.nullable().optional(),
    status: z.enum(STATUSES).optional(),
    recurrence_days_of_week: recurrenceDaysOfWeekSchema,
    recurrence_end_date: dayString.nullable().optional(),
  })
  .loose();

export type UpdateFocusBody = z.infer<typeof UpdateFocusBodySchema>;

export const ListFocusQuerySchema = z
  .object({
    timeframe: z.enum(TIMEFRAMES).optional(),
    domain_id: z.string().uuid().optional(),
    status: z.enum(STATUSES).optional(),
    // Range filter on period_date, for the To-Do List card's Week view (an
    // unfiltered NULL period_date, i.e. a recurring habit, never matches a
    // range and is naturally excluded).
    startDate: dayString.optional(),
    endDate: dayString.optional(),
  })
  .loose();

export type ListFocusQuery = z.infer<typeof ListFocusQuerySchema>;

// --- Check-ins ------------------------------------------------------------------

export const UpsertFocusCheckinBodySchema = z
  .object({
    progress_value: z.number().nullable().optional(),
    completed: z.boolean().nullable().optional(),
    reflection_note: optionalNullableString,
  })
  .loose();

export type UpsertFocusCheckinBody = z.infer<
  typeof UpsertFocusCheckinBodySchema
>;

export const DateParamSchema = z
  .object({
    date: dayString,
  })
  .loose();

export const ListCheckinsQuerySchema = z
  .object({
    startDate: dayString.optional(),
    endDate: dayString.optional(),
  })
  .loose();

export const TodayQuerySchema = z
  .object({
    date: dayString.optional(),
  })
  .loose();
