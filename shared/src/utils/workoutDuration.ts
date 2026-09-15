import { setsDurationMinutes, type TimedSetLike } from "./calorieCalculations.ts";

/** A set row that may carry the ISO timestamp it was marked complete. */
export interface CompletedSetLike extends TimedSetLike {
  completed_at?: string | null;
}

/**
 * Floor for how long a gap between two completed sets may count, in seconds.
 * A longer gap is treated as the user walking away (a draft left open, a
 * phone call) rather than training.
 */
export const MIN_SET_GAP_CAP_SECONDS = 300;

/**
 * Below this fraction of the set-based estimate, timestamps are assumed to
 * come from logging a finished workout after the fact (sets ticked off in
 * seconds), so the estimate is the better number.
 */
const RETRO_LOGGING_RATIO = 0.5;

/**
 * Exercise duration in minutes from when its sets were actually completed,
 * instead of wall-clock time from starting the exercise until Finish (which
 * turned an idle draft into a 406-minute Slow Squat).
 *
 * Sums the first set's own work time plus each gap to the next completed set,
 * capping every gap at max(2 × the previous set's rest, 5 minutes). Falls back
 * to the per-set duration + rest estimate when no timestamps exist or when
 * the timed total is implausibly short.
 */
export function deriveExerciseDurationFromSets(
  sets: readonly CompletedSetLike[] | null | undefined,
  options?: { fallbackMinutes?: number },
): number {
  const rows = Array.isArray(sets) ? sets : [];
  const estimate = setsDurationMinutes(rows, options);

  const timed = rows
    .map((set) => ({ set, ms: set.completed_at ? Date.parse(set.completed_at) : NaN }))
    .filter((row) => !Number.isNaN(row.ms))
    .sort((a, b) => a.ms - b.ms);

  if (timed.length === 0) {
    return estimate;
  }

  let totalSeconds = Number(timed[0]!.set.duration) || 0;
  for (let i = 1; i < timed.length; i += 1) {
    const previous = timed[i - 1]!;
    const gapSeconds = Math.max(0, (timed[i]!.ms - previous.ms) / 1000);
    const capSeconds = Math.max(
      2 * (Number(previous.set.rest_time) || 0),
      MIN_SET_GAP_CAP_SECONDS,
    );
    totalSeconds += Math.min(gapSeconds, capSeconds);
  }

  const timedMinutes = totalSeconds / 60;
  if (timedMinutes === 0 || timedMinutes < estimate * RETRO_LOGGING_RATIO) {
    return estimate;
  }
  return timedMinutes;
}
