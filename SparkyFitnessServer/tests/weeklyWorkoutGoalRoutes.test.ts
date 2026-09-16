import { vi, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
// @ts-expect-error no supertest types
import request from 'supertest';
import weeklyWorkoutGoalService from '../services/weeklyWorkoutGoalService.js';
import weeklyWorkoutGoalRoutes from '../routes/v2/weeklyWorkoutGoalRoutes.js';

vi.mock('../services/weeklyWorkoutGoalService.js', () => ({
  default: {
    getWeeklyWorkoutGoalProgress: vi.fn(),
  },
}));

vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: () => (_req: any, _res: any, next: any) => next(),
}));

const USER_ID = '99999999-9999-4999-8999-999999999999';

const PROGRESS_FIXTURE = {
  week_start: '2026-09-14',
  week_end: '2026-09-20',
  target_total: 3,
  target_strength: 2,
  target_cardio: 1,
  cardio_min_minutes: 20,
  strength_counting: 'any_strength' as const,
  completed_total: 2,
  completed_strength: 1,
  completed_cardio: 0,
  total_met: false,
  strength_met: false,
  cardio_met: false,
};

const app = express();
app.use(express.json());
app.use((req: import('express').Request, _res, next) => {
  (req as unknown as { userId: string }).userId = USER_ID;
  next();
});
app.use('/v2/reports', weeklyWorkoutGoalRoutes);

describe('weeklyWorkoutGoalRoutes (supertest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a missing date', async () => {
    const res = await request(app).get('/v2/reports/weekly-workout-goal');
    expect(res.status).toBe(400);
    expect(
      weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress
    ).not.toHaveBeenCalled();
  });

  it('rejects a malformed date', async () => {
    const res = await request(app).get(
      '/v2/reports/weekly-workout-goal?date=09-16-2026'
    );
    expect(res.status).toBe(400);
    expect(
      weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress
    ).not.toHaveBeenCalled();
  });

  it('returns weekly progress on success', async () => {
    vi.mocked(
      weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress
    ).mockResolvedValue(PROGRESS_FIXTURE);

    const res = await request(app).get(
      '/v2/reports/weekly-workout-goal?date=2026-09-16'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(PROGRESS_FIXTURE);
    expect(
      weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress
    ).toHaveBeenCalledWith(USER_ID, '2026-09-16');
  });

  it('returns progress with null target/met fields when no goals are set', async () => {
    vi.mocked(
      weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress
    ).mockResolvedValue({
      ...PROGRESS_FIXTURE,
      target_total: null,
      target_strength: null,
      target_cardio: null,
      total_met: null,
      strength_met: null,
      cardio_met: null,
    });

    const res = await request(app).get(
      '/v2/reports/weekly-workout-goal?date=2026-09-16'
    );

    expect(res.status).toBe(200);
    expect(res.body.target_total).toBeNull();
    expect(res.body.total_met).toBeNull();
  });
});
