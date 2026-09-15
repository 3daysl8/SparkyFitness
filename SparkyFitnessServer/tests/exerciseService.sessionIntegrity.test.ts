import { vi, beforeEach, describe, expect, it } from 'vitest';
import { getClient } from '../db/poolManager.js';
import exerciseDb from '../models/exercise.js';
import exerciseEntryDb from '../models/exerciseEntry.js';
import exercisePresetEntryRepository from '../models/exercisePresetEntryRepository.js';
import workoutPresetRepository from '../models/workoutPresetRepository.js';
import calorieCalculationService from '../services/CalorieCalculationService.js';
import { resolveExerciseIdToUuid } from '../utils/uuidUtils.js';
import { getGroupedExerciseSessionByIdWithClient } from '../services/exerciseEntryHistoryService.js';
import exerciseService from '../services/exerciseService.js';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
  getSystemClient: vi.fn(),
}));
vi.mock('../models/exerciseRepository', () => ({}));
vi.mock('../models/exercise', () => ({
  default: {
    getExerciseById: vi.fn(),
  },
}));
vi.mock('../models/exerciseEntry', () => ({
  default: {
    _createExerciseEntryWithClient: vi.fn(),
    getExerciseEntryOwnerId: vi.fn(),
    getExerciseEntryById: vi.fn(),
    deleteExerciseEntry: vi.fn(),
  },
}));
vi.mock('../models/activityDetailsRepository', () => ({}));
vi.mock('../models/exercisePresetEntryRepository.js', () => ({
  default: {
    createExercisePresetEntryWithClient: vi.fn(),
    insertExercisePresetEntryIdempotentWithClient: vi.fn(),
  },
}));
vi.mock('../models/userRepository', () => ({}));
vi.mock('../models/preferenceRepository', () => ({}));
vi.mock('../models/workoutPresetRepository', () => ({
  default: {
    getWorkoutPresetById: vi.fn(),
  },
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));
vi.mock('../integrations/wger/wgerService', () => ({}));
vi.mock('../integrations/nutritionix/nutritionixService', () => ({}));
vi.mock('../integrations/freeexercisedb/FreeExerciseDBService', () => ({}));
vi.mock('../models/measurementRepository', () => ({}));
vi.mock('../utils/imageDownloader', () => ({
  downloadImage: vi.fn(),
}));
vi.mock('../services/CalorieCalculationService', () => ({
  default: {
    estimateCaloriesBurnedPerHour: vi.fn(),
  },
}));
vi.mock('../utils/uuidUtils', () => ({
  isValidUuid: vi.fn(),
  resolveExerciseIdToUuid: vi.fn(),
}));
vi.mock('../models/familyAccessRepository', () => ({
  checkFamilyAccessPermission: vi.fn(),
}));
vi.mock('../services/exerciseEntryHistoryService', () => ({
  getGroupedExerciseSessionById: vi.fn(),
  getGroupedExerciseSessionByIdWithClient: vi.fn(),
}));

const client = {
  query: vi.fn(),
  release: vi.fn(),
};

const exerciseId = '11111111-1111-4111-8111-111111111111';
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('grouped workout session idempotency (service level)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    getClient.mockResolvedValue(client);
    client.query.mockResolvedValue({});
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getWorkoutPlanAssignmentIdByPresetEntryIdWithClient?.mockResolvedValue?.(
      null
    );
    vi.mocked(resolveExerciseIdToUuid).mockImplementation(
      async (id: string) => id
    );
    // @ts-expect-error TS(2339): mockImplementation on mocked fn
    exerciseDb.getExerciseById.mockImplementation(async (id: string) => ({
      id,
      name: 'Test Exercise',
      calories_per_hour: 300,
    }));
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    calorieCalculationService.estimateCaloriesBurnedPerHour.mockResolvedValue(
      300
    );
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb._createExerciseEntryWithClient.mockResolvedValue({
      entry: { id: 'new-entry' },
      operation: 'created',
    });
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    getGroupedExerciseSessionByIdWithClient.mockResolvedValue({
      type: 'preset',
      id: 'preset-entry-1',
    });
  });

  it('reports created:true and inserts children on a first save with a client_request_id', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.insertExercisePresetEntryIdempotentWithClient.mockResolvedValue(
      { entry: { id: 'preset-entry-1' }, created: true, storedFingerprint: 'x' }
    );

    const result = await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      {
        name: 'Live Workout',
        entry_date: '2026-03-12',
        source: 'sparky',
        client_request_id: requestId,
        exercises: [
          {
            exercise_id: exerciseId,
            sort_order: 0,
            duration_minutes: 5,
            sets: [],
          },
        ],
      }
    );

    expect(result.created).toBe(true);
    expect(
      exerciseEntryDb._createExerciseEntryWithClient
    ).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('reports created:false and skips child inserts on a replayed client_request_id', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.insertExercisePresetEntryIdempotentWithClient.mockResolvedValue(
      {
        entry: { id: 'preset-entry-1' },
        created: false,
        storedFingerprint: undefined, // filled in below to match the computed fingerprint
      }
    );
    // Capture the fingerprint the service computes so the mock can echo it back.
    // @ts-expect-error TS(2339): mockImplementation on mocked fn
    exercisePresetEntryRepository.insertExercisePresetEntryIdempotentWithClient.mockImplementation(
      async (
        _client: unknown,
        _userId: string,
        entryData: { client_request_fingerprint: string }
      ) => ({
        entry: { id: 'preset-entry-1' },
        created: false,
        storedFingerprint: entryData.client_request_fingerprint,
      })
    );

    const payload = {
      name: 'Live Workout',
      entry_date: '2026-03-12',
      source: 'sparky',
      client_request_id: requestId,
      exercises: [
        {
          exercise_id: exerciseId,
          sort_order: 0,
          duration_minutes: 5,
          sets: [],
        },
      ],
    };

    const result = await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      payload
    );

    expect(result.created).toBe(false);
    expect(
      exerciseEntryDb._createExerciseEntryWithClient
    ).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects a replayed client_request_id whose stored fingerprint disagrees, and rolls back', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.insertExercisePresetEntryIdempotentWithClient.mockResolvedValue(
      {
        entry: { id: 'preset-entry-1' },
        created: false,
        storedFingerprint: 'a-different-fingerprint',
      }
    );

    await expect(
      exerciseService.createGroupedWorkoutSessionWithStatus(
        'user-1',
        'actor-1',
        {
          name: 'Live Workout',
          entry_date: '2026-03-12',
          source: 'sparky',
          client_request_id: requestId,
          exercises: [
            {
              exercise_id: exerciseId,
              sort_order: 0,
              duration_minutes: 5,
              sets: [],
            },
          ],
        }
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(
      exerciseEntryDb._createExerciseEntryWithClient
    ).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('does not compute a fingerprint or call the idempotent insert path when no client_request_id is sent', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.createExercisePresetEntryWithClient.mockResolvedValue(
      { id: 'preset-entry-1' }
    );

    await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      {
        name: 'Live Workout',
        entry_date: '2026-03-12',
        source: 'sparky',
        exercises: [
          {
            exercise_id: exerciseId,
            sort_order: 0,
            duration_minutes: 5,
            sets: [],
          },
        ],
      }
    );

    expect(
      exercisePresetEntryRepository.insertExercisePresetEntryIdempotentWithClient
    ).not.toHaveBeenCalled();
    expect(
      exercisePresetEntryRepository.createExercisePresetEntryWithClient
    ).toHaveBeenCalledTimes(1);
  });
});

describe('grouped workout creation when the preset is not visible via RLS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    getClient.mockResolvedValue(client);
    client.query.mockResolvedValue({});
    vi.mocked(resolveExerciseIdToUuid).mockImplementation(
      async (id: string) => id
    );
    // @ts-expect-error TS(2339): mockImplementation on mocked fn
    exerciseDb.getExerciseById.mockImplementation(async (id: string) => ({
      id,
      name: 'Test Exercise',
      calories_per_hour: 300,
    }));
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    calorieCalculationService.estimateCaloriesBurnedPerHour.mockResolvedValue(
      300
    );
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb._createExerciseEntryWithClient.mockResolvedValue({
      entry: { id: 'new-entry' },
      operation: 'created',
    });
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.createExercisePresetEntryWithClient.mockResolvedValue(
      { id: 'preset-entry-1' }
    );
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    getGroupedExerciseSessionByIdWithClient.mockResolvedValue({
      type: 'preset',
      id: 'preset-entry-1',
    });
    // The RLS-scoped lookup finds nothing for this user.
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    workoutPresetRepository.getWorkoutPresetById.mockResolvedValue(null);
  });

  it('stores workout_preset_id as null and still saves when the client also supplied exercises', async () => {
    await exerciseService.createGroupedWorkoutSession('user-1', 'actor-1', {
      workout_preset_id: 42,
      name: 'Live Workout',
      entry_date: '2026-03-12',
      source: 'sparky',
      exercises: [
        {
          exercise_id: exerciseId,
          sort_order: 0,
          duration_minutes: 5,
          sets: [],
        },
      ],
    });

    expect(
      exercisePresetEntryRepository.createExercisePresetEntryWithClient
    ).toHaveBeenCalledWith(
      client,
      'user-1',
      expect.objectContaining({ workout_preset_id: null }),
      'actor-1'
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects with 404 when the preset is invisible and the client sent no exercises to fall back on', async () => {
    await expect(
      exerciseService.createGroupedWorkoutSession('user-1', 'actor-1', {
        workout_preset_id: 42,
        entry_date: '2026-03-12',
        source: 'sparky',
      })
    ).rejects.toMatchObject({ status: 404 });

    expect(
      exercisePresetEntryRepository.createExercisePresetEntryWithClient
    ).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('deleting an exercise entry removes its emptied session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryOwnerId.mockResolvedValue('user-1');
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue({
      id: 'entry-1',
      image_url: null,
    });
  });

  it('logs and still succeeds when the model reports the session was removed', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.deleteExerciseEntry.mockResolvedValue({
      deleted: true,
      removedSessionId: 'preset-entry-1',
    });

    const result = await exerciseService.deleteExerciseEntry(
      'user-1',
      'entry-1'
    );
    expect(result).toEqual({ message: 'Exercise entry deleted successfully.' });
  });

  it('succeeds without a removed session when siblings remain', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.deleteExerciseEntry.mockResolvedValue({
      deleted: true,
      removedSessionId: null,
    });

    const result = await exerciseService.deleteExerciseEntry(
      'user-1',
      'entry-1'
    );
    expect(result).toEqual({ message: 'Exercise entry deleted successfully.' });
  });

  it('throws when the model reports nothing was deleted', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.deleteExerciseEntry.mockResolvedValue({
      deleted: false,
      removedSessionId: null,
    });

    await expect(
      exerciseService.deleteExerciseEntry('user-1', 'entry-1')
    ).rejects.toThrow('Exercise entry not found or not authorized to delete.');
  });
});
