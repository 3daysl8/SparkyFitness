import { apiCall } from '@/api/api';
import type {
  FocusDomain,
  Focus,
  FocusCheckin,
  CreateFocusInput,
  UpdateFocusInput,
  ListFocusOptions,
  UpsertFocusCheckinInput,
  TodaySnapshot,
} from '@/types/focus';

// --- Domains -----------------------------------------------------------------

export const listFocusDomains = (): Promise<FocusDomain[]> =>
  apiCall('/v2/focus/domains', { method: 'GET' });

export const createFocusDomain = (
  body: Pick<FocusDomain, 'name'> & Partial<FocusDomain>
): Promise<FocusDomain> =>
  apiCall('/v2/focus/domains', { method: 'POST', body });

export const deleteFocusDomain = (id: string): Promise<void> =>
  apiCall(`/v2/focus/domains/${id}`, { method: 'DELETE' });

// --- Focuses ------------------------------------------------------------------

export const listFocuses = (opts?: ListFocusOptions): Promise<Focus[]> =>
  apiCall('/v2/focus', { method: 'GET', params: opts });

export const createFocus = (body: CreateFocusInput): Promise<Focus> =>
  apiCall('/v2/focus', { method: 'POST', body });

export const updateFocus = (
  id: string,
  body: UpdateFocusInput
): Promise<Focus> => apiCall(`/v2/focus/${id}`, { method: 'PUT', body });

export const deleteFocus = (id: string): Promise<void> =>
  apiCall(`/v2/focus/${id}`, { method: 'DELETE' });

// --- Check-ins ------------------------------------------------------------------

export const listFocusCheckins = (
  focusId: string,
  opts?: { startDate?: string; endDate?: string }
): Promise<FocusCheckin[]> =>
  apiCall(`/v2/focus/${focusId}/checkins`, { method: 'GET', params: opts });

export const upsertFocusCheckin = (
  focusId: string,
  date: string,
  body: UpsertFocusCheckinInput
): Promise<FocusCheckin> =>
  apiCall(`/v2/focus/${focusId}/checkins/${date}`, { method: 'PUT', body });

// --- Today snapshot -------------------------------------------------------------

export const getTodaySnapshot = (date?: string): Promise<TodaySnapshot> =>
  apiCall('/v2/focus/today', {
    method: 'GET',
    params: date ? { date } : undefined,
  });
