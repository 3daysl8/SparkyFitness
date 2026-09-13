import { apiCall } from '@/api/api';
import type {
  Medication,
  MedicationSchedule,
  ListMedicationsOptions,
  MedicationEntry,
  CreateMedicationEntryInput,
  UpdateMedicationEntryInput,
  ListMedicationEntriesOptions,
} from '@/types/medications';

// --- Medications -----------------------------------------------------------

export const listMedications = (
  opts?: ListMedicationsOptions
): Promise<Medication[]> =>
  apiCall('/v2/medications', { method: 'GET', params: opts });

export const createMedication = (
  body: Partial<Medication> & { name: string }
): Promise<Medication> => apiCall('/v2/medications', { method: 'POST', body });

export const updateMedication = (
  id: string,
  body: Partial<Medication>
): Promise<Medication> =>
  apiCall(`/v2/medications/${id}`, { method: 'PUT', body });

export const deleteMedication = (id: string): Promise<void> =>
  apiCall(`/v2/medications/${id}`, { method: 'DELETE' });

// --- Medication Entries (Adherence) ---------------------------------------

export const listMedicationEntries = (
  opts?: ListMedicationEntriesOptions
): Promise<MedicationEntry[]> =>
  apiCall('/v2/medications/entries', { method: 'GET', params: opts });

export const createMedicationEntry = (
  body: CreateMedicationEntryInput
): Promise<MedicationEntry> =>
  apiCall('/v2/medications/entries', { method: 'POST', body });

export const updateMedicationEntry = (
  id: string,
  body: UpdateMedicationEntryInput
): Promise<MedicationEntry> =>
  apiCall(`/v2/medications/entries/${id}`, { method: 'PUT', body });

export const deleteMedicationEntry = (id: string): Promise<void> =>
  apiCall(`/v2/medications/entries/${id}`, { method: 'DELETE' });

// --- Schedules -------------------------------------------------------------

export const addSchedule = (
  medicationId: string,
  body: Partial<MedicationSchedule> & { schedule_type_id: string }
): Promise<MedicationSchedule> =>
  apiCall(`/v2/medications/${medicationId}/schedules`, {
    method: 'POST',
    body,
  });

export const deleteSchedule = (id: string): Promise<void> =>
  apiCall(`/v2/medications/schedules/${id}`, { method: 'DELETE' });
