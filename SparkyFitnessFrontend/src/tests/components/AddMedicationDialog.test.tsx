import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddMedicationDialog from '@/pages/Medications/AddMedicationDialog';
import type { Medication } from '@/types/medications';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

const mockCreateMutate = jest.fn(
  (_body: unknown, options?: { onSuccess?: () => void }) =>
    options?.onSuccess?.()
);
const mockUpdateMutate = jest.fn(
  (_args: unknown, options?: { onSuccess?: () => void }) =>
    options?.onSuccess?.()
);

jest.mock('@/hooks/useMedications', () => ({
  useCreateMedicationMutation: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateMedicationMutation: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}));

const sampleMed = {
  id: 'med-1',
  name: 'Creatine Monohydrate',
  type_id: 'powder',
  is_supplement: true,
  strength_value: 5,
  strength_unit: 'g',
  dose_amount: 5,
  dose_unit: 'g',
  is_active: true,
} as unknown as Medication;

function openDialog(buttonText = /Add/i) {
  const btn =
    screen.queryByRole('button', { name: buttonText }) ||
    screen.getAllByRole('button')[0];
  if (btn) fireEvent.click(btn);
}

function submitForm() {
  const btn = screen.getByRole('button', { name: /^(Add|Save Changes)$/i });
  fireEvent.click(btn);
}

function lastCreateBody(): Partial<Medication> {
  const call = mockCreateMutate.mock.calls.at(-1);
  if (!call) throw new Error('createMutation.mutate was not called');
  return call[0] as Partial<Medication>;
}

describe('AddMedicationDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders and allows adding a supplement', async () => {
    render(<AddMedicationDialog defaultIsSupplement />);
    openDialog();
    fireEvent.change(screen.getByPlaceholderText(/Creatine Monohydrate/i), {
      target: { value: 'Vitamin D3' },
    });
    fireEvent.change(screen.getByPlaceholderText('1'), {
      target: { value: '5000' },
    });
    submitForm();

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    });
    expect(lastCreateBody()).toMatchObject({
      name: 'Vitamin D3',
      dose_amount: 5000,
      is_supplement: true,
    });
  });

  it('renders with editMed pre-filled', () => {
    render(<AddMedicationDialog editMed={sampleMed} />);
    openDialog();
    expect(screen.getByPlaceholderText(/Creatine Monohydrate/i)).toHaveValue(
      'Creatine Monohydrate'
    );
  });
});
