import { apiCall } from '@/api/api';
import type {
  PlannedWorkoutResponse,
  CreatePlannedWorkoutRequest,
  UpdatePlannedWorkoutRequest,
  MovePlannedWorkoutRequest,
  CompletePlannedWorkoutRequest,
} from '@workspace/shared';

const BASE = '/v2/planned-workouts';

export interface PlannedWorkoutDayView {
  for_date: PlannedWorkoutResponse[];
  missed: PlannedWorkoutResponse[];
}

export const listPlannedWorkouts = async (
  from: string,
  to: string
): Promise<PlannedWorkoutResponse[]> => {
  return apiCall(BASE, { method: 'GET', params: { from, to } });
};

export const getPlannedWorkoutDayView = async (
  date: string
): Promise<PlannedWorkoutDayView> => {
  return apiCall(`${BASE}/day/${date}`, { method: 'GET' });
};

export const getPlannedWorkoutById = async (
  id: string
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}`, { method: 'GET' });
};

export const createPlannedWorkout = async (
  data: CreatePlannedWorkoutRequest
): Promise<PlannedWorkoutResponse> => {
  return apiCall(BASE, { method: 'POST', body: JSON.stringify(data) });
};

export const updatePlannedWorkout = async (
  id: string,
  patch: UpdatePlannedWorkoutRequest
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
};

export const movePlannedWorkout = async (
  id: string,
  data: MovePlannedWorkoutRequest
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}/move`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const startPlannedWorkout = async (
  id: string
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}/start`, { method: 'POST' });
};

export const skipPlannedWorkout = async (
  id: string
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}/skip`, { method: 'POST' });
};

export const completePlannedWorkout = async (
  id: string,
  data: CompletePlannedWorkoutRequest
): Promise<PlannedWorkoutResponse> => {
  return apiCall(`${BASE}/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const deletePlannedWorkout = async (
  id: string
): Promise<{ message: string }> => {
  return apiCall(`${BASE}/${id}`, { method: 'DELETE' });
};
