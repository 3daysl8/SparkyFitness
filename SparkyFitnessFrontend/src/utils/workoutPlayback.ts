import {
  instantHourMinute,
  resolveExerciseModality,
  setsDurationMinutes,
  type CreatePresetSessionRequest,
  type ExerciseModality,
  type ExerciseSessionResponse,
  type ExerciseEntryResponse,
} from '@workspace/shared';
import type { WorkoutPreset, WorkoutPresetSet } from '@/types/workout';
import type { Exercise } from '@/types/exercises';

export const DEFAULT_REST_SECONDS = 90;
export const WORKOUT_PLAYBACK_SET_GRID_CLASSES =
  'grid w-full grid-cols-4 gap-2 sm:min-w-[48rem] sm:grid-cols-[7rem_10rem_5rem_6rem_6rem_6rem] sm:gap-x-6 sm:gap-y-2';

export type WorkoutPlaybackRestState = 'idle' | 'running' | 'paused';

export interface WorkoutPlaybackRestTimer {
  state: WorkoutPlaybackRestState;
  duration_seconds: number;
  remaining_seconds: number;
  target_end_timestamp_ms?: number | null;
  target_exercise_index?: number;
  target_set_index?: number;
}

export interface WorkoutPlaybackSetDraft extends WorkoutPresetSet {
  completed: boolean;
  /** ISO timestamp of when the set was checked off; null while incomplete. */
  completed_at: string | null;
  /** Stamped by the page when completing a set beats isPrSet's baseline
   * comparison (see below) — cleared if the set is un-completed. */
  is_pr?: boolean;
}

export interface WorkoutPlaybackExerciseDraft {
  exercise_id: string;
  exercise_name: string;
  modality?: ExerciseModality;
  image_url?: string;
  notes: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  sets: WorkoutPlaybackSetDraft[];
}

export interface WorkoutPlaybackDraft {
  version: 1;
  preset_id: string;
  name: string;
  description: string | null;
  entry_date: string;
  notes: string | null;
  source: 'sparky';
  active_exercise_index: number;
  active_set_index: number;
  rest_timer: WorkoutPlaybackRestTimer;
  exercises: WorkoutPlaybackExerciseDraft[];
  started_at: string;
  updated_at: string;
}

export interface WorkoutSetPointer {
  exerciseIndex: number;
  setIndex: number;
}

export interface WorkoutPlaybackStats {
  totalSets: number;
  completedSets: number;
  completionRate: number;
}

export interface WorkoutPlaybackRouteState {
  returnTo?: string;
  draft?: WorkoutPlaybackDraft | null;
}

const WORKOUT_PLAYBACK_STORAGE_PREFIX = 'sparky.workoutPlaybackDraft.v1';

const DEFAULT_REST_TIMER: WorkoutPlaybackRestTimer = {
  state: 'idle',
  duration_seconds: DEFAULT_REST_SECONDS,
  remaining_seconds: DEFAULT_REST_SECONDS,
  target_end_timestamp_ms: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

export function getWorkoutPlaybackDraftStorageKey(entryDate: string): string {
  return `${WORKOUT_PLAYBACK_STORAGE_PREFIX}:${entryDate}`;
}

function isWorkoutPlaybackDraft(value: unknown): value is WorkoutPlaybackDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const draft = value as WorkoutPlaybackDraft;
  return (
    draft.version === 1 &&
    typeof draft.preset_id === 'string' &&
    typeof draft.entry_date === 'string' &&
    typeof draft.started_at === 'string' &&
    Array.isArray(draft.exercises)
  );
}

export function loadWorkoutPlaybackDraftFromStorage(
  entryDate: string
): WorkoutPlaybackDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageKey = getWorkoutPlaybackDraftStorageKey(entryDate);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isWorkoutPlaybackDraft(parsed)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load workout playback draft from storage', error);
    return null;
  }
}

export function saveWorkoutPlaybackDraftToStorage(
  draft: WorkoutPlaybackDraft
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getWorkoutPlaybackDraftStorageKey(draft.entry_date);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch (error) {
    console.error('Failed to save workout playback draft to storage', error);
  }
}

export function clearWorkoutPlaybackDraftFromStorage(entryDate: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(
      getWorkoutPlaybackDraftStorageKey(entryDate)
    );
  } catch (error) {
    console.error('Failed to clear workout playback draft from storage', error);
  }
}

function touchDraft(draft: WorkoutPlaybackDraft): WorkoutPlaybackDraft {
  return { ...draft, updated_at: nowIso() };
}

function syncActiveExerciseTiming(
  draft: WorkoutPlaybackDraft,
  previousExerciseIndex: number,
  nextExerciseIndex: number
): WorkoutPlaybackDraft {
  if (previousExerciseIndex === nextExerciseIndex) {
    const timestamp = nowIso();
    const exercises = draft.exercises.map((exercise, index) => {
      if (index !== nextExerciseIndex) {
        return exercise;
      }

      return {
        ...exercise,
        started_at: exercise.started_at ?? timestamp,
        ended_at: null,
      };
    });

    return touchDraft({ ...draft, exercises });
  }

  const timestamp = nowIso();
  const exercises = draft.exercises.map((exercise, index) => {
    if (index === previousExerciseIndex) {
      return {
        ...exercise,
        ended_at: timestamp,
      };
    }

    if (index === nextExerciseIndex) {
      return {
        ...exercise,
        started_at: exercise.started_at ?? timestamp,
        ended_at: null,
      };
    }

    return exercise;
  });

  return touchDraft({ ...draft, exercises });
}

function isValidPointer(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer
): boolean {
  const exercise = draft.exercises[pointer.exerciseIndex];
  if (!exercise) return false;
  return pointer.setIndex >= 0 && pointer.setIndex < exercise.sets.length;
}

function fallbackPointer(draft: WorkoutPlaybackDraft): WorkoutSetPointer {
  for (
    let exerciseIndex = 0;
    exerciseIndex < draft.exercises.length;
    exerciseIndex += 1
  ) {
    const exercise = draft.exercises[exerciseIndex];
    if (exercise && exercise.sets.length > 0) {
      return { exerciseIndex, setIndex: 0 };
    }
  }

  return { exerciseIndex: 0, setIndex: 0 };
}

function getSetByPointer(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer
): WorkoutPlaybackSetDraft | null {
  const exercise = draft.exercises[pointer.exerciseIndex];
  if (!exercise) return null;
  return exercise.sets[pointer.setIndex] ?? null;
}

export function listWorkoutSetPointers(
  draft: WorkoutPlaybackDraft
): WorkoutSetPointer[] {
  const pointers: WorkoutSetPointer[] = [];
  draft.exercises.forEach((exercise, exerciseIndex) => {
    exercise.sets.forEach((_, setIndex) => {
      pointers.push({ exerciseIndex, setIndex });
    });
  });
  return pointers;
}

export function getCurrentWorkoutSetPointer(
  draft: WorkoutPlaybackDraft
): WorkoutSetPointer {
  const pointer = {
    exerciseIndex: draft.active_exercise_index,
    setIndex: draft.active_set_index,
  };
  if (isValidPointer(draft, pointer)) {
    return pointer;
  }
  return fallbackPointer(draft);
}

export function getWorkoutPlaybackStats(
  draft: WorkoutPlaybackDraft
): WorkoutPlaybackStats {
  let totalSets = 0;
  let completedSets = 0;

  draft.exercises.forEach((exercise) => {
    totalSets += exercise.sets.length;
    completedSets += exercise.sets.filter((set) => set.completed).length;
  });

  return {
    totalSets,
    completedSets,
    completionRate: totalSets > 0 ? completedSets / totalSets : 0,
  };
}

export function isWorkoutPlaybackComplete(
  draft: WorkoutPlaybackDraft
): boolean {
  const stats = getWorkoutPlaybackStats(draft);
  return stats.totalSets > 0 && stats.completedSets === stats.totalSets;
}

export function createWorkoutPlaybackDraftFromPreset(
  preset: WorkoutPreset,
  entryDate: string
): WorkoutPlaybackDraft {
  const createdAt = nowIso();

  const exercises: WorkoutPlaybackExerciseDraft[] = preset.exercises.map(
    (exercise, exerciseIndex) => ({
      exercise_id: exercise.exercise_id,
      exercise_name:
        exercise.exercise_name ||
        exercise.exercise?.name ||
        `Exercise ${exerciseIndex + 1}`,
      image_url: exercise.image_url || exercise.exercise?.images?.[0],
      modality: resolveExerciseModality(
        exercise.modality ?? exercise.exercise?.modality,
        exercise.category ?? exercise.exercise?.category
      ),
      notes: null,
      started_at: null,
      ended_at: null,
      sets: exercise.sets.map((set, setIndex) => ({
        set_number: set.set_number ?? setIndex + 1,
        set_type: set.set_type ?? 'Working Set',
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        duration: set.duration ?? null,
        distance: set.distance ?? null,
        rest_time: set.rest_time ?? DEFAULT_REST_SECONDS,
        notes: set.notes ?? null,
        rpe: set.rpe ?? null,
        completed: false,
        completed_at: null,
      })),
    })
  );

  const draft: WorkoutPlaybackDraft = {
    version: 1,
    preset_id: String(preset.id),
    name: preset.name,
    description: preset.description ?? null,
    entry_date: entryDate,
    notes: null,
    source: 'sparky',
    active_exercise_index: 0,
    active_set_index: 0,
    rest_timer: DEFAULT_REST_TIMER,
    exercises,
    started_at: createdAt,
    updated_at: createdAt,
  };

  const pointer = fallbackPointer(draft);
  draft.active_exercise_index = pointer.exerciseIndex;
  draft.active_set_index = pointer.setIndex;
  draft.exercises = draft.exercises.map((exercise, index) =>
    index === pointer.exerciseIndex
      ? { ...exercise, started_at: createdAt, ended_at: null }
      : exercise
  );

  return draft;
}

export function createWorkoutPlaybackRouteState(
  preset: WorkoutPreset,
  entryDate: string,
  returnTo?: string
): WorkoutPlaybackRouteState {
  return {
    returnTo,
    draft: createWorkoutPlaybackDraftFromPreset(preset, entryDate),
  };
}

/** "Repeat Workout" from a past logbook session: same draft shape as
 * createWorkoutPlaybackDraftFromPreset, but sourced from what was actually
 * performed last time (an ExerciseSessionResponse) rather than a preset's
 * stored targets. A preset-type session carries its own `exercises` array;
 * an individual-type session IS a single exercise entry, so it becomes a
 * one-exercise draft. Every set starts uncompleted again, same as starting
 * from a preset. */
export function createWorkoutPlaybackDraftFromSession(
  session: ExerciseSessionResponse,
  entryDate: string
): WorkoutPlaybackDraft {
  const createdAt = nowIso();
  const sourceExercises: ExerciseEntryResponse[] =
    session.type === 'preset' ? session.exercises : [session];

  const exercises: WorkoutPlaybackExerciseDraft[] = sourceExercises.map(
    (exercise, exerciseIndex) => ({
      exercise_id: exercise.exercise_id,
      exercise_name:
        exercise.exercise_snapshot?.name || `Exercise ${exerciseIndex + 1}`,
      image_url:
        exercise.exercise_snapshot?.images?.[0] ??
        exercise.image_url ??
        undefined,
      modality: resolveExerciseModality(
        exercise.exercise_snapshot?.modality,
        exercise.exercise_snapshot?.category ?? exercise.category ?? undefined
      ),
      notes: null,
      started_at: null,
      ended_at: null,
      sets:
        exercise.sets.length > 0
          ? exercise.sets.map((set, setIndex) => ({
              set_number: set.set_number ?? setIndex + 1,
              set_type: set.set_type ?? 'Working Set',
              reps: set.reps ?? null,
              weight: set.weight ?? null,
              duration: set.duration ?? null,
              distance: set.distance ?? null,
              rest_time: set.rest_time ?? DEFAULT_REST_SECONDS,
              notes: null,
              rpe: set.rpe ?? null,
              completed: false,
              completed_at: null,
            }))
          : [
              {
                set_number: 1,
                set_type: 'Working Set',
                reps: null,
                weight: null,
                duration: null,
                distance: null,
                rest_time: DEFAULT_REST_SECONDS,
                notes: null,
                rpe: null,
                completed: false,
                completed_at: null,
              },
            ],
    })
  );

  const draft: WorkoutPlaybackDraft = {
    version: 1,
    preset_id:
      session.type === 'preset' && session.workout_preset_id
        ? String(session.workout_preset_id)
        : 'blank',
    name: session.type === 'preset' ? session.name : session.name || 'Workout',
    description: session.type === 'preset' ? session.description : null,
    entry_date: entryDate,
    notes: null,
    source: 'sparky',
    active_exercise_index: 0,
    active_set_index: 0,
    rest_timer: DEFAULT_REST_TIMER,
    exercises,
    started_at: createdAt,
    updated_at: createdAt,
  };

  const pointer = fallbackPointer(draft);
  draft.active_exercise_index = pointer.exerciseIndex;
  draft.active_set_index = pointer.setIndex;
  draft.exercises = draft.exercises.map((exercise, index) =>
    index === pointer.exerciseIndex
      ? { ...exercise, started_at: createdAt, ended_at: null }
      : exercise
  );

  return draft;
}

export function createWorkoutPlaybackRouteStateFromSession(
  session: ExerciseSessionResponse,
  entryDate: string,
  returnTo?: string
): WorkoutPlaybackRouteState {
  return {
    returnTo,
    draft: createWorkoutPlaybackDraftFromSession(session, entryDate),
  };
}

/** A synthetic "no preset" starting point for an ad-hoc workout — same
 * shape as createWorkoutPlaybackDraftFromPreset's output, just with no
 * exercises yet. Built up live via addExerciseToWorkoutDraft below. */
export function createBlankWorkoutPlaybackDraft(
  entryDate: string
): WorkoutPlaybackDraft {
  const createdAt = nowIso();
  return {
    version: 1,
    preset_id: 'blank',
    name: 'Workout',
    description: null,
    entry_date: entryDate,
    notes: null,
    source: 'sparky',
    active_exercise_index: 0,
    active_set_index: 0,
    rest_timer: DEFAULT_REST_TIMER,
    exercises: [],
    started_at: createdAt,
    updated_at: createdAt,
  };
}

/** Appends one exercise (with a single blank default set) to a live draft —
 * the sticky bar's "+ Add Exercise" mid-session. Mirrors
 * createWorkoutPlaybackDraftFromPreset's per-exercise mapping and
 * addWorkoutSetToExercise's default-set shape. */
export function addExerciseToWorkoutDraft(
  draft: WorkoutPlaybackDraft,
  exercise: Exercise
): WorkoutPlaybackDraft {
  const wasEmpty = draft.exercises.length === 0;
  const timestamp = nowIso();

  const newExercise: WorkoutPlaybackExerciseDraft = {
    exercise_id: exercise.id,
    exercise_name: exercise.name,
    image_url: exercise.images?.[0],
    modality: resolveExerciseModality(exercise.modality, exercise.category),
    notes: null,
    started_at: wasEmpty ? timestamp : null,
    ended_at: null,
    sets: [
      {
        set_number: 1,
        set_type: 'Working Set',
        reps: null,
        weight: null,
        duration: null,
        distance: null,
        rest_time: DEFAULT_REST_SECONDS,
        notes: null,
        rpe: null,
        completed: false,
        completed_at: null,
      },
    ],
  };

  const nextDraft: WorkoutPlaybackDraft = {
    ...draft,
    exercises: [...draft.exercises, newExercise],
  };

  if (wasEmpty) {
    nextDraft.active_exercise_index = 0;
    nextDraft.active_set_index = 0;
  }

  return touchDraft(nextDraft);
}

export function getWorkoutPlaybackRestRemainingSeconds(
  restTimer: WorkoutPlaybackRestTimer,
  nowMs: number = Date.now()
): number {
  if (restTimer.state !== 'running') {
    return Math.max(0, restTimer.remaining_seconds);
  }

  if (typeof restTimer.target_end_timestamp_ms !== 'number') {
    return Math.max(0, restTimer.remaining_seconds);
  }

  return Math.max(
    0,
    Math.ceil((restTimer.target_end_timestamp_ms - nowMs) / 1000)
  );
}

export function setWorkoutPlaybackPointer(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer
): WorkoutPlaybackDraft {
  if (!isValidPointer(draft, pointer)) {
    return draft;
  }

  return syncActiveExerciseTiming(
    {
      ...draft,
      active_exercise_index: pointer.exerciseIndex,
      active_set_index: pointer.setIndex,
    },
    draft.active_exercise_index,
    pointer.exerciseIndex
  );
}

function getPointerIndex(
  pointers: WorkoutSetPointer[],
  pointer: WorkoutSetPointer
): number {
  return pointers.findIndex(
    (p) =>
      p.exerciseIndex === pointer.exerciseIndex &&
      p.setIndex === pointer.setIndex
  );
}

function updateSetAtPointer(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer,
  updater: (set: WorkoutPlaybackSetDraft) => WorkoutPlaybackSetDraft
): WorkoutPlaybackDraft {
  if (!isValidPointer(draft, pointer)) {
    return draft;
  }

  const exercises = draft.exercises.map((exercise, exerciseIndex) => {
    if (exerciseIndex !== pointer.exerciseIndex) {
      return exercise;
    }

    const sets = exercise.sets.map((set, setIndex) =>
      setIndex === pointer.setIndex ? updater(set) : set
    );
    return { ...exercise, sets };
  });

  return touchDraft({ ...draft, exercises });
}

export function toggleWorkoutSetCompletion(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer
): WorkoutPlaybackDraft {
  return updateSetAtPointer(draft, pointer, (set) => ({
    ...set,
    completed: !set.completed,
    completed_at: set.completed ? null : new Date().toISOString(),
    // Un-completing a set retracts any PR it earned; re-completing it later
    // goes through the page's isPrSet check again rather than assuming.
    is_pr: set.completed ? false : set.is_pr,
  }));
}

export function updateWorkoutSetAtPointer(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer,
  updates: Partial<WorkoutPlaybackSetDraft>
): WorkoutPlaybackDraft {
  return updateSetAtPointer(draft, pointer, (set) => ({
    ...set,
    ...updates,
  }));
}

export function addWorkoutSetToExercise(
  draft: WorkoutPlaybackDraft,
  exerciseIndex: number
): WorkoutPlaybackDraft {
  const exercise = draft.exercises[exerciseIndex];
  if (!exercise) {
    return draft;
  }

  const lastSet = exercise.sets[exercise.sets.length - 1];
  const newSet: WorkoutPlaybackSetDraft = {
    set_number: exercise.sets.length + 1,
    set_type: lastSet?.set_type ?? 'Working Set',
    reps: lastSet?.reps ?? null,
    weight: lastSet?.weight ?? null,
    duration: lastSet?.duration ?? null,
    distance: lastSet?.distance ?? null,
    rest_time: lastSet?.rest_time ?? DEFAULT_REST_SECONDS,
    notes: lastSet?.notes ?? null,
    rpe: lastSet?.rpe ?? null,
    completed: false,
    completed_at: null,
  };

  const exercises = draft.exercises.map((currentExercise, index) => {
    if (index !== exerciseIndex) {
      return currentExercise;
    }
    return {
      ...currentExercise,
      sets: [...currentExercise.sets, newSet].map((set, setIndex) => ({
        ...set,
        set_number: setIndex + 1,
      })),
    };
  });

  const nextDraft: WorkoutPlaybackDraft = {
    ...draft,
    exercises,
  };

  if (exercise.sets.length === 0) {
    nextDraft.active_exercise_index = exerciseIndex;
    nextDraft.active_set_index = 0;
  }

  return touchDraft(nextDraft);
}

export function removeWorkoutSetFromExercise(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer
): WorkoutPlaybackDraft {
  const exercise = draft.exercises[pointer.exerciseIndex];
  if (!exercise || exercise.sets.length <= 1) {
    return draft;
  }

  const exercises = draft.exercises.map((currentExercise, exerciseIndex) => {
    if (exerciseIndex !== pointer.exerciseIndex) {
      return currentExercise;
    }

    return {
      ...currentExercise,
      sets: currentExercise.sets
        .filter((_, setIndex) => setIndex !== pointer.setIndex)
        .map((set, setIndex) => ({
          ...set,
          set_number: setIndex + 1,
        })),
    };
  });

  const nextDraft: WorkoutPlaybackDraft = {
    ...draft,
    exercises,
  };

  if (nextDraft.active_exercise_index === pointer.exerciseIndex) {
    if (nextDraft.active_set_index > pointer.setIndex) {
      nextDraft.active_set_index -= 1;
    } else if (nextDraft.active_set_index === pointer.setIndex) {
      const remainingSets =
        nextDraft.exercises[pointer.exerciseIndex]?.sets.length ?? 0;
      nextDraft.active_set_index = Math.max(
        0,
        Math.min(pointer.setIndex, remainingSets - 1)
      );
    }
  }

  const nextPointer = getCurrentWorkoutSetPointer(nextDraft);
  const previousActiveExerciseIndex = draft.active_exercise_index;
  nextDraft.active_exercise_index = nextPointer.exerciseIndex;
  nextDraft.active_set_index = nextPointer.setIndex;

  if (nextDraft.rest_timer.target_exercise_index === pointer.exerciseIndex) {
    const targetSetIndex = nextDraft.rest_timer.target_set_index;

    if (targetSetIndex === pointer.setIndex) {
      nextDraft.rest_timer = {
        ...nextDraft.rest_timer,
        state: 'idle',
        remaining_seconds: nextDraft.rest_timer.duration_seconds,
        target_end_timestamp_ms: null,
        target_exercise_index: undefined,
        target_set_index: undefined,
      };
    } else if (
      typeof targetSetIndex === 'number' &&
      targetSetIndex > pointer.setIndex
    ) {
      nextDraft.rest_timer = {
        ...nextDraft.rest_timer,
        target_set_index: targetSetIndex - 1,
      };
    }
  }

  return syncActiveExerciseTiming(
    nextDraft,
    previousActiveExerciseIndex,
    nextPointer.exerciseIndex
  );
}

function getNextIncompletePointer(
  draft: WorkoutPlaybackDraft,
  fromPointer: WorkoutSetPointer
): WorkoutSetPointer | null {
  const pointers = listWorkoutSetPointers(draft);
  const currentIndex = getPointerIndex(pointers, fromPointer);
  if (currentIndex < 0) {
    return null;
  }

  for (let i = currentIndex + 1; i < pointers.length; i += 1) {
    const pointer = pointers[i];
    if (pointer && !getSetByPointer(draft, pointer)?.completed) {
      return pointer;
    }
  }

  for (let i = 0; i < currentIndex; i += 1) {
    const pointer = pointers[i];
    if (pointer && !getSetByPointer(draft, pointer)?.completed) {
      return pointer;
    }
  }

  return null;
}

export function completeCurrentWorkoutSet(
  draft: WorkoutPlaybackDraft
): WorkoutPlaybackDraft {
  const currentPointer = getCurrentWorkoutSetPointer(draft);
  const currentSet = getSetByPointer(draft, currentPointer);
  if (!currentSet || currentSet.completed) {
    return draft;
  }

  let nextDraft = updateSetAtPointer(draft, currentPointer, (set) => ({
    ...set,
    completed: true,
    completed_at: new Date().toISOString(),
  }));

  const nextPointer = getNextIncompletePointer(nextDraft, currentPointer);
  if (!nextPointer) {
    return nextDraft;
  }

  nextDraft = setWorkoutPlaybackPointer(nextDraft, nextPointer);
  return nextDraft;
}

export function setWorkoutPlaybackRestTimer(
  draft: WorkoutPlaybackDraft,
  restTimer: WorkoutPlaybackRestTimer
): WorkoutPlaybackDraft {
  return touchDraft({ ...draft, rest_timer: restTimer });
}

/** Adds `seconds` to the rest timer's remaining time — the floating timer's
 * "+30s" control. Extends `target_end_timestamp_ms` when running (so the
 * countdown keeps deriving from a wall-clock target rather than drifting),
 * or just `remaining_seconds` when paused/idle. A no-op when the timer isn't
 * showing at all (`idle` with nothing queued). */
export function extendWorkoutPlaybackRestTimer(
  draft: WorkoutPlaybackDraft,
  seconds: number
): WorkoutPlaybackDraft {
  const timer = draft.rest_timer;
  if (timer.state === 'idle') {
    return draft;
  }

  if (timer.state === 'running') {
    const currentTarget =
      timer.target_end_timestamp_ms ??
      Date.now() + timer.remaining_seconds * 1000;
    return setWorkoutPlaybackRestTimer(draft, {
      ...timer,
      target_end_timestamp_ms: currentTarget + seconds * 1000,
      duration_seconds: timer.duration_seconds + seconds,
    });
  }

  return setWorkoutPlaybackRestTimer(draft, {
    ...timer,
    remaining_seconds: Math.max(0, timer.remaining_seconds + seconds),
    duration_seconds: timer.duration_seconds + seconds,
  });
}

// --- Personal record (PR) detection -----------------------------------
//
// Ported from SparkyFitnessMobile/src/utils/workoutSession.ts (isWarmupSetType
// / compareSetRecords / isPrSet), which already solved this exact problem for
// the mobile app. The web playback draft has no persisted set id until
// Finish, so the port takes a WorkoutSetPointer instead of PresetSessionResponse
// + a set id — otherwise the comparison logic is unchanged.

/** True when `set_type` names a warmup, matching the server's SQL filter and
 * the mobile app's isWarmupSetType: lowercase, strip every non-alphanumeric
 * character, prefix-match "warmup". Catches "warmup", "Warm-up", "Warm up",
 * "Warm-up Set", etc. Warmups never count toward or earn a PR. */
export function isWarmupSetType(setType: string | null | undefined): boolean {
  if (setType == null) return false;
  return setType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .startsWith('warmup');
}

/** A single historical best used as the PR baseline (weight in kg, the
 * canonical stored unit — see useExerciseStats' bestSet). */
export interface PrBaselineEntry {
  weight: number | null;
  reps: number | null;
}

/**
 * Compare two weighted sets by (weight at hundredths precision, then reps).
 * Positive when `a` is the better record, negative when `b` is, 0 when tied.
 *
 * Hundredths, not epsilon: the DB stores `numeric(10,2)`, so a sub-cent
 * difference round-trips to equality — and rounding also kills the float
 * dust from lb→kg conversion. Null reps count as 0.
 */
export function compareSetRecords(
  a: { weight: number; reps: number | null },
  b: { weight: number; reps: number | null }
): number {
  const wa = Math.round(a.weight * 100);
  const wb = Math.round(b.weight * 100);
  if (wa !== wb) return wa - wb;
  return (a.reps ?? 0) - (b.reps ?? 0);
}

/**
 * Decide whether the set at `pointer` beats its PR baseline. Never a PR when:
 * the set is a warmup, its weight is null, or the baseline hasn't loaded yet
 * (`undefined` — stay conservative rather than risk a false PR before the
 * history is actually known). The effective best is the better of the
 * baseline and every other already-completed non-warmup weighted set of the
 * same exercise in this draft (the candidate itself excluded) — so a session
 * with no prior history can still earn a PR on its second-heaviest set.
 */
export function isPrSet(
  draft: WorkoutPlaybackDraft,
  pointer: WorkoutSetPointer,
  baseline: PrBaselineEntry | null | undefined
): boolean {
  const exercise = draft.exercises[pointer.exerciseIndex];
  const candidate = exercise?.sets[pointer.setIndex];
  if (!exercise || !candidate) return false;
  if (candidate.weight == null) return false;
  if (isWarmupSetType(candidate.set_type)) return false;
  if (baseline === undefined) return false;

  let best: { weight: number; reps: number | null } | null =
    baseline != null && baseline.weight != null
      ? { weight: baseline.weight, reps: baseline.reps }
      : null;

  draft.exercises.forEach((otherExercise, exerciseIndex) => {
    if (otherExercise.exercise_id !== exercise.exercise_id) return;
    otherExercise.sets.forEach((set, setIndex) => {
      if (
        exerciseIndex === pointer.exerciseIndex &&
        setIndex === pointer.setIndex
      ) {
        return;
      }
      if (!set.completed) return;
      if (set.weight == null) return;
      if (isWarmupSetType(set.set_type)) return;
      const contender = { weight: set.weight, reps: set.reps ?? null };
      if (best == null || compareSetRecords(contender, best) > 0) {
        best = contender;
      }
    });
  });

  if (best == null) return false;
  return (
    compareSetRecords(
      { weight: candidate.weight, reps: candidate.reps ?? null },
      best
    ) > 0
  );
}

function toNullableNumber(value: number | null | undefined): number | null {
  return value === undefined ? null : value;
}

function deriveExerciseDurationMinutes(
  exercise: WorkoutPlaybackExerciseDraft,
  nowMs: number = Date.now()
): number {
  const startMs = exercise.started_at ? Date.parse(exercise.started_at) : NaN;
  if (!Number.isNaN(startMs)) {
    const endMs = exercise.ended_at ? Date.parse(exercise.ended_at) : nowMs;
    if (!Number.isNaN(endMs) && endMs >= startMs) {
      return (endMs - startMs) / 60000;
    }
  }

  return setsDurationMinutes(exercise.sets);
}

export function buildPresetSessionCreateRequestFromDraft(
  draft: WorkoutPlaybackDraft,
  timezone: string
): CreatePresetSessionRequest {
  const exercises = draft.exercises
    .map((exercise, exerciseIndex) => {
      const completedSets = exercise.sets.filter((set) => set.completed);
      if (completedSets.length === 0) {
        return null;
      }

      let entryTime: string | null = null;
      const startTimestamp = draft.started_at;
      if (startTimestamp) {
        try {
          const hm = instantHourMinute(startTimestamp, timezone);
          entryTime = `${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}`;
        } catch (e) {
          console.error('Failed to parse draft started_at:', e);
        }
      }

      return {
        exercise_id: exercise.exercise_id,
        sort_order: exerciseIndex,
        duration_minutes: deriveExerciseDurationMinutes(exercise),
        notes: exercise.notes ?? null,
        entry_time: entryTime,
        sets: completedSets.map((set, setIndex) => ({
          set_number: setIndex + 1,
          set_type: set.set_type ?? null,
          reps: toNullableNumber(set.reps),
          weight: toNullableNumber(set.weight),
          duration: toNullableNumber(set.duration),
          distance: toNullableNumber(set.distance),
          rest_time: toNullableNumber(set.rest_time),
          notes: set.notes ?? null,
          rpe: toNullableNumber(set.rpe),
          // `?? null` also covers persisted drafts that predate the field.
          completed_at: set.completed_at ?? null,
          // Stamped live by the page's isPrSet check as sets are completed
          // (see the "Personal record (PR) detection" section above) —
          // `?? false` covers drafts persisted before this field existed.
          is_pr: set.is_pr ?? false,
        })),
      };
    })
    .filter((exercise): exercise is NonNullable<typeof exercise> => !!exercise);

  return {
    name: draft.name,
    description: draft.description,
    notes: draft.notes,
    entry_date: draft.entry_date,
    source: draft.source,
    exercises,
  };
}
