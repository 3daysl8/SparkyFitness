import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreatePresetSessionMutation,
  useDeleteExercisePresetEntryMutation,
  useLogWorkoutPresetMutation,
} from '@/hooks/Exercises/useExerciseEntries';
import {
  createPresetSession,
  deleteExercisePresetEntry,
  logWorkoutPreset,
} from '@/api/Exercises/exerciseEntryService';
import { exerciseEntryKeys } from '@/api/keys/exercises';
import { dailyProgressKeys } from '@/api/keys/diary';

jest.mock('@/api/Exercises/exerciseEntryService', () => ({
  createPresetSession: jest.fn(),
  deleteExercisePresetEntry: jest.fn(),
  logWorkoutPreset: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (_key: string, fallback: string) => fallback },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const renderWithClient = <T,>(hook: () => T) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(hook, { wrapper: Wrapper });
  return { result, invalidateSpy };
};

const invalidatedKeys = (invalidateSpy: jest.SpyInstance) =>
  invalidateSpy.mock.calls.map(
    ([filters]) => (filters as { queryKey: unknown }).queryKey
  );

describe('workout mutations refresh every view of exercise entries', () => {
  beforeEach(() => {
    jest.mocked(createPresetSession).mockResolvedValue(undefined);
    jest.mocked(deleteExercisePresetEntry).mockResolvedValue(undefined);
    jest.mocked(logWorkoutPreset).mockResolvedValue(undefined);
  });

  it('invalidates all exercise entries and daily progress after logging a preset', async () => {
    const { result, invalidateSpy } = renderWithClient(
      useLogWorkoutPresetMutation
    );

    await act(async () => {
      await result.current.mutateAsync({ presetId: 3, date: '2026-09-15' });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual(
      expect.arrayContaining([exerciseEntryKeys.all, dailyProgressKeys.all])
    );
  });

  it('invalidates all exercise entries and daily progress after saving a session', async () => {
    const { result, invalidateSpy } = renderWithClient(
      useCreatePresetSessionMutation
    );

    await act(async () => {
      await result.current.mutateAsync({
        entry_date: '2026-09-15',
        name: 'Workout',
        source: 'sparky',
      });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual(
      expect.arrayContaining([exerciseEntryKeys.all, dailyProgressKeys.all])
    );
  });

  it('invalidates all exercise entries and daily progress after deleting a session', async () => {
    const { result, invalidateSpy } = renderWithClient(
      useDeleteExercisePresetEntryMutation
    );

    await act(async () => {
      await result.current.mutateAsync('session-1');
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual(
      expect.arrayContaining([exerciseEntryKeys.all, dailyProgressKeys.all])
    );
  });
});
