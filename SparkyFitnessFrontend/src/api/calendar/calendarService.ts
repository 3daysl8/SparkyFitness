import { apiCall } from '@/api/api';
import type {
  CalendarFeed,
  CreateCalendarFeedInput,
  UpdateCalendarFeedInput,
  CalendarEvent,
} from '@/types/calendar';

export const listCalendarFeeds = (): Promise<CalendarFeed[]> =>
  apiCall('/v2/calendar/feeds', { method: 'GET' });

export const createCalendarFeed = (
  body: CreateCalendarFeedInput
): Promise<CalendarFeed> =>
  apiCall('/v2/calendar/feeds', { method: 'POST', body });

export const updateCalendarFeed = (
  id: string,
  body: UpdateCalendarFeedInput
): Promise<CalendarFeed> =>
  apiCall(`/v2/calendar/feeds/${id}`, { method: 'PUT', body });

export const deleteCalendarFeed = (id: string): Promise<void> =>
  apiCall(`/v2/calendar/feeds/${id}`, { method: 'DELETE' });

export const getAgenda = (
  start: string,
  end: string
): Promise<CalendarEvent[]> =>
  apiCall('/v2/calendar/agenda', { method: 'GET', params: { start, end } });
