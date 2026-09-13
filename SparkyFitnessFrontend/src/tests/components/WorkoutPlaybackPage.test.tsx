import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutPlaybackPage from '@/pages/Exercises/WorkoutPlaybackPage';
import type { WorkoutPreset } from '@/types/workout';
import { createWorkoutPlaybackDraftFromPreset } from '@/utils/workoutPlayback';

const mockNavigate = jest.fn();
const mockCreatePresetSession = jest.fn();
const mockSearchParams = new URLSearchParams('date=2026-04-27');
let mockLocationState: { returnTo?: string; draft?: unknown } | null = null;

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
  useSearchParams: () => [mockSearchParams],
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ weightUnit: 'kg', timezone: 'UTC' }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/pages/Exercises/AddExerciseDialog', () => () => null);

jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useCreatePresetSessionMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockCreatePresetSession(...args),
    isPending: false,
  }),
  // No prior history in these fixtures — every exercise gets no "Previous: …"
  // hint and no PR baseline to compare against.
  useWorkoutExerciseStats: () => ({}),
}));

const mockUpsertHabitCheckin = jest.fn();

jest.mock('@/hooks/useFocus', () => ({
  useTodayFocusSnapshot: () => ({ data: undefined }),
  useUpsertFocusCheckin: () => ({
    mutateAsync: (...args: unknown[]) => mockUpsertHabitCheckin(...args),
  }),
}));

const presetFixture: WorkoutPreset = {
  id: 'preset-1',
  user_id: 'user-1',
  name: 'Upper Body',
  description: 'Push + Pull',
  exercises: [
    {
      exercise_id: 'exercise-1',
      exercise_name: 'Bench Press',
      sets: [{ set_number: 1, reps: 8, weight: 80, rest_time: 90 }],
    },
    {
      exercise_id: 'exercise-2',
      exercise_name: 'Barbell Row',
      sets: [{ set_number: 1, reps: 10, weight: 60, rest_time: 90 }],
    },
  ],
} as unknown as WorkoutPreset;

describe('WorkoutPlaybackPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreatePresetSession.mockReset();
    mockUpsertHabitCheckin.mockReset();
    window.localStorage.clear();
    mockLocationState = { returnTo: '/?date=2026-04-27' };
  });

  describe('finishing a workout', () => {
    it('shows the finish-summary modal with PR count after saving, then Done clears the draft and navigates away', async () => {
      const draft = createWorkoutPlaybackDraftFromPreset(
        presetFixture,
        '2026-04-27'
      );
      draft.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          set.completed = true;
        });
      });
      if (draft.exercises[0]?.sets[0]) {
        draft.exercises[0].sets[0].is_pr = true;
      }
      mockLocationState = { returnTo: '/?date=2026-04-27', draft };
      mockCreatePresetSession.mockResolvedValue(undefined);

      render(<WorkoutPlaybackPage />);
      // Mounting fires an unrelated one-time route-state-scrub navigate call
      // (see the scrubbedRouteStateRef effect) — not part of the finish flow.
      const navigateCallsBeforeFinish = mockNavigate.mock.calls.length;

      const finishButtons = screen.getAllByRole('button', {
        name: /finish workout/i,
      });
      fireEvent.click(finishButtons[0]!);

      await waitFor(() =>
        expect(mockCreatePresetSession).toHaveBeenCalledTimes(1)
      );
      expect(await screen.findByText('Workout Complete!')).toBeInTheDocument();
      expect(screen.getByText('1 Personal Record!')).toBeInTheDocument();
      // The draft/navigation are deferred until "Done" is pressed, not fired
      // immediately on save — the whole point of the recap step.
      expect(mockNavigate.mock.calls.length).toBe(navigateCallsBeforeFinish);

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(mockNavigate).toHaveBeenLastCalledWith('/?date=2026-04-27', {
        replace: true,
      });
      expect(
        window.localStorage.getItem('sparky.workoutPlaybackDraft.v1:2026-04-27')
      ).toBeNull();
    });

    it('does not show a personal-record callout when no set was a PR', async () => {
      const draft = createWorkoutPlaybackDraftFromPreset(
        presetFixture,
        '2026-04-27'
      );
      draft.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          set.completed = true;
        });
      });
      mockLocationState = { returnTo: '/?date=2026-04-27', draft };
      mockCreatePresetSession.mockResolvedValue(undefined);

      render(<WorkoutPlaybackPage />);

      const finishButtons = screen.getAllByRole('button', {
        name: /finish workout/i,
      });
      fireEvent.click(finishButtons[0]!);

      expect(await screen.findByText('Workout Complete!')).toBeInTheDocument();
      expect(screen.queryByText(/Personal Record/i)).not.toBeInTheDocument();
    });
  });

  it('shows elapsed timer and collapses completed exercises', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    if (draft.exercises[0]?.sets[0]) {
      draft.exercises[0].sets[0].completed = true;
    }
    draft.active_exercise_index = 1;
    draft.active_set_index = 0;
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    expect(screen.getAllByText('Duration').length).toBeGreaterThan(0);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(1);
  });

  it('renders duration instead of reps and weight for a timed set', () => {
    const timedPreset = {
      ...presetFixture,
      exercises: [
        {
          exercise_id: 'exercise-treadmill',
          exercise_name: 'Treadmill Warm Up',
          category: 'cardio',
          sets: [
            {
              set_number: 1,
              set_type: 'Warm-up',
              duration: 600,
              reps: null,
              weight: null,
              rest_time: 60,
            },
          ],
        },
      ],
    } as unknown as WorkoutPreset;
    const draft = createWorkoutPlaybackDraftFromPreset(
      timedPreset,
      '2026-04-27'
    );
    expect(draft.exercises[0]?.modality).toBe('duration_distance');
    // Pre-modality local drafts must retain their time-based rendering.
    delete (draft.exercises[0] as { modality?: unknown }).modality;
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    expect(screen.getByText('Duration (s)')).toBeInTheDocument();
    const durationInput = screen.getByLabelText(
      'Duration set 1'
    ) as HTMLInputElement;
    expect(durationInput).toHaveValue(600);
    fireEvent.change(durationInput, { target: { value: '300' } });
    expect(durationInput).toHaveValue(300);
    expect(screen.queryByLabelText('Reps set 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Weight set 1')).not.toBeInTheDocument();
  });

  it('keeps blank rows duration-based in legacy timed drafts', () => {
    const timedPreset = {
      ...presetFixture,
      exercises: [
        {
          exercise_id: 'exercise-treadmill',
          exercise_name: 'Treadmill Warm Up',
          category: 'cardio',
          sets: [
            {
              set_number: 1,
              duration: 600,
              reps: null,
              weight: 0,
              rest_time: 60,
            },
          ],
        },
      ],
    } as unknown as WorkoutPreset;
    const draft = createWorkoutPlaybackDraftFromPreset(
      timedPreset,
      '2026-04-27'
    );
    delete (draft.exercises[0] as { modality?: unknown }).modality;
    draft.exercises[0]?.sets.push({
      set_number: 2,
      duration: null,
      reps: null,
      weight: null,
      rest_time: 60,
      completed: false,
      completed_at: null,
    });
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    expect(screen.getByText('Duration (s)')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration set 1')).toHaveValue(600);
    expect(screen.getByLabelText('Duration set 2')).toHaveValue(null);
    expect(screen.queryByLabelText('Reps set 2')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Weight set 2')).not.toBeInTheDocument();
  });

  it('trusts exercise modality over stale set data', () => {
    const mixedPreset = {
      ...presetFixture,
      exercises: [
        {
          exercise_id: 'exercise-plank',
          exercise_name: 'Plank',
          category: 'isometric',
          sets: [
            {
              set_number: 1,
              duration: null,
              reps: null,
              weight: null,
              rest_time: 60,
            },
          ],
        },
        {
          exercise_id: 'exercise-bench',
          exercise_name: 'Bench Press',
          sets: [
            {
              set_number: 1,
              duration: 600,
              reps: null,
              weight: 80,
              rest_time: 90,
            },
          ],
        },
      ],
    } as unknown as WorkoutPreset;
    const draft = createWorkoutPlaybackDraftFromPreset(
      mixedPreset,
      '2026-04-27'
    );
    expect(draft.exercises[0]?.modality).toBe('duration');
    expect(draft.exercises[1]?.modality).toBe('weight_reps');
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    // Plank is timed by modality even with no duration values yet.
    expect(screen.getByLabelText('Duration set 1')).toHaveValue(null);
    // Bench keeps reps/weight despite a stale duration on its set.
    expect(screen.getByLabelText('Reps set 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight set 1')).toBeInTheDocument();
  });

  it('restores a draft from localStorage on reload', async () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    window.localStorage.setItem(
      'sparky.workoutPlaybackDraft.v1:2026-04-27',
      JSON.stringify(draft)
    );
    mockLocationState = { returnTo: '/?date=2026-04-27' };

    render(<WorkoutPlaybackPage />);

    await waitFor(() => {
      expect(screen.getByText('Upper Body')).toBeInTheDocument();
    });
    expect(screen.getAllByLabelText('Reps set 1')[0]).toBeInTheDocument();
  });

  it('starts rest countdown when current set is completed', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Complete set 1')[0]!);

    expect(
      screen.getAllByRole('button', { name: 'Pause' }).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Pause').length).toBeGreaterThan(0);
    expect(screen.getByText('640')).toBeInTheDocument();
  });

  it('allows editing set values and adding/removing sets', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    const repsInput = screen.getAllByLabelText(
      'Reps set 1'
    )[0] as HTMLInputElement;
    fireEvent.change(repsInput, { target: { value: '12' } });
    expect(repsInput.value).toBe('12');

    fireEvent.click(screen.getByLabelText('Add set for Bench Press'));
    expect(screen.getAllByLabelText('Reps set 2').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByLabelText('Remove set 2 for Bench Press')[0]!
    );
    expect(screen.queryByLabelText('Reps set 2')).not.toBeInTheDocument();

    const sessionNotes = screen.getAllByPlaceholderText(
      'Any notes about this session...'
    )[0] as HTMLTextAreaElement;
    fireEvent.change(sessionNotes, { target: { value: 'Felt strong today' } });
    expect(sessionNotes.value).toBe('Felt strong today');

    expect(screen.queryByLabelText('Set notes 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Toggle notes for set 1')[0]!);
    expect(screen.getByLabelText('Set notes 1')).toBeInTheDocument();
  });

  it('clears the start time when the clear button is clicked', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    draft.started_at = '2026-04-27T14:30:00.000Z';
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    const startTimeInput = screen.getByLabelText(
      'Start Time'
    ) as HTMLInputElement;
    expect(startTimeInput.value).toBe('14:30');

    fireEvent.click(screen.getByText('Clear'));
    expect(startTimeInput.value).toBe('');
  });

  it('allows extending a finished exercise after expanding it', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    if (draft.exercises[0]?.sets[0]) {
      draft.exercises[0].sets[0].completed = true;
    }
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getByLabelText('Expand Bench Press'));
    fireEvent.click(screen.getByLabelText('Add set for Bench Press'));

    expect(screen.getAllByLabelText('Reps set 2').length).toBeGreaterThan(0);
  });

  it('edits rest via rest chip presets', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Edit rest for set 1')[0]!);
    fireEvent.click(screen.getByRole('button', { name: '2:00' }));

    fireEvent.click(screen.getAllByLabelText('Edit rest for set 1')[0]!);
    expect(screen.getByLabelText('Custom (seconds)')).toHaveValue(120);
  });

  it('keeps rest indicator anchored to next set even when selecting others', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    if (draft.exercises[0]?.sets[0]) {
      draft.exercises[0].sets.push({
        ...draft.exercises[0].sets[0],
        set_number: 2,
      });
    }
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Complete set 1')[0]!);
    expect(screen.getAllByLabelText('Pause').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByLabelText('Select set 2 for Bench Press')[0]!
    );

    expect(screen.getAllByLabelText('Pause').length).toBeGreaterThan(0);
  });
});
