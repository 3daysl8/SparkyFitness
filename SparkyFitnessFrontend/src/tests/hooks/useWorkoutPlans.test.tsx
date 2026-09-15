import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateWorkoutPlanTemplateMutation,
  useUpdateWorkoutPlanTemplateMutation,
  useDeleteWorkoutPlanTemplateMutation,
  workoutPlanKeys,
} from '@/hooks/Exercises/useWorkoutPlans';
import { plannedWorkoutKeys } from '@/api/keys/exercises';
import {
  createWorkoutPlanTemplate,
  updateWorkoutPlanTemplate,
  deleteWorkoutPlanTemplate,
} from '@/api/Exercises/workoutPlanTemplates';
import type { WorkoutPlanTemplate } from '@/types/workout';

jest.mock('@/api/Exercises/workoutPlanTemplates', () => ({
  getWorkoutPlanTemplates: jest.fn(),
  createWorkoutPlanTemplate: jest.fn(),
  updateWorkoutPlanTemplate: jest.fn(),
  deleteWorkoutPlanTemplate: jest.fn(),
  getActiveWorkoutPlanTemplate: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const mockedCreate = createWorkoutPlanTemplate as jest.MockedFunction<
  typeof createWorkoutPlanTemplate
>;
const mockedUpdate = updateWorkoutPlanTemplate as jest.MockedFunction<
  typeof updateWorkoutPlanTemplate
>;
const mockedDelete = deleteWorkoutPlanTemplate as jest.MockedFunction<
  typeof deleteWorkoutPlanTemplate
>;

const samplePlan = { id: 'plan-1' } as unknown as WorkoutPlanTemplate;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidateSpy };
};

// Activating/deactivating/creating/deleting a workout-plan template triggers
// the backend's syncTemplatePlannedWorkouts, which regenerates planned_workouts
// rows — so every template mutation must invalidate plannedWorkoutKeys.all
// alongside its own workoutPlanKeys.all, or a PlannedWorkoutsList/dashboard
// card would go stale until a hard reload.
describe('useWorkoutPlans template mutations invalidate plannedWorkoutKeys too', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedUpdate.mockReset();
    mockedDelete.mockReset();
  });

  it('create invalidates both workoutPlanKeys.all and plannedWorkoutKeys.all', async () => {
    mockedCreate.mockResolvedValue(samplePlan);
    const { Wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useCreateWorkoutPlanTemplateMutation(),
      { wrapper: Wrapper }
    );

    result.current.mutate({
      userId: 'user-1',
      data: samplePlan as Omit<
        WorkoutPlanTemplate,
        'id' | 'user_id' | 'created_at' | 'updated_at'
      >,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey
    );
    expect(invalidatedKeys).toContainEqual(workoutPlanKeys.all);
    expect(invalidatedKeys).toContainEqual(plannedWorkoutKeys.all);
  });

  it('update invalidates both workoutPlanKeys.all and plannedWorkoutKeys.all', async () => {
    mockedUpdate.mockResolvedValue(samplePlan);
    const { Wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useUpdateWorkoutPlanTemplateMutation(),
      { wrapper: Wrapper }
    );

    result.current.mutate({ id: 'plan-1', data: { is_active: true } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey
    );
    expect(invalidatedKeys).toContainEqual(workoutPlanKeys.all);
    expect(invalidatedKeys).toContainEqual(plannedWorkoutKeys.all);
  });

  it('delete invalidates both workoutPlanKeys.all and plannedWorkoutKeys.all', async () => {
    mockedDelete.mockResolvedValue({ message: 'Workout plan deleted.' });
    const { Wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useDeleteWorkoutPlanTemplateMutation(),
      { wrapper: Wrapper }
    );

    result.current.mutate('plan-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey
    );
    expect(invalidatedKeys).toContainEqual(workoutPlanKeys.all);
    expect(invalidatedKeys).toContainEqual(plannedWorkoutKeys.all);
  });
});
