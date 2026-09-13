import { z } from 'zod/v4';
import { optionalNullableNumber, optionalNullableInt } from './schema.utils.js';

const customFields = z.record(z.string(), z.unknown()).nullable().optional();
const optionalNullableString = z.string().nullable().optional();
const optionalDateString = z.string().nullable().optional(); // 'YYYY-MM-DD'
const nutrientValue = z.number().finite().nonnegative();
// A dose amount, when present, must be positive. Beyond being a sane display quantity, for
// a supplement it becomes the report's per-entry dose multiplier (COALESCE(ms.dose_amount,
// m.dose_amount)), where a zero or negative value would silently zero or subtract every
// nutrient in the daily total.
const positiveDoseAmount = z
  .number()
  .finite()
  .positive('dose_amount must be greater than 0')
  .nullable()
  .optional();

export const MedicationNutrientsSchema = z
  .object({
    calories: nutrientValue.optional(),
    protein: nutrientValue.optional(),
    carbs: nutrientValue.optional(),
    fat: nutrientValue.optional(),
    saturated_fat: nutrientValue.optional(),
    polyunsaturated_fat: nutrientValue.optional(),
    monounsaturated_fat: nutrientValue.optional(),
    trans_fat: nutrientValue.optional(),
    cholesterol: nutrientValue.optional(),
    sodium: nutrientValue.optional(),
    potassium: nutrientValue.optional(),
    dietary_fiber: nutrientValue.optional(),
    sugars: nutrientValue.optional(),
    vitamin_a: nutrientValue.optional(),
    vitamin_c: nutrientValue.optional(),
    calcium: nutrientValue.optional(),
    iron: nutrientValue.optional(),
    // Kept in step with the food_variants nutrient columns. The micronutrient
    // catalog offers Caffeine against fixedField caffeine_mg and the caffeine
    // kinetics query already reads nutrients_snapshot->>'caffeine_mg' off a
    // supplement, but this strict schema rejected the field -- so a
    // caffeinated supplement could be picked in the UI and never saved, and
    // the dose arm that reads it could never have any rows.
    caffeine_mg: nutrientValue.optional(),
    water_ml: nutrientValue.optional(),
    alcohol_g: nutrientValue.optional(),
    custom_nutrients: z.record(z.string(), nutrientValue).optional(),
  })
  .strict();
export type MedicationNutrients = z.infer<typeof MedicationNutrientsSchema>;

// --------------------------------------------------------------------------
// Medications
// --------------------------------------------------------------------------
const MedicationFieldsSchema = z.object({
  name: z.string().min(1, 'name is required'),
  display_name: optionalNullableString,
  type_id: optionalNullableString,
  route_id: optionalNullableString,
  strength_value: optionalNullableNumber,
  strength_unit: optionalNullableString,
  dose_amount: positiveDoseAmount,
  dose_unit: optionalNullableString,
  rxnorm_rxcui: optionalNullableString,
  ndc: optionalNullableString,
  reason_text: optionalNullableString,
  color: optionalNullableString,
  icon: optionalNullableString,
  is_active: z.boolean().optional(),
  is_quick: z.boolean().optional(),
  is_supplement: z.boolean().optional(),
  nutrients: MedicationNutrientsSchema.optional(),
  notes: optionalNullableString,
  source: z.string().optional(),
  custom_fields: customFields,
});

export const CreateMedicationBodySchema = MedicationFieldsSchema.loose();
export type CreateMedicationBody = z.infer<typeof CreateMedicationBodySchema>;

// Update is a partial patch — every field optional, including name.
export const UpdateMedicationBodySchema =
  MedicationFieldsSchema.partial().loose();
export type UpdateMedicationBody = z.infer<typeof UpdateMedicationBodySchema>;

// --------------------------------------------------------------------------
// Schedules
// --------------------------------------------------------------------------
export const CreateScheduleBodySchema = z
  .object({
    schedule_type_id: z.string().min(1, 'schedule_type_id is required'),
    time_of_day: optionalNullableString, // 'HH:MM' or 'HH:MM:SS'
    dose_amount: positiveDoseAmount,
    days_of_week: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    interval_days: optionalNullableInt,
    day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    cycle_on_days: optionalNullableInt,
    cycle_off_days: optionalNullableInt,
    with_meal: z
      .enum(['before', 'with', 'after', 'away_from_meals'])
      .nullable()
      .optional(),
    prn_reason: optionalNullableString,
    prn_max_per_day: optionalNullableInt,
    start_date: optionalDateString,
    end_date: optionalDateString,
    active: z.boolean().optional(),
    source: z.string().optional(),
    custom_fields: customFields,
  })
  .loose();
export type CreateScheduleBody = z.infer<typeof CreateScheduleBodySchema>;

// Update is a partial patch — every field optional, including schedule_type_id.
export const UpdateScheduleBodySchema = CreateScheduleBodySchema.partial();
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBodySchema>;

// --------------------------------------------------------------------------
// Param / query schemas
// --------------------------------------------------------------------------
export const MedicationIdParamSchema = z
  .object({ medicationId: z.string().uuid() })
  .loose();
export type MedicationIdParam = z.infer<typeof MedicationIdParamSchema>;

export const ListMedicationsQuerySchema = z
  .object({
    activeOnly: z.coerce.boolean().optional(),
  })
  .loose();
export type ListMedicationsQuery = z.infer<typeof ListMedicationsQuerySchema>;

// --------------------------------------------------------------------------
// Medication Entries
// --------------------------------------------------------------------------
export const CreateMedicationEntryBodySchema = z
  .object({
    medication_id: z.string().uuid(),
    schedule_id: z.string().uuid().nullable().optional(),
    status: z.enum(['taken', 'skipped', 'snoozed', 'prn_taken']).optional(),
    taken_at: z.string().nullable().optional(),
    scheduled_for: z.string().nullable().optional(),
    entry_date: optionalDateString,
    med_name_snapshot: optionalNullableString,
    dose_amount_snapshot: optionalNullableNumber,
    dose_unit_snapshot: optionalNullableString,
    notes: optionalNullableString,
    source: z.string().optional(),
    custom_fields: customFields,
  })
  .loose();
export type CreateMedicationEntryBody = z.infer<
  typeof CreateMedicationEntryBodySchema
>;

// Update is a partial patch — chiefly for correcting the "when" (taken_at/entry_date)
// of a dose logged after the fact. medication_id is not editable.
export const UpdateMedicationEntryBodySchema = z
  .object({
    schedule_id: z.string().uuid().nullable().optional(),
    status: z.enum(['taken', 'skipped', 'snoozed', 'prn_taken']).optional(),
    taken_at: z.string().nullable().optional(),
    scheduled_for: z.string().nullable().optional(),
    entry_date: optionalDateString,
    notes: optionalNullableString,
    custom_fields: customFields,
  })
  .loose();
export type UpdateMedicationEntryBody = z.infer<
  typeof UpdateMedicationEntryBodySchema
>;

export const ListMedicationEntriesQuerySchema = z
  .object({
    fromDate: optionalDateString,
    toDate: optionalDateString,
    medicationId: z.string().uuid().optional(),
  })
  .loose();
export type ListMedicationEntriesQuery = z.infer<
  typeof ListMedicationEntriesQuerySchema
>;

// --------------------------------------------------------------------------
// Display Preferences
// --------------------------------------------------------------------------
export const UpdateMedicationDisplayPreferencesBodySchema = z
  .object({
    visible_items: z.array(z.string()),
  })
  .loose();
export type UpdateMedicationDisplayPreferencesBody = z.infer<
  typeof UpdateMedicationDisplayPreferencesBodySchema
>;

export const DisplayPreferenceParamsSchema = z.object({
  viewGroup: z.string().min(1).max(50),
  platform: z.string().min(1).max(20),
});
export type DisplayPreferenceParams = z.infer<
  typeof DisplayPreferenceParamsSchema
>;
