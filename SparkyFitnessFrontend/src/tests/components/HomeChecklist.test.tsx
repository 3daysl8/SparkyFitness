import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { addDays } from '@workspace/shared';
import HomeChecklist from '@/pages/Home/HomeChecklist';

const TODAY_INSTANT = '2026-04-27T23:59:30.000Z';
const TODAY = '2026-04-27';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

let mockPreferences = {
  timezone: 'UTC',
  firstDayOfWeek: 0,
  formatDate: (d: string) => d,
};
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => mockPreferences,
}));

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'user-1' }),
}));

jest.mock('@/contexts/WaterContainerContext', () => ({
  useWaterContainer: () => ({ activeContainer: null }),
}));

jest.mock('@/hooks/useFocus', () => ({
  useFocusDomains: () => ({ data: [] }),
  useCreateFocus: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpsertFocusCheckin: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteFocusCheckin: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useTodayFocusSnapshot: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useExerciseEntries: () => ({ data: [] }),
}));

const mockUsePlannedWorkoutDayView = jest.fn();
const mockMoveMutate = jest.fn();
const mockSkipMutate = jest.fn();
jest.mock('@/hooks/Exercises/usePlannedWorkouts', () => ({
  usePlannedWorkoutDayView: (...args: unknown[]) =>
    mockUsePlannedWorkoutDayView(...args),
  useMovePlannedWorkoutMutation: () => ({
    mutate: mockMoveMutate,
    isPending: false,
  }),
  useSkipPlannedWorkoutMutation: () => ({
    mutate: mockSkipMutate,
    isPending: false,
  }),
}));

jest.mock('@/hooks/Diary/useWaterIntake', () => ({
  useWaterIntakeQuery: () => ({ data: 0 }),
  useWaterGoalQuery: () => ({ data: 1920 }),
  useUpdateWaterIntakeMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/CheckIn/useSleep', () => ({
  useSleepEntriesQuery: () => ({ data: [] }),
}));

jest.mock('@/hooks/useMedications', () => ({
  useMedications: () => ({ data: [], isLoading: false }),
  useMedicationEntries: () => ({ data: [], isLoading: false }),
  useCreateMedicationEntryMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useDeleteMedicationEntryMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/pages/Home/AgendaCard', () => () => null);
jest.mock('@/pages/Home/ToDoCard', () => () => null);
jest.mock('@/pages/Home/FocusBanner', () => () => null);
jest.mock('@/pages/Home/DailyCheckpointCard', () => () => null);
jest.mock('@/pages/Home/SupplementsSnapshotCard', () => () => null);
jest.mock('@/pages/Home/HabitCard', () => () => null);

// WorkoutCard has its own dedicated test suite (tests/components/WorkoutCard.test.tsx)
// — here it's stubbed to a marker that surfaces the `selectedDate` HomeChecklist
// passes down, so these tests can verify HomeChecklist's own state management
// (week-strip reorder, midnight rollover) without re-testing WorkoutCard's internals.
jest.mock(
  '@/pages/Home/WorkoutCard',
  () =>
    ({ selectedDate }: { selectedDate: string }) => (
      <div data-testid="workout-card" data-selected-date={selectedDate} />
    )
);

describe('HomeChecklist', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(TODAY_INSTANT));
    mockPreferences = {
      timezone: 'UTC',
      firstDayOfWeek: 0,
      formatDate: (d: string) => d,
    };
    mockUsePlannedWorkoutDayView
      .mockReset()
      .mockReturnValue({ data: { for_date: [], missed: [] } });
    mockMoveMutate.mockReset();
    mockSkipMutate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on today and reorders the week strip per the firstDayOfWeek preference', () => {
    mockPreferences.firstDayOfWeek = 1;
    render(<HomeChecklist />);

    expect(screen.getByTestId('workout-card')).toHaveAttribute(
      'data-selected-date',
      TODAY
    );
    const dayLabels = screen
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      .map((el) => el.textContent);
    expect(dayLabels[0]).toBe('Mon');
  });

  it('defaults to a Sunday-first week strip when firstDayOfWeek is 0', () => {
    render(<HomeChecklist />);

    const dayLabels = screen
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      .map((el) => el.textContent);
    expect(dayLabels[0]).toBe('Sun');
  });

  it('rolls selectedDate forward at local midnight while the user is still viewing today', () => {
    render(<HomeChecklist />);
    expect(screen.getByTestId('workout-card')).toHaveAttribute(
      'data-selected-date',
      TODAY
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('workout-card')).toHaveAttribute(
      'data-selected-date',
      addDays(TODAY, 1)
    );
  });

  it('does not yank the user back to today if they had manually navigated to a different date before midnight', () => {
    const { container } = render(<HomeChecklist />);

    // The previous-week chevron is the first <button> in the whole tree —
    // every card mounted above it in the DOM (Agenda/ToDo/WorkoutCard) is
    // stubbed to render nothing interactive at this point.
    fireEvent.click(container.querySelectorAll('button')[0]!);
    expect(screen.getByTestId('workout-card')).toHaveAttribute(
      'data-selected-date',
      addDays(TODAY, -7)
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('workout-card')).toHaveAttribute(
      'data-selected-date',
      addDays(TODAY, -7)
    );
  });

  it('surfaces a missed-workouts nudge only while viewing today, with working Move-to-today and Skip actions', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [],
        missed: [
          { id: 'missed-1', title: 'Leg Day', planned_date: '2026-04-25' },
        ],
      },
    });

    render(<HomeChecklist />);

    expect(screen.getByText('Leg Day')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Move to today' }));
    expect(mockMoveMutate).toHaveBeenCalledWith({
      id: 'missed-1',
      data: { planned_date: TODAY },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockSkipMutate).toHaveBeenCalledWith('missed-1');
  });

  it('hides the missed-workouts nudge once the user navigates away from today', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [],
        missed: [
          { id: 'missed-1', title: 'Leg Day', planned_date: '2026-04-25' },
        ],
      },
    });
    const { container } = render(<HomeChecklist />);
    expect(screen.getByText('Leg Day')).toBeInTheDocument();

    fireEvent.click(container.querySelectorAll('button')[0]!);

    expect(screen.queryByText('Leg Day')).not.toBeInTheDocument();
  });
});
