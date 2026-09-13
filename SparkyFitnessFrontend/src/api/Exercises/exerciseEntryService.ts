import { apiCall } from '@/api/api';
import { debug } from '@/utils/logging';
import { getUserLoggingLevel } from '@/utils/userPreferences';
import type { ActivityDetailsResponse } from '@/types/exercises';
import {
  ExerciseSessionResponse,
  exerciseSessionResponseSchema,
  ExerciseEntryResponse,
  CreateExerciseEntryRequest,
  CreatePresetSessionRequest,
  UpdateExerciseEntryRequest,
  exerciseProgressResponseSchema,
  ExerciseProgressResponse,
  exerciseSnapshotResponseSchema,
  ExerciseSnapshotResponse,
  PresetSessionResponse,
  presetSessionResponseSchema,
  exerciseStatsResponseSchema,
  ExerciseStatsResponse,
  ExerciseHistoryResponse,
  exerciseHistoryResponseSchema,
} from '@workspace/shared';
import z from 'zod';
import { parseJsonArray } from './exerciseService';

export const fetchExerciseEntries = async (
  date: string,
  userId?: string
): Promise<ExerciseSessionResponse[]> => {
  const params = new URLSearchParams({ selectedDate: date });
  if (userId) {
    params.append('userId', userId);
  }
  const response = await apiCall(
    `/v2/exercise-entries/by-date?${params.toString()}`,
    {
      method: 'GET',
    }
  );
  return z.array(exerciseSessionResponseSchema).parse(response);
};

export const createExerciseEntry = async (
  payload: CreateExerciseEntryRequest & { imageFile: File | null }
): Promise<void> => {
  const { imageFile, ...entryData } = payload;

  if (imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    // Append other data from the payload to formData
    Object.entries(entryData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'sets' && Array.isArray(value)) {
          // The backend expects 'sets' to be a JSON string if it's part of FormData
          formData.append(key, JSON.stringify(value));
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'activity_details' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return apiCall('/exercise-entries', {
      method: 'POST',
      body: formData,
      isFormData: true, // Explicitly mark as FormData
    });
  } else {
    return apiCall('/exercise-entries', {
      method: 'POST',
      body: entryData,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const logWorkoutPreset = async (
  workoutPresetId: string | number,
  entryDate: string
): Promise<void> => {
  return apiCall('/exercise-preset-entries', {
    method: 'POST',
    body: JSON.stringify({
      workout_preset_id: workoutPresetId,
      entry_date: entryDate,
    }),
  });
};

export const createPresetSession = async (
  payload: CreatePresetSessionRequest
): Promise<void> => {
  return apiCall('/exercise-preset-entries', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Fetches a grouped workout session (a strength/multi-exercise Garmin session, or any
 * other preset-backed workout) with every child exercise entry, its sets, and its
 * relational muscle snapshot (`exercise_snapshot.primary_muscles`/`secondary_muscles`).
 * This is the relational replacement for parsing the raw provider JSON blob to build a
 * session's exercise/muscle breakdown.
 */
export const getGroupedWorkoutSession = async (
  presetEntryId: string
): Promise<PresetSessionResponse> => {
  const data = await apiCall(`/exercise-preset-entries/${presetEntryId}`, {
    method: 'GET',
  });
  return presetSessionResponseSchema.parse(data);
};

export const deleteExerciseEntry = async (entryId: string): Promise<void> => {
  return apiCall(`/exercise-entries/${entryId}`, {
    method: 'DELETE',
  });
};

export const deleteExercisePresetEntry = async (
  presetEntryId: string
): Promise<void> => {
  return apiCall(`/exercise-preset-entries/${presetEntryId}`, {
    method: 'DELETE',
  });
};

export const updateExerciseEntry = async (
  entryId: string,
  payload: UpdateExerciseEntryRequest & { imageFile: File | null }
): Promise<void> => {
  const { imageFile, ...entryData } = payload;
  const loggingLevel = getUserLoggingLevel();
  debug(loggingLevel, 'updateExerciseEntry payload:', payload);
  debug(loggingLevel, 'updateExerciseEntry entryData:', entryData);

  if (imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    Object.entries(entryData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'sets' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'activity_details' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    // FormData cannot carry null; the server treats entry_time === '' as a
    // clear, so an explicit null must still be sent on this path.
    if (entryData.entry_time === null) {
      formData.append('entry_time', '');
    }

    // Same contract for distance: omitting it would make the server derive
    // from sets or preserve the old value instead of clearing.
    if (entryData.distance === null) {
      formData.append('distance', '');
    }

    return apiCall(`/exercise-entries/${entryId}`, {
      method: 'PUT',
      body: formData,
      isFormData: true,
    });
  } else {
    // Omit image_url when unchanged to avoid triggering server-side image deletion.
    // Send image_url: null explicitly when the user cleared the image.
    const { image_url, ...rest } = entryData;
    const dataToSend = image_url === null ? { ...rest, image_url: null } : rest;
    return apiCall(`/exercise-entries/${entryId}`, {
      method: 'PUT',
      body: dataToSend,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const getExerciseProgressData = async (
  exerciseId: string,
  startDate: string,
  endDate: string,
  aggregationLevel: string = 'daily'
): Promise<ExerciseProgressResponse[]> => {
  const params = new URLSearchParams({
    startDate,
    endDate,
    aggregationLevel,
  });
  const response = await apiCall(
    `/exercise-entries/progress/${exerciseId}?${params.toString()}`,
    {
      method: 'GET',
    }
  );
  return z.array(exerciseProgressResponseSchema).parse(response);
};

export const getExerciseHistory = async (
  exerciseId: string,
  limit: number = 5
): Promise<ExerciseEntryResponse[]> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  const response = await apiCall(
    `/exercise-entries/history/${exerciseId}?${params.toString()}`,
    {
      method: 'GET',
    }
  );
  return response;
};

/**
 * Fetches a page of the workout logbook: every past session (preset-grouped
 * or standalone), newest first. This is the History tab's data source —
 * distinct from getExerciseHistory above, which is a per-exercise ghost-value
 * lookup, not a session feed.
 */
export const getExerciseEntryHistoryPage = async (
  page: number,
  pageSize: number,
  userId?: string
): Promise<ExerciseHistoryResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (userId) {
    params.append('userId', userId);
  }
  const response = await apiCall(
    `/v2/exercise-entries/history?${params.toString()}`,
    { method: 'GET' }
  );
  return exerciseHistoryResponseSchema.parse(response);
};

export const getExerciseStats = async (
  exerciseId: string,
  options?: { excludePresetEntryId?: string; presetId?: string }
): Promise<ExerciseStatsResponse> => {
  const params = new URLSearchParams();
  if (options?.excludePresetEntryId) {
    params.set('excludePresetEntryId', options.excludePresetEntryId);
  }
  if (options?.presetId) {
    params.set('presetId', options.presetId);
  }
  const query = params.toString();
  const response = await apiCall(
    `/v2/exercises/${exerciseId}/stats${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
  return exerciseStatsResponseSchema.parse(response);
};

export const fetchExerciseDetails = async (
  exerciseId: string
): Promise<ExerciseSnapshotResponse> => {
  const response = await apiCall(`/exercises/${exerciseId}`, {
    method: 'GET',
  });

  const parsedResponse = { ...response };
  const arrayFields = [
    'images',
    'primary_muscles',
    'secondary_muscles',
    'equipment',
    'instructions',
  ];

  arrayFields.forEach((field) => {
    parsedResponse[field] = parseJsonArray(parsedResponse[field]) || [];
  });

  return exerciseSnapshotResponseSchema.parse(parsedResponse);
};

export const fetchExerciseEntryById = async (
  entryId: string
): Promise<ExerciseEntryResponse> => {
  return apiCall(`/exercise-entries/${entryId}`, {
    method: 'GET',
  });
};

// suppress404Toast means apiCall resolves to null when the provider has no
// stored details, so the signature has to admit that.
export const getActivityDetails = async (
  exerciseEntryId: string,
  providerName: string
): Promise<ActivityDetailsResponse | null> => {
  return apiCall(
    `/exercises/activity-details/${exerciseEntryId}/${providerName}`,
    {
      method: 'GET',
      suppress404Toast: true,
    }
  );
};
