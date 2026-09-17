import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CycleSettings,
  CycleDailyEntry,
  CyclePhaseInfo,
  CycleHistoryItem,
} from '@/types/cycle';
import {
  getStoredCycleSettings,
  saveStoredCycleSettings,
  getStoredCycleEntries,
  saveStoredCycleEntry,
  getStoredCycleHistory,
  saveStoredCycleHistory,
  calculateCycleInfo,
  formatDateYMD,
} from '@/utils/cycleUtils';
import { useProfileQuery } from '@/hooks/Settings/useProfile';
import { useActiveUser } from '@/contexts/ActiveUserContext';

const CYCLE_QUERY_KEYS = {
  settings: ['cycle-settings'] as const,
  entries: ['cycle-entries'] as const,
  entry: (date: string) => ['cycle-entry', date] as const,
  history: ['cycle-history'] as const,
  phase: (date: string) => ['cycle-phase', date] as const,
};

export function useCycleActive(): {
  isCycleActive: boolean;
  isFemale: boolean;
} {
  const { activeUserId } = useActiveUser();
  const { data: profile } = useProfileQuery(activeUserId ?? undefined);
  const { data: settings } = useCycleSettings();

  const isFemale = (profile?.gender ?? '').toLowerCase() === 'female';
  // Active if female (default true) or explicitly enabled in settings
  const isCycleActive = settings
    ? settings.enabled && (isFemale || settings.enabled)
    : isFemale;

  return { isCycleActive, isFemale };
}

export function useCycleSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<CycleSettings>({
    queryKey: CYCLE_QUERY_KEYS.settings,
    queryFn: () => getStoredCycleSettings(),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<CycleSettings>) => {
      return saveStoredCycleSettings(patch);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(CYCLE_QUERY_KEYS.settings, updated);
      queryClient.invalidateQueries({ queryKey: ['cycle-phase'] });
    },
  });

  return {
    ...query,
    settings: query.data ?? getStoredCycleSettings(),
    updateSettings: mutation.mutate,
    updateSettingsAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

export function useCycleDailyEntry(date?: string) {
  const targetDate = date || formatDateYMD(new Date());

  const query = useQuery<CycleDailyEntry | null>({
    queryKey: CYCLE_QUERY_KEYS.entry(targetDate),
    queryFn: () => {
      const all = getStoredCycleEntries();
      return all[targetDate] || null;
    },
  });

  return {
    ...query,
    entry: query.data,
  };
}

export function useSaveCycleDailyEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: CycleDailyEntry) => {
      saveStoredCycleEntry(entry);
      return entry;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(CYCLE_QUERY_KEYS.entry(saved.date), saved);
      queryClient.invalidateQueries({ queryKey: CYCLE_QUERY_KEYS.entries });
    },
  });
}

export function useCycleHistory() {
  const queryClient = useQueryClient();

  const query = useQuery<CycleHistoryItem[]>({
    queryKey: CYCLE_QUERY_KEYS.history,
    queryFn: () => getStoredCycleHistory(),
  });

  const mutation = useMutation({
    mutationFn: async (history: CycleHistoryItem[]) => {
      saveStoredCycleHistory(history);
      return history;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(CYCLE_QUERY_KEYS.history, saved);
    },
  });

  return {
    ...query,
    history: query.data || [],
    saveHistory: mutation.mutate,
  };
}

export function useCyclePhase(date?: string): CyclePhaseInfo {
  const targetDate = date || formatDateYMD(new Date());
  const { settings } = useCycleSettings();

  return calculateCycleInfo(targetDate, settings);
}
