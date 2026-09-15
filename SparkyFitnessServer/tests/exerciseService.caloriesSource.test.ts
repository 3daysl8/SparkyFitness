import { vi, beforeEach, describe, expect, it } from 'vitest';
import exerciseDb from '../models/exercise.js';
import exerciseEntryDb from '../models/exerciseEntry.js';
import calorieCalculationService from '../services/CalorieCalculationService.js';
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
    getExerciseEntryById: vi.fn(),
    updateExerciseEntry: vi.fn(),
  },
}));
vi.mock('../models/activityDetailsRepository', () => ({}));
vi.mock('../models/exercisePresetEntryRepository.js', () => ({
  default: {},
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

const exerciseId = '11111111-1111-4111-8111-111111111111';

// Rate is 600 cal/hour (10 cal/min) throughout.
const baseExistingEntry = {
  id: 'entry-1',
  exercise_id: exerciseId,
  entry_date: '2026-07-26',
  duration_minutes: 30,
  calories_burned: 300, // matches the 10 cal/min formula at 30 minutes
  calories_per_hour: 600,
  calories_source: 'derived' as string | null,
  notes: null,
  image_url: null,
  distance: null,
  avg_heart_rate: null,
  steps: null,
  sort_order: 0,
  exercise_name: 'Treadmill Run',
  superset_group: null,
  entry_time: null,
};

function updatePayload() {
  const [, , , updateData] = vi.mocked(exerciseEntryDb.updateExerciseEntry).mock
    .calls[0];
  return updateData;
}

describe('calories_source recompute on individual update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseDb.getExerciseById.mockResolvedValue({
      id: exerciseId,
      name: 'Treadmill Run',
      calories_per_hour: 600,
    });
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    calorieCalculationService.estimateCaloriesBurnedPerHour.mockResolvedValue(
      600
    );
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.updateExerciseEntry.mockResolvedValue({ id: 'entry-1' });
  });

  it('labels an explicit calories_burned as manual and does not recompute', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue(baseExistingEntry);

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      calories_burned: 999,
    });

    expect(updatePayload()).toMatchObject({
      calories_burned: 999,
      calories_source: 'manual',
    });
    expect(
      calorieCalculationService.estimateCaloriesBurnedPerHour
    ).not.toHaveBeenCalled();
  });

  it('recomputes derived calories when duration changes', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue(baseExistingEntry);

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      duration_minutes: 45,
    });

    expect(updatePayload()).toMatchObject({
      duration_minutes: 45,
      calories_burned: 450, // 10 cal/min * 45
      calories_source: 'derived',
    });
  });

  it('keeps manual calories untouched when duration changes', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue({
      ...baseExistingEntry,
      calories_source: 'manual',
      calories_burned: 250, // deliberately does not match the formula
    });

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      duration_minutes: 45,
    });

    const payload = updatePayload();
    expect(payload.duration_minutes).toBe(45);
    expect(payload.calories_burned).toBe(250); // unchanged
    expect(payload.calories_source).toBeUndefined(); // model preserves existing
    expect(
      calorieCalculationService.estimateCaloriesBurnedPerHour
    ).not.toHaveBeenCalled();
  });

  it('keeps device-sourced calories untouched when the exercise changes', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue({
      ...baseExistingEntry,
      calories_source: 'device',
      calories_burned: 512,
    });

    const otherExerciseId = '22222222-2222-4222-8222-222222222222';
    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      exercise_id: otherExerciseId,
    });

    const payload = updatePayload();
    expect(payload.calories_burned).toBe(512);
    expect(payload.calories_source).toBeUndefined();
  });

  it('treats a legacy row (no calories_source) as derived when stored calories match the formula', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue({
      ...baseExistingEntry,
      calories_source: null,
      calories_burned: 300, // matches 10 cal/min * 30 min
    });

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      duration_minutes: 60,
    });

    expect(updatePayload()).toMatchObject({
      calories_burned: 600,
      calories_source: 'derived',
    });
  });

  it('treats a legacy row (no calories_source) as not derived when stored calories disagree with the formula', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue({
      ...baseExistingEntry,
      calories_source: null,
      calories_burned: 900, // does not match 10 cal/min * 30 min
    });

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      duration_minutes: 60,
    });

    const payload = updatePayload();
    expect(payload.calories_burned).toBe(900); // preserved
    expect(payload.calories_source).toBeUndefined();
    expect(
      calorieCalculationService.estimateCaloriesBurnedPerHour
    ).not.toHaveBeenCalled();
  });

  it('recomputes derived calories when sets change with no explicit duration', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue(baseExistingEntry);

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      sets: [{ set_number: 1, reps: 10, weight: 60 }],
    });

    expect(updatePayload()).toMatchObject({
      calories_burned: 300, // duration unchanged at 30 min * 10 cal/min
      calories_source: 'derived',
    });
  });

  it('leaves calories untouched when neither duration, exercise, nor sets change', async () => {
    // @ts-expect-error TS(2339): mockResolvedValue on mocked fn
    exerciseEntryDb.getExerciseEntryById.mockResolvedValue(baseExistingEntry);

    await exerciseService.updateExerciseEntry('user-1', 'actor-1', 'entry-1', {
      notes: 'still a run',
    });

    const payload = updatePayload();
    expect(payload.calories_source).toBeUndefined();
    expect(
      calorieCalculationService.estimateCaloriesBurnedPerHour
    ).not.toHaveBeenCalled();
  });
});
