import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/plannedWorkoutService.js', () => ({
  default: {
    listPlannedWorkouts: vi.fn(),
    getDayView: vi.fn(),
    getPlannedWorkoutById: vi.fn(),
    createPlannedWorkout: vi.fn(),
    updatePlannedWorkout: vi.fn(),
    movePlannedWorkout: vi.fn(),
    startPlannedWorkout: vi.fn(),
    revertPlannedWorkout: vi.fn(),
    completePlannedWorkout: vi.fn(),
    skipPlannedWorkout: vi.fn(),
    deletePlannedWorkout: vi.fn(),
  },
}));

vi.mock('../models/workoutPresetRepository.js', () => ({
  default: {
    getWorkoutPresetByName: vi.fn(),
  },
}));

vi.mock('../ai/tools/exerciseTools.js', () => ({
  findExerciseByExactName: vi.fn(),
}));

vi.mock('../config/logging.js', () => ({
  log: vi.fn(),
}));

import plannedWorkoutService from '../services/plannedWorkoutService.js';
import workoutPresetRepository from '../models/workoutPresetRepository.js';
import { findExerciseByExactName } from '../ai/tools/exerciseTools.js';
import { buildPlannedWorkoutTools } from '../ai/tools/plannedWorkoutTools.js';

const opts = { toolCallId: 'tc-1', messages: [] };

const USER_ID = 'user-1';
const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const DB_ERROR_TEXT =
  'Error [DB_ERROR]: A database error occurred.\n\nSuggestion: Do NOT retry the same call — it will fail the same way. Tell the user what failed and stop.';

const svc = plannedWorkoutService as unknown as {
  listPlannedWorkouts: ReturnType<typeof vi.fn>;
  getDayView: ReturnType<typeof vi.fn>;
  getPlannedWorkoutById: ReturnType<typeof vi.fn>;
  createPlannedWorkout: ReturnType<typeof vi.fn>;
  updatePlannedWorkout: ReturnType<typeof vi.fn>;
  movePlannedWorkout: ReturnType<typeof vi.fn>;
  startPlannedWorkout: ReturnType<typeof vi.fn>;
  revertPlannedWorkout: ReturnType<typeof vi.fn>;
  completePlannedWorkout: ReturnType<typeof vi.fn>;
  skipPlannedWorkout: ReturnType<typeof vi.fn>;
  deletePlannedWorkout: ReturnType<typeof vi.fn>;
};

const presetRepo = workoutPresetRepository as unknown as {
  getWorkoutPresetByName: ReturnType<typeof vi.fn>;
};

const findExerciseMock = findExerciseByExactName as unknown as ReturnType<
  typeof vi.fn
>;

const BASE_ROW = {
  id: PLAN_ID,
  planned_date: '2026-07-10',
  planned_time: null,
  duration_estimate_minutes: null,
  title: 'Leg Day',
  workout_preset_id: null,
  exercise_id: null,
  workout_type: null,
  notes: null,
  status: 'planned' as const,
  is_missed: false,
  started_at: null,
  completed_at: null,
  completed_session_id: null,
};

function getTool() {
  const tools = buildPlannedWorkoutTools(USER_ID, 'UTC');
  return tools.sparky_manage_planned_workouts;
}

describe('sparky_manage_planned_workouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Today is 2026-07-10 in UTC.
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('list_planned', () => {
    it('defaults to a 14-day window starting today (inferred from {})', async () => {
      svc.listPlannedWorkouts.mockResolvedValue([]);
      const result = await getTool().execute!({}, opts);
      expect(svc.listPlannedWorkouts).toHaveBeenCalledWith(
        USER_ID,
        '2026-07-10',
        '2026-07-23',
        '2026-07-10'
      );
      expect(result).toBe(
        '# Planned Workouts: 2026-07-10 to 2026-07-23\n\nNo results found.'
      );
    });

    it('lists rows in the given range', async () => {
      svc.listPlannedWorkouts.mockResolvedValue([
        { ...BASE_ROW, title: 'Push Day', planned_time: '18:00' },
      ]);
      const result = await getTool().execute!(
        {
          action: 'list_planned',
          start_date: '2026-07-01',
          end_date: '2026-07-31',
        },
        opts
      );
      expect(result).toBe(
        `# Planned Workouts: 2026-07-01 to 2026-07-31\n\n**Push Day** (planned) at 18:00 — 2026-07-10\n  ID: ${PLAN_ID}`
      );
    });

    it('rejects a range wider than 62 days', async () => {
      const result = await getTool().execute!(
        {
          action: 'list_planned',
          start_date: '2026-07-01',
          end_date: '2026-12-01',
        },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(result).toContain('62 days');
      expect(svc.listPlannedWorkouts).not.toHaveBeenCalled();
    });
  });

  describe('get_day', () => {
    it('defaults date to today and shows just for_date when nothing is missed', async () => {
      svc.getDayView.mockResolvedValue({ for_date: [BASE_ROW], missed: [] });
      const result = await getTool().execute!({ action: 'get_day' }, opts);
      expect(svc.getDayView).toHaveBeenCalledWith(
        USER_ID,
        '2026-07-10',
        '2026-07-10'
      );
      expect(result).toBe(
        `# Planned for 2026-07-10\n\n**Leg Day** (planned) — 2026-07-10\n  ID: ${PLAN_ID}`
      );
    });

    it('appends a missed section when there are missed workouts', async () => {
      svc.getDayView.mockResolvedValue({
        for_date: [],
        missed: [
          {
            ...BASE_ROW,
            id: 'missed-1',
            is_missed: true,
            planned_date: '2026-07-05',
          },
        ],
      });
      const result = await getTool().execute!(
        { action: 'get_day', date: '2026-07-10' },
        opts
      );
      expect(result).toContain('# Planned for 2026-07-10\n\nNo results found.');
      expect(result).toContain('# Missed — needs Move or Skip');
      expect(result).toContain('**Leg Day** (missed) — 2026-07-05');
      expect(result).toContain('ID: missed-1');
    });
  });

  describe('create', () => {
    it('creates a bare-title plan with neither preset nor exercise', async () => {
      svc.createPlannedWorkout.mockResolvedValue(BASE_ROW);
      const result = await getTool().execute!(
        { action: 'create', planned_date: '2026-07-10', title: 'Leg Day' },
        opts
      );
      expect(svc.createPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        {
          planned_date: '2026-07-10',
          planned_time: null,
          duration_estimate_minutes: null,
          title: 'Leg Day',
          workout_preset_id: null,
          exercise_id: null,
          workout_type: null,
          notes: null,
        },
        '2026-07-10',
        'coach'
      );
      expect(result).toContain('# Planned workout created');
      expect(result).toContain(`id: ${PLAN_ID}`);
      expect(result).toContain('title: Leg Day');
    });

    it('resolves a workout preset by name', async () => {
      presetRepo.getWorkoutPresetByName.mockResolvedValue({ id: 11 });
      svc.createPlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        workout_preset_id: 11,
      });
      await getTool().execute!(
        {
          action: 'create',
          planned_date: '2026-07-10',
          title: 'Push Day',
          workout_preset_name: 'Upper Body A',
        },
        opts
      );
      expect(presetRepo.getWorkoutPresetByName).toHaveBeenCalledWith(
        USER_ID,
        'Upper Body A'
      );
      expect(svc.createPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ workout_preset_id: 11, exercise_id: null }),
        '2026-07-10',
        'coach'
      );
    });

    it('resolves an exercise by name', async () => {
      findExerciseMock.mockResolvedValue({ id: 'resolved-uuid' });
      svc.createPlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        exercise_id: 'resolved-uuid',
      });
      await getTool().execute!(
        {
          action: 'create',
          planned_date: '2026-07-10',
          title: 'Squats',
          exercise_name: 'Squats',
        },
        opts
      );
      expect(findExerciseMock).toHaveBeenCalledWith(USER_ID, 'Squats');
      expect(svc.createPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          workout_preset_id: null,
          exercise_id: 'resolved-uuid',
        }),
        '2026-07-10',
        'coach'
      );
    });

    it('rejects both a preset and an exercise given together', async () => {
      const result = await getTool().execute!(
        {
          action: 'create',
          planned_date: '2026-07-10',
          title: 'Leg Day',
          workout_preset_id: 9,
          exercise_id: '11111111-1111-1111-1111-111111111111',
        },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(svc.createPlannedWorkout).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for an unknown preset name', async () => {
      presetRepo.getWorkoutPresetByName.mockResolvedValue(null);
      const result = await getTool().execute!(
        {
          action: 'create',
          planned_date: '2026-07-10',
          title: 'Push Day',
          workout_preset_name: 'Nonexistent',
        },
        opts
      );
      expect(result).toContain('Error [NOT_FOUND]');
      expect(svc.createPlannedWorkout).not.toHaveBeenCalled();
    });

    it('rejects a missing title (VALIDATION)', async () => {
      const result = await getTool().execute!(
        { action: 'create', planned_date: '2026-07-10' },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(svc.createPlannedWorkout).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('patches only the fields given', async () => {
      svc.updatePlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        title: 'New Title',
      });
      const result = await getTool().execute!(
        { action: 'update', id: PLAN_ID, title: 'New Title' },
        opts
      );
      expect(svc.updatePlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        { title: 'New Title' },
        '2026-07-10'
      );
      expect(result).toContain('title: New Title');
    });

    it('resolves and replaces the target when a preset/exercise field is given', async () => {
      presetRepo.getWorkoutPresetByName.mockResolvedValue({ id: 22 });
      svc.updatePlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        workout_preset_id: 22,
      });
      await getTool().execute!(
        {
          action: 'update',
          id: PLAN_ID,
          workout_preset_name: 'Leg Day Preset',
        },
        opts
      );
      expect(svc.updatePlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        { workout_preset_id: 22, exercise_id: null },
        '2026-07-10'
      );
    });

    it('rejects an update with no fields besides id', async () => {
      const result = await getTool().execute!(
        { action: 'update', id: PLAN_ID },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(svc.updatePlannedWorkout).not.toHaveBeenCalled();
    });

    it('maps a 409 conflict from the service', async () => {
      svc.updatePlannedWorkout.mockRejectedValue(
        Object.assign(
          new Error('Cannot edit a plan that is already completed.'),
          { status: 409 }
        )
      );
      const result = await getTool().execute!(
        { action: 'update', id: PLAN_ID, title: 'New Title' },
        opts
      );
      expect(result).toBe(
        'Error [CONFLICT]: Cannot edit a plan that is already completed.'
      );
    });
  });

  describe('move', () => {
    it('reschedules a plan', async () => {
      svc.movePlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        planned_date: '2026-07-15',
        planned_time: '18:00',
      });
      const result = await getTool().execute!(
        {
          action: 'move',
          id: PLAN_ID,
          planned_date: '2026-07-15',
          planned_time: '18:00',
        },
        opts
      );
      expect(svc.movePlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        '2026-07-15',
        '18:00',
        '2026-07-10'
      );
      expect(result).toContain('# Planned workout moved');
      expect(result).toContain('planned_date: 2026-07-15');
    });
  });

  describe('delete', () => {
    it('returns the outcome message', async () => {
      svc.deletePlannedWorkout.mockResolvedValue({
        message: 'Planned workout deleted.',
      });
      const result = await getTool().execute!(
        { action: 'delete', id: PLAN_ID },
        opts
      );
      expect(result).toBe('✅ Planned workout deleted.');
      expect(svc.deletePlannedWorkout).toHaveBeenCalledWith(USER_ID, PLAN_ID);
    });

    it('maps a 409 refusal from the service', async () => {
      svc.deletePlannedWorkout.mockRejectedValue(
        Object.assign(
          new Error(
            'An in-progress plan cannot be deleted; skip or finish it first.'
          ),
          { status: 409 }
        )
      );
      const result = await getTool().execute!(
        { action: 'delete', id: PLAN_ID },
        opts
      );
      expect(result).toBe(
        'Error [CONFLICT]: An in-progress plan cannot be deleted; skip or finish it first.'
      );
    });
  });

  describe('start', () => {
    it('starts a plan dated today', async () => {
      svc.getPlannedWorkoutById.mockResolvedValue({
        ...BASE_ROW,
        planned_date: '2026-07-10',
      });
      svc.startPlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        status: 'started',
        started_at: '2026-07-10T12:00:00Z',
      });
      const result = await getTool().execute!(
        { action: 'start', id: PLAN_ID },
        opts
      );
      expect(svc.startPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        '2026-07-10'
      );
      expect(result).toContain('# Workout started');
      expect(result).toContain('status: started');
    });

    it('refuses to start a plan not dated today', async () => {
      svc.getPlannedWorkoutById.mockResolvedValue({
        ...BASE_ROW,
        planned_date: '2026-07-05',
      });
      const result = await getTool().execute!(
        { action: 'start', id: PLAN_ID },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(result).toContain('2026-07-05');
      expect(svc.startPlannedWorkout).not.toHaveBeenCalled();
    });

    it('maps a 404 when the plan does not exist', async () => {
      svc.getPlannedWorkoutById.mockRejectedValue(
        Object.assign(new Error('Planned workout not found.'), {
          status: 404,
        })
      );
      const result = await getTool().execute!(
        { action: 'start', id: PLAN_ID },
        opts
      );
      expect(result).toBe('Error [NOT_FOUND]: Planned workout not found.');
    });
  });

  describe('revert', () => {
    it('reverts a started plan back to planned', async () => {
      svc.revertPlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        status: 'planned',
        started_at: null,
      });
      const result = await getTool().execute!(
        { action: 'revert', id: PLAN_ID },
        opts
      );
      expect(svc.revertPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        '2026-07-10'
      );
      expect(result).toContain('# Workout reverted to planned');
      expect(result).toContain('status: planned');
    });

    it('maps a 409 when the plan is not currently started', async () => {
      svc.revertPlannedWorkout.mockRejectedValue(
        Object.assign(
          new Error('Cannot revert a plan that is already completed.'),
          { status: 409 }
        )
      );
      const result = await getTool().execute!(
        { action: 'revert', id: PLAN_ID },
        opts
      );
      expect(result).toBe(
        'Error [CONFLICT]: Cannot revert a plan that is already completed.'
      );
    });
  });

  describe('complete', () => {
    it('links an existing session to the plan', async () => {
      svc.completePlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        status: 'completed',
        completed_session_id: SESSION_ID,
      });
      const result = await getTool().execute!(
        { action: 'complete', id: PLAN_ID, session_id: SESSION_ID },
        opts
      );
      expect(svc.completePlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        SESSION_ID,
        '2026-07-10'
      );
      expect(result).toContain('# Workout completed');
    });

    it('maps a 400 future-date refusal from the service', async () => {
      svc.completePlannedWorkout.mockRejectedValue(
        Object.assign(
          new Error('Cannot complete a plan dated in the future.'),
          {
            status: 400,
          }
        )
      );
      const result = await getTool().execute!(
        { action: 'complete', id: PLAN_ID, session_id: SESSION_ID },
        opts
      );
      expect(result).toBe(
        'Error [VALIDATION]: Cannot complete a plan dated in the future.'
      );
    });

    it('maps a 409 when already linked to another session', async () => {
      svc.completePlannedWorkout.mockRejectedValue(
        Object.assign(
          new Error('This plan was already completed by another session.'),
          { status: 409 }
        )
      );
      const result = await getTool().execute!(
        { action: 'complete', id: PLAN_ID, session_id: SESSION_ID },
        opts
      );
      expect(result).toBe(
        'Error [CONFLICT]: This plan was already completed by another session.'
      );
    });
  });

  describe('skip', () => {
    it('skips a plan', async () => {
      svc.skipPlannedWorkout.mockResolvedValue({
        ...BASE_ROW,
        status: 'skipped',
      });
      const result = await getTool().execute!(
        { action: 'skip', id: PLAN_ID },
        opts
      );
      expect(svc.skipPlannedWorkout).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        '2026-07-10'
      );
      expect(result).toContain('# Workout skipped');
      expect(result).toContain('status: skipped');
    });
  });

  it('returns DB_ERROR for an unexpected, non-status error', async () => {
    svc.listPlannedWorkouts.mockRejectedValue(new Error('boom'));
    const result = await getTool().execute!({ action: 'list_planned' }, opts);
    expect(result).toBe(DB_ERROR_TEXT);
  });

  it('rejects a malformed id (VALIDATION)', async () => {
    const result = await getTool().execute!(
      { action: 'skip', id: 'not-a-uuid' },
      opts
    );
    expect(result).toContain('Error [VALIDATION]');
    expect(svc.skipPlannedWorkout).not.toHaveBeenCalled();
  });
});
