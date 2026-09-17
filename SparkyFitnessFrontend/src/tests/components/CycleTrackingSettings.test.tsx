import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CycleTrackingSettings } from '@/pages/Settings/CycleTrackingSettings';
import * as cycleHooks from '@/hooks/useCycle';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
}));

describe('CycleTrackingSettings', () => {
  const mockUpdateSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(cycleHooks, 'useCycleActive').mockReturnValue({
      isCycleActive: true,
      isFemale: true,
    });
    jest.spyOn(cycleHooks, 'useCycleSettings').mockReturnValue({
      settings: {
        enabled: true,
        avg_cycle_length: 28,
        avg_period_length: 5,
        luteal_phase_length: 14,
        last_period_start_date: '2026-09-01',
        reminders_enabled: true,
      },
      updateSettings: mockUpdateSettings,
      updateSettingsAsync: jest.fn(),
      isUpdating: false,
    } as unknown as ReturnType<typeof cycleHooks.useCycleSettings>);
  });

  it('renders cycle settings form and allows editing parameters', () => {
    render(<CycleTrackingSettings />);

    expect(
      screen.getByText('Menstrual Cycle & Phase Tracking')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enable Menstrual Cycle Tracking')
    ).toBeInTheDocument();

    const cycleInput = screen.getByDisplayValue('28');
    fireEvent.change(cycleInput, { target: { value: '30' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        avg_cycle_length: 30,
        enabled: true,
      })
    );
  });
});
