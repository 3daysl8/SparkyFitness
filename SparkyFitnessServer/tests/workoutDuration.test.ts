import { describe, expect, it } from 'vitest';
import {
  deriveExerciseDurationFromSets,
  MIN_SET_GAP_CAP_SECONDS,
  setsDurationMinutes,
} from '@workspace/shared';

const at = (isoSecondsFromStart: number) =>
  new Date(
    Date.UTC(2026, 8, 14, 8, 0, 0) + isoSecondsFromStart * 1000
  ).toISOString();

describe('deriveExerciseDurationFromSets', () => {
  it('falls back to the duration + rest estimate when no set has a timestamp', () => {
    const sets = [
      { duration: null, rest_time: 90 },
      { duration: null, rest_time: 90 },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(
      setsDurationMinutes(sets)
    );
  });

  it('passes fallbackMinutes through for an empty set list', () => {
    expect(deriveExerciseDurationFromSets([], { fallbackMinutes: 30 })).toBe(
      30
    );
  });

  it('sums the gaps between completed sets', () => {
    const sets = [
      { rest_time: 90, completed_at: at(0) },
      { rest_time: 90, completed_at: at(120) },
      { rest_time: 90, completed_at: at(240) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(4);
  });

  it('caps an idle gap so a draft left open for hours adds at most five minutes', () => {
    const sets = [
      { rest_time: 90, completed_at: at(0) },
      { rest_time: 90, completed_at: at(4 * 60 * 60) },
      { rest_time: 90, completed_at: at(4 * 60 * 60 + 120) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(
      (MIN_SET_GAP_CAP_SECONDS + 120) / 60
    );
  });

  it('allows a gap up to twice the previous set rest when that exceeds five minutes', () => {
    const sets = [
      { rest_time: 240, completed_at: at(0) },
      { rest_time: 240, completed_at: at(20 * 60) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(8);
  });

  it('uses the estimate when sets were ticked off in seconds after the workout', () => {
    const sets = [
      { rest_time: 60, completed_at: at(0) },
      { rest_time: 60, completed_at: at(1) },
      { rest_time: 60, completed_at: at(2) },
      { rest_time: 60, completed_at: at(3) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(4);
  });

  it("counts the first set's own work time for timed sets", () => {
    const sets = [
      { duration: 60, completed_at: at(0) },
      { duration: 60, completed_at: at(120) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(3);
  });

  it('sorts out-of-order timestamps and ignores unparseable ones', () => {
    const sets = [
      { rest_time: 90, completed_at: at(240) },
      { rest_time: 90, completed_at: 'not-a-date' },
      { rest_time: 90, completed_at: at(0) },
      { rest_time: 90, completed_at: at(120) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(4);
  });

  it('keeps the 14 Sep Slow Squat regression near its real length, not 406 minutes', () => {
    const sets = [
      { rest_time: 90, completed_at: at(0) },
      { rest_time: 90, completed_at: at(90) },
      { rest_time: 90, completed_at: at(180) },
      { rest_time: 90, completed_at: at(270) },
    ];
    expect(deriveExerciseDurationFromSets(sets)).toBe(4.5);
  });
});
