import { apiCall } from '@/api/api';
import { getWeeklyWorkoutGoalProgress } from '@/api/Reports/reportsService';
import type { WeeklyWorkoutGoalProgressResponse } from '@workspace/shared';

jest.mock('@/api/api', () => ({
  apiCall: jest.fn(),
}));

const response: WeeklyWorkoutGoalProgressResponse = {
  week_start: '2026-09-13',
  week_end: '2026-09-19',
  target_total: 4,
  target_strength: null,
  target_cardio: null,
  cardio_min_minutes: 20,
  strength_counting: 'any_strength',
  completed_total: 2,
  completed_strength: 0,
  completed_cardio: 0,
  total_met: false,
  strength_met: null,
  cardio_met: null,
};

describe('getWeeklyWorkoutGoalProgress', () => {
  beforeEach(() => jest.mocked(apiCall).mockReset());

  // The backend endpoint (GET /v2/reports/weekly-workout-goal) isn't live yet
  // -- this only proves the client builds the request the contract's type
  // expects, mirroring getAlcoholWeekReport's own client test shape.
  it('requests the weekly-workout-goal endpoint for the given date', async () => {
    jest.mocked(apiCall).mockResolvedValue(response);

    const result = await getWeeklyWorkoutGoalProgress('2026-09-15');

    expect(apiCall).toHaveBeenCalledWith(
      '/v2/reports/weekly-workout-goal?date=2026-09-15',
      { method: 'GET' }
    );
    expect(result).toEqual(response);
  });

  it('adds userId to the query string when acting on another user', async () => {
    jest.mocked(apiCall).mockResolvedValue(response);

    await getWeeklyWorkoutGoalProgress('2026-09-15', 'user-2');

    expect(apiCall).toHaveBeenCalledWith(
      '/v2/reports/weekly-workout-goal?date=2026-09-15&userId=user-2',
      { method: 'GET' }
    );
  });
});
