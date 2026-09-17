import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyCheckpointCard from '@/pages/Home/DailyCheckpointCard';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'user-1' }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'UTC' }),
}));

jest.mock('@/hooks/useFocus', () => ({
  useTodayFocusSnapshot: () => ({
    data: {
      daily_recurring: [
        { id: 'h1', done: true },
        { id: 'h2', done: false },
      ],
    },
  }),
}));

jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useExerciseEntries: () => ({
    data: [{ id: 'ex-1', completed: true }],
  }),
}));

jest.mock('@/hooks/Diary/useWaterIntake', () => ({
  useWaterIntakeQuery: () => ({ data: 1500 }),
  useWaterGoalQuery: () => ({ data: 2000 }),
}));

jest.mock('@/hooks/CheckIn/useSleep', () => ({
  useSleepEntriesQuery: () => ({
    data: [{ id: 's-1', duration_in_seconds: 28800 }],
  }),
}));

jest.mock('@/hooks/useMedications', () => ({
  useMedications: () => ({ data: [] }),
  useMedicationEntries: () => ({ data: [] }),
}));

jest.mock('@/hooks/CheckIn/useMood', () => ({
  useMoodEntryByDate: () => ({
    data: { mood_score: 8 },
  }),
}));

jest.mock('@/hooks/CheckIn/useCheckIn', () => ({
  useCheckInMeasurementsForDate: () => ({
    data: [],
  }),
}));

describe('DailyCheckpointCard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders daily checkpoint progress and summary', () => {
    render(<DailyCheckpointCard selectedDate="2026-09-17" />);

    expect(
      screen.getByText('Daily Checkpoint & Accountability')
    ).toBeInTheDocument();
    expect(screen.getByText(/completed \(/)).toBeInTheDocument();
  });

  it('navigates when clicking a checkpoint tile', () => {
    render(<DailyCheckpointCard selectedDate="2026-09-17" />);

    // Expand the collapsible
    const trigger = screen.getByText('Daily Checkpoint & Accountability');
    fireEvent.click(trigger);

    const workoutTile = screen.getByText('Workout');
    fireEvent.click(workoutTile);

    expect(mockNavigate).toHaveBeenCalledWith('/workouts');
  });
});
