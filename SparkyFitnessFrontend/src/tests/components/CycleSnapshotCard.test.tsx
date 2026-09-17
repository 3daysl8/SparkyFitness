import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CycleSnapshotCard } from '@/pages/Home/CycleSnapshotCard';
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

describe('CycleSnapshotCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(cycleHooks, 'useCycleSettings').mockReturnValue({
      settings: {
        enabled: true,
        avg_cycle_length: 28,
        avg_period_length: 5,
        luteal_phase_length: 14,
        last_period_start_date: '2026-09-01',
        reminders_enabled: true,
      },
      updateSettings: jest.fn(),
      updateSettingsAsync: jest.fn(),
      isUpdating: false,
    } as unknown as ReturnType<typeof cycleHooks.useCycleSettings>);
    jest.spyOn(cycleHooks, 'useSaveCycleDailyEntry').mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof cycleHooks.useSaveCycleDailyEntry>);
  });

  it('renders nothing when cycle tracking is inactive for the user', () => {
    jest.spyOn(cycleHooks, 'useCycleActive').mockReturnValue({
      isCycleActive: false,
      isFemale: false,
    });
    jest.spyOn(cycleHooks, 'useCyclePhase').mockReturnValue(mockPhaseInfo);
    jest.spyOn(cycleHooks, 'useCycleDailyEntry').mockReturnValue({
      data: null,
      entry: null,
    } as unknown as ReturnType<typeof cycleHooks.useCycleDailyEntry>);

    const { container } = render(<CycleSnapshotCard date="2026-09-08" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders phase card and cycle day when active', () => {
    jest.spyOn(cycleHooks, 'useCycleActive').mockReturnValue({
      isCycleActive: true,
      isFemale: true,
    });
    jest.spyOn(cycleHooks, 'useCyclePhase').mockReturnValue(mockPhaseInfo);
    jest.spyOn(cycleHooks, 'useCycleDailyEntry').mockReturnValue({
      data: null,
      entry: null,
    } as unknown as ReturnType<typeof cycleHooks.useCycleDailyEntry>);

    render(<CycleSnapshotCard date="2026-09-08" />);

    expect(screen.getByText('Cycle & Phase')).toBeInTheDocument();
    expect(screen.getByText('Follicular Phase')).toBeInTheDocument();
    expect(
      screen.getByText('High Energy & Progressive Overload:')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Heavy resistance training and HIIT')
    ).toBeInTheDocument();
  });

  it('opens CycleTrackerDialog when clicked', () => {
    jest.spyOn(cycleHooks, 'useCycleActive').mockReturnValue({
      isCycleActive: true,
      isFemale: true,
    });
    jest.spyOn(cycleHooks, 'useCyclePhase').mockReturnValue(mockPhaseInfo);
    jest.spyOn(cycleHooks, 'useCycleDailyEntry').mockReturnValue({
      data: null,
      entry: null,
    } as unknown as ReturnType<typeof cycleHooks.useCycleDailyEntry>);

    render(<CycleSnapshotCard date="2026-09-08" />);

    const logBtn = screen.getByRole('button', { name: /Log Today/i });
    fireEvent.click(logBtn);

    expect(
      screen.getByText('Menstrual Cycle & Phase Guide')
    ).toBeInTheDocument();
  });
});
