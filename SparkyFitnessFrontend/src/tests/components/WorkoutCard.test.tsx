import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { todayInZone } from '@workspace/shared';
import type { ExerciseSessionResponse } from '@workspace/shared';
import WorkoutCard from '@/pages/Home/WorkoutCard';

const mockNavigate = jest.fn();
// Computed from the real (unmocked) todayInZone so "today" here always
// matches what the component itself will compute — avoids needing fake
// timers just to pin a date.
const TODAY = todayInZone('UTC');
const PAST_DATE = '2020-01-01';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ weightUnit: 'kg', timezone: 'UTC' }),
}));

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'user-1' }),
}));

const mockUseExerciseEntries = jest.fn();
jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useExerciseEntries: (...args: unknown[]) => mockUseExerciseEntries(...args),
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

describe('WorkoutCard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseExerciseEntries.mockReset().mockReturnValue({ data: [] });
    mockUseWorkoutPreset.mockReset().mockReturnValue({ data: undefined });
    mockUsePlannedWorkoutDayView
      .mockReset()
      .mockReturnValue({ data: undefined });
    window.localStorage.clear();
  });

  it('shows the "+ Start Workout" fallback when nothing is planned, logged, or missed', () => {
    render(<WorkoutCard selectedDate={TODAY} />);

    const button = screen.getByRole('button', { name: /\+ Start Workout/ });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/workouts', {
      state: { openStartWorkout: true },
    });
  });

  it('prioritizes an already-logged session over a planned workout', () => {
    mockUseExerciseEntries.mockReturnValue({
      data: [
        {
          type: 'individual',
          id: 'entry-1',
          name: 'Bench Press',
          duration_minutes: 30,
          sets: [{ weight: 50, reps: 10 }],
        },
      ] as unknown as ExerciseSessionResponse[],
    });
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [
          { id: 'plan-1', title: 'Push Day', workout_preset_id: null },
        ],
        missed: [],
      },
    });

    render(<WorkoutCard selectedDate={TODAY} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Push Day')).not.toBeInTheDocument();
  });

  it('shows a clickable scheduled card for today and starts playback carrying the planned_workout_id', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [{ id: 'plan-1', title: 'Push Day', workout_preset_id: 42 }],
        missed: [],
      },
    });
    mockUseWorkoutPreset.mockReturnValue({
      data: {
        id: 42,
        name: 'Push Day',
        exercises: [
          { exercise_id: 'ex-1', exercise_name: 'Bench', sets: [] },
          { exercise_id: 'ex-2', exercise_name: 'Row', sets: [] },
        ],
      },
    });

    render(<WorkoutCard selectedDate={TODAY} />);

    const button = screen.getByRole('button', { name: /Push Day/ });
    expect(button).toHaveTextContent('2 exercises');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/workout-playback?date=${TODAY}`,
      expect.objectContaining({
        state: expect.objectContaining({
          draft: expect.objectContaining({ planned_workout_id: 'plan-1' }),
        }),
      })
    );
  });

  it('falls back to a blank draft (still carrying planned_workout_id) when the plan has no preset', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [
          { id: 'plan-2', title: 'Ad-hoc Mobility', workout_preset_id: null },
        ],
        missed: [],
      },
    });

    render(<WorkoutCard selectedDate={TODAY} />);

    fireEvent.click(screen.getByRole('button', { name: /Ad-hoc Mobility/ }));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/workout-playback?date=${TODAY}`,
      expect.objectContaining({
        state: expect.objectContaining({
          draft: expect.objectContaining({
            preset_id: 'blank',
            planned_workout_id: 'plan-2',
          }),
        }),
      })
    );
  });

  it('renders a scheduled plan for a non-today date as informational only, with no button', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: {
        for_date: [{ id: 'plan-3', title: 'Leg Day', workout_preset_id: null }],
        missed: [],
      },
    });

    render(<WorkoutCard selectedDate={PAST_DATE} />);

    expect(screen.getByText('Leg Day')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a compact missed-workouts indicator on today when nothing is scheduled but workouts were missed', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: { for_date: [], missed: [{ id: 'm1' }, { id: 'm2' }] },
    });

    render(<WorkoutCard selectedDate={TODAY} />);

    expect(screen.getByText('2 Missed')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not surface the missed indicator while browsing a non-today date — it stays the plain fallback', () => {
    mockUsePlannedWorkoutDayView.mockReturnValue({
      data: { for_date: [], missed: [{ id: 'm1' }] },
    });

    render(<WorkoutCard selectedDate={PAST_DATE} />);

    expect(screen.getByText('+ Start Workout')).toBeInTheDocument();
    expect(screen.queryByText(/Missed/)).not.toBeInTheDocument();
  });
});
