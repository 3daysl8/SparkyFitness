import { beforeEach, describe, expect, it, vi } from 'vitest';
import preferenceService from '../services/preferenceService.js';
import preferenceRepository from '../models/preferenceRepository.js';

vi.mock('../models/preferenceRepository.js');

describe('weekly workout goal preference validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(preferenceRepository.updateUserPreferences).mockResolvedValue({
      user_id: 'user-1',
    });
  });

  it.each(['any_strength', 'explicit_only'])(
    'accepts a valid weekly_strength_counting value %s',
    async (value) => {
      await expect(
        preferenceService.updateUserPreferences('user-1', 'user-1', {
          weekly_strength_counting: value,
        })
      ).resolves.toEqual({ user_id: 'user-1' });
    }
  );

  it('rejects an unknown weekly_strength_counting value with a 400', async () => {
    await expect(
      preferenceService.updateUserPreferences('user-1', 'user-1', {
        weekly_strength_counting: 'sometimes',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([1, 5, 100])(
    'accepts a positive integer weekly_workout_target_total %s',
    async (value) => {
      await expect(
        preferenceService.updateUserPreferences('user-1', 'user-1', {
          weekly_workout_target_total: value,
        })
      ).resolves.toEqual({ user_id: 'user-1' });
    }
  );

  it('accepts null to clear a nullable target', async () => {
    await expect(
      preferenceService.updateUserPreferences('user-1', 'user-1', {
        weekly_workout_target_strength: null,
      })
    ).resolves.toEqual({ user_id: 'user-1' });
  });

  it.each([0, -1, 1.5])(
    'rejects a non-positive-integer weekly_workout_target_cardio %s',
    async (value) => {
      await expect(
        preferenceService.updateUserPreferences('user-1', 'user-1', {
          weekly_workout_target_cardio: value,
        })
      ).rejects.toMatchObject({ status: 400 });
    }
  );

  it('accepts a positive integer weekly_cardio_min_minutes', async () => {
    await expect(
      preferenceService.updateUserPreferences('user-1', 'user-1', {
        weekly_cardio_min_minutes: 30,
      })
    ).resolves.toEqual({ user_id: 'user-1' });
  });

  it('rejects a null weekly_cardio_min_minutes (NOT NULL column, unlike the nullable targets)', async () => {
    await expect(
      preferenceService.updateUserPreferences('user-1', 'user-1', {
        weekly_cardio_min_minutes: null,
      } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a zero weekly_cardio_min_minutes', async () => {
    await expect(
      preferenceService.updateUserPreferences('user-1', 'user-1', {
        weekly_cardio_min_minutes: 0,
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});
