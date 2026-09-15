import { z } from 'zod';
import { optionalDateSchema, uuidSchema } from './common.js';

const TIMEFRAMES = ['daily', 'weekly', 'long_term'] as const;
const TARGET_TYPES = ['none', 'numeric', 'boolean'] as const;
const STATUSES = ['active', 'completed', 'archived'] as const;

// Matches the REST contract (timeOfDayString in schemas/focusSchemas.ts).
const dueTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    'Due time must be in 24-hour HH:MM format (optionally HH:MM:SS).'
  )
  .nullable()
  .optional()
  .describe(
    'Time of day the focus is due, 24-hour HH:MM (e.g. "18:00"). Put a deadline time here, never in the statement. null clears it.'
  );

const listDomainsSchema = z
  .object({ action: z.literal('list_domains') })
  .strict();

const createDomainSchema = z
  .object({
    action: z.literal('create_domain'),
    name: z
      .string()
      .min(1)
      .describe('Name of the life domain, e.g. Health, Work, Relationship'),
    color: z.string().optional().describe('Optional display color'),
    icon: z.string().optional().describe('Optional icon name'),
  })
  .strict();

const listFocusesSchema = z
  .object({
    action: z.literal('list_focuses'),
    timeframe: z.enum(TIMEFRAMES).optional().describe('Filter by timeframe'),
    domain_id: uuidSchema.optional().describe('Filter by domain'),
    status: z
      .enum(STATUSES)
      .optional()
      .describe('Filter by status (defaults to active)'),
  })
  .strict();

const getFocusSchema = z
  .object({
    action: z.literal('get_focus'),
    focus_id: uuidSchema.describe('UUID of the focus'),
  })
  .strict();

const createFocusSchema = z
  .object({
    action: z.literal('create_focus'),
    timeframe: z.enum(TIMEFRAMES).describe('daily, weekly, or long_term'),
    statement: z
      .string()
      .min(1)
      .describe('The written intention, e.g. "Finish the client proposal"'),
    domain_id: uuidSchema
      .nullable()
      .optional()
      .describe('Life domain this focus belongs to'),
    target_type: z
      .enum(TARGET_TYPES)
      .optional()
      .describe('none (just a statement), numeric, or boolean'),
    target_value: z
      .number()
      .nullable()
      .optional()
      .describe('Target value if target_type is numeric'),
    unit: z
      .string()
      .nullable()
      .optional()
      .describe('Unit for the target value, e.g. "steps", "$"'),
    parent_focus_id: uuidSchema
      .nullable()
      .optional()
      .describe('A weekly/long_term focus this one serves, forming a chain'),
    period_date: optionalDateSchema.describe(
      "For a one-off scheduled daily focus: the specific date. For weekly: that week's Monday start date. Omit entirely (and use recurrence fields instead) for a standing recurring daily habit. Omit for long_term."
    ),
    due_time: dueTimeSchema,
    recurrence_days_of_week: z
      .array(z.number().int().min(0).max(6))
      .nullable()
      .optional()
      .describe(
        'Only for a recurring daily habit (period_date omitted): which days it applies, 0=Sun..6=Sat. Omit/null for every day.'
      ),
    recurrence_end_date: optionalDateSchema.describe(
      'Only for a recurring daily habit: optional date after which it stops recurring.'
    ),
  })
  .strict();

const updateFocusSchema = z
  .object({
    action: z.literal('update_focus'),
    focus_id: uuidSchema.describe('UUID of the focus to update'),
    statement: z.string().min(1).optional(),
    domain_id: uuidSchema.nullable().optional(),
    target_type: z.enum(TARGET_TYPES).optional(),
    target_value: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    parent_focus_id: uuidSchema.nullable().optional(),
    due_time: dueTimeSchema,
    status: z
      .enum(STATUSES)
      .optional()
      .describe('Set to completed or archived to close it out'),
    recurrence_days_of_week: z
      .array(z.number().int().min(0).max(6))
      .nullable()
      .optional()
      .describe('Which days a recurring habit applies, 0=Sun..6=Sat'),
    recurrence_end_date: optionalDateSchema.describe(
      'Optional date after which a recurring habit stops recurring'
    ),
  })
  .strict();

const deleteFocusSchema = z
  .object({
    action: z.literal('delete_focus'),
    focus_id: uuidSchema.describe('UUID of the focus to delete'),
  })
  .strict();

const checkinSchema = z
  .object({
    action: z.literal('checkin'),
    focus_id: uuidSchema.describe('UUID of the focus to check in against'),
    date: optionalDateSchema.describe(
      'Date of the check-in (defaults to today)'
    ),
    progress_value: z
      .number()
      .optional()
      .describe('Progress value, for numeric-target focuses'),
    completed: z
      .boolean()
      .optional()
      .describe('Whether it was completed, for boolean-target focuses'),
    reflection_note: z
      .string()
      .optional()
      .describe('Free-text reflection on how it went'),
  })
  .strict();

const listCheckinsSchema = z
  .object({
    action: z.literal('list_checkins'),
    focus_id: uuidSchema.describe('UUID of the focus'),
    from_date: optionalDateSchema,
    to_date: optionalDateSchema,
  })
  .strict();

const getTodaySchema = z
  .object({
    action: z.literal('get_today'),
    date: optionalDateSchema.describe('Defaults to today'),
  })
  .strict();

export const manageFocusSchema = z.discriminatedUnion('action', [
  listDomainsSchema,
  createDomainSchema,
  listFocusesSchema,
  getFocusSchema,
  createFocusSchema,
  updateFocusSchema,
  deleteFocusSchema,
  checkinSchema,
  listCheckinsSchema,
  getTodaySchema,
]);

export type ManageFocusInput = z.infer<typeof manageFocusSchema>;

export const manageFocusInput = z.object({
  action: z
    .enum([
      'list_domains',
      'create_domain',
      'list_focuses',
      'get_focus',
      'create_focus',
      'update_focus',
      'delete_focus',
      'checkin',
      'list_checkins',
      'get_today',
    ])
    .optional()
    .describe('Action to perform'),
  name: z.string().optional().describe('Domain name (for create_domain)'),
  color: z.string().optional(),
  icon: z.string().optional(),
  timeframe: z.enum(TIMEFRAMES).optional(),
  domain_id: uuidSchema.nullable().optional(),
  status: z.enum(STATUSES).optional(),
  focus_id: uuidSchema.optional(),
  statement: z.string().optional(),
  target_type: z.enum(TARGET_TYPES).optional(),
  target_value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  parent_focus_id: uuidSchema.nullable().optional(),
  period_date: optionalDateSchema,
  due_time: dueTimeSchema,
  recurrence_days_of_week: z
    .array(z.number().int().min(0).max(6))
    .nullable()
    .optional(),
  recurrence_end_date: optionalDateSchema,
  date: optionalDateSchema,
  progress_value: z.number().optional(),
  completed: z.boolean().optional(),
  reflection_note: z.string().optional(),
  from_date: optionalDateSchema,
  to_date: optionalDateSchema,
});
