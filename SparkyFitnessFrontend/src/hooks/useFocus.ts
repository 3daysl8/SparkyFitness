import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as focusService from '@/api/focus/focusService';
import type {
  CreateFocusInput,
  UpdateFocusInput,
  ListFocusOptions,
  UpsertFocusCheckinInput,
  FocusDomain,
} from '@/types/focus';

const focusKeys = {
  domains: ['focus-domains'] as const,
  list: (opts?: ListFocusOptions) => ['focuses', opts ?? {}] as const,
  detail: (id: string) => ['focus', id] as const,
  checkins: (focusId: string) => ['focus-checkins', focusId] as const,
  today: (date?: string) => ['focus-today', date ?? 'today'] as const,
};

// --- Domains ---------------------------------------------------------------

export const useFocusDomains = () =>
  useQuery({
    queryKey: focusKeys.domains,
    queryFn: () => focusService.listFocusDomains(),
    meta: { errorMessage: 'Failed to load focus domains.' },
  });

export const useCreateFocusDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<FocusDomain, 'name'> & Partial<FocusDomain>) =>
      focusService.createFocusDomain(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: focusKeys.domains }),
  });
};

export const useDeleteFocusDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => focusService.deleteFocusDomain(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: focusKeys.domains }),
  });
};

// --- Focuses -----------------------------------------------------------------

export const useFocuses = (opts?: ListFocusOptions) =>
  useQuery({
    queryKey: focusKeys.list(opts),
    queryFn: () => focusService.listFocuses(opts),
    meta: { errorMessage: 'Failed to load focuses.' },
  });

export const useCreateFocus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFocusInput) => focusService.createFocus(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focuses'] });
      queryClient.invalidateQueries({ queryKey: ['focus-today'] });
    },
  });
};

export const useUpdateFocus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFocusInput }) =>
      focusService.updateFocus(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focuses'] });
      queryClient.invalidateQueries({ queryKey: ['focus-today'] });
    },
  });
};

export const useDeleteFocus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => focusService.deleteFocus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focuses'] });
      queryClient.invalidateQueries({ queryKey: ['focus-today'] });
    },
  });
};

// --- Check-ins ---------------------------------------------------------------

export const useFocusCheckins = (focusId: string) =>
  useQuery({
    queryKey: focusKeys.checkins(focusId),
    queryFn: () => focusService.listFocusCheckins(focusId),
    enabled: !!focusId,
    meta: { errorMessage: 'Failed to load check-ins.' },
  });

export const useUpsertFocusCheckin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      focusId,
      date,
      body,
    }: {
      focusId: string;
      date: string;
      body: UpsertFocusCheckinInput;
    }) => focusService.upsertFocusCheckin(focusId, date, body),
    onSuccess: (_, { focusId }) => {
      queryClient.invalidateQueries({ queryKey: focusKeys.checkins(focusId) });
      queryClient.invalidateQueries({ queryKey: ['focus-today'] });
    },
  });
};

export const useDeleteFocusCheckin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ focusId, date }: { focusId: string; date: string }) =>
      focusService.deleteFocusCheckin(focusId, date),
    onSuccess: (_, { focusId }) => {
      queryClient.invalidateQueries({ queryKey: focusKeys.checkins(focusId) });
      queryClient.invalidateQueries({ queryKey: ['focus-today'] });
    },
  });
};

// --- Today snapshot -----------------------------------------------------------

export const useTodayFocusSnapshot = (date?: string) =>
  useQuery({
    queryKey: focusKeys.today(date),
    queryFn: () => focusService.getTodaySnapshot(date),
    meta: { errorMessage: 'Failed to load today’s focus.' },
  });
