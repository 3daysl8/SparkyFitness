import type { WorkoutPreset } from '@/types/workout';
import type { ExerciseSessionResponse } from '@workspace/shared';
import {
  addWorkoutSetToExercise,
  clearWorkoutPlaybackDraftFromStorage,
  buildPresetSessionCreateRequestFromDraft,
  completeCurrentWorkoutSet,
  createBlankWorkoutPlaybackDraft,
  createWorkoutPlaybackDraftFromPreset,
  createWorkoutPlaybackDraftFromSession,
  createWorkoutPlaybackRouteState,
  createWorkoutPlaybackRouteStateFromSession,
  ensureWorkoutPlaybackDraftClientRequestId,
  getCurrentWorkoutSetPointer,
  getWorkoutPlaybackPlausibilityWarnings,
  getWorkoutPlaybackStats,
  getWorkoutPlaybackRestRemainingSeconds,
  getWorkoutPlaybackDraftStorageKey,
  loadWorkoutPlaybackDraftFromStorage,
  pauseWorkoutPlayback,
  removeWorkoutSetFromExercise,
  resumeWorkoutPlayback,
  substituteExerciseInWorkoutDraft,
  removeExerciseFromWorkoutDraft,
  saveWorkoutPlaybackDraftToStorage,
  setWorkoutPlaybackPointer,
  toggleWorkoutPlaybackPause,
  getWorkoutPlaybackElapsedSeconds,
  toggleWorkoutSetCompletion,
  updateWorkoutSetAtPointer,
  listWorkoutSetPointers,
  groupPlaybackExerciseWithNext,
  ungroupPlaybackExercise,
} from '@/utils/workoutPlayback';

const createPresetFixture = (): WorkoutPreset =>
  ({
    id: 'preset-1',
    user_id: 'user-1',
    name: 'Upper Body',
    description: 'Push + Pull',
    exercises: [
      {
        exercise_id: 'exercise-1',
        exercise_name: 'Bench Press',
        sets: [
          { set_number: 1, reps: 8, weight: 80, rest_time: 90 },
          { set_number: 2, reps: 8, weight: 80, rest_time: 90 },
        ],
      },
      {
        exercise_id: 'exercise-2',
        exercise_name: 'Barbell Row',
        sets: [{ set_number: 1, reps: 10, weight: 60, rest_time: 90 }],
      },
    ],
  }) as unknown as WorkoutPreset;

const createPresetSessionFixture = (): ExerciseSessionResponse =>
  ({
    type: 'preset',
    id: 'session-1',
    entry_date: '2026-05-01',
    workout_preset_id: 42,
    name: 'Push Day A',
    description: 'Chest + Shoulders',
    exercises: [
      {
        id: 'entry-1',
        exercise_id: 'exercise-1',
        exercise_snapshot: { name: 'Bench Press' },
        sets: [
          {
            id: 1,
            set_number: 1,
            set_type: 'Working Set',
            reps: 8,
            weight: 82.5,
            rest_time: 90,
            is_pr: true,
          },
          {
            id: 2,
            set_number: 2,
            set_type: 'Working Set',
            reps: 8,
            weight: 82.5,
            rest_time: 90,
            is_pr: false,
          },
        ],
      },
    ],
  }) as unknown as ExerciseSessionResponse;

const createIndividualSessionFixture = (): ExerciseSessionResponse =>
  ({
    type: 'individual',
    id: 'entry-9',
    exercise_id: 'exercise-9',
    entry_date: '2026-05-02',
    name: 'Evening Run',
    exercise_snapshot: { name: 'Running' },
    sets: [],
  }) as unknown as ExerciseSessionResponse;

describe('workoutPlayback utils', () => {
  it('creates a local draft from a past preset session ("Repeat Workout")', () => {
    const draft = createWorkoutPlaybackDraftFromSession(
      createPresetSessionFixture(),
      '2026-05-10'
    );

    expect(draft.name).toBe('Push Day A');
    expect(draft.entry_date).toBe('2026-05-10');
    expect(draft.preset_id).toBe('42');
    expect(draft.exercises).toHaveLength(1);
    expect(draft.exercises[0]?.exercise_name).toBe('Bench Press');
    expect(draft.exercises[0]?.sets).toHaveLength(2);
    expect(draft.exercises[0]?.sets[0]?.weight).toBe(82.5);
    // Every set starts uncompleted again, even ones that were PRs last time.
    expect(
      draft.exercises
        .flatMap((exercise) => exercise.sets)
        .every((set) => !set.completed)
    ).toBe(true);
  });

  it('falls back to a single blank set when repeating a session with no logged sets', () => {
    const draft = createWorkoutPlaybackDraftFromSession(
      createIndividualSessionFixture(),
      '2026-05-10'
    );

    expect(draft.name).toBe('Evening Run');
    expect(draft.preset_id).toBe('blank');
    expect(draft.exercises).toHaveLength(1);
    expect(draft.exercises[0]?.exercise_name).toBe('Running');
    expect(draft.exercises[0]?.sets).toHaveLength(1);
    expect(draft.exercises[0]?.sets[0]?.completed).toBe(false);
  });

  it('builds a route state from a session that carries the draft and return path', () => {
    const routeState = createWorkoutPlaybackRouteStateFromSession(
      createPresetSessionFixture(),
      '2026-05-10',
      '/workouts?tab=history'
    );

    expect(routeState.returnTo).toBe('/workouts?tab=history');
    expect(routeState.draft?.entry_date).toBe('2026-05-10');
    expect(routeState.draft?.name).toBe('Push Day A');
  });

  it('creates a local draft from a workout preset', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    expect(draft.name).toBe('Upper Body');
    expect(draft.entry_date).toBe('2026-04-27');
    expect(draft.exercises).toHaveLength(2);
    expect(draft.exercises[0]?.sets).toHaveLength(2);
    expect(
      draft.exercises
        .flatMap((exercise) => exercise.sets)
        .every((set) => !set.completed)
    ).toBe(true);
  });

  it('builds a route state that carries the draft and return path', () => {
    const routeState = createWorkoutPlaybackRouteState(
      createPresetFixture(),
      '2026-04-27',
      '/diary'
    );

    expect(routeState.returnTo).toBe('/diary');
    expect(routeState.draft?.entry_date).toBe('2026-04-27');
    expect(routeState.draft?.name).toBe('Upper Body');
    expect(routeState.draft?.planned_workout_id).toBeNull();
  });

  it('threads an optional planned_workout_id through preset draft construction, route state, and the blank draft', () => {
    const presetDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27',
      'plan-123'
    );
    expect(presetDraft.planned_workout_id).toBe('plan-123');

    const routeState = createWorkoutPlaybackRouteState(
      createPresetFixture(),
      '2026-04-27',
      '/diary',
      'plan-123'
    );
    expect(routeState.draft?.planned_workout_id).toBe('plan-123');

    const blankDraft = createBlankWorkoutPlaybackDraft(
      '2026-04-27',
      'plan-456'
    );
    expect(blankDraft.planned_workout_id).toBe('plan-456');

    // Omitting it (the un-planned launch path) still defaults to null rather
    // than undefined, so a persisted draft always has the field.
    expect(
      createWorkoutPlaybackDraftFromPreset(createPresetFixture(), '2026-04-27')
        .planned_workout_id
    ).toBeNull();
  });

  it('includes planned_workout_id in the session-create payload when the draft carries one, and omits it otherwise', () => {
    const planned = toggleWorkoutSetCompletion(
      createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27',
        'plan-789'
      ),
      { exerciseIndex: 0, setIndex: 0 }
    );
    const plannedPayload = buildPresetSessionCreateRequestFromDraft(
      planned,
      'UTC'
    );
    expect(plannedPayload.planned_workout_id).toBe('plan-789');

    const unplanned = toggleWorkoutSetCompletion(
      createWorkoutPlaybackDraftFromPreset(createPresetFixture(), '2026-04-27'),
      { exerciseIndex: 0, setIndex: 0 }
    );
    const unplannedPayload = buildPresetSessionCreateRequestFromDraft(
      unplanned,
      'UTC'
    );
    expect(unplannedPayload.planned_workout_id).toBeUndefined();
  });

  it('saves, loads, and clears a persisted draft by date', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    saveWorkoutPlaybackDraftToStorage(draft);
    expect(
      window.localStorage.getItem(
        getWorkoutPlaybackDraftStorageKey('2026-04-27')
      )
    ).not.toBeNull();

    const restored = loadWorkoutPlaybackDraftFromStorage('2026-04-27');

    expect(restored?.preset_id).toBe('preset-1');
    expect(restored?.entry_date).toBe('2026-04-27');

    clearWorkoutPlaybackDraftFromStorage('2026-04-27');
    expect(
      window.localStorage.getItem(
        getWorkoutPlaybackDraftStorageKey('2026-04-27')
      )
    ).toBeNull();
  });

  it('derives rest remaining from the target end timestamp', () => {
    expect(
      getWorkoutPlaybackRestRemainingSeconds(
        {
          state: 'running',
          duration_seconds: 90,
          remaining_seconds: 90,
          target_end_timestamp_ms: 1_030_000,
        },
        1_000_000
      )
    ).toBe(30);
  });

  it('marks the current set complete and advances the active pointer', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const nextDraft = completeCurrentWorkoutSet(initialDraft);
    const pointer = getCurrentWorkoutSetPointer(nextDraft);
    const stats = getWorkoutPlaybackStats(nextDraft);

    expect(nextDraft.exercises[0]?.sets[0]?.completed).toBe(true);
    expect(pointer).toEqual({ exerciseIndex: 0, setIndex: 1 });
    expect(stats.completedSets).toBe(1);
    expect(stats.totalSets).toBe(3);
  });

  it('builds grouped-session payload from completed sets only', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    let nextDraft = toggleWorkoutSetCompletion(initialDraft, {
      exerciseIndex: 0,
      setIndex: 0,
    });
    nextDraft = toggleWorkoutSetCompletion(nextDraft, {
      exerciseIndex: 1,
      setIndex: 0,
    });

    const payload = buildPresetSessionCreateRequestFromDraft(nextDraft, 'UTC');

    expect(payload.name).toBe('Upper Body');
    expect(payload.source).toBe('sparky');
    expect(payload.exercises).toHaveLength(2);
    expect(payload.exercises?.[0]?.sets).toHaveLength(1);
    expect(payload.exercises?.[0]?.sets?.[0]?.set_number).toBe(1);
    expect(payload.exercises?.[1]?.sets).toHaveLength(1);
    // Web playback never claims a PR — the server owns detection.
    expect(payload.exercises?.[0]?.sets?.[0]?.is_pr).toBe(false);
    expect(payload.exercises?.[1]?.sets?.[0]?.is_pr).toBe(false);
  });

  it('carries programmed cardio duration and distance from preset to draft to payload', () => {
    const cardioPreset = {
      ...createPresetFixture(),
      exercises: [
        {
          exercise_id: 'exercise-3',
          exercise_name: 'Treadmill Run',
          sets: [
            {
              set_number: 1,
              reps: null,
              weight: null,
              duration: 1500,
              distance: 5.2,
              rest_time: 0,
            },
          ],
        },
      ],
    } as unknown as WorkoutPreset;

    const draft = createWorkoutPlaybackDraftFromPreset(
      cardioPreset,
      '2026-04-27'
    );
    expect(draft.exercises[0]?.sets[0]?.duration).toBe(1500);
    expect(draft.exercises[0]?.sets[0]?.distance).toBe(5.2);

    // An added set duplicates the last set's programmed effort too.
    const withAddedSet = addWorkoutSetToExercise(draft, 0);
    expect(withAddedSet.exercises[0]?.sets[1]?.distance).toBe(5.2);

    const completedDraft = toggleWorkoutSetCompletion(draft, {
      exerciseIndex: 0,
      setIndex: 0,
    });
    const payload = buildPresetSessionCreateRequestFromDraft(
      completedDraft,
      'UTC'
    );
    expect(payload.exercises?.[0]?.sets?.[0]?.duration).toBe(1500);
    expect(payload.exercises?.[0]?.sets?.[0]?.distance).toBe(5.2);
  });

  it('stamps completed_at on toggle-on and clears it on toggle-off', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );
    const pointer = { exerciseIndex: 0, setIndex: 0 };

    const before = Date.now();
    const checked = toggleWorkoutSetCompletion(initialDraft, pointer);
    const stamped = checked.exercises[0]?.sets[0]?.completed_at;
    expect(stamped).toBeTruthy();
    expect(Date.parse(stamped!)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(stamped!)).toBeLessThanOrEqual(Date.now());

    const unchecked = toggleWorkoutSetCompletion(checked, pointer);
    expect(unchecked.exercises[0]?.sets[0]?.completed).toBe(false);
    expect(unchecked.exercises[0]?.sets[0]?.completed_at).toBeNull();
  });

  it('stamps completed_at when auto-completing the current set', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const nextDraft = completeCurrentWorkoutSet(initialDraft);
    const set = nextDraft.exercises[0]?.sets[0];
    expect(set?.completed).toBe(true);
    expect(set?.completed_at).toBeTruthy();
  });

  it('emits completed_at in the grouped-session payload', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const nextDraft = toggleWorkoutSetCompletion(initialDraft, {
      exerciseIndex: 0,
      setIndex: 0,
    });
    const stamped = nextDraft.exercises[0]?.sets[0]?.completed_at;

    const payload = buildPresetSessionCreateRequestFromDraft(nextDraft, 'UTC');
    expect(payload.exercises?.[0]?.sets?.[0]?.completed_at).toBe(stamped);
  });

  it('emits null completed_at for persisted drafts that predate the field', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );
    // A legacy localStorage draft: sets marked completed but no completed_at.
    const legacyDraft = {
      ...draft,
      exercises: draft.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          const { completed_at: _completedAt, ...rest } = set;
          return { ...rest, completed: true } as typeof set;
        }),
      })),
    };

    const payload = buildPresetSessionCreateRequestFromDraft(
      legacyDraft,
      'UTC'
    );
    expect(payload.exercises?.[0]?.sets?.[0]?.completed_at).toBeNull();
  });

  it('tracks exercise timing when the active exercise changes', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const movedDraft = setWorkoutPlaybackPointer(initialDraft, {
      exerciseIndex: 1,
      setIndex: 0,
    });

    expect(movedDraft.exercises[0]?.started_at).toBeTruthy();
    expect(movedDraft.exercises[0]?.ended_at).toBeTruthy();
    expect(movedDraft.exercises[1]?.started_at).toBeTruthy();
    expect(movedDraft.exercises[1]?.ended_at).toBeNull();
  });

  it('derives duration from when sets were completed, not from wall-clock time', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    // The exercise was opened hours before the sets were done and, as the
    // last exercise, never got an ended_at before Finish.
    const idleDraft = {
      ...draft,
      exercises: draft.exercises.map((exercise, index) =>
        index === 0
          ? {
              ...exercise,
              started_at: '2026-04-27T04:00:00.000Z',
              ended_at: null,
              sets: exercise.sets.map((set, setIndex) => ({
                ...set,
                completed: true,
                completed_at: `2026-04-27T10:0${setIndex * 3}:00.000Z`,
              })),
            }
          : exercise
      ),
    };

    const payload = buildPresetSessionCreateRequestFromDraft(idleDraft, 'UTC');

    expect(payload.exercises?.[0]?.duration_minutes).toBeCloseTo(3, 5);
  });

  it('caps an idle gap between two completed sets', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );
    const completedAt = [
      '2026-04-27T10:00:00.000Z',
      '2026-04-27T16:46:00.000Z',
    ];
    const idleDraft = {
      ...draft,
      exercises: draft.exercises.map((exercise, index) =>
        index === 0
          ? {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) => ({
                ...set,
                completed: true,
                completed_at: completedAt[setIndex] ?? null,
              })),
            }
          : exercise
      ),
    };

    const payload = buildPresetSessionCreateRequestFromDraft(idleDraft, 'UTC');

    expect(payload.exercises?.[0]?.duration_minutes).toBeLessThanOrEqual(5);
  });

  it('gives every new draft its own UUID client_request_id', () => {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = [
      createWorkoutPlaybackDraftFromPreset(createPresetFixture(), '2026-04-27'),
      createWorkoutPlaybackDraftFromSession(
        createPresetSessionFixture(),
        '2026-04-27'
      ),
      createBlankWorkoutPlaybackDraft('2026-04-27'),
    ].map((draft) => draft.client_request_id);

    ids.forEach((id) => expect(id).toMatch(uuid));
    expect(new Set(ids).size).toBe(3);
  });

  it('keeps the id across storage and accepts stored drafts that predate it', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );
    saveWorkoutPlaybackDraftToStorage(draft);
    expect(
      loadWorkoutPlaybackDraftFromStorage('2026-04-27')?.client_request_id
    ).toBe(draft.client_request_id);

    const { client_request_id: _clientRequestId, ...legacyDraft } = draft;
    window.localStorage.setItem(
      getWorkoutPlaybackDraftStorageKey('2026-04-27'),
      JSON.stringify(legacyDraft)
    );
    const restored = loadWorkoutPlaybackDraftFromStorage('2026-04-27');
    expect(restored).not.toBeNull();
    expect(restored?.client_request_id).toBeUndefined();

    const ensured = ensureWorkoutPlaybackDraftClientRequestId(restored!);
    expect(ensured.client_request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(ensureWorkoutPlaybackDraftClientRequestId(ensured)).toBe(ensured);

    clearWorkoutPlaybackDraftFromStorage('2026-04-27');
  });

  it('sends the client_request_id and a numeric workout_preset_id', () => {
    const complete = (
      draft: ReturnType<typeof createBlankWorkoutPlaybackDraft>
    ) => ({
      ...draft,
      exercises: draft.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set, completed: true })),
      })),
    });

    const numericDraft = complete(
      createWorkoutPlaybackDraftFromPreset(
        { ...createPresetFixture(), id: 42 },
        '2026-04-27'
      )
    );
    const numericPayload = buildPresetSessionCreateRequestFromDraft(
      numericDraft,
      'UTC'
    );
    expect(numericPayload.client_request_id).toBe(
      numericDraft.client_request_id
    );
    expect(numericPayload.workout_preset_id).toBe(42);

    const repeated = createWorkoutPlaybackDraftFromSession(
      createPresetSessionFixture(),
      '2026-04-27'
    );
    expect(
      buildPresetSessionCreateRequestFromDraft(complete(repeated), 'UTC')
        .workout_preset_id
    ).toBe(42);

    const nonNumericDraft = complete(
      createWorkoutPlaybackDraftFromPreset(createPresetFixture(), '2026-04-27')
    );
    expect(
      buildPresetSessionCreateRequestFromDraft(nonNumericDraft, 'UTC')
        .workout_preset_id
    ).toBeNull();

    const blankDraft = createBlankWorkoutPlaybackDraft('2026-04-27');
    const blankPayload = buildPresetSessionCreateRequestFromDraft(
      blankDraft,
      'UTC'
    );
    expect(blankPayload.workout_preset_id).toBeNull();
    expect(blankPayload.client_request_id).toBe(blankDraft.client_request_id);
  });

  it('omits a non-UUID client_request_id instead of sending one the server rejects', () => {
    const draft = createBlankWorkoutPlaybackDraft('2026-04-27');
    const payload = buildPresetSessionCreateRequestFromDraft(
      { ...draft, client_request_id: 'temp-lx2k9-abc123' },
      'UTC'
    );
    expect(payload.client_request_id).toBeUndefined();
  });

  it('warns about implausible durations using the exercise modality', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );
    const longDraft = {
      ...draft,
      exercises: draft.exercises.map((exercise, index) => ({
        ...exercise,
        modality:
          index === 0
            ? ('weight_reps' as const)
            : ('duration_distance' as const),
        sets: exercise.sets.slice(0, 1).map((set) => ({
          ...set,
          // 150 min of work: over the strength cap, under the cardio cap.
          duration: 150 * 60,
          rest_time: 0,
          completed: true,
          completed_at: null,
        })),
      })),
    };
    longDraft.exercises[1]!.modality = 'duration_distance';

    const payload = buildPresetSessionCreateRequestFromDraft(longDraft, 'UTC');
    const warnings = getWorkoutPlaybackPlausibilityWarnings(longDraft, payload);

    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'entry_duration_high',
        exercise_name: 'Bench Press',
        value: 150,
      }),
      expect.objectContaining({
        code: 'session_duration_high',
        exercise_name: null,
        value: 300,
      }),
    ]);
  });

  it('falls back to per-set duration and rest seconds without timestamps', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const completedDraft = {
      ...draft,
      exercises: draft.exercises.map((exercise, index) =>
        index === 0
          ? {
              ...exercise,
              started_at: null,
              ended_at: null,
              sets: exercise.sets.slice(0, 1).map((set) => ({
                ...set,
                duration: 90,
                rest_time: 60,
                completed: true,
              })),
            }
          : exercise
      ),
    };

    const payload = buildPresetSessionCreateRequestFromDraft(
      completedDraft,
      'UTC'
    );

    expect(payload.exercises?.[0]?.duration_minutes).toBeCloseTo(2.5, 5);
  });

  it('updates set fields and supports add/remove set editing', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    let nextDraft = updateWorkoutSetAtPointer(
      initialDraft,
      { exerciseIndex: 0, setIndex: 0 },
      { reps: 12, weight: 85 }
    );
    nextDraft = addWorkoutSetToExercise(nextDraft, 0);

    expect(nextDraft.exercises[0]?.sets).toHaveLength(3);
    expect(nextDraft.exercises[0]?.sets[0]?.reps).toBe(12);
    expect(nextDraft.exercises[0]?.sets[0]?.weight).toBe(85);

    nextDraft = removeWorkoutSetFromExercise(nextDraft, {
      exerciseIndex: 0,
      setIndex: 2,
    });
    expect(nextDraft.exercises[0]?.sets).toHaveLength(2);
  });

  it('substitutes an exercise while preserving configured sets structure', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const replacementExercise = {
      id: 'exercise-alt-1',
      name: 'Incline Dumbbell Press',
      category: 'Chest',
      modality: 'reps_weight',
      images: ['incline-db.png'],
    };

    const substituted = substituteExerciseInWorkoutDraft(
      initialDraft,
      0,
      replacementExercise as any
    );

    expect(substituted.exercises[0]?.exercise_id).toBe('exercise-alt-1');
    expect(substituted.exercises[0]?.exercise_name).toBe(
      'Incline Dumbbell Press'
    );
    expect(substituted.exercises[0]?.image_url).toBe('incline-db.png');
    // Sets structure should be preserved:
    expect(substituted.exercises[0]?.sets).toHaveLength(2);
    expect(substituted.exercises[0]?.sets[0]?.reps).toBe(8);
    expect(substituted.exercises[0]?.sets[0]?.weight).toBe(80);
  });

  it('removes an exercise from the active draft and recalibrates active pointers', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    expect(initialDraft.exercises).toHaveLength(2);
    const removed = removeExerciseFromWorkoutDraft(initialDraft, 0);
    expect(removed.exercises).toHaveLength(1);
    expect(removed.exercises[0]?.exercise_id).toBe('exercise-2');
    expect(removed.active_exercise_index).toBe(0);
  });

  describe('workout pause and resume functionality', () => {
    it('pauses a workout, freezing elapsed time and pausing running rest timer', () => {
      const initialDraft = createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27'
      );
      initialDraft.started_at = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      initialDraft.rest_timer = {
        state: 'running',
        duration_seconds: 90,
        remaining_seconds: 60,
        target_end_timestamp_ms: Date.now() + 60000,
      };

      const pausedDraft = pauseWorkoutPlayback(initialDraft);
      expect(pausedDraft.is_paused).toBe(true);
      expect(pausedDraft.paused_at).toBeDefined();
      expect(pausedDraft.rest_timer.state).toBe('paused');
      expect(pausedDraft.rest_timer.remaining_seconds).toBe(60);

      // Elapsed seconds calculation reflects frozen pause time
      const elapsed = getWorkoutPlaybackElapsedSeconds(
        pausedDraft,
        Date.now() + 100000
      );
      expect(elapsed).toBe(600); // 10 min, does not advance while paused
    });

    it('resumes a workout, accumulating total paused seconds and resuming rest timer', () => {
      const initialDraft = createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27'
      );
      const startTime = Date.now() - 600000;
      initialDraft.started_at = new Date(startTime).toISOString();

      const pauseTime = startTime + 300000; // paused after 5 min
      const pausedDraft = {
        ...initialDraft,
        is_paused: true,
        paused_at: new Date(pauseTime).toISOString(),
        total_paused_seconds: 0,
        rest_timer: {
          state: 'paused' as const,
          duration_seconds: 90,
          remaining_seconds: 45,
          target_end_timestamp_ms: null,
        },
      };

      // Resumed 5 minutes later (10 min total from start, but 5 min were paused)
      jest.spyOn(Date, 'now').mockReturnValue(pauseTime + 300000);

      const resumedDraft = resumeWorkoutPlayback(pausedDraft);
      expect(resumedDraft.is_paused).toBe(false);
      expect(resumedDraft.paused_at).toBeNull();
      expect(resumedDraft.total_paused_seconds).toBe(300);
      expect(resumedDraft.rest_timer.state).toBe('running');

      const elapsed = getWorkoutPlaybackElapsedSeconds(
        resumedDraft,
        pauseTime + 300000
      );
      expect(elapsed).toBe(300); // 5 min active elapsed

      (Date.now as any).mockRestore?.();
    });

    it('toggles pause and resume states correctly', () => {
      const draft = createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27'
      );

      const paused = toggleWorkoutPlaybackPause(draft);
      expect(paused.is_paused).toBe(true);

      const resumed = toggleWorkoutPlaybackPause(paused);
      expect(resumed.is_paused).toBe(false);
    });
  });

  describe('superset and giant set playback flow', () => {
    it('alternates set pointers round-by-round across grouped exercises', () => {
      const preset = {
        id: 'preset-ss',
        user_id: 'user-1',
        name: 'Superset Workout',
        description: null,
        exercises: [
          {
            exercise_id: 'ex-1',
            exercise_name: 'Bicep Curl',
            superset_group: 1,
            sets: [
              { set_number: 1, reps: 10, weight: 15 },
              { set_number: 2, reps: 10, weight: 15 },
            ],
          },
          {
            exercise_id: 'ex-2',
            exercise_name: 'Tricep Extension',
            superset_group: 1,
            sets: [
              { set_number: 1, reps: 12, weight: 20 },
              { set_number: 2, reps: 12, weight: 20 },
            ],
          },
          {
            exercise_id: 'ex-3',
            exercise_name: 'Plank',
            superset_group: null,
            sets: [{ set_number: 1, duration: 60 }],
          },
        ],
      } as unknown as WorkoutPreset;

      const draft = createWorkoutPlaybackDraftFromPreset(preset, '2026-04-27');
      const pointers = listWorkoutSetPointers(draft);

      expect(pointers).toEqual([
        { exerciseIndex: 0, setIndex: 0 },
        { exerciseIndex: 1, setIndex: 0 },
        { exerciseIndex: 0, setIndex: 1 },
        { exerciseIndex: 1, setIndex: 1 },
        { exerciseIndex: 2, setIndex: 0 },
      ]);
    });

    it('advances pointer alternatingly when completing sets in a superset', () => {
      const preset = {
        id: 'preset-ss',
        user_id: 'user-1',
        name: 'Superset Workout',
        description: null,
        exercises: [
          {
            exercise_id: 'ex-1',
            exercise_name: 'Bicep Curl',
            superset_group: 1,
            sets: [
              { set_number: 1, reps: 10, weight: 15 },
              { set_number: 2, reps: 10, weight: 15 },
            ],
          },
          {
            exercise_id: 'ex-2',
            exercise_name: 'Tricep Extension',
            superset_group: 1,
            sets: [
              { set_number: 1, reps: 12, weight: 20 },
              { set_number: 2, reps: 12, weight: 20 },
            ],
          },
        ],
      } as unknown as WorkoutPreset;

      let draft = createWorkoutPlaybackDraftFromPreset(preset, '2026-04-27');
      expect(draft.active_exercise_index).toBe(0);
      expect(draft.active_set_index).toBe(0);

      // Complete Round 1 Ex 1 -> advances to Round 1 Ex 2
      draft = completeCurrentWorkoutSet(draft);
      expect(draft.active_exercise_index).toBe(1);
      expect(draft.active_set_index).toBe(0);

      // Complete Round 1 Ex 2 -> advances to Round 2 Ex 1
      draft = completeCurrentWorkoutSet(draft);
      expect(draft.active_exercise_index).toBe(0);
      expect(draft.active_set_index).toBe(1);

      // Complete Round 2 Ex 1 -> advances to Round 2 Ex 2
      draft = completeCurrentWorkoutSet(draft);
      expect(draft.active_exercise_index).toBe(1);
      expect(draft.active_set_index).toBe(1);
    });

    it('supports dynamic grouping and ungrouping during playback', () => {
      const draft = createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27'
      );
      expect(draft.exercises[0]?.superset_group).toBeNull();
      expect(draft.exercises[1]?.superset_group).toBeNull();

      const grouped = groupPlaybackExerciseWithNext(draft, 0);
      expect(grouped.exercises[0]?.superset_group).toBe(1);
      expect(grouped.exercises[1]?.superset_group).toBe(1);

      const ungrouped = ungroupPlaybackExercise(grouped, 0);
      expect(ungrouped.exercises[0]?.superset_group).toBeNull();
      expect(ungrouped.exercises[1]?.superset_group).toBeNull();
    });

    it('includes superset_group in buildPresetSessionCreateRequestFromDraft payload', () => {
      const draft = createWorkoutPlaybackDraftFromPreset(
        createPresetFixture(),
        '2026-04-27'
      );
      const grouped = groupPlaybackExerciseWithNext(draft, 0);
      // Mark sets completed
      grouped.exercises[0]!.sets[0]!.completed = true;
      grouped.exercises[1]!.sets[0]!.completed = true;

      const payload = buildPresetSessionCreateRequestFromDraft(grouped, 'UTC');
      expect(payload.exercises?.[0]?.superset_group).toBe(1);
      expect(payload.exercises?.[1]?.superset_group).toBe(1);
    });
  });
});
