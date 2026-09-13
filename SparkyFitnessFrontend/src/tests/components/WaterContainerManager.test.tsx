import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WaterContainerManager from '@/pages/Settings/WaterContainerManager';
import type { WaterContainer } from '@/types/settings';
import { renderWithClient } from '../test-utils';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSetPrimary = jest.fn();

const mockContainers: WaterContainer[] = [
  {
    id: 1,
    user_id: 'user-1',
    name: 'Bottle',
    volume: 500,
    unit: 'ml',
    is_primary: true,
    servings_per_container: 1,
    hydration_factor: 1.0,
  },
  {
    id: 2,
    user_id: 'user-1',
    name: 'Tea Mug',
    volume: 250,
    unit: 'ml',
    is_primary: false,
    servings_per_container: 1,
    hydration_factor: 0.9,
  },
];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown) =>
      typeof second === 'string'
        ? second
        : ((second as { defaultValue?: string })?.defaultValue ?? key),
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', activeUserId: 'user-1' } }),
}));

const mockMaterializePreset = jest.fn();

jest.mock('@/hooks/Settings/useWaterContainers', () => ({
  useWaterContainersQuery: () => ({ data: mockContainers }),
  useCreateWaterContainerMutation: () => ({ mutateAsync: mockCreate }),
  useUpdateWaterContainerMutation: () => ({ mutateAsync: mockUpdate }),
  useDeleteWaterContainerMutation: () => ({ mutateAsync: mockDelete }),
  useSetPrimaryWaterContainerMutation: () => ({ mutateAsync: mockSetPrimary }),
  useDrinkPresetCatalogQuery: () => ({
    data: [
      {
        id: 'espresso',
        displayNameKey: 'drink_presets.espresso',
        defaultName: 'Espresso',
        volumeMl: 30,
        servingUnit: 'ml',
        caffeineMg: 63,
        hydrationFactor: 0,
        kind: 'caffeine',
      },
    ],
  }),
  useMaterializeDrinkPresetMutation: () => ({
    mutateAsync: mockMaterializePreset,
    isPending: false,
  }),
}));

describe('WaterContainerManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders existing containers', () => {
    renderWithClient(<WaterContainerManager />);
    expect(screen.getByText('Bottle')).toBeInTheDocument();
    expect(screen.getByText('Tea Mug')).toBeInTheDocument();
  });

  it('allows adding a new container', async () => {
    renderWithClient(<WaterContainerManager />);

    fireEvent.change(screen.getByPlaceholderText(/Gym Bottle/i), {
      target: { value: 'Hydro Flask' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 500'), {
      target: { value: '750' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Container/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Hydro Flask',
          volume: 750,
          hydration_factor: 1,
        })
      );
    });
  });

  it('allows setting a primary container', async () => {
    renderWithClient(<WaterContainerManager />);

    const makePrimaryBtn = screen.getByRole('button', {
      name: /Make primary/i,
    });
    fireEvent.click(makePrimaryBtn);

    await waitFor(() => {
      expect(mockSetPrimary).toHaveBeenCalledWith(2);
    });
  });
});
