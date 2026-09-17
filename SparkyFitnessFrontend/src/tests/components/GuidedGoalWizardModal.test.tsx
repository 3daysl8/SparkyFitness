import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuidedGoalWizardModal from '@/pages/Focus/GuidedGoalWizardModal';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockMutateCreateDomain = jest.fn();
const mockMutateCreateFocus = jest.fn();

jest.mock('@/hooks/useFocus', () => ({
  useFocusDomains: () => ({
    data: [{ id: 'd-1', name: 'Strength & Conditioning', color: '#6366f1' }],
  }),
  useCreateFocusDomain: () => ({
    mutateAsync: mockMutateCreateDomain,
  }),
  useCreateFocus: () => ({
    mutateAsync: mockMutateCreateFocus,
  }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    timezone: 'UTC',
    firstDayOfWeek: 0,
  }),
}));

describe('GuidedGoalWizardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateCreateDomain.mockResolvedValue({
      id: 'd-new',
      name: 'New Domain',
    });
    mockMutateCreateFocus.mockResolvedValue({ id: 'f-new' });
  });

  it('renders archetype templates on Step 1', () => {
    render(<GuidedGoalWizardModal isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Consistent Strength Builder')).toBeInTheDocument();
    expect(
      screen.getByText('Metabolic Flexibility & Fasting')
    ).toBeInTheDocument();
    expect(screen.getByText('Optimal Daily Hydration')).toBeInTheDocument();
    expect(
      screen.getByText('Restorative Sleep & Recovery')
    ).toBeInTheDocument();
  });

  it('populates fields and transitions to Step 2 when selecting an archetype', () => {
    render(<GuidedGoalWizardModal isOpen={true} onClose={jest.fn()} />);

    fireEvent.click(screen.getByText('Consistent Strength Builder'));

    // Should now be on Step 2 (North Star)
    expect(
      screen.getByText('Tier 1: Identity & North Star (Long-Term)')
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        'Cultivate a strong, capable body that handles life with vigor and confidence.'
      )
    ).toBeInTheDocument();
  });

  it('navigates through all 4 steps and submits complete 3-tier goal hierarchy', async () => {
    const handleClose = jest.fn();
    render(<GuidedGoalWizardModal isOpen={true} onClose={handleClose} />);

    // Step 1: Select Strength Builder
    fireEvent.click(screen.getByText('Consistent Strength Builder'));

    // Step 2: Click Next Step
    fireEvent.click(screen.getByText('Next Step'));

    // Step 3: Weekly Focus
    expect(
      screen.getByText('Tier 2: Weekly Focus & Milestone')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next Step'));

    // Step 4: Daily Habit & WOOP If-Then Plan
    expect(
      screen.getByText('Tier 3: Daily Implementation & Obstacle Plan (WOOP)')
    ).toBeInTheDocument();

    // Finish
    fireEvent.click(screen.getByText('Activate Goal Framework'));

    await waitFor(() => {
      // 3 focuses created (Long-Term, Weekly, Daily)
      expect(mockMutateCreateFocus).toHaveBeenCalledTimes(3);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
