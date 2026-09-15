import { isCardioModality, type ExerciseModality } from "../constants/exercise.ts";

/**
 * Hard caps enforced by request schemas for manually entered, playback and
 * coach-logged values. Device/sync imports are deliberately not capped here:
 * real recordings can exceed a day.
 */
export const MAX_ENTRY_DURATION_MINUTES = 1440;
export const MAX_ENTRY_CALORIES = 10000;

/** Soft thresholds: values above these still save, but after a warning. */
export const PLAUSIBILITY_THRESHOLDS = {
  entryDurationMinutes: { strength: 120, cardio: 300, other: 180 },
  sessionDurationMinutes: 240,
  entryCalories: 1500,
  caloriesPerMinute: 20,
} as const;

export type PlausibilityKind = keyof typeof PLAUSIBILITY_THRESHOLDS.entryDurationMinutes;

export type PlausibilityWarningCode =
  | "entry_duration_high"
  | "entry_calories_high"
  | "calorie_rate_high"
  | "session_duration_high";

export interface PlausibilityWarning {
  code: PlausibilityWarningCode;
  value: number;
  threshold: number;
  /** Index into the entries passed to checkSessionPlausibility. */
  entryIndex?: number;
}

export interface PlausibilityEntryInput {
  duration_minutes?: number | null;
  calories_burned?: number | null;
  kind?: PlausibilityKind;
}

export function plausibilityKindFromModality(
  modality: ExerciseModality | null | undefined,
): PlausibilityKind {
  if (!modality) return "other";
  if (isCardioModality(modality)) return "cardio";
  if (modality === "weight_reps" || modality === "reps_only") return "strength";
  return "other";
}

export function checkEntryPlausibility(
  entry: PlausibilityEntryInput,
  entryIndex?: number,
): PlausibilityWarning[] {
  const warnings: PlausibilityWarning[] = [];
  const duration = Number(entry.duration_minutes) || 0;
  const calories = Number(entry.calories_burned) || 0;
  const durationThreshold =
    PLAUSIBILITY_THRESHOLDS.entryDurationMinutes[entry.kind ?? "other"];

  if (duration > durationThreshold) {
    warnings.push({ code: "entry_duration_high", value: duration, threshold: durationThreshold, entryIndex });
  }
  if (calories > PLAUSIBILITY_THRESHOLDS.entryCalories) {
    warnings.push({
      code: "entry_calories_high",
      value: calories,
      threshold: PLAUSIBILITY_THRESHOLDS.entryCalories,
      entryIndex,
    });
  }
  if (duration > 0 && calories > 0) {
    const rate = calories / duration;
    if (rate > PLAUSIBILITY_THRESHOLDS.caloriesPerMinute) {
      warnings.push({
        code: "calorie_rate_high",
        value: rate,
        threshold: PLAUSIBILITY_THRESHOLDS.caloriesPerMinute,
        entryIndex,
      });
    }
  }
  return warnings;
}

export function checkSessionPlausibility(
  entries: readonly PlausibilityEntryInput[],
): PlausibilityWarning[] {
  const warnings = entries.flatMap((entry, index) => checkEntryPlausibility(entry, index));
  const totalMinutes = entries.reduce((sum, entry) => sum + (Number(entry.duration_minutes) || 0), 0);
  if (totalMinutes > PLAUSIBILITY_THRESHOLDS.sessionDurationMinutes) {
    warnings.push({
      code: "session_duration_high",
      value: totalMinutes,
      threshold: PLAUSIBILITY_THRESHOLDS.sessionDurationMinutes,
    });
  }
  return warnings;
}
