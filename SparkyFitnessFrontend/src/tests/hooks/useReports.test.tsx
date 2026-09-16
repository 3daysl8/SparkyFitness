import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWeeklyWorkoutGoal } from '@/hooks/Reports/useReports';
import { getWeeklyWorkoutGoalProgress } from '@/api/Reports/reportsService';
import { reportKeys } from '@/api/keys/reports';
import type { WeeklyWorkoutGoalProgressResponse } from '@workspace/shared';

jest.mock('@/api/Reports/reportsService', () => ({
  getWeeklyWorkoutGoalProgress: jest.fn(),
}));

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockGetWeeklyWorkoutGoalProgress = jest.mocked(
  getWeeklyWorkoutGoalProgress
);

function renderWithClient<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper: Wrapper });
}

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

describe('useWeeklyWorkoutGoal', () => {
  beforeEach(() => {
    mockGetWeeklyWorkoutGoalProgress.mockReset().mockResolvedValue(response);
  });

  it('fetches progress for the given date/user and returns it', async () => {
    const { result } = renderWithClient(() =>
      useWeeklyWorkoutGoal('2026-09-15', 'user-1')
    );

    await waitFor(() => expect(result.current.data).toEqual(response));

    expect(mockGetWeeklyWorkoutGoalProgress).toHaveBeenCalledWith(
      '2026-09-15',
      'user-1'
    );
  });

  it('passes undefined instead of a null userId through to the client', async () => {
    renderWithClient(() => useWeeklyWorkoutGoal('2026-09-15', null));

    await waitFor(() =>
      expect(mockGetWeeklyWorkoutGoalProgress).toHaveBeenCalledWith(
        '2026-09-15',
        undefined
      )
    );
  });

  it('does not fetch while disabled', async () => {
    renderWithClient(() => useWeeklyWorkoutGoal('2026-09-15', 'user-1', false));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetWeeklyWorkoutGoalProgress).not.toHaveBeenCalled();
  });

  it('does not fetch with an empty date', async () => {
    renderWithClient(() => useWeeklyWorkoutGoal('', 'user-1'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetWeeklyWorkoutGoalProgress).not.toHaveBeenCalled();
  });

  it('keys the query by date and userId, matching the alcohol-week key shape', () => {
    expect(reportKeys.weeklyWorkoutGoal('2026-09-15', 'user-1')).toEqual([
      'reports',
      'weeklyWorkoutGoal',
      '2026-09-15',
      { userId: 'user-1' },
    ]);
  });
});
