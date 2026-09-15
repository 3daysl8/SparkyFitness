import type { ExerciseSessionResponse } from '@workspace/shared';

/** A preset session with no exercises left in it records no training. */
function isNonEmptySession(session: ExerciseSessionResponse): boolean {
  return session.type !== 'preset' || session.exercises.length > 0;
}

export function hasLoggedWorkout(
  sessions: readonly ExerciseSessionResponse[]
): boolean {
  return sessions.some(isNonEmptySession);
}

export function summarizeWorkoutSessions(
  sessions: readonly ExerciseSessionResponse[]
) {
  const workouts = sessions.filter(isNonEmptySession);
  let durationMinutes = 0;
  let volumeKg = 0;

  for (const session of workouts) {
    durationMinutes +=
      session.type === 'preset'
        ? session.total_duration_minutes
        : session.duration_minutes;
    const exercises = session.type === 'preset' ? session.exercises : [session];
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        volumeKg += (set.weight ?? 0) * (set.reps ?? 0);
      }
    }
  }

  const first = workouts[0];
  const name =
    workouts.length === 1 && first
      ? first.type === 'preset'
        ? first.name
        : (first.name ?? first.exercise_snapshot?.name ?? 'Workout')
      : `${workouts.length} Workouts`;

  return {
    count: workouts.length,
    name,
    durationMinutes: Math.round(durationMinutes),
    volumeKg,
  };
}
