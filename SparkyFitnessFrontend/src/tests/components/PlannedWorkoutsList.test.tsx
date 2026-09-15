import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlannedWorkoutsList from '@/pages/Exercises/PlannedWorkoutsList';
import type { PlannedWorkoutResponse } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    timezone: 'UTC',
    // Pure pass-through so assertions can just match the raw planned_date —
    // the real formatter's timezone/locale logic is exercised elsewhere.
    formatDateInUserTimezone: (date: string) => date,
  }),
}));

const mockUsePlannedWorkoutsRange = jest.fn();
const mockMove = jest.fn();
const mockSkip = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/hooks/Exercises/usePlannedWorkouts', () => ({
  usePlannedWorkoutsRange: (...args: unknown[]) =>
    mockUsePlannedWorkoutsRange(...args),
  useMovePlannedWorkoutMutation: () => ({
    mutate: mockMove,
    isPending: false,
  }),
  useSkipPlannedWorkoutMutation: () => ({
    mutate: mockSkip,
    isPending: false,
  }),
  useDeletePlannedWorkoutMutation: () => ({
    mutate: mockDelete,
    isPending: false,
  }),
}));

const buildRow = (
  overrides: Partial<PlannedWorkoutResponse> = {}
): PlannedWorkoutResponse =>
  ({
    id: 'row-1',
    planned_date: '2026-09-20',
    planned_time: null,
    duration_estimate_minutes: null,
    title: 'Leg Day',
    workout_preset_id: null,
    exercise_id: null,
    workout_type: null,
    notes: null,
    status: 'planned',
    is_missed: false,
    started_at: null,
    completed_at: null,
    completed_session_id: null,
    origin: 'manual',
    template_id: null,
    assignment_id: null,
    user_modified: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }) as PlannedWorkoutResponse;

describe('PlannedWorkoutsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when there are no rows', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({ data: [], isLoading: false });

    render(<PlannedWorkoutsList />);

    expect(
      screen.getByText(
        "Nothing planned yet — plan a workout and it'll show up here."
      )
    ).toBeInTheDocument();
  });

  it('renders rows sorted by date then time, regardless of fetch order', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [
        buildRow({
          id: 'later',
          planned_date: '2026-09-21',
          title: 'Later Day',
        }),
        buildRow({
          id: 'earlier-late-time',
          planned_date: '2026-09-20',
          planned_time: '18:00:00',
          title: 'Evening Session',
        }),
        buildRow({
          id: 'earlier-early-time',
          planned_date: '2026-09-20',
          planned_time: '06:00:00',
          title: 'Morning Session',
        }),
      ],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    const titles = screen
      .getAllByText(/Session|Later Day/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Morning Session', 'Evening Session', 'Later Day']);
  });

  it('shows a missed badge only when the row is flagged missed', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [buildRow({ is_missed: true })],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    expect(screen.getByText('Missed')).toBeInTheDocument();
  });

  it('disables Skip and Delete for a completed row and enables them for a planned row', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [
        buildRow({ id: 'planned-row', status: 'planned' }),
        buildRow({ id: 'completed-row', status: 'completed' }),
      ],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    const skipButtons = screen.getAllByRole('button', { name: 'Skip' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });

    // planned row first (2026-09-20 sorts before... both rows share the same
    // date/time in this fixture, so order follows array order deterministically
    // since Array.prototype.sort is stable).
    expect(skipButtons[0]).toBeEnabled();
    expect(deleteButtons[0]).toBeEnabled();
    expect(skipButtons[1]).toBeDisabled();
    expect(deleteButtons[1]).toBeDisabled();
  });

  it('enables Delete for a skipped row with no linked session', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [
        buildRow({
          status: 'skipped',
          completed_session_id: null,
        }),
      ],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    // Skip is a status: 'planned'-only route — a skipped row can't be skipped again.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
  });

  it('calls the skip mutation with the row id when Skip is clicked', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [buildRow({ id: 'row-to-skip', status: 'planned' })],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(mockSkip).toHaveBeenCalledWith('row-to-skip');
  });

  it('calls the delete mutation with the row id when Delete is clicked', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [buildRow({ id: 'row-to-delete', status: 'planned' })],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDelete).toHaveBeenCalledWith('row-to-delete');
  });

  it('moves a row to the date/time entered in the Move popover', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [
        buildRow({
          id: 'row-to-move',
          planned_date: '2026-09-20',
          planned_time: '06:00:00',
          status: 'planned',
        }),
      ],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    fireEvent.click(screen.getByRole('button', { name: /Move/i }));

    const dateInput = screen.getByLabelText('Date');
    expect(dateInput).toHaveValue('2026-09-20');
    fireEvent.change(dateInput, { target: { value: '2026-09-25' } });

    const timeInput = screen.getByLabelText('Time (optional)');
    expect(timeInput).toHaveValue('06:00');
    fireEvent.change(timeInput, { target: { value: '07:30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Move' }));

    expect(mockMove).toHaveBeenCalledWith(
      {
        id: 'row-to-move',
        data: { planned_date: '2026-09-25', planned_time: '07:30' },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('disables Move for a row that is not in planned status', () => {
    mockUsePlannedWorkoutsRange.mockReturnValue({
      data: [buildRow({ status: 'started' })],
      isLoading: false,
    });

    render(<PlannedWorkoutsList />);

    expect(screen.getByRole('button', { name: /Move/i })).toBeDisabled();
  });
});
