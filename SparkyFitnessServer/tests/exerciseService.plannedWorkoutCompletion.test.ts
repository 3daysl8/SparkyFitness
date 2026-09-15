import { vi, beforeEach, describe, expect, it } from 'vitest';
import { getClient } from '../db/poolManager.js';
import exerciseDb from '../models/exercise.js';
import exerciseEntryDb from '../models/exerciseEntry.js';
import exercisePresetEntryRepository from '../models/exercisePresetEntryRepository.js';
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
  },
}));
vi.mock('../models/activityDetailsRepository', () => ({}));
vi.mock('../models/exercisePresetEntryRepository.js', () => ({
  default: {
    createExercisePresetEntryWithClient: vi.fn(),
    insertExercisePresetEntryIdempotentWithClient: vi.fn(),
    linkPlannedWorkoutWithClient: vi.fn(),
  },
}));
vi.mock('../models/userRepository', () => ({}));
vi.mock('../models/preferenceRepository', () => ({}));
vi.mock('../models/workoutPresetRepository', () => ({
  default: {},
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
const plannedWorkoutId = '22222222-2222-4222-8222-222222222222';

describe('grouped workout creation completing a planned workout', () => {
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
  });

  const payload = (extra: Record<string, unknown> = {}) => ({
    name: 'Live Workout',
    entry_date: '2026-03-12',
    source: 'sparky',
    exercises: [
      { exercise_id: exerciseId, sort_order: 0, duration_minutes: 5, sets: [] },
    ],
    ...extra,
  });

  it('links the planned workout when a planned_workout_id is sent', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.linkPlannedWorkoutWithClient.mockResolvedValue(
      { linked: true }
    );

    await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      payload({ planned_workout_id: plannedWorkoutId })
    );

    expect(
      exercisePresetEntryRepository.linkPlannedWorkoutWithClient
    ).toHaveBeenCalledWith(
      client,
      'user-1',
      plannedWorkoutId,
      'preset-entry-1'
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('still saves the session when the link is refused (already completed elsewhere)', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exercisePresetEntryRepository.linkPlannedWorkoutWithClient.mockResolvedValue(
      {
        linked: false,
        warning:
          'Planned workout was already completed by another session; this session was saved without linking it.',
      }
    );

    const result = await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      payload({ planned_workout_id: plannedWorkoutId })
    );

    expect(result.created).toBe(true);
    expect(result.session).not.toBeNull();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
  });

  it('does not attempt a link when no planned_workout_id is sent', async () => {
    await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      payload()
    );

    expect(
      exercisePresetEntryRepository.linkPlannedWorkoutWithClient
    ).not.toHaveBeenCalled();
  });

  it('does not re-attempt a link on a replayed (non-created) save', async () => {
    const requestId = '33333333-3333-4333-8333-333333333333';
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
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

    const result = await exerciseService.createGroupedWorkoutSessionWithStatus(
      'user-1',
      'actor-1',
      payload({
        client_request_id: requestId,
        planned_workout_id: plannedWorkoutId,
      })
    );

    expect(result.created).toBe(false);
    expect(
      exercisePresetEntryRepository.linkPlannedWorkoutWithClient
    ).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
