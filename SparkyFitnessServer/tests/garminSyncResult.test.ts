import { describe, expect, it } from 'vitest';
import { getGarminSyncPhaseErrors } from '../services/garminSyncResult.js';

// Garmin's nutrition-diary sync phase was hard-deleted along with the food
// domain (Ouroboros Life restructure): GARMIN_SYNC_PHASES is now just
// ['health', 'activities'], so a stray 'nutrition' key in the result object
// is no longer inspected for errors at all.
describe('getGarminSyncPhaseErrors', () => {
  it('returns phases with top-level sync errors', () => {
    const result = {
      health: { error: 'health unavailable' },
      activities: { processedEntries: 2 },
    };

    expect(getGarminSyncPhaseErrors(result)).toEqual(['health']);
  });

  it('does not treat nested processing errors as phase failures', () => {
    const result = {
      health: { processedEntries: 1 },
      activities: { errors: [{ message: 'one activity skipped' }] },
    };

    expect(getGarminSyncPhaseErrors(result)).toEqual([]);
  });

  it('treats partialErrors as phase failures to prevent advancing last_sync_at on incomplete syncs', () => {
    const result = {
      health: {
        processedEntries: 5,
        partialErrors: ['[2026-08-01..2026-08-07]: ECONNRESET'],
      },
      activities: { processedEntries: 10 },
    };

    expect(getGarminSyncPhaseErrors(result)).toEqual(['health']);
  });

  it('ignores a stray nutrition key (the phase no longer exists)', () => {
    const result = {
      health: { processedEntries: 1 },
      activities: { processedEntries: 2 },
      nutrition: { error: 'should be ignored' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    expect(getGarminSyncPhaseErrors(result)).toEqual([]);
  });
});
