import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/workoutPlanTemplateService.js', () => ({
  default: {
    getWorkoutPlanTemplatesByUserId: vi.fn(),
    getWorkoutPlanTemplateById: vi.fn(),
    deleteWorkoutPlanTemplate: vi.fn(),
    updateWorkoutPlanTemplate: vi.fn(),
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

import workoutPlanTemplateService from '../services/workoutPlanTemplateService.js';
import workoutPresetRepository from '../models/workoutPresetRepository.js';
import { findExerciseByExactName } from '../ai/tools/exerciseTools.js';
import { buildWorkoutPlanTools } from '../ai/tools/workoutPlanTools.js';

const opts = { toolCallId: 'tc-1', messages: [] };

const PLAN_ID = 42;

const DB_ERROR_TEXT =
  'Error [DB_ERROR]: A database error occurred.\n\nSuggestion: Do NOT retry the same call — it will fail the same way. Tell the user what failed and stop.';

const svc = workoutPlanTemplateService as unknown as {
  getWorkoutPlanTemplatesByUserId: ReturnType<typeof vi.fn>;
  getWorkoutPlanTemplateById: ReturnType<typeof vi.fn>;
  deleteWorkoutPlanTemplate: ReturnType<typeof vi.fn>;
  updateWorkoutPlanTemplate: ReturnType<typeof vi.fn>;
};

const presetRepo = workoutPresetRepository as unknown as {
  getWorkoutPresetByName: ReturnType<typeof vi.fn>;
};

const findExerciseMock = findExerciseByExactName as unknown as ReturnType<
  typeof vi.fn
>;

const BASE_PLAN = {
  id: PLAN_ID,
  plan_name: 'Push Pull Legs',
  description: 'A 3-day split',
  start_date: '2026-01-01',
  end_date: null,
  is_active: true,
  assignments: [
    {
      id: 1,
      day_of_week: 1,
      workout_preset_id: 5,
      workout_preset_name: 'Push Day',
      exercise_id: null,
      exercise_name: null,
      sort_order: 0,
      sets: [],
    },
    {
      id: 2,
      day_of_week: 3,
      workout_preset_id: null,
      exercise_id: 'ex-uuid',
      exercise_name: 'Deadlift',
      sort_order: 0,
      sets: [{ id: 's1', set_number: 1, reps: 5, weight: 100 }],
    },
  ],
};

function getTool() {
  const tools = buildWorkoutPlanTools('user-1', 'UTC');
  return tools.sparky_manage_workout_plans;
}

describe('sparky_manage_workout_plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists workout plans (inferred from {})', async () => {
    svc.getWorkoutPlanTemplatesByUserId.mockResolvedValue([
      {
        id: PLAN_ID,
        plan_name: 'Push Pull Legs',
        is_active: true,
        assignments: [{ day_of_week: 1 }, { day_of_week: 3 }],
      },
      {
        id: 43,
        plan_name: 'Beginner',
        is_active: false,
        assignments: [{ day_of_week: 0 }],
      },
    ]);
    const result = await getTool().execute!({}, opts);
    expect(result).toBe(
      '# Workout Plans\n\n**Push Pull Legs** (active, 2 assignments)\n  ID: ' +
        PLAN_ID +
        '\n\n**Beginner** (inactive, 1 assignment)\n  ID: 43'
    );
  });

  it('renders no results when there are no plans', async () => {
    svc.getWorkoutPlanTemplatesByUserId.mockResolvedValue([]);
    const result = await getTool().execute!(
      { action: 'list_workout_plans' },
      opts
    );
    expect(result).toBe('# Workout Plans\n\nNo results found.');
  });

  it('gets a workout plan with its assignments', async () => {
    svc.getWorkoutPlanTemplateById.mockResolvedValue({
      id: PLAN_ID,
      plan_name: 'Push Pull Legs',
      is_active: true,
      assignments: [
        {
          day_of_week: 1,
          workout_preset_name: 'Push Day',
          sets: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        },
        {
          day_of_week: 3,
          exercise_name: 'Deadlift',
          sets: [{ id: 's4' }],
        },
        { day_of_week: 5 },
      ],
    });
    const result = await getTool().execute!(
      { action: 'get_workout_plan', plan_id: PLAN_ID },
      opts
    );
    expect(result).toBe(
      '# Workout Plan: Push Pull Legs\n\nMonday: Push Day — 3 sets\n\nWednesday: Deadlift — 1 set\n\nFriday: Unknown item'
    );
    expect(svc.getWorkoutPlanTemplateById).toHaveBeenCalledWith(
      'user-1',
      PLAN_ID
    );
  });

  it('returns NOT_FOUND when getting a missing plan', async () => {
    svc.getWorkoutPlanTemplateById.mockRejectedValue(
      new Error('Workout plan template not found.')
    );
    const result = await getTool().execute!(
      { action: 'get_workout_plan', plan_id: PLAN_ID },
      opts
    );
    expect(result).toBe(
      "Error [NOT_FOUND]: Workout plan with ID '" +
        PLAN_ID +
        "' not found.\n\nSuggestion: Check the ID and try again."
    );
  });

  it('deletes a workout plan', async () => {
    svc.deleteWorkoutPlanTemplate.mockResolvedValue({
      message: 'Workout plan template deleted successfully.',
    });
    const result = await getTool().execute!(
      { action: 'delete_workout_plan', plan_id: PLAN_ID },
      opts
    );
    expect(result).toBe('✅ Workout plan deleted.');
    expect(svc.deleteWorkoutPlanTemplate).toHaveBeenCalledWith(
      'user-1',
      PLAN_ID
    );
  });

  it('returns NOT_FOUND when deleting a missing plan', async () => {
    svc.deleteWorkoutPlanTemplate.mockRejectedValue(
      new Error('Workout plan template not found.')
    );
    const result = await getTool().execute!(
      { action: 'delete_workout_plan', plan_id: PLAN_ID },
      opts
    );
    expect(result).toBe(
      "Error [NOT_FOUND]: Workout plan with ID '" +
        PLAN_ID +
        "' not found.\n\nSuggestion: Check the ID and try again."
    );
  });

  it('rejects a non-integer plan_id (VALIDATION)', async () => {
    const result = await getTool().execute!(
      { action: 'get_workout_plan', plan_id: 'not-a-number' },
      opts
    );
    expect(result).toContain('Error [VALIDATION]');
    expect(svc.getWorkoutPlanTemplateById).not.toHaveBeenCalled();
  });

  it('returns DB_ERROR when the service throws a generic error', async () => {
    svc.getWorkoutPlanTemplatesByUserId.mockRejectedValue(new Error('boom'));
    const result = await getTool().execute!(
      { action: 'list_workout_plans' },
      opts
    );
    expect(result).toBe(DB_ERROR_TEXT);
  });

  describe('set_day_assignment', () => {
    it('assigns a preset by ID, replacing that day and echoing the rest of the plan unchanged', async () => {
      svc.getWorkoutPlanTemplateById.mockResolvedValue(BASE_PLAN);
      svc.updateWorkoutPlanTemplate.mockResolvedValue({});
      const result = await getTool().execute!(
        {
          action: 'set_day_assignment',
          plan_id: PLAN_ID,
          day_of_week: 1,
          preset_id: 9,
        },
        opts
      );
      expect(result).toBe('✅ Monday set on "Push Pull Legs".');
      expect(svc.updateWorkoutPlanTemplate).toHaveBeenCalledWith(
        'user-1',
        PLAN_ID,
        {
          plan_name: 'Push Pull Legs',
          description: 'A 3-day split',
          start_date: '2026-01-01',
          end_date: null,
          is_active: true,
          assignments: [
            {
              id: 2,
              day_of_week: 3,
              workout_preset_id: null,
              exercise_id: 'ex-uuid',
              sort_order: 0,
              sets: [{ id: 's1', set_number: 1, reps: 5, weight: 100 }],
            },
            {
              day_of_week: 1,
              workout_preset_id: 9,
              exercise_id: null,
              sort_order: 0,
            },
          ],
        }
      );
    });

    it('resolves a preset by name', async () => {
      svc.getWorkoutPlanTemplateById.mockResolvedValue(BASE_PLAN);
      svc.updateWorkoutPlanTemplate.mockResolvedValue({});
      presetRepo.getWorkoutPresetByName.mockResolvedValue({ id: 11 });
      await getTool().execute!(
        {
          action: 'set_day_assignment',
          plan_id: PLAN_ID,
          day_of_week: 'Tuesday',
          preset_name: 'Upper Body B',
        },
        opts
      );
      expect(presetRepo.getWorkoutPresetByName).toHaveBeenCalledWith(
        'user-1',
        'Upper Body B'
      );
      const call = svc.updateWorkoutPlanTemplate.mock.calls[0][2];
      expect(call.assignments).toContainEqual(
        expect.objectContaining({ day_of_week: 2, workout_preset_id: 11 })
      );
    });

    it('resolves an exercise by name', async () => {
      svc.getWorkoutPlanTemplateById.mockResolvedValue(BASE_PLAN);
      svc.updateWorkoutPlanTemplate.mockResolvedValue({});
      findExerciseMock.mockResolvedValue({ id: 'resolved-uuid' });
      await getTool().execute!(
        {
          action: 'set_day_assignment',
          plan_id: PLAN_ID,
          day_of_week: 5,
          exercise_name: 'Squats',
        },
        opts
      );
      expect(findExerciseMock).toHaveBeenCalledWith('user-1', 'Squats');
      const call = svc.updateWorkoutPlanTemplate.mock.calls[0][2];
      expect(call.assignments).toContainEqual(
        expect.objectContaining({
          day_of_week: 5,
          exercise_id: 'resolved-uuid',
          workout_preset_id: null,
        })
      );
    });

    it('rejects both a preset and an exercise given together', async () => {
      const result = await getTool().execute!(
        {
          action: 'set_day_assignment',
          plan_id: PLAN_ID,
          day_of_week: 1,
          preset_id: 9,
          exercise_id: '11111111-1111-1111-1111-111111111111',
        },
        opts
      );
      expect(result).toContain('Error [VALIDATION]');
      expect(svc.getWorkoutPlanTemplateById).not.toHaveBeenCalled();
      expect(svc.updateWorkoutPlanTemplate).not.toHaveBeenCalled();
    });

    it('rejects neither a preset nor an exercise given', async () => {
      const result = await getTool().execute!(
        { action: 'set_day_assignment', plan_id: PLAN_ID, day_of_week: 1 },
        opts
      );
      expect(result).toContain('Error [MISSING_PARAMS]');
      expect(svc.updateWorkoutPlanTemplate).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for an unknown preset name', async () => {
      presetRepo.getWorkoutPresetByName.mockResolvedValue(null);
      const result = await getTool().execute!(
        {
          action: 'set_day_assignment',
          plan_id: PLAN_ID,
          day_of_week: 1,
          preset_name: 'Nonexistent',
        },
        opts
      );
      expect(result).toContain('Error [NOT_FOUND]');
      expect(svc.updateWorkoutPlanTemplate).not.toHaveBeenCalled();
    });
  });

  describe('clear_day_assignment', () => {
    it('removes the assignment for that day and keeps the rest', async () => {
      svc.getWorkoutPlanTemplateById.mockResolvedValue(BASE_PLAN);
      svc.updateWorkoutPlanTemplate.mockResolvedValue({});
      const result = await getTool().execute!(
        { action: 'clear_day_assignment', plan_id: PLAN_ID, day_of_week: 1 },
        opts
      );
      expect(result).toBe(
        '✅ Monday cleared on "Push Pull Legs" — now a rest day.'
      );
      expect(svc.updateWorkoutPlanTemplate).toHaveBeenCalledWith(
        'user-1',
        PLAN_ID,
        {
          plan_name: 'Push Pull Legs',
          description: 'A 3-day split',
          start_date: '2026-01-01',
          end_date: null,
          is_active: true,
          assignments: [
            {
              id: 2,
              day_of_week: 3,
              workout_preset_id: null,
              exercise_id: 'ex-uuid',
              sort_order: 0,
              sets: [{ id: 's1', set_number: 1, reps: 5, weight: 100 }],
            },
          ],
        }
      );
    });
  });
});
