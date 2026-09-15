import { vi, beforeEach, describe, expect, it } from 'vitest';
import plannedWorkoutRepository from '../models/plannedWorkoutRepository.js';
import plannedWorkoutService from '../services/plannedWorkoutService.js';
import type { PlannedWorkoutRow } from '../services/plannedWorkoutService.types.js';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
  getSystemClient: vi.fn(),
}));
vi.mock('../models/plannedWorkoutRepository.js', () => ({
  default: {
    listPlannedWorkouts: vi.fn(),
    getDayView: vi.fn(),
    getPlannedWorkoutById: vi.fn(),
    createPlannedWorkout: vi.fn(),
    updatePlannedWorkout: vi.fn(),
    startPlannedWorkout: vi.fn(),
    revertPlannedWorkout: vi.fn(),
    skipPlannedWorkout: vi.fn(),
    completePlannedWorkoutWithSession: vi.fn(),
    deletePlannedWorkout: vi.fn(),
    syncTemplateGeneratedRows: vi.fn(),
    deletePlannedWorkoutsByTemplateId: vi.fn(),
  },
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));

const USER_ID = 'user-1';
const PLAN_ID = 'plan-1';
const TODAY = '2026-07-10';

const baseRow: PlannedWorkoutRow = {
  id: PLAN_ID,
  user_id: USER_ID,
  planned_date: '2026-07-10',
  planned_time: null,
  duration_estimate_minutes: null,
  title: 'Leg Day',
  workout_preset_id: null,
  exercise_id: null,
  workout_type: null,
  notes: null,
  status: 'planned',
  started_at: null,
  completed_at: null,
  completed_session_id: null,
  origin: 'manual',
  template_id: null,
  assignment_id: null,
  generated_for_date: null,
  slot: null,
  user_modified: false,
  dismissed_at: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

describe('plannedWorkoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('is_missed derivation', () => {
    it('marks a planned row from a past date as missed', async () => {
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({
        ...baseRow,
        planned_date: '2026-07-05',
        status: 'planned',
      });

      const result = await plannedWorkoutService.getPlannedWorkoutById(
        USER_ID,
        PLAN_ID,
        TODAY
      );

      expect(result.is_missed).toBe(true);
    });

    it('does not mark a completed row from a past date as missed', async () => {
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({
        ...baseRow,
        planned_date: '2026-07-05',
        status: 'completed',
      });

      const result = await plannedWorkoutService.getPlannedWorkoutById(
        USER_ID,
        PLAN_ID,
        TODAY
      );

      expect(result.is_missed).toBe(false);
    });

    it('does not mark a future planned row as missed', async () => {
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({
        ...baseRow,
        planned_date: '2026-07-15',
        status: 'planned',
      });

      const result = await plannedWorkoutService.getPlannedWorkoutById(
        USER_ID,
        PLAN_ID,
        TODAY
      );

      expect(result.is_missed).toBe(false);
    });
  });

  describe('getPlannedWorkoutById', () => {
    it('throws 404 when the repository finds nothing', async () => {
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue(null);

      await expect(
        plannedWorkoutService.getPlannedWorkoutById(USER_ID, PLAN_ID, TODAY)
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updatePlannedWorkout', () => {
    it('returns the updated row on success', async () => {
      vi.mocked(
        plannedWorkoutRepository.updatePlannedWorkout
      ).mockResolvedValue({ ...baseRow, title: 'New Title' });

      const result = await plannedWorkoutService.updatePlannedWorkout(
        USER_ID,
        PLAN_ID,
        { title: 'New Title' },
        TODAY
      );

      expect(result.title).toBe('New Title');
    });

    it('throws 404 when the plan does not exist', async () => {
      vi.mocked(
        plannedWorkoutRepository.updatePlannedWorkout
      ).mockResolvedValue(null);
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue(null);

      await expect(
        plannedWorkoutService.updatePlannedWorkout(
          USER_ID,
          PLAN_ID,
          { title: 'New Title' },
          TODAY
        )
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 with the current status when the plan is no longer planned', async () => {
      vi.mocked(
        plannedWorkoutRepository.updatePlannedWorkout
      ).mockResolvedValue(null);
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({ ...baseRow, status: 'completed' });

      await expect(
        plannedWorkoutService.updatePlannedWorkout(
          USER_ID,
          PLAN_ID,
          { title: 'New Title' },
          TODAY
        )
      ).rejects.toMatchObject({
        status: 409,
        message: 'Cannot edit a plan that is already completed.',
      });
    });
  });

  describe('movePlannedWorkout', () => {
    it('delegates to updatePlannedWorkout with the date/time patch', async () => {
      vi.mocked(
        plannedWorkoutRepository.updatePlannedWorkout
      ).mockResolvedValue({ ...baseRow, planned_date: '2026-07-20' });

      const result = await plannedWorkoutService.movePlannedWorkout(
        USER_ID,
        PLAN_ID,
        '2026-07-20',
        '18:00',
        TODAY
      );

      expect(
        plannedWorkoutRepository.updatePlannedWorkout
      ).toHaveBeenCalledWith(USER_ID, PLAN_ID, {
        planned_date: '2026-07-20',
        planned_time: '18:00',
      });
      expect(result.planned_date).toBe('2026-07-20');
    });
  });

  describe('createPlannedWorkout', () => {
    it('defaults origin to manual when not given', async () => {
      vi.mocked(
        plannedWorkoutRepository.createPlannedWorkout
      ).mockResolvedValue(baseRow);

      await plannedWorkoutService.createPlannedWorkout(
        USER_ID,
        { planned_date: '2026-07-10', title: 'Leg Day' },
        TODAY
      );

      expect(
        plannedWorkoutRepository.createPlannedWorkout
      ).toHaveBeenCalledWith(
        USER_ID,
        { planned_date: '2026-07-10', title: 'Leg Day' },
        'manual'
      );
    });

    it('passes through an explicit coach origin', async () => {
      vi.mocked(
        plannedWorkoutRepository.createPlannedWorkout
      ).mockResolvedValue({ ...baseRow, origin: 'coach' });

      const result = await plannedWorkoutService.createPlannedWorkout(
        USER_ID,
        { planned_date: '2026-07-10', title: 'Leg Day' },
        TODAY,
        'coach'
      );

      expect(
        plannedWorkoutRepository.createPlannedWorkout
      ).toHaveBeenCalledWith(
        USER_ID,
        { planned_date: '2026-07-10', title: 'Leg Day' },
        'coach'
      );
      expect(result.origin).toBe('coach');
    });
  });

  describe('startPlannedWorkout / revertPlannedWorkout / skipPlannedWorkout', () => {
    it('throws 409 when starting a plan that is not in the planned state', async () => {
      vi.mocked(plannedWorkoutRepository.startPlannedWorkout).mockResolvedValue(
        null
      );
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({ ...baseRow, status: 'skipped' });

      await expect(
        plannedWorkoutService.startPlannedWorkout(USER_ID, PLAN_ID, TODAY)
      ).rejects.toMatchObject({
        status: 409,
        message: 'Cannot start a plan that is already skipped.',
      });
    });

    it('reverts a started plan back to planned', async () => {
      vi.mocked(
        plannedWorkoutRepository.revertPlannedWorkout
      ).mockResolvedValue({ ...baseRow, status: 'planned', started_at: null });

      const result = await plannedWorkoutService.revertPlannedWorkout(
        USER_ID,
        PLAN_ID,
        TODAY
      );

      expect(result.status).toBe('planned');
      expect(
        plannedWorkoutRepository.revertPlannedWorkout
      ).toHaveBeenCalledWith(USER_ID, PLAN_ID);
    });

    it('throws 404 when reverting a plan that does not exist', async () => {
      vi.mocked(
        plannedWorkoutRepository.revertPlannedWorkout
      ).mockResolvedValue(null);
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue(null);

      await expect(
        plannedWorkoutService.revertPlannedWorkout(USER_ID, PLAN_ID, TODAY)
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 when reverting a plan that is not currently started', async () => {
      vi.mocked(
        plannedWorkoutRepository.revertPlannedWorkout
      ).mockResolvedValue(null);
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({ ...baseRow, status: 'planned' });

      await expect(
        plannedWorkoutService.revertPlannedWorkout(USER_ID, PLAN_ID, TODAY)
      ).rejects.toMatchObject({
        status: 409,
        message: 'Cannot revert a plan that is already planned.',
      });
    });

    it('throws 409 when skipping an already-completed plan', async () => {
      vi.mocked(plannedWorkoutRepository.skipPlannedWorkout).mockResolvedValue(
        null
      );
      vi.mocked(
        plannedWorkoutRepository.getPlannedWorkoutById
      ).mockResolvedValue({ ...baseRow, status: 'completed' });

      await expect(
        plannedWorkoutService.skipPlannedWorkout(USER_ID, PLAN_ID, TODAY)
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('completePlannedWorkout', () => {
    it.each([
      ['not_found', 404],
      ['future', 400],
      ['already_linked', 409],
      ['session_not_found', 404],
    ] as const)('maps outcome %s to status %i', async (outcome, status) => {
      vi.mocked(
        plannedWorkoutRepository.completePlannedWorkoutWithSession
      ).mockResolvedValue({ outcome });

      await expect(
        plannedWorkoutService.completePlannedWorkout(
          USER_ID,
          PLAN_ID,
          'session-1',
          TODAY
        )
      ).rejects.toMatchObject({ status });
    });

    it('returns the completed row on success', async () => {
      vi.mocked(
        plannedWorkoutRepository.completePlannedWorkoutWithSession
      ).mockResolvedValue({
        outcome: 'completed',
        row: { ...baseRow, status: 'completed' },
      });

      const result = await plannedWorkoutService.completePlannedWorkout(
        USER_ID,
        PLAN_ID,
        'session-1',
        TODAY
      );

      expect(result.status).toBe('completed');
      expect(result.is_missed).toBe(false);
    });
  });

  describe('deletePlannedWorkout', () => {
    it.each([
      ['deleted', 'Planned workout deleted.'],
      ['dismissed', 'Planned workout dismissed.'],
    ] as const)(
      'returns a message for outcome %s',
      async (outcome, message) => {
        vi.mocked(
          plannedWorkoutRepository.deletePlannedWorkout
        ).mockResolvedValue({ outcome } as never);

        const result = await plannedWorkoutService.deletePlannedWorkout(
          USER_ID,
          PLAN_ID
        );

        expect(result).toEqual({ message });
      }
    );

    it('throws 404 when not found', async () => {
      vi.mocked(
        plannedWorkoutRepository.deletePlannedWorkout
      ).mockResolvedValue({ outcome: 'not_found' });

      await expect(
        plannedWorkoutService.deletePlannedWorkout(USER_ID, PLAN_ID)
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 with the repository reason when refused', async () => {
      vi.mocked(
        plannedWorkoutRepository.deletePlannedWorkout
      ).mockResolvedValue({
        outcome: 'refused',
        reason: 'A completed plan cannot be deleted.',
      });

      await expect(
        plannedWorkoutService.deletePlannedWorkout(USER_ID, PLAN_ID)
      ).rejects.toMatchObject({
        status: 409,
        message: 'A completed plan cannot be deleted.',
      });
    });
  });
});
