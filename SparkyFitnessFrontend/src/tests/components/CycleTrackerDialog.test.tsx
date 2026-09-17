import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CycleTrackerDialog } from '@/pages/Cycle/CycleTrackerDialog';
import * as cycleHooks from '@/hooks/useCycle';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
}));

const mockPhaseInfo: ReturnType<typeof cycleHooks.useCyclePhase> = {
  phase: 'follicular',
  phaseName: 'Follicular Phase',
  cycleDay: 8,
  totalCycleDays: 28,
  daysUntilNextPeriod: 20,
  phaseProgressPercent: 28,
  nextPeriodDate: '2026-09-29',
  ovulationDate: '2026-09-14',
  fertileWindowStart: '2026-09-09',
  fertileWindowEnd: '2026-09-14',
  trainingGuidance: {
    title: 'High Energy & Progressive Overload',
    focus: 'Heavy resistance training and HIIT',
    intensity: 'high',
    description: 'Prime phase to push personal records.',
  },
  nutritionGuidance: {
    title: 'Fuel Muscle Building',
    tip: 'Complex carbs and protein.',
    metabolicNote: 'Enhanced insulin sensitivity.',
  },
};

describe('CycleTrackerDialog', () => {
  const mockSaveMutate = jest.fn().mockResolvedValue({});
  const mockUpdateSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(cycleHooks, 'useCyclePhase').mockReturnValue(mockPhaseInfo);
    jest.spyOn(cycleHooks, 'useCycleDailyEntry').mockReturnValue({
      data: null,
      entry: null,
    } as unknown as ReturnType<typeof cycleHooks.useCycleDailyEntry>);
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
    jest.spyOn(cycleHooks, 'useSaveCycleDailyEntry').mockReturnValue({
      mutateAsync: mockSaveMutate,
      isPending: false,
    } as unknown as ReturnType<typeof cycleHooks.useSaveCycleDailyEntry>);
  });

  it('renders dialog with tabs and phase insights', () => {
    render(
      <CycleTrackerDialog open onOpenChange={jest.fn()} date="2026-09-08" />
    );

    expect(
      screen.getByText('Menstrual Cycle & Phase Guide')
    ).toBeInTheDocument();
    expect(screen.getByText('Follicular Phase')).toBeInTheDocument();
    expect(screen.getByText('Training & Workout Focus')).toBeInTheDocument();
    expect(
      screen.getByText('Nutrition & Recovery Strategy')
    ).toBeInTheDocument();
  });

  it('allows selecting flow and symptoms in daily log tab', async () => {
    render(
      <CycleTrackerDialog
        open
        onOpenChange={jest.fn()}
        date="2026-09-08"
        defaultTab="log"
      />
    );

    // Select Medium flow
    const mediumFlowBtn = screen.getByRole('button', { name: /Medium/i });
    fireEvent.click(mediumFlowBtn);

    // Select Cramps and Fatigue
    const crampsBtn = screen.getByRole('button', { name: /^Cramps$/i });
    fireEvent.click(crampsBtn);

    // Save Daily Log
    const saveBtn = screen.getByRole('button', { name: /Save Daily Log/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-09-08',
          flow: 'medium',
          symptoms: expect.arrayContaining(['cramps']),
        })
      );
    });
  });
});
