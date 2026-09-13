import { vi, beforeEach, describe, expect, it } from 'vitest';
import hydrationTotalsService from '../services/hydrationTotalsService.js';
import measurementRepository from '../models/measurementRepository.js';

vi.mock('../models/measurementRepository.js');

// Food-derived water (the add_food_water_to_intake preference folding a
// food's water content into the day's total) was hard-deleted along with the
// food domain -- food_ml is now always 0, and resolveWaterTotalsForDate no
// longer reads preferenceRepository or models/foodMisc.js at all.
describe('hydrationTotalsService.resolveWaterTotalsForDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the ledger totals with food_ml always 0', async () => {
    // @ts-expect-error TS(2339): mock helper
    measurementRepository.getWaterIntakeByDate.mockResolvedValue({
      water_ml: '250',
      manual_ml: '250',
    });

    const result = await hydrationTotalsService.resolveWaterTotalsForDate(
      'user-1',
      'user-1',
      '2026-09-05'
    );

    expect(result).toEqual({
      water_ml: 250,
      manual_ml: 250,
      ledger_ml: 250,
      food_ml: 0,
    });
  });

  it('handles no ledger row gracefully', async () => {
    // @ts-expect-error TS(2339): mock helper
    measurementRepository.getWaterIntakeByDate.mockResolvedValue(undefined);

    const result = await hydrationTotalsService.resolveWaterTotalsForDate(
      'user-1',
      'user-1',
      '2026-09-05'
    );

    expect(result).toEqual({
      water_ml: 0,
      manual_ml: 0,
      ledger_ml: 0,
      food_ml: 0,
    });
  });
});
