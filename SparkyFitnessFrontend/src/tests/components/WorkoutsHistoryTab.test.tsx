import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutsHistoryTab from '@/pages/Exercises/WorkoutsHistoryTab';
import type { ExerciseSessionResponse } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/workouts', search: '' }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/utils/workoutPlayback', () => ({
  createWorkoutPlaybackRouteStateFromSession: () => ({}),
}));

const individualSession = {
  type: 'individual',
  id: 'entry-1',
  entry_date: '2026-09-10',
  name: 'Morning Run',
} as unknown as ExerciseSessionResponse;

const presetSession = {
  type: 'preset',
  id: 'preset-entry-1',
  entry_date: '2026-09-11',
  name: 'Upper Body Day',
} as unknown as ExerciseSessionResponse;

const mockUseExerciseEntryHistoryPage = jest.fn();
const mockDeleteExerciseEntry = jest.fn();
const mockDeleteExercisePresetEntry = jest.fn();

jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useExerciseEntryHistoryPage: (...args: unknown[]) =>
    mockUseExerciseEntryHistoryPage(...args),
  useDeleteExerciseEntryMutation: () => ({
    mutate: mockDeleteExerciseEntry,
  }),
  useDeleteExercisePresetEntryMutation: () => ({
    mutate: mockDeleteExercisePresetEntry,
  }),
}));

// The card's own rendering/expand behavior is covered by
// WorkoutHistorySessionCard.test.tsx — this stubs it down to just the two
// action affordances so the tab's delete-confirmation wiring is what's
// actually under test here.
jest.mock('@/pages/Exercises/WorkoutHistorySessionCard', () => ({
  __esModule: true,
  default: ({
    session,
    onDelete,
  }: {
    session: ExerciseSessionResponse;
    onRepeat: () => void;
    onDelete: () => void;
  }) => (
    <div>
      <span>{session.name}</span>
      <button onClick={onDelete}>{`Delete ${session.name}`}</button>
    </div>
  ),
}));

describe('WorkoutsHistoryTab delete flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks for confirmation before deleting, and does nothing if cancelled', () => {
    mockUseExerciseEntryHistoryPage.mockReturnValue({
      data: {
        sessions: [individualSession],
        pagination: { totalCount: 1 },
      },
      isLoading: false,
      isFetching: false,
    });

    render(<WorkoutsHistoryTab />);

    fireEvent.click(screen.getByText('Delete Morning Run'));
    expect(screen.getByText('Delete this workout?')).toBeInTheDocument();
    expect(mockDeleteExerciseEntry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDeleteExerciseEntry).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete this workout?')).not.toBeInTheDocument();
  });

  it('deletes an individual session via the entry route on confirm', () => {
    mockUseExerciseEntryHistoryPage.mockReturnValue({
      data: {
        sessions: [individualSession],
        pagination: { totalCount: 1 },
      },
      isLoading: false,
      isFetching: false,
    });

    render(<WorkoutsHistoryTab />);

    fireEvent.click(screen.getByText('Delete Morning Run'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteExerciseEntry).toHaveBeenCalledWith('entry-1');
    expect(mockDeleteExercisePresetEntry).not.toHaveBeenCalled();
  });

  it('deletes a grouped preset session via the preset-entry route on confirm', () => {
    mockUseExerciseEntryHistoryPage.mockReturnValue({
      data: {
        sessions: [presetSession],
        pagination: { totalCount: 1 },
      },
      isLoading: false,
      isFetching: false,
    });

    render(<WorkoutsHistoryTab />);

    fireEvent.click(screen.getByText('Delete Upper Body Day'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteExercisePresetEntry).toHaveBeenCalledWith(
      'preset-entry-1'
    );
    expect(mockDeleteExerciseEntry).not.toHaveBeenCalled();
  });
});
