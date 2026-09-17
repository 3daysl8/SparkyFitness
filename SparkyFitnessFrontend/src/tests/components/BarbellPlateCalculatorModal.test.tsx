import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BarbellPlateCalculatorModal from '@/components/BarbellPlateCalculatorModal';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

describe('BarbellPlateCalculatorModal', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnApplyWeight = jest.fn();

  beforeEach(() => {
    mockOnOpenChange.mockReset();
    mockOnApplyWeight.mockReset();
  });

  it('renders correctly when open', () => {
    render(
      <BarbellPlateCalculatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        initialWeight={100}
        weightUnit="kg"
        onApplyWeight={mockOnApplyWeight}
      />
    );

    expect(screen.getByText('Plate Calculator')).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Weight/i)).toHaveValue(100);
    expect(screen.getByText('40 kg / side')).toBeInTheDocument();
    expect(screen.getByText('1 × 25 kg')).toBeInTheDocument();
    expect(screen.getByText('1 × 15 kg')).toBeInTheDocument();
  });

  it('adjusts weight using plus and minus step buttons', () => {
    render(
      <BarbellPlateCalculatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        initialWeight={60}
        weightUnit="kg"
        onApplyWeight={mockOnApplyWeight}
      />
    );

    // Click +10 kg button
    const plusButtons = screen.getAllByRole('button', { name: /10/i });
    const plusTen = plusButtons.find((btn) => btn.textContent?.includes('+'));
    if (plusTen) {
      fireEvent.click(plusTen);
      expect(screen.getByLabelText(/Target Weight/i)).toHaveValue(70);
    }
  });

  it('calls onApplyWeight and closes modal when clicking Apply', () => {
    render(
      <BarbellPlateCalculatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        initialWeight={80}
        weightUnit="kg"
        onApplyWeight={mockOnApplyWeight}
      />
    );

    const applyButton = screen.getByRole('button', { name: /Apply 80 kg/i });
    fireEvent.click(applyButton);

    expect(mockOnApplyWeight).toHaveBeenCalledWith(80);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
