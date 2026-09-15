import { describe, expect, it } from 'vitest';
import {
  checkEntryPlausibility,
  checkSessionPlausibility,
  MAX_ENTRY_CALORIES,
  MAX_ENTRY_DURATION_MINUTES,
  plausibilityKindFromModality,
  presetSessionExerciseRequestSchema,
  createExerciseEntryRequestSchema,
} from '@workspace/shared';

const EXERCISE_ID = '11111111-1111-4111-8111-111111111111';

describe('checkEntryPlausibility', () => {
  it('returns no warnings for a normal strength entry', () => {
    expect(
      checkEntryPlausibility({
        duration_minutes: 12.7,
        calories_burned: 88,
        kind: 'strength',
      })
    ).toEqual([]);
  });

  it('flags the original 406-minute / 2,181 kcal Slow Squat entry', () => {
    const codes = checkEntryPlausibility({
      duration_minutes: 406,
      calories_burned: 2181.5,
      kind: 'strength',
    }).map((w) => w.code);
    expect(codes).toEqual(['entry_duration_high', 'entry_calories_high']);
  });

  it('flags stale calories left behind after duration was edited down', () => {
    const codes = checkEntryPlausibility({
      duration_minutes: 6,
      calories_burned: 2181.5,
      kind: 'strength',
    }).map((w) => w.code);
    expect(codes).toEqual(['entry_calories_high', 'calorie_rate_high']);
  });

  it('uses a longer duration threshold for cardio than strength', () => {
    expect(
      checkEntryPlausibility({ duration_minutes: 200, kind: 'cardio' })
    ).toEqual([]);
    expect(
      checkEntryPlausibility({ duration_minutes: 200, kind: 'strength' }).map(
        (w) => w.code
      )
    ).toEqual(['entry_duration_high']);
  });

  it('defaults to the "other" threshold when kind is omitted', () => {
    expect(checkEntryPlausibility({ duration_minutes: 180 })).toEqual([]);
    expect(checkEntryPlausibility({ duration_minutes: 181 })).toHaveLength(1);
  });
});

describe('checkSessionPlausibility', () => {
  it('tags per-entry warnings with their index and adds a session total warning', () => {
    const warnings = checkSessionPlausibility([
      { duration_minutes: 100, kind: 'strength' },
      { duration_minutes: 150, kind: 'strength' },
    ]);
    expect(warnings).toEqual([
      {
        code: 'entry_duration_high',
        value: 150,
        threshold: 120,
        entryIndex: 1,
      },
      { code: 'session_duration_high', value: 250, threshold: 240 },
    ]);
  });
});

describe('plausibilityKindFromModality', () => {
  it.each([
    ['duration_distance', 'cardio'],
    ['weight_reps', 'strength'],
    ['reps_only', 'strength'],
    ['duration', 'other'],
    [null, 'other'],
  ] as const)('%s -> %s', (modality, kind) => {
    expect(plausibilityKindFromModality(modality)).toBe(kind);
  });
});

describe('request schema hard caps', () => {
  it('rejects a playback exercise above the duration or calorie cap', () => {
    expect(
      presetSessionExerciseRequestSchema.safeParse({
        exercise_id: EXERCISE_ID,
        duration_minutes: MAX_ENTRY_DURATION_MINUTES + 1,
      }).success
    ).toBe(false);
    expect(
      presetSessionExerciseRequestSchema.safeParse({
        exercise_id: EXERCISE_ID,
        duration_minutes: 10,
        calories_burned: MAX_ENTRY_CALORIES + 1,
      }).success
    ).toBe(false);
  });

  it('accepts values at the caps', () => {
    expect(
      presetSessionExerciseRequestSchema.safeParse({
        exercise_id: EXERCISE_ID,
        duration_minutes: MAX_ENTRY_DURATION_MINUTES,
        calories_burned: MAX_ENTRY_CALORIES,
      }).success
    ).toBe(true);
  });

  it('rejects a manual entry above the duration or calorie cap', () => {
    const base = { exercise_id: EXERCISE_ID, entry_date: '2026-09-14' };
    expect(
      createExerciseEntryRequestSchema.safeParse({
        ...base,
        duration_minutes: MAX_ENTRY_DURATION_MINUTES + 1,
      }).success
    ).toBe(false);
    expect(
      createExerciseEntryRequestSchema.safeParse({
        ...base,
        calories_burned: MAX_ENTRY_CALORIES + 1,
      }).success
    ).toBe(false);
  });
});
