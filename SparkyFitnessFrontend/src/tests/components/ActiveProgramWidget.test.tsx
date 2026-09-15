import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActiveProgramWidget from '@/pages/Exercises/ActiveProgramWidget';

const mockNavigate = jest.fn();

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/', search: '' }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

let mockPreferences = { timezone: 'UTC', firstDayOfWeek: 0 };
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => mockPreferences,
}));

const mockUseActiveWorkoutPlan = jest.fn();
jest.mock('@/hooks/Exercises/useWorkoutPlans', () => ({
  useActiveWorkoutPlan: (...args: unknown[]) =>
    mockUseActiveWorkoutPlan(...args),
}));

const mockUseWorkoutPreset = jest.fn();
jest.mock('@/hooks/Exercises/useWorkoutPresets', () => ({
  useWorkoutPreset: (...args: unknown[]) => mockUseWorkoutPreset(...args),
}));

const mockUsePlannedWorkoutDayView = jest.fn();
jest.mock('@/hooks/Exercises/usePlannedWorkouts', () => ({
  usePlannedWorkoutDayView: (...args: unknown[]) =>
    mockUsePlannedWorkoutDayView(...args),
}));

jest.mock('@/pages/Exercises/ManageSchedulesDialog', () => () => null);

describe('ActiveProgramWidget', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPreferences = { timezone: 'UTC', firstDayOfWeek: 0 };
    mockUseActiveWorkoutPlan.mockReset();
    mockUseWorkoutPreset.mockReset().mockReturnValue({ data: undefined });
    mockUsePlannedWorkoutDayView
      .mockReset()
      .mockReturnValue({ data: undefined });
  });

  it('shows the no-active-plan state when there is no active template', () => {
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<ActiveProgramWidget />);

    expect(
      screen.getByText('No active training schedule.')
    ).toBeInTheDocument();
  });

  it('reorders the 7-day grid columns per the firstDayOfWeek preference without touching DAYS_OF_WEEK itself', () => {
    mockPreferences = { timezone: 'UTC', firstDayOfWeek: 1 };
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: { plan_name: 'My Plan', assignments: [] },
      isLoading: false,
    });

    render(<ActiveProgramWidget />);

    const dayLabels = screen
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      .map((el) => el.textContent);
    expect(dayLabels).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
  });

  it('defaults to a Sunday-first grid when firstDayOfWeek is 0', () => {
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: { plan_name: 'My Plan', assignments: [] },
      isLoading: false,
    });

    render(<ActiveProgramWidget />);

    const dayLabels = screen
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      .map((el) => el.textContent);
    expect(dayLabels).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });

  it('hides "Start Today\'s Workout" when the template has an assignment for today but the day-view has no for_date row yet', () => {
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: {
        plan_name: 'My Plan',
        assignments: [
          {
            day_of_week: 0,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 1,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 2,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 3,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 4,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 5,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
          {
            day_of_week: 6,
            workout_preset_id: 1,
            workout_preset_name: 'Legacy',
          },
        ],
      },
      isLoading: false,
    });
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: { for_date: [], missed: [] },
    });

    render(<ActiveProgramWidget />);

    expect(
      screen.queryByRole('button', { name: /Start Today's Workout/ })
    ).not.toBeInTheDocument();
  });

  it('resolves "Start Today\'s Workout" from the planned_workouts day-view row (not the raw template assignment) and carries its id into the draft', () => {
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: { plan_name: 'My Plan', assignments: [] },
      isLoading: false,
    });
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [
          { id: 'plan-today', title: 'Push Day', workout_preset_id: 7 },
        ],
        missed: [],
      },
    });
    mockUseWorkoutPreset.mockReturnValue({
      data: {
        id: 7,
        name: 'Push Day',
        exercises: [{ exercise_id: 'ex-1', exercise_name: 'Bench', sets: [] }],
      },
    });

    render(<ActiveProgramWidget />);

    fireEvent.click(
      screen.getByRole('button', { name: /Start Today's Workout/ })
    );

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [path, options] = mockNavigate.mock.calls[0]!;
    expect(path).toMatch(/^\/workout-playback\?date=/);
    expect(options.state.draft.planned_workout_id).toBe('plan-today');
    expect(options.state.draft.preset_id).toBe('7');
  });

  it('falls back to a blank draft carrying the planned id when the day-view row has no preset', () => {
    mockUseActiveWorkoutPlan.mockReturnValue({
      data: { plan_name: 'My Plan', assignments: [] },
      isLoading: false,
    });
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [
          { id: 'plan-adhoc', title: 'Mobility', workout_preset_id: null },
        ],
        missed: [],
      },
    });

    render(<ActiveProgramWidget />);

    fireEvent.click(
      screen.getByRole('button', { name: /Start Today's Workout/ })
    );

    const [, options] = mockNavigate.mock.calls[0]!;
    expect(options.state.draft.preset_id).toBe('blank');
    expect(options.state.draft.planned_workout_id).toBe('plan-adhoc');
  });
});
