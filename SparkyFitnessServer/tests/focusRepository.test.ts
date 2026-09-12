import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import focusRepository from '../models/focusRepository.js';
import { getClient } from '../db/poolManager.js';

vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(),
}));

describe('focusRepository', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    // @ts-expect-error mock typing
    getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getTodaySnapshot', () => {
    it('filters recurring habits by day-of-week and recurrence end date', async () => {
      await focusRepository.getTodaySnapshot(
        'user-1',
        '2026-09-14',
        '2026-09-14',
        1 // Monday
      );

      // Calls run in parallel via Promise.all; find the recurring-habit query
      // (the one joining focus_checkins) among the four issued.
      const recurringCall = mockClient.query.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('focus_checkins')
      );
      expect(recurringCall).toBeDefined();
      const [sql, params] = recurringCall as [string, unknown[]];
      expect(sql).toContain(
        'recurrence_end_date IS NULL OR f.recurrence_end_date >= $2'
      );
      expect(sql).toContain(
        'recurrence_days_of_week IS NULL OR $3 = ANY(f.recurrence_days_of_week)'
      );
      expect(params).toEqual(['user-1', '2026-09-14', 1]);
    });
  });

  describe('deleteCheckin (undo)', () => {
    it('reports success when a check-in row was actually removed', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 'c1' }], rowCount: 1 });

      const ok = await focusRepository.deleteCheckin(
        'user-1',
        'habit-1',
        '2026-09-14'
      );

      expect(ok).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM focus_checkins'),
        ['user-1', 'habit-1', '2026-09-14']
      );
    });

    it('reports failure when there was nothing to undo', async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const ok = await focusRepository.deleteCheckin(
        'user-1',
        'habit-1',
        '2026-09-14'
      );

      expect(ok).toBe(false);
    });
  });

  describe('upsertCheckin', () => {
    it('sets completed to false when explicitly un-checked, rather than leaving it untouched', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'c1', completed: false }],
        rowCount: 1,
      });

      await focusRepository.upsertCheckin('user-1', 'habit-1', '2026-09-14', {
        completed: false,
      });

      const [, params] = mockClient.query.mock.calls[0] as [string, unknown[]];
      // data.completed ?? null must preserve an explicit `false`, not coerce
      // it to null (which would make COALESCE fall back to the old value).
      expect(params).toEqual([
        'user-1',
        'habit-1',
        '2026-09-14',
        null,
        false,
        null,
      ]);
    });
  });
});
