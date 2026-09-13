import measurementRepository from '../models/measurementRepository.js';

interface WaterTotals {
  water_ml: number;
  manual_ml: number;
  ledger_ml: number;
  food_ml: number;
}

/**
 * Single owner of the water-total formula (#1557, #1629): the ledger total
 * (water_intake_entries, all sources).
 *
 * Used to also add food-derived water when the user opted in via
 * add_food_water_to_intake; food/nutrition tracking was hard-deleted from
 * this fork, so that preference is now inert and `food_ml` is always 0.
 * Kept as a field (rather than dropped from the response shape) since
 * callers already read it defensively.
 *
 * _actingUserId is accepted (not used below) to keep this call's signature
 * stable for callers that need it for permission checks upstream -- the
 * repository reads here are already scoped to targetUserId via RLS.
 */
async function resolveWaterTotalsForDate(
  targetUserId: string,
  _actingUserId: string,
  date: string
): Promise<WaterTotals> {
  const ledgerResult = await measurementRepository.getWaterIntakeByDate(
    targetUserId,
    date
  );

  const ledgerMl = parseFloat(ledgerResult?.water_ml) || 0;
  const manualMl = parseFloat(ledgerResult?.manual_ml) || 0;

  return {
    water_ml: ledgerMl,
    manual_ml: manualMl,
    ledger_ml: ledgerMl,
    food_ml: 0,
  };
}

export { resolveWaterTotalsForDate };
export default { resolveWaterTotalsForDate };
