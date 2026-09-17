import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoutineTemplateExplorerModal } from '@/components/RoutineTemplateExplorerModal';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

describe('RoutineTemplateExplorerModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAddToMyRoutines = jest.fn();
  const mockOnStartWorkout = jest.fn();
  const mockOnCustomize = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAddToMyRoutines.mockResolvedValue(undefined);
  });

  it('renders modal with templates and categories when open', () => {
    render(
      <RoutineTemplateExplorerModal
        isOpen={true}
        onClose={mockOnClose}
        onAddToMyRoutines={mockOnAddToMyRoutines}
        onStartWorkout={mockOnStartWorkout}
        onCustomize={mockOnCustomize}
        userId="user-1"
      />
    );

    expect(screen.getByText('Routine Template Library')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search routines/i)).toBeInTheDocument();
    expect(screen.getByText('All Programs')).toBeInTheDocument();
    expect(screen.getByText('Push / Pull / Legs')).toBeInTheDocument();
  });

  it('filters templates via search input', () => {
    render(
      <RoutineTemplateExplorerModal
        isOpen={true}
        onClose={mockOnClose}
        onAddToMyRoutines={mockOnAddToMyRoutines}
        onStartWorkout={mockOnStartWorkout}
        onCustomize={mockOnCustomize}
        userId="user-1"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search routines/i);
    fireEvent.change(searchInput, { target: { value: '5/3/1' } });

    expect(
      screen.getByText('5/3/1 Heavy Compound Strength')
    ).toBeInTheDocument();
  });

  it('triggers onAddToMyRoutines when clicking Add Routine', async () => {
    render(
      <RoutineTemplateExplorerModal
        isOpen={true}
        onClose={mockOnClose}
        onAddToMyRoutines={mockOnAddToMyRoutines}
        onStartWorkout={mockOnStartWorkout}
        onCustomize={mockOnCustomize}
        userId="user-1"
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add Routine/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]!);

    await waitFor(() => {
      expect(mockOnAddToMyRoutines).toHaveBeenCalledTimes(1);
    });
  });

  it('triggers onStartWorkout and closes modal when clicking Start Now', () => {
    render(
      <RoutineTemplateExplorerModal
        isOpen={true}
        onClose={mockOnClose}
        onAddToMyRoutines={mockOnAddToMyRoutines}
        onStartWorkout={mockOnStartWorkout}
        onCustomize={mockOnCustomize}
        userId="user-1"
      />
    );

    const startButtons = screen.getAllByRole('button', { name: /Start Now/i });
    expect(startButtons.length).toBeGreaterThan(0);
    fireEvent.click(startButtons[0]!);

    expect(mockOnStartWorkout).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onCustomize and closes modal when clicking Customize in Builder', () => {
    render(
      <RoutineTemplateExplorerModal
        isOpen={true}
        onClose={mockOnClose}
        onAddToMyRoutines={mockOnAddToMyRoutines}
        onStartWorkout={mockOnStartWorkout}
        onCustomize={mockOnCustomize}
        userId="user-1"
      />
    );

    const customizeButtons = screen.getAllByRole('button', {
      name: /Customize in Builder/i,
    });
    expect(customizeButtons.length).toBeGreaterThan(0);
    fireEvent.click(customizeButtons[0]!);

    expect(mockOnCustomize).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
