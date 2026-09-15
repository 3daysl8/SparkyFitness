import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import {
  useCreatePresetSessionMutation,
  useWorkoutExerciseStats,
} from '@/hooks/Exercises/useExerciseEntries';
import { useTodayFocusSnapshot, useUpsertFocusCheckin } from '@/hooks/useFocus';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  DEFAULT_REST_SECONDS,
  addExerciseToWorkoutDraft,
  addWorkoutSetToExercise,
  clearWorkoutPlaybackDraftFromStorage,
  buildPresetSessionCreateRequestFromDraft,
  completeCurrentWorkoutSet,
  ensureWorkoutPlaybackDraftClientRequestId,
  extendWorkoutPlaybackRestTimer,
  getCurrentWorkoutSetPointer,
  getWorkoutPlaybackPlausibilityWarnings,
  getWorkoutPlaybackRestRemainingSeconds,
  getWorkoutPlaybackStats,
  isPrSet,
  isWorkoutPlaybackComplete,
  loadWorkoutPlaybackDraftFromStorage,
  removeWorkoutSetFromExercise,
  saveWorkoutPlaybackDraftToStorage,
  setWorkoutPlaybackPointer,
  setWorkoutPlaybackRestTimer,
  toggleWorkoutSetCompletion,
  type WorkoutPlaybackPlausibilityWarning,
  type WorkoutPlaybackRouteState,
  type WorkoutPlaybackDraft,
  type WorkoutSetPointer,
  updateWorkoutSetAtPointer,
} from '@/utils/workoutPlayback';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { formatSecondsClock } from '@/utils/timeFormatters';
import { localDateTimeToUtc } from '@workspace/shared';
import type { Exercise } from '@/types/exercises';
import AddExerciseDialog from '@/pages/Exercises/AddExerciseDialog';
import WorkoutPlaybackDialogs from './WorkoutPlaybackDialogs';
import WorkoutPlaybackExercisesList from './WorkoutPlaybackExercisesList';
import WorkoutPlaybackFloatingRestTimer from './WorkoutPlaybackFloatingRestTimer';
import WorkoutPlaybackStickyBar from './WorkoutPlaybackStickyBar';
import WorkoutPlaybackSummary from './WorkoutPlaybackSummary';
import WorkoutFinishSummaryModal, {
  type WorkoutFinishSummary,
} from './WorkoutFinishSummaryModal';

const MIN_REST_SECONDS = 15;
const MAX_REST_SECONDS = 900;
const REST_EXTEND_SECONDS = 30;

// Auto-completion match rule for the dashboard's "Workout"/"Gym" habit — a
// plain statement string-match, since Focus has no category field to key
// off instead. See agent-docs/fork-status-and-handoff.md for the rationale.
const WORKOUT_HABIT_PATTERN = /workout|gym/i;

function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_SECONDS;
  }

  const clamped = Math.max(
    MIN_REST_SECONDS,
    Math.min(MAX_REST_SECONDS, seconds)
  );
  return Math.round(clamped / 5) * 5;
}

function getInitialDraft(
  requestedDate: string | null,
  routeState: WorkoutPlaybackRouteState | null
): WorkoutPlaybackDraft | null {
  const existingDraft = routeState?.draft ?? null;
  if (existingDraft) {
    if (requestedDate && existingDraft.entry_date !== requestedDate) {
      return null;
    }

    return existingDraft;
  }

  if (!requestedDate) {
    return null;
  }

  return loadWorkoutPlaybackDraftFromStorage(requestedDate);
}

function getReturnPath(
  requestedDate: string | null,
  routeState: WorkoutPlaybackRouteState | null
): string {
  if (routeState?.returnTo) {
    return routeState.returnTo;
  }

  if (requestedDate) {
    return `/?date=${requestedDate}`;
  }

  return '/';
}

function startRestTimer(
  draft: WorkoutPlaybackDraft,
  restSeconds: number,
  targetPointer?: WorkoutSetPointer
): WorkoutPlaybackDraft {
  const normalizedRestSeconds = Math.max(0, restSeconds);

  if (normalizedRestSeconds === 0) {
    return setWorkoutPlaybackRestTimer(draft, {
      state: 'idle',
      duration_seconds: 0,
      remaining_seconds: 0,
      target_exercise_index: undefined,
      target_set_index: undefined,
    });
  }

  return setWorkoutPlaybackRestTimer(draft, {
    state: 'running',
    duration_seconds: normalizedRestSeconds,
    remaining_seconds: normalizedRestSeconds,
    target_end_timestamp_ms: Date.now() + normalizedRestSeconds * 1000,
    target_exercise_index: targetPointer?.exerciseIndex,
    target_set_index: targetPointer?.setIndex,
  });
}

const WorkoutPlaybackPage = () => {
  const { t } = useTranslation();
  const { weightUnit, timezone } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');
  const routeState =
    (location.state as WorkoutPlaybackRouteState | null) ?? null;
  const returnPath = getReturnPath(requestedDate, routeState);

  const scrubbedRouteStateRef = useRef(false);
  const persistedDraftDateRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<WorkoutPlaybackDraft | null>(() =>
    getInitialDraft(requestedDate, routeState)
  );
  const draftRef = useRef<WorkoutPlaybackDraft | null>(draft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [elapsedTickMs, setElapsedTickMs] = useState(() => Date.now());
  const [setNotesVisibility, setSetNotesVisibility] = useState<
    Record<string, boolean>
  >({});
  const [restEditorPointer, setRestEditorPointer] =
    useState<WorkoutSetPointer | null>(null);
  const [restEditorCustomValue, setRestEditorCustomValue] = useState('');
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [finishSummary, setFinishSummary] =
    useState<WorkoutFinishSummary | null>(null);
  const [plausibilityWarnings, setPlausibilityWarnings] = useState<
    WorkoutPlaybackPlausibilityWarning[] | null
  >(null);
  // Set synchronously on Finish: `isSaving` only disables the buttons a
  // render later, so a double tap would otherwise save twice.
  const finishInFlightRef = useRef(false);
  // Once saved, the draft stays in state behind the summary but must never be
  // written back to storage by a debounced save.
  const sessionSavedRef = useRef(false);

  const { mutateAsync: createPresetSession, isPending: isSaving } =
    useCreatePresetSessionMutation();
  const { data: todaySnapshot } = useTodayFocusSnapshot(draft?.entry_date);
  const upsertHabitCheckin = useUpsertFocusCheckin();

  // Best/last/recent-session stats per exercise in the draft, for the set
  // rows' "Previous: …" hint and for the PR baseline below.
  const uniqueExerciseIds = useMemo(
    () => Array.from(new Set(draft?.exercises.map((e) => e.exercise_id) ?? [])),
    [draft?.exercises]
  );
  const statsByExerciseId = useWorkoutExerciseStats(uniqueExerciseIds);

  useEffect(() => {
    if (scrubbedRouteStateRef.current || !routeState?.draft) {
      return;
    }

    scrubbedRouteStateRef.current = true;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: routeState.returnTo
        ? { returnTo: routeState.returnTo }
        : undefined,
    });
  }, [
    location.pathname,
    location.search,
    navigate,
    routeState,
    routeState?.draft,
    routeState?.returnTo,
  ]);

  // Debounce draft saves to avoid excessive localStorage writes on timer ticks
  useEffect(() => {
    if (!draft) {
      if (persistedDraftDateRef.current) {
        clearWorkoutPlaybackDraftFromStorage(persistedDraftDateRef.current);
        persistedDraftDateRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (sessionSavedRef.current) return;
      if (
        persistedDraftDateRef.current &&
        persistedDraftDateRef.current !== draft.entry_date
      ) {
        clearWorkoutPlaybackDraftFromStorage(persistedDraftDateRef.current);
      }

      saveWorkoutPlaybackDraftToStorage(draft);
      persistedDraftDateRef.current = draft.entry_date;
    }, 500);

    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Combined interval for both rest timer and elapsed time
  // Only update draft when timer expires; remaining time derives from target_end_timestamp_ms
  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedTickMs(Date.now());

      setDraft((currentDraft) => {
        if (!currentDraft || currentDraft.rest_timer.state !== 'running') {
          return currentDraft;
        }

        const nextRemaining = getWorkoutPlaybackRestRemainingSeconds(
          currentDraft.rest_timer
        );

        // Only update draft state when timer expires to avoid triggering localStorage saves
        if (nextRemaining <= 0) {
          return setWorkoutPlaybackRestTimer(currentDraft, {
            ...currentDraft.rest_timer,
            state: 'idle',
            remaining_seconds: 0,
            target_end_timestamp_ms: null,
          });
        }

        // Don't update draft; remaining time is derived from target_end_timestamp_ms in render
        return currentDraft;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!draft) return null;
    return getWorkoutPlaybackStats(draft);
  }, [draft]);

  const totalVolume = useMemo(() => {
    if (!draft) return 0;

    return draft.exercises.reduce(
      (exerciseSum, exercise) =>
        exerciseSum +
        exercise.sets.reduce(
          (setSum, set) =>
            set.completed
              ? setSum + (Number(set.weight) || 0) * (Number(set.reps) || 0)
              : setSum,
          0
        ),
      0
    );
  }, [draft]);

  const startedAtMs = useMemo(() => {
    if (!draft) {
      return NaN;
    }

    return Date.parse(draft.started_at);
  }, [draft]);

  const elapsedSeconds = useMemo(() => {
    if (!draft || Number.isNaN(startedAtMs)) return 0;
    return Math.max(0, Math.floor((elapsedTickMs - startedAtMs) / 1000));
  }, [draft, elapsedTickMs, startedAtMs]);

  const updateDraft = useCallback(
    (updater: (currentDraft: WorkoutPlaybackDraft) => WorkoutPlaybackDraft) => {
      setDraft((currentDraft) => {
        if (!currentDraft) return currentDraft;
        return updater(currentDraft);
      });
    },
    []
  );

  const handleCompleteSet = useCallback(
    (pointer: WorkoutSetPointer) => {
      updateDraft((currentDraft) => {
        const set =
          currentDraft.exercises[pointer.exerciseIndex]?.sets[pointer.setIndex];
        if (!set || set.completed) {
          return currentDraft;
        }

        let nextDraft = setWorkoutPlaybackPointer(currentDraft, pointer);
        nextDraft = completeCurrentWorkoutSet(nextDraft);

        const exerciseId =
          currentDraft.exercises[pointer.exerciseIndex]?.exercise_id;
        const baseline = exerciseId
          ? statsByExerciseId[exerciseId]?.bestSet
          : undefined;
        if (isPrSet(nextDraft, pointer, baseline)) {
          nextDraft = updateWorkoutSetAtPointer(nextDraft, pointer, {
            is_pr: true,
          });
        }

        if (!isWorkoutPlaybackComplete(nextDraft)) {
          const restSeconds = set.rest_time ?? DEFAULT_REST_SECONDS;
          const targetPointer = getCurrentWorkoutSetPointer(nextDraft);
          nextDraft = startRestTimer(nextDraft, restSeconds, targetPointer);
        }

        return nextDraft;
      });
    },
    [updateDraft, statsByExerciseId]
  );

  const handleUncompleteSet = useCallback(
    (pointer: WorkoutSetPointer) => {
      updateDraft((currentDraft) => {
        const updated = toggleWorkoutSetCompletion(
          setWorkoutPlaybackPointer(currentDraft, pointer),
          pointer
        );

        if (
          updated.rest_timer.target_exercise_index === pointer.exerciseIndex &&
          updated.rest_timer.target_set_index === pointer.setIndex &&
          updated.rest_timer.state !== 'idle'
        ) {
          return setWorkoutPlaybackRestTimer(updated, {
            ...updated.rest_timer,
            state: 'idle',
            remaining_seconds: 0,
          });
        }

        return updated;
      });
    },
    [updateDraft]
  );

  const handleSetFieldChange = useCallback(
    (
      pointer: WorkoutSetPointer,
      field:
        'reps' | 'weight' | 'duration' | 'rest_time' | 'set_type' | 'notes',
      value: number | string | null
    ) => {
      updateDraft((currentDraft) =>
        updateWorkoutSetAtPointer(currentDraft, pointer, { [field]: value })
      );
    },
    [updateDraft]
  );

  const handleSessionNotesChange = useCallback(
    (value: string) => {
      updateDraft((currentDraft) => ({ ...currentDraft, notes: value }));
    },
    [updateDraft]
  );

  const handleStartTimeChange = useCallback(
    (timeStr: string) => {
      setDraft((currentDraft) => {
        if (!currentDraft) return null;
        if (!timeStr) {
          return {
            ...currentDraft,
            started_at: '',
          };
        }
        try {
          const utcDate = localDateTimeToUtc(
            `${currentDraft.entry_date}T${timeStr}`,
            timezone
          );
          return {
            ...currentDraft,
            started_at: utcDate.toISOString(),
          };
        } catch (e) {
          console.error('Error changing start time:', e);
          return currentDraft;
        }
      });
    },
    [timezone]
  );

  const toggleSetNotesVisibility = useCallback((setKey: string) => {
    setSetNotesVisibility((current) => ({
      ...current,
      [setKey]: !current[setKey],
    }));
  }, []);

  const handleAddSet = useCallback(
    (exerciseIndex: number) => {
      updateDraft((currentDraft) =>
        addWorkoutSetToExercise(currentDraft, exerciseIndex)
      );
    },
    [updateDraft]
  );

  const handleRemoveSet = useCallback(
    (pointer: WorkoutSetPointer) => {
      updateDraft((currentDraft) =>
        removeWorkoutSetFromExercise(currentDraft, pointer)
      );
    },
    [updateDraft]
  );

  const handleExerciseAdded = useCallback(
    (exercise?: Exercise) => {
      if (!exercise) return;
      updateDraft((currentDraft) =>
        addExerciseToWorkoutDraft(currentDraft, exercise)
      );
      setIsAddExerciseDialogOpen(false);
    },
    [updateDraft]
  );

  const handlePauseResumeRest = useCallback(() => {
    updateDraft((currentDraft) => {
      if (currentDraft.rest_timer.state === 'running') {
        const remainingSeconds = getWorkoutPlaybackRestRemainingSeconds(
          currentDraft.rest_timer
        );
        return setWorkoutPlaybackRestTimer(currentDraft, {
          ...currentDraft.rest_timer,
          state: 'paused',
          remaining_seconds: remainingSeconds,
          target_end_timestamp_ms: null,
        });
      }

      if (currentDraft.rest_timer.state === 'paused') {
        return setWorkoutPlaybackRestTimer(currentDraft, {
          ...currentDraft.rest_timer,
          state: 'running',
          target_end_timestamp_ms:
            Date.now() + currentDraft.rest_timer.remaining_seconds * 1000,
        });
      }

      return currentDraft;
    });
  }, [updateDraft]);

  const handleSkipRest = useCallback(() => {
    updateDraft((currentDraft) =>
      setWorkoutPlaybackRestTimer(currentDraft, {
        ...currentDraft.rest_timer,
        state: 'idle',
        remaining_seconds: currentDraft.rest_timer.duration_seconds,
        target_end_timestamp_ms: null,
        target_exercise_index: undefined,
        target_set_index: undefined,
      })
    );
  }, [updateDraft]);

  const handleExtendRest = useCallback(() => {
    updateDraft((currentDraft) =>
      extendWorkoutPlaybackRestTimer(currentDraft, REST_EXTEND_SECONDS)
    );
  }, [updateDraft]);

  const handleOpenRestEditor = useCallback((pointer: WorkoutSetPointer) => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    const selectedSet =
      currentDraft.exercises[pointer.exerciseIndex]?.sets[pointer.setIndex];
    if (!selectedSet) return;
    setRestEditorPointer(pointer);
    setRestEditorCustomValue(
      String(selectedSet.rest_time ?? DEFAULT_REST_SECONDS)
    );
  }, []);

  const closeRestEditor = useCallback(() => {
    setRestEditorPointer(null);
    setRestEditorCustomValue('');
  }, []);

  const updateRestForPointer = useCallback(
    (seconds: number) => {
      if (!restEditorPointer) return;
      const normalized = clampRestSeconds(seconds);
      updateDraft((currentDraft) =>
        updateWorkoutSetAtPointer(currentDraft, restEditorPointer, {
          rest_time: normalized,
        })
      );
      closeRestEditor();
    },
    [closeRestEditor, restEditorPointer, updateDraft]
  );

  const handleSaveCustomRest = useCallback(() => {
    const parsed = Number(restEditorCustomValue);
    updateRestForPointer(
      Number.isFinite(parsed) ? parsed : DEFAULT_REST_SECONDS
    );
  }, [restEditorCustomValue, updateRestForPointer]);

  const handleSelectSet = useCallback(
    (pointer: WorkoutSetPointer) => {
      updateDraft((currentDraft) =>
        setWorkoutPlaybackPointer(currentDraft, pointer)
      );
    },
    [updateDraft]
  );

  const handleCloseKeepDraft = useCallback(() => {
    navigate(returnPath);
  }, [navigate, returnPath]);

  const handleDiscard = useCallback(() => {
    setIsDiscardDialogOpen(true);
  }, []);

  const handleConfirmDiscard = useCallback(() => {
    if (draft) {
      clearWorkoutPlaybackDraftFromStorage(draft.entry_date);
    }
    setDraft(null);
    setSaveError(null);
    setIsDiscardDialogOpen(false);
    navigate(returnPath);
  }, [draft, navigate, returnPath]);

  const saveWorkout = useCallback(async () => {
    if (!draft || finishInFlightRef.current) return;
    finishInFlightRef.current = true;

    // Persisted before sending so a retry after a failure, a reload or a
    // crash replays the same request id instead of creating a new session.
    const draftToSave = ensureWorkoutPlaybackDraftClientRequestId(draft);
    saveWorkoutPlaybackDraftToStorage(draftToSave);
    persistedDraftDateRef.current = draftToSave.entry_date;
    if (draftToSave !== draft) {
      setDraft((currentDraft) =>
        currentDraft && !currentDraft.client_request_id
          ? {
              ...currentDraft,
              client_request_id: draftToSave.client_request_id,
            }
          : currentDraft
      );
    }

    try {
      await createPresetSession(
        buildPresetSessionCreateRequestFromDraft(draftToSave, timezone)
      );
    } catch {
      finishInFlightRef.current = false;
      setSaveError(
        t(
          'exercise.workoutPlaybackDialog.finishError',
          'Failed to save workout. Your local progress is still preserved, and you can retry.'
        )
      );
      return;
    }

    sessionSavedRef.current = true;
    clearWorkoutPlaybackDraftFromStorage(draftToSave.entry_date);

    // Best-effort: auto-check any "Workout"/"Gym" daily habit for this
    // day. A failure here must not block the already-saved workout from
    // navigating away — only boolean/none-target habits have a "done"
    // state that toggling actually means something for.
    const matchingHabits = (todaySnapshot?.daily_recurring ?? []).filter(
      (habit) =>
        habit.target_type !== 'numeric' &&
        !habit.done &&
        WORKOUT_HABIT_PATTERN.test(habit.statement)
    );
    if (matchingHabits.length > 0) {
      await Promise.allSettled(
        matchingHabits.map((habit) =>
          upsertHabitCheckin.mutateAsync({
            focusId: habit.id,
            date: draftToSave.entry_date,
            body: { completed: true },
          })
        )
      );
    }

    const prCount = draftToSave.exercises
      .flatMap((exercise) => exercise.sets)
      .filter((set) => set.is_pr).length;

    setSaveError(null);
    setFinishSummary({
      name: draftToSave.name,
      prCount,
      totalVolume,
      elapsedSeconds,
      setsCompleted: stats?.completedSets ?? 0,
      totalSets: stats?.totalSets ?? 0,
    });
  }, [
    createPresetSession,
    draft,
    elapsedSeconds,
    stats,
    t,
    timezone,
    todaySnapshot,
    totalVolume,
    upsertHabitCheckin,
  ]);

  const handleFinishWorkout = useCallback(() => {
    if (!draft || finishInFlightRef.current) return;

    const payload = buildPresetSessionCreateRequestFromDraft(draft, timezone);
    if (!payload.exercises || payload.exercises.length === 0) {
      setSaveError(
        t(
          'exercise.workoutPlaybackDialog.completeAtLeastOneSet',
          'Complete at least one set before finishing.'
        )
      );
      return;
    }

    const warnings = getWorkoutPlaybackPlausibilityWarnings(draft, payload);
    if (warnings.length > 0) {
      setPlausibilityWarnings(warnings);
      return;
    }

    void saveWorkout();
  }, [draft, saveWorkout, t, timezone]);

  const handleSaveImplausibleWorkout = useCallback(() => {
    setPlausibilityWarnings(null);
    void saveWorkout();
  }, [saveWorkout]);

  const plausibilityMessages = useMemo(
    () =>
      (plausibilityWarnings ?? []).map((warning) => {
        const exercise = warning.exercise_name ?? '';
        switch (warning.code) {
          case 'entry_duration_high':
            return t(
              'exercise.workoutPlaybackDialog.implausibleEntryDuration',
              {
                exercise,
                value: Math.round(warning.value),
                defaultValue:
                  '{{exercise}}: {{value}} min is longer than expected',
              }
            );
          case 'entry_calories_high':
            return t(
              'exercise.workoutPlaybackDialog.implausibleEntryCalories',
              {
                exercise,
                value: Math.round(warning.value),
                defaultValue:
                  '{{exercise}}: {{value}} kcal is higher than expected',
              }
            );
          case 'calorie_rate_high':
            return t('exercise.workoutPlaybackDialog.implausibleCalorieRate', {
              exercise,
              value: Number(warning.value.toFixed(1)),
              defaultValue:
                '{{exercise}}: {{value}} kcal/min is higher than expected',
            });
          default:
            return t(
              'exercise.workoutPlaybackDialog.implausibleSessionDuration',
              {
                value: Math.round(warning.value),
                defaultValue:
                  'Workout total of {{value}} min is longer than expected',
              }
            );
        }
      }),
    [plausibilityWarnings, t]
  );

  const handleCloseFinishSummary = useCallback(() => {
    setDraft(null);
    setFinishSummary(null);
    navigate(returnPath, { replace: true });
  }, [navigate, returnPath]);

  if (!draft) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="gap-2"
          onClick={() => navigate(returnPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {t('exercise.workoutPlaybackDialog.title', 'Live Workout')}
            </h2>
            <CardDescription>
              {t(
                'exercise.workoutPlaybackDialog.noDraft',
                'No active workout draft was found for this date.'
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isRestActive = draft && draft.rest_timer.state !== 'idle';
  const restRemaining = formatSecondsClock(
    draft ? getWorkoutPlaybackRestRemainingSeconds(draft.rest_timer) : 0
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:pb-4">
      <WorkoutPlaybackSummary
        draft={draft}
        elapsedSeconds={elapsedSeconds}
        totalVolume={totalVolume}
        stats={stats}
        restRemaining={restRemaining}
        isRestActive={!!isRestActive}
        saveError={saveError}
        isSaving={isSaving}
        timezone={timezone}
        onCloseKeepDraft={handleCloseKeepDraft}
        onDiscard={handleDiscard}
        onFinishWorkout={handleFinishWorkout}
        onPauseResumeRest={handlePauseResumeRest}
        onSkipRest={handleSkipRest}
        onSessionNotesChange={handleSessionNotesChange}
        onStartTimeChange={handleStartTimeChange}
      />

      <WorkoutPlaybackExercisesList
        exercises={draft.exercises}
        setNotesVisibility={setNotesVisibility}
        onToggleSetNotesVisibility={toggleSetNotesVisibility}
        onSelectSet={handleSelectSet}
        onCompleteSet={handleCompleteSet}
        onUncompleteSet={handleUncompleteSet}
        onSetFieldChange={handleSetFieldChange}
        onOpenRestEditor={handleOpenRestEditor}
        onRemoveSet={handleRemoveSet}
        onAddSet={handleAddSet}
        weightUnit={weightUnit}
        statsByExerciseId={statsByExerciseId}
      />

      <WorkoutPlaybackDialogs
        restEditorPointer={restEditorPointer}
        restEditorCustomValue={restEditorCustomValue}
        onCloseRestEditor={closeRestEditor}
        onUpdateRestForPointer={updateRestForPointer}
        onSetRestEditorCustomValue={setRestEditorCustomValue}
        onSaveCustomRest={handleSaveCustomRest}
        isDiscardDialogOpen={isDiscardDialogOpen}
        onDiscardDialogChange={setIsDiscardDialogOpen}
        onConfirmDiscard={handleConfirmDiscard}
      />

      <ConfirmationDialog
        open={plausibilityWarnings !== null}
        onOpenChange={(open) => !open && setPlausibilityWarnings(null)}
        onConfirm={handleSaveImplausibleWorkout}
        title={t(
          'exercise.workoutPlaybackDialog.implausibleTitle',
          'Double-check this workout'
        )}
        description={
          <>
            <p>
              {t(
                'exercise.workoutPlaybackDialog.implausibleDescription',
                'Some values look unusual. Save anyway, or go back and review?'
              )}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {plausibilityMessages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </>
        }
        confirmLabel={t(
          'exercise.workoutPlaybackDialog.implausibleSaveAnyway',
          'Save anyway'
        )}
        cancelLabel={t(
          'exercise.workoutPlaybackDialog.implausibleReview',
          'Review'
        )}
      />

      <WorkoutPlaybackFloatingRestTimer
        restState={draft.rest_timer.state}
        restRemaining={restRemaining}
        onPauseResume={handlePauseResumeRest}
        onSkip={handleSkipRest}
        onExtend={handleExtendRest}
      />

      <WorkoutPlaybackStickyBar
        onAddExercise={() => setIsAddExerciseDialogOpen(true)}
        onFinishWorkout={handleFinishWorkout}
        isSaving={isSaving}
      />

      <AddExerciseDialog
        open={isAddExerciseDialogOpen}
        onOpenChange={setIsAddExerciseDialogOpen}
        onExerciseAdded={handleExerciseAdded}
        mode="preset"
      />

      <WorkoutFinishSummaryModal
        summary={finishSummary}
        onDone={handleCloseFinishSummary}
      />
    </div>
  );
};

export default WorkoutPlaybackPage;
