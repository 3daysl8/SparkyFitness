import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getActiveCaffeineKinetics } from '../services/caffeineKineticsService.js';
import * as foodMisc from '../models/foodMisc.js';
import * as preferenceRepo from '../models/preferenceRepository.js';
import * as timezoneLoader from '../utils/timezoneLoader.js';

describe('Caffeine Dose Window and Fallback Hierarchy', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.spyOn(timezoneLoader, 'loadUserTimezone').mockResolvedValue('UTC');
    vi.spyOn(preferenceRepo, 'getUserPreferences').mockResolvedValue({
      id: 'pref-1',
      user_id: userId,
      caffeine_half_life_hours: 5.0,
      target_bedtime: '22:30:00',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries a 3-day window (startDate = date - 2 days, endDate = date)', async () => {
    const getDosesSpy = vi
      .spyOn(foodMisc, 'getCaffeineDosesForWindow')
      .mockResolvedValue([]);

    await getActiveCaffeineKinetics(userId, { date: '2026-09-05' });

    expect(getDosesSpy).toHaveBeenCalledWith(
      userId,
      '2026-09-03',
      '2026-09-05'
    );
  });

  // The entry_time/meal_default_time fallback chain below existed for the
  // food-sourced branch of getCaffeineDosesForWindow (food_entries joined to
  // meal_types/user_meal_visibilities for an untimed entry's default time).
  // Food/nutrition tracking was hard-deleted from this fork, so that branch
  // is gone -- every dose is now a supplement, which always carries a precise
  // `taken_at` timestamp (see 'includes supplement doses' below) and never
  // exercises the entry_time/meal_default_time/noon fallbacks.

  it('includes supplement doses with taken_at timestamp', async () => {
    vi.spyOn(foodMisc, 'getCaffeineDosesForWindow').mockResolvedValue([
      {
        source: 'supplement',
        entry_date: '2026-09-05',
        entry_time: null,
        meal_default_time: null,
        taken_at: new Date('2026-09-05T06:00:00.000Z'),
        caffeine_mg: 200,
        name: 'Pre-workout',
      },
    ]);

    const result = await getActiveCaffeineKinetics(userId, {
      date: '2026-09-05',
      now: '2026-09-05T11:00:00.000Z', // 5 hours later -> 1 half life
    });

    expect(result.doses).toHaveLength(1);
    expect(result.doses[0].at).toBe('2026-09-05T06:00:00.000Z');
    expect(result.doses[0].is_estimated).toBe(false);
    expect(result.active_mg_now).toBe(100);
  });
});
