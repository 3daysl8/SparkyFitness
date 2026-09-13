import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import * as medicationService from '@/api/Medications/medicationService';
import { reportKeys } from '@/api/keys/reports';
import type {
  Medication,
  ListMedicationsOptions,
  MedicationSchedule,
  CreateMedicationEntryInput,
  UpdateMedicationEntryInput,
  ListMedicationEntriesOptions,
} from '@/types/medications';

const medKeys = {
  list: (opts?: ListMedicationsOptions) => ['medications', opts ?? {}] as const,
  entries: (opts?: ListMedicationEntriesOptions) =>
    ['medication-entries', opts ?? {}] as const,
};

const invalidateReports = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: reportKeys.all,
    refetchType: 'all',
  });

// --- Queries ---------------------------------------------------------------

export const useMedications = (opts?: ListMedicationsOptions) =>
  useQuery({
    queryKey: medKeys.list(opts),
    queryFn: () => medicationService.listMedications(opts),
    meta: { errorMessage: 'Failed to load medications.' },
  });

// --- Mutations -------------------------------------------------------------

export const useCreateMedicationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Medication> & { name: string }) =>
      medicationService.createMedication(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not add medication.',
      successMessage: 'Medication added.',
    },
  });
};

export const useUpdateMedicationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Medication> }) =>
      medicationService.updateMedication(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not update medication.',
      successMessage: 'Medication updated.',
    },
  });
};

export const useDeleteMedicationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => medicationService.deleteMedication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not remove medication.',
      successMessage: 'Medication removed.',
    },
  });
};

// --- Entries & Adherence Queries & Mutations ------------------------------

export const useMedicationEntries = (opts?: ListMedicationEntriesOptions) =>
  useQuery({
    queryKey: medKeys.entries(opts),
    queryFn: () => medicationService.listMedicationEntries(opts),
    meta: { errorMessage: 'Failed to load logged doses.' },
  });

export const useCreateMedicationEntryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMedicationEntryInput) =>
      medicationService.createMedicationEntry(body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medication-entries'],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not log dose.',
      successMessage: 'Dose logged.',
    },
  });
};

export const useUpdateMedicationEntryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateMedicationEntryInput;
    }) => medicationService.updateMedicationEntry(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medication-entries'],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not update logged dose.',
      successMessage: 'Logged dose updated.',
    },
  });
};

export const useDeleteMedicationEntryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => medicationService.deleteMedicationEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medication-entries'],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not remove logged dose.',
      successMessage: 'Logged dose removed.',
    },
  });
};

// --- Schedule Mutations ---------------------------------------------------

export const useAddScheduleMutation = (medId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Partial<MedicationSchedule> & { schedule_type_id: string }
    ) => medicationService.addSchedule(medId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not add schedule.',
      successMessage: 'Schedule added.',
    },
  });
};

export const useDeleteScheduleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => medicationService.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      invalidateReports(queryClient);
    },
    meta: {
      errorMessage: 'Could not delete schedule.',
      successMessage: 'Schedule deleted.',
    },
  });
};
