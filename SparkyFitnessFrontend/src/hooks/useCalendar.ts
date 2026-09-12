import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as calendarService from '@/api/calendar/calendarService';
import type {
  CreateCalendarFeedInput,
  UpdateCalendarFeedInput,
} from '@/types/calendar';

const calendarKeys = {
  feeds: ['calendar-feeds'] as const,
  agenda: (start: string, end: string) =>
    ['calendar-agenda', start, end] as const,
};

// --- Feeds -------------------------------------------------------------------

export const useCalendarFeeds = () =>
  useQuery({
    queryKey: calendarKeys.feeds,
    queryFn: () => calendarService.listCalendarFeeds(),
    meta: { errorMessage: 'Failed to load calendar feeds.' },
  });

export const useCreateCalendarFeed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCalendarFeedInput) =>
      calendarService.createCalendarFeed(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.feeds });
      queryClient.invalidateQueries({ queryKey: ['calendar-agenda'] });
    },
  });
};

export const useUpdateCalendarFeed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCalendarFeedInput }) =>
      calendarService.updateCalendarFeed(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.feeds });
      queryClient.invalidateQueries({ queryKey: ['calendar-agenda'] });
    },
  });
};

export const useDeleteCalendarFeed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarService.deleteCalendarFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.feeds });
      queryClient.invalidateQueries({ queryKey: ['calendar-agenda'] });
    },
  });
};

// --- Agenda --------------------------------------------------------------------

export const useAgenda = (start: string, end: string) =>
  useQuery({
    queryKey: calendarKeys.agenda(start, end),
    queryFn: () => calendarService.getAgenda(start, end),
    meta: { errorMessage: 'Failed to load your agenda.' },
  });
