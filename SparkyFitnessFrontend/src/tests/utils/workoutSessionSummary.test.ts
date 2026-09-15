import type { ExerciseSessionResponse } from '@workspace/shared';
import {
  hasLoggedWorkout,
  summarizeWorkoutSessions,
} from '@/utils/workoutSessionSummary';

const exerciseEntry = (id: string) => ({
  id,
  exercise_id: `exercise-${id}`,
  exercise_snapshot: { name: `Exercise ${id}` },
  sets: [{ set_number: 1, reps: 10, weight: 50 }],
});

const presetSession = (
  id: string,
  exercises: ReturnType<typeof exerciseEntry>[]
): ExerciseSessionResponse =>
  ({
    type: 'preset',
    id,
    entry_date: '2026-09-15',
    workout_preset_id: 7,
    name: `Session ${id}`,
    total_duration_minutes: exercises.length * 10,
    exercises,
  }) as unknown as ExerciseSessionResponse;

const individualSession = (id: string): ExerciseSessionResponse =>
  ({
    type: 'individual',
    id,
    exercise_id: 'exercise-run',
    name: 'Evening Run',
    duration_minutes: 30,
    sets: [],
  }) as unknown as ExerciseSessionResponse;

describe('workoutSessionSummary', () => {
  it('counts one preset session with three exercises as one workout', () => {
    const summary = summarizeWorkoutSessions([
      presetSession('a', [
        exerciseEntry('1'),
        exerciseEntry('2'),
        exerciseEntry('3'),
      ]),
    ]);

    expect(summary.count).toBe(1);
    expect(summary.name).toBe('Session a');
    expect(summary.durationMinutes).toBe(30);
    expect(summary.volumeKg).toBe(1500);
  });

  it('does not count a preset session with no exercises', () => {
    expect(summarizeWorkoutSessions([presetSession('empty', [])]).count).toBe(
      0
    );

    const summary = summarizeWorkoutSessions([
      presetSession('empty', []),
      presetSession('real', [exerciseEntry('1')]),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.name).toBe('Session real');
    expect(summary.durationMinutes).toBe(10);
  });

  it('still counts individual entries, which have no nested exercises', () => {
    const summary = summarizeWorkoutSessions([
      individualSession('run'),
      presetSession('real', [exerciseEntry('1')]),
    ]);

    expect(summary.count).toBe(2);
    expect(summary.name).toBe('2 Workouts');
  });

  it('only lights the week-strip dot for non-empty sessions', () => {
    expect(hasLoggedWorkout([])).toBe(false);
    expect(hasLoggedWorkout([presetSession('empty', [])])).toBe(false);
    expect(
      hasLoggedWorkout([
        presetSession('empty', []),
        presetSession('real', [exerciseEntry('1')]),
      ])
    ).toBe(true);
    expect(hasLoggedWorkout([individualSession('run')])).toBe(true);
  });
});
