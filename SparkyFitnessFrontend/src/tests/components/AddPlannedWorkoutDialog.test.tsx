import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddPlannedWorkoutDialog from '@/pages/Exercises/AddPlannedWorkoutDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'UTC', loggingLevel: 'ERROR' }),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockCreatePlannedWorkout = jest.fn();
jest.mock('@/hooks/Exercises/usePlannedWorkouts', () => ({
  useCreatePlannedWorkoutMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockCreatePlannedWorkout(...args),
    isPending: false,
  }),
}));

// AddExerciseDialog itself is deep (search/preset tabs, custom-exercise form,
// each with their own data hooks) — the dialog under test only needs its
// onExerciseAdded/onWorkoutPresetSelected callbacks exercised, so it's
// replaced with a minimal stand-in that fires them directly. Its content
// isn't portaled the way the real component's Dialog content is, so it ends
// up outside the outer Dialog's own portal and gets marked aria-hidden by
// Radix's background inert-ing while the outer dialog is open — clicking via
// `getByText` (not `getByRole`) sidesteps that testing artifact since text
// queries don't filter on the accessibility tree.
jest.mock('@/pages/Exercises/AddExerciseDialog', () => {
  const MockAddExerciseDialog = ({
    open,
    onExerciseAdded,
    onWorkoutPresetSelected,
  }: {
    open: boolean;
    onExerciseAdded: (exercise: { id: string; name: string }) => void;
    onWorkoutPresetSelected: (preset: { id: number; name: string }) => void;
  }) => {
    if (!open) return null;
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            onExerciseAdded({ id: 'exercise-1', name: 'Bench Press' })
          }
        >
          Pick Bench Press Exercise
        </button>
        <button
          type="button"
          onClick={() =>
            onWorkoutPresetSelected({ id: 42, name: 'Upper Body Preset' })
          }
        >
          Pick Upper Body Preset
        </button>
      </div>
    );
  };
  return { __esModule: true, default: MockAddExerciseDialog };
});

const openPicker = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose Exercise or Preset' })
  );
const pickExercise = () =>
  fireEvent.click(screen.getByText('Pick Bench Press Exercise'));
const pickPreset = () =>
  fireEvent.click(screen.getByText('Pick Upper Body Preset'));

describe('AddPlannedWorkoutDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults the date to today when no initialDate is given, and requires a title', () => {
    render(<AddPlannedWorkoutDialog isOpen onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
    expect(mockCreatePlannedWorkout).not.toHaveBeenCalled();
  });

  it('uses the passed-in initialDate as the default planned date', () => {
    render(
      <AddPlannedWorkoutDialog
        isOpen
        onClose={jest.fn()}
        initialDate="2026-10-05"
      />
    );

    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-05');
  });

  it('submits a manual plan with only a title and date filled in', async () => {
    const onClose = jest.fn();
    mockCreatePlannedWorkout.mockResolvedValue({ id: 'new-id' });

    render(
      <AddPlannedWorkoutDialog
        isOpen
        onClose={onClose}
        initialDate="2026-10-05"
      />
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Leg Day' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(mockCreatePlannedWorkout).toHaveBeenCalledWith({
      title: 'Leg Day',
      planned_date: '2026-10-05',
      planned_time: null,
      duration_estimate_minutes: null,
      workout_type: null,
      workout_preset_id: null,
      exercise_id: null,
      notes: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('links an exercise picked from the reused AddExerciseDialog and defaults the title', () => {
    render(<AddPlannedWorkoutDialog isOpen onClose={jest.fn()} />);

    openPicker();
    pickExercise();

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Bench Press');
  });

  it('links a preset picked from the reused AddExerciseDialog, mutually exclusive with an exercise', () => {
    render(<AddPlannedWorkoutDialog isOpen onClose={jest.fn()} />);

    openPicker();
    pickPreset();

    expect(screen.getByText('Upper Body Preset')).toBeInTheDocument();
    // Selecting again replaces rather than stacking — only one link shown.
    expect(screen.getAllByText('Change')).toHaveLength(1);
  });

  it('sends the selected preset id (coerced to a number) on submit', async () => {
    mockCreatePlannedWorkout.mockResolvedValue({ id: 'new-id' });
    render(
      <AddPlannedWorkoutDialog
        isOpen
        onClose={jest.fn()}
        initialDate="2026-10-05"
      />
    );

    openPicker();
    pickPreset();
    fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    await waitFor(() => expect(mockCreatePlannedWorkout).toHaveBeenCalled());

    expect(mockCreatePlannedWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_preset_id: 42,
        exercise_id: null,
        title: 'Upper Body Preset',
      })
    );
  });

  it('clears a linked selection via the Clear control', () => {
    render(<AddPlannedWorkoutDialog isOpen onClose={jest.fn()} />);

    openPicker();
    pickExercise();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Choose Exercise or Preset' })
    ).toBeInTheDocument();
  });
});
