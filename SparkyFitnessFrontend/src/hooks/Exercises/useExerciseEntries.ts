import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  fetchExerciseEntries,
  createExerciseEntry,
  updateExerciseEntry,
  deleteExerciseEntry,
  createPresetSession,
  logWorkoutPreset,
  deleteExercisePresetEntry,
  fetchExerciseDetails,
  getExerciseHistory,
  getExerciseEntryHistoryPage,
  getExerciseStats,
  getExerciseProgressData,
} from '@/api/Exercises/exerciseEntryService';
import { exerciseEntryKeys, exerciseKeys } from '@/api/keys/exercises';
import i18n from '@/i18n';
import { dailyProgressKeys } from '@/api/keys/diary';
import {
  UpdateExerciseEntryRequest,
  type ExerciseStatsResponse,
} from '@workspace/shared';
import { useDiaryInvalidation } from '../useInvalidateKeys';

// --- Queries ---

export const useExerciseEntries = (date: string, userId?: string) => {
  return useQuery({
    queryKey: exerciseEntryKeys.byDate(date, userId),
    queryFn: () => fetchExerciseEntries(date, userId),
    enabled: !!date,
    staleTime: 0, // Always consider data stale so it refetches when needed
    refetchOnWindowFocus: true, // Refetch when user returns to the tab after a sync
  });
};

export const useExerciseHistory = (exerciseId: string, limit: number = 5) => {
  return useQuery({
    queryKey: exerciseEntryKeys.history(exerciseId, limit),
    queryFn: () => getExerciseHistory(exerciseId, limit),
    enabled: !!exerciseId,
  });
};

/** Raw per-entry progress data for one exercise over a date range — used by
 * the Exercise Library detail modal to chart volume history. */
export const useExerciseProgress = (
  exerciseId: string | undefined,
  startDate: string,
  endDate: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: exerciseEntryKeys.progress(
      exerciseId ?? '',
      startDate,
      endDate,
      'daily'
    ),
    queryFn: () => getExerciseProgressData(exerciseId!, startDate, endDate),
    enabled: enabled && !!exerciseId,
  });
};

/** One page of the workout logbook (History tab): every past session,
 * newest first, server-paginated — mirrors useWorkoutPresets' manual
 * pagination shape (page/pageSize state owned by the caller). */
export const useExerciseEntryHistoryPage = (
  page: number,
  pageSize: number,
  userId?: string
) => {
  return useQuery({
    queryKey: exerciseEntryKeys.historyPage(page, pageSize, userId),
    queryFn: () => getExerciseEntryHistoryPage(page, pageSize, userId),
    placeholderData: keepPreviousData,
  });
};

/** Query definition for per-exercise best/last set + recent sessions stats,
 * used for live "Previous: …" placeholders and PR-baseline comparison during
 * a workout. Exported as options, not just wrapped in
 * useWorkoutExerciseStats below, in case a single-exercise caller ever needs
 * it directly (e.g. via useQuery). */
export const exerciseStatsQueryOptions = (
  exerciseId: string,
  options?: { excludePresetEntryId?: string; presetId?: string }
) => ({
  queryKey: exerciseEntryKeys.stats(exerciseId, options),
  queryFn: () => getExerciseStats(exerciseId, options),
  enabled: !!exerciseId,
});

/** Best/last/recent-session stats for every exercise in a live workout
 * draft, keyed by exercise_id. A dynamic list of useQuery calls (one per
 * exercise) would violate the rules of hooks, so this fans out over
 * useQueries instead — one hook call regardless of how many exercises are in
 * the draft. */
export const useWorkoutExerciseStats = (
  exerciseIds: string[]
): Record<string, ExerciseStatsResponse | undefined> => {
  const results = useQueries({
    queries: exerciseIds.map((exerciseId) =>
      exerciseStatsQueryOptions(exerciseId)
    ),
  });

  const map: Record<string, ExerciseStatsResponse | undefined> = {};
  exerciseIds.forEach((exerciseId, index) => {
    map[exerciseId] = results[index]?.data;
  });
  return map;
};

export const useCreateExerciseEntryMutation = () => {
  const { t } = useTranslation();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: createExerciseEntry,
    onSuccess: invalidate,
    meta: {
      successMessage: t(
        'diary.exerciseEntry.createSuccess',
        'Exercise logged successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.createError',
        'Failed to log exercise.'
      ),
    },
  });
};

export const useUpdateExerciseEntryMutation = () => {
  const invalidate = useDiaryInvalidation();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateExerciseEntryRequest & { imageFile: File | null };
    }) => updateExerciseEntry(id, data),
    onSuccess: invalidate,
    meta: {
      successMessage: t(
        'diary.exerciseEntry.updateSuccess',
        'Exercise entry updated successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.updateError',
        'Failed to update exercise entry.'
      ),
    },
  });
};

export const useDeleteExerciseEntryMutation = () => {
  const invalidate = useDiaryInvalidation();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: deleteExerciseEntry,
    onSuccess: invalidate,
    meta: {
      successMessage: t(
        'diary.exerciseEntry.deleteSuccess',
        'Exercise entry deleted successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.deleteError',
        'Failed to delete exercise entry.'
      ),
    },
  });
};

export const useLogWorkoutPresetMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      presetId,
      date,
    }: {
      presetId: string | number;
      date: string;
    }) => logWorkoutPreset(presetId, date),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: exerciseEntryKeys.byDate(variables.date),
      });
      queryClient.invalidateQueries({
        queryKey: dailyProgressKeys.all,
      });
    },
    meta: {
      successMessage: t(
        'diary.exerciseEntry.logPresetSuccess',
        'Workout preset logged successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.logPresetError',
        'Failed to log workout preset.'
      ),
    },
  });
};

export const useCreatePresetSessionMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: createPresetSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseEntryKeys.all });
      queryClient.invalidateQueries({ queryKey: dailyProgressKeys.all });
    },
    meta: {
      successMessage: t(
        'diary.exerciseEntry.createPresetSessionSuccess',
        'Workout saved successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.createPresetSessionError',
        'Failed to save workout.'
      ),
    },
  });
};

export const useDeleteExercisePresetEntryMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: deleteExercisePresetEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseEntryKeys.all });
      queryClient.invalidateQueries({
        queryKey: dailyProgressKeys.all,
      });
    },
    meta: {
      successMessage: t(
        'diary.exerciseEntry.deletePresetSuccess',
        'Preset entry deleted successfully.'
      ),
      errorMessage: t(
        'diary.exerciseEntry.deletePresetError',
        'Failed to delete preset entry.'
      ),
    },
  });
};

export const exerciseDetailsOptions = (exerciseId: string) => ({
  queryKey: exerciseKeys.detail(exerciseId),
  queryFn: () => fetchExerciseDetails(exerciseId),
  staleTime: 1000 * 60 * 60,
  enabled: !!exerciseId,
  meta: {
    errorMessage: i18n.t(
      'exercise.failedToFetchDetails',
      'Could not fetch exercise details. Please try again.'
    ),
  },
});
