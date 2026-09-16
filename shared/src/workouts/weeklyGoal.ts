import { WORKOUT_TYPES, isWorkoutType, type WorkoutType } from "../constants/exercise.ts";

export const WEEKLY_STRENGTH_COUNTING_MODES = [
  "any_strength",
  "explicit_only",
] as const;

export type WeeklyStrengthCounting =
  (typeof WEEKLY_STRENGTH_COUNTING_MODES)[number];

export function isWeeklyStrengthCounting(
  value: unknown,
): value is WeeklyStrengthCounting {
  return (
    typeof value === "string" &&
    (WEEKLY_STRENGTH_COUNTING_MODES as readonly string[]).includes(value)
  );
}

const DEFAULT_CARDIO_MIN_MINUTES = 20;
const DEFAULT_STRENGTH_COUNTING: WeeklyStrengthCounting = "any_strength";

export interface WeeklyGoalPolicy {
  target_total: number | null;
  target_strength: number | null;
  target_cardio: number | null;
  cardio_min_minutes: number;
  strength_counting: WeeklyStrengthCounting;
}

/** The subset of a user_preferences row weekly-goal policy is resolved from. */
export interface WeeklyGoalPreferencesSource {
  weekly_workout_target_total?: number | null;
  weekly_workout_target_strength?: number | null;
  weekly_workout_target_cardio?: number | null;
  weekly_cardio_min_minutes?: number | null;
  weekly_strength_counting?: string | null;
}

/**
 * Resolves the raw preferences row into a policy with defaults applied.
 * `weekly_cardio_min_minutes`/`weekly_strength_counting` are NOT NULL with a
 * DB default, but this also tolerates a missing/pre-migration row (e.g. a
 * user who hasn't loaded preferences yet) by applying the same defaults.
 */
export function resolveWeeklyGoalPolicy(
  prefs: WeeklyGoalPreferencesSource | null | undefined,
): WeeklyGoalPolicy {
  return {
    target_total: prefs?.weekly_workout_target_total ?? null,
    target_strength: prefs?.weekly_workout_target_strength ?? null,
    target_cardio: prefs?.weekly_workout_target_cardio ?? null,
    cardio_min_minutes:
      prefs?.weekly_cardio_min_minutes ?? DEFAULT_CARDIO_MIN_MINUTES,
    strength_counting: isWeeklyStrengthCounting(prefs?.weekly_strength_counting)
      ? prefs.weekly_strength_counting
      : DEFAULT_STRENGTH_COUNTING,
  };
}

export interface ClassifiableExercise {
  /** exercises.workout_type for the exercise this entry logs. */
  workout_type: string | null;
  /** exercises.modality (ExerciseModality) — last-resort inference only. */
  modality?: string | null;
  duration_minutes?: number | null;
}

export interface ClassifiableSession {
  /** exercise_preset_entries.workout_type — the session's own explicit tag. */
  workout_type: string | null;
  /** workout_presets.workout_type, when the session was started from a preset. */
  preset_workout_type?: string | null;
  exercises: ClassifiableExercise[];
}

/**
 * Classifies a completed session for weekly-goal bucketing via a fixed
 * cascade: the session's own tag, then its preset's tag, then a
 * duration-weighted majority across its exercises' tags (ties broken by
 * WORKOUT_TYPES declaration order, so "strength" wins a tie over "cardio").
 *
 * `explicit_only` counting stops there and returns null rather than
 * guessing — the `any_strength` default additionally falls back to a last
 * resort inferred from exercise modality, since an untagged weight_reps
 * exercise is usually but not always strength work (it could be light
 * mobility done holding a weight).
 */
export function classifySession(
  session: ClassifiableSession,
  strengthCounting: WeeklyStrengthCounting = DEFAULT_STRENGTH_COUNTING,
): WorkoutType | null {
  if (isWorkoutType(session.workout_type)) return session.workout_type;
  if (isWorkoutType(session.preset_workout_type)) {
    return session.preset_workout_type;
  }

  const weights = new Map<WorkoutType, number>();
  for (const exercise of session.exercises) {
    if (!isWorkoutType(exercise.workout_type)) continue;
    const weight =
      exercise.duration_minutes && exercise.duration_minutes > 0
        ? exercise.duration_minutes
        : 1;
    weights.set(
      exercise.workout_type,
      (weights.get(exercise.workout_type) ?? 0) + weight,
    );
  }
  if (weights.size > 0) {
    let best: WorkoutType | null = null;
    let bestWeight = 0;
    for (const type of WORKOUT_TYPES) {
      const weight = weights.get(type) ?? 0;
      if (weight > bestWeight) {
        bestWeight = weight;
        best = type;
      }
    }
    if (best) return best;
  }

  if (strengthCounting === "explicit_only") return null;

  for (const exercise of session.exercises) {
    if (exercise.modality === "duration_distance") return "cardio";
  }
  for (const exercise of session.exercises) {
    if (
      exercise.modality === "weight_reps" ||
      exercise.modality === "reps_only" ||
      exercise.modality === "duration"
    ) {
      return "strength";
    }
  }
  return null;
}

export interface WeeklyClassifiedSession {
  classification: WorkoutType | null;
  duration_minutes: number;
}

export interface WeeklyGoalProgress {
  week_start: string;
  week_end: string;
  target_total: number | null;
  target_strength: number | null;
  target_cardio: number | null;
  cardio_min_minutes: number;
  strength_counting: WeeklyStrengthCounting;
  completed_total: number;
  completed_strength: number;
  completed_cardio: number;
  total_met: boolean | null;
  strength_met: boolean | null;
  cardio_met: boolean | null;
}

/**
 * Rolls a week's already-classified sessions up against a policy. `sessions`
 * must already be filtered to real, non-empty, completed sessions in
 * [week_start, week_end] — this function does no date filtering itself.
 * A cardio-classified session only counts toward `target_cardio` once its
 * duration meets `policy.cardio_min_minutes`; it still counts toward
 * `completed_total` regardless (the total target is type-agnostic).
 */
export function computeWeeklyProgress(
  policy: WeeklyGoalPolicy,
  sessions: WeeklyClassifiedSession[],
  week_start: string,
  week_end: string,
): WeeklyGoalProgress {
  const completed_total = sessions.length;
  const completed_strength = sessions.filter(
    (s) => s.classification === "strength",
  ).length;
  const completed_cardio = sessions.filter(
    (s) =>
      s.classification === "cardio" &&
      s.duration_minutes >= policy.cardio_min_minutes,
  ).length;

  return {
    week_start,
    week_end,
    target_total: policy.target_total,
    target_strength: policy.target_strength,
    target_cardio: policy.target_cardio,
    cardio_min_minutes: policy.cardio_min_minutes,
    strength_counting: policy.strength_counting,
    completed_total,
    completed_strength,
    completed_cardio,
    total_met:
      policy.target_total === null
        ? null
        : completed_total >= policy.target_total,
    strength_met:
      policy.target_strength === null
        ? null
        : completed_strength >= policy.target_strength,
    cardio_met:
      policy.target_cardio === null
        ? null
        : completed_cardio >= policy.target_cardio,
  };
}
