import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWeeklyWorkoutGoalProgress } from '../services/weeklyWorkoutGoalService.js';
import preferenceRepository from '../models/preferenceRepository.js';
import weeklyWorkoutGoalRepository from '../models/weeklyWorkoutGoalRepository.js';

vi.mock('../models/preferenceRepository.js', () => ({
  default: {
    getUserPreferences: vi.fn(),
  },
}));

vi.mock('../models/weeklyWorkoutGoalRepository.js', () => ({
  default: {
    getWeeklySessions: vi.fn(),
  },
}));

const prefRepo = preferenceRepository as unknown as {
  getUserPreferences: ReturnType<typeof vi.fn>;
};
const weeklyRepo = weeklyWorkoutGoalRepository as unknown as {
  getWeeklySessions: ReturnType<typeof vi.fn>;
};

// A basic preferences row with no weekly goals set and Sunday-start weeks.
const NO_GOALS_PREFS = {
  first_day_of_week: 0,
  weekly_workout_target_total: null,
  weekly_workout_target_strength: null,
  weekly_workout_target_cardio: null,
  weekly_cardio_min_minutes: 20,
  weekly_strength_counting: 'any_strength',
};

function session(overrides: {
  session_workout_type?: string | null;
  preset_workout_type?: string | null;
  exercises?: Array<{
    workout_type?: string | null;
    modality?: string | null;
    duration_minutes?: number | null;
  }>;
}) {
  return {
    id: 'session-id',
    session_workout_type: overrides.session_workout_type ?? null,
    preset_workout_type: overrides.preset_workout_type ?? null,
    exercises: (overrides.exercises ?? []).map((exercise) => ({
      workout_type: exercise.workout_type ?? null,
      modality: exercise.modality ?? null,
      duration_minutes: exercise.duration_minutes ?? null,
    })),
  };
}

describe('weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null met flags and zero counts when no goals are set and no sessions exist', async () => {
    prefRepo.getUserPreferences.mockResolvedValue(NO_GOALS_PREFS);
    weeklyRepo.getWeeklySessions.mockResolvedValue([]);

    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');

    expect(result.target_total).toBeNull();
    expect(result.target_strength).toBeNull();
    expect(result.target_cardio).toBeNull();
    expect(result.total_met).toBeNull();
    expect(result.strength_met).toBeNull();
    expect(result.cardio_met).toBeNull();
    expect(result.completed_total).toBe(0);
    expect(result.completed_strength).toBe(0);
    expect(result.completed_cardio).toBe(0);
    expect(result.cardio_min_minutes).toBe(20);
    expect(result.strength_counting).toBe('any_strength');
  });

  it('reports total target independently met or unmet', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({ session_workout_type: 'mobility' }),
      session({ session_workout_type: 'recovery' }),
    ]);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_total: 2,
    });
    const met = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(met.completed_total).toBe(2);
    expect(met.total_met).toBe(true);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_total: 3,
    });
    const unmet = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(unmet.completed_total).toBe(2);
    expect(unmet.total_met).toBe(false);
  });

  it('reports strength target independently met or unmet, classified via the session tag', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({ session_workout_type: 'strength' }),
    ]);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_strength: 1,
    });
    const met = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(met.completed_strength).toBe(1);
    expect(met.strength_met).toBe(true);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_strength: 2,
    });
    const unmet = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(unmet.completed_strength).toBe(1);
    expect(unmet.strength_met).toBe(false);
  });

  it('reports cardio target independently met or unmet when duration clears the minimum', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({
        session_workout_type: 'cardio',
        exercises: [{ duration_minutes: 25 }],
      }),
    ]);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_cardio: 1,
      weekly_cardio_min_minutes: 20,
    });
    const met = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(met.completed_cardio).toBe(1);
    expect(met.cardio_met).toBe(true);

    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_cardio: 2,
      weekly_cardio_min_minutes: 20,
    });
    const unmet = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');
    expect(unmet.completed_cardio).toBe(1);
    expect(unmet.cardio_met).toBe(false);
  });

  it('does not count a cardio session below weekly_cardio_min_minutes, but still counts it toward the total', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({
        session_workout_type: 'cardio',
        exercises: [{ duration_minutes: 15 }],
      }),
    ]);
    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_cardio: 1,
      weekly_cardio_min_minutes: 20,
    });

    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');

    expect(result.completed_cardio).toBe(0);
    expect(result.cardio_met).toBe(false);
    // Type-agnostic total still counts the session regardless of classification.
    expect(result.completed_total).toBe(1);
  });

  it('any_strength counts an untagged weight_reps session as strength via modality fallback', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({
        exercises: [{ modality: 'weight_reps', duration_minutes: 30 }],
      }),
    ]);
    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_strength: 1,
      weekly_strength_counting: 'any_strength',
    });

    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');

    expect(result.completed_strength).toBe(1);
    expect(result.strength_met).toBe(true);
    expect(result.completed_total).toBe(1);
  });

  it('explicit_only refuses to classify the same untagged session as strength off modality alone', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([
      session({
        exercises: [{ modality: 'weight_reps', duration_minutes: 30 }],
      }),
    ]);
    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      weekly_workout_target_strength: 1,
      weekly_strength_counting: 'explicit_only',
    });

    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-16');

    expect(result.completed_strength).toBe(0);
    expect(result.strength_met).toBe(false);
    // The session is unclassifiable, not nonexistent -- it still counts toward
    // the type-agnostic total.
    expect(result.completed_total).toBe(1);
    expect(result.strength_counting).toBe('explicit_only');
  });

  it('computes the week boundary from first_day_of_week and passes it straight through to the repository', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([]);
    prefRepo.getUserPreferences.mockResolvedValue({
      ...NO_GOALS_PREFS,
      first_day_of_week: 1, // Monday
    });

    // 2026-09-05 is a Saturday (same known-good date as alcoholWeekService.test.ts).
    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-05');

    expect(weeklyRepo.getWeeklySessions).toHaveBeenCalledWith(
      'user-1',
      '2026-08-31',
      '2026-09-06'
    );
    expect(result.week_start).toBe('2026-08-31');
    expect(result.week_end).toBe('2026-09-06');
  });

  it('defaults first_day_of_week to Sunday (0) when preferences are missing it', async () => {
    weeklyRepo.getWeeklySessions.mockResolvedValue([]);
    prefRepo.getUserPreferences.mockResolvedValue(undefined);

    // 2026-09-05 is a Saturday; a Sunday-start week ending on it starts 2026-08-30.
    const result = await getWeeklyWorkoutGoalProgress('user-1', '2026-09-05');

    expect(result.week_start).toBe('2026-08-30');
    expect(result.week_end).toBe('2026-09-05');
    expect(result.cardio_min_minutes).toBe(20);
    expect(result.strength_counting).toBe('any_strength');
  });
});
