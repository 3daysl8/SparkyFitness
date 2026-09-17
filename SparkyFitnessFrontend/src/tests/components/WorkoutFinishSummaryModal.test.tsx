import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutFinishSummaryModal from '@/pages/Exercises/WorkoutFinishSummaryModal';
import {
  estimateOneRepMax,
  formatWorkoutSummaryText,
  type WorkoutFinishSummary,
} from '@/utils/workoutPlayback';
import { toast } from 'sonner';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ weightUnit: 'kg', timezone: 'UTC' }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock HTMLCanvasElement for WorkoutConfetti in jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('WorkoutFinishSummaryModal', () => {
  const mockOnDone = jest.fn();

  beforeEach(() => {
    mockOnDone.mockReset();
    (toast.success as jest.Mock).mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  const baseSummary: WorkoutFinishSummary = {
    name: 'Push Day Hypertrophy',
    prCount: 0,
    prAchievements: [],
    totalVolume: 5200,
    elapsedSeconds: 2700, // 45m
    setsCompleted: 15,
    totalSets: 15,
    exercises: [
      {
        name: 'Bench Press',
        completedSets: 4,
        totalSets: 4,
        topWeight: 100,
        topReps: 8,
        totalVolume: 3200,
      },
      {
        name: 'Incline Dumbbell Press',
        completedSets: 3,
        totalSets: 3,
        topWeight: 32,
        topReps: 10,
        totalVolume: 2000,
      },
    ],
    supersetsCompleted: 1,
  };

  it('renders nothing when summary is null', () => {
    const { container } = render(
      <WorkoutFinishSummaryModal summary={null} onDone={mockOnDone} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders workout stats correctly when no PRs are present', () => {
    render(
      <WorkoutFinishSummaryModal summary={baseSummary} onDone={mockOnDone} />
    );

    expect(screen.getByText('Workout Complete!')).toBeInTheDocument();
    expect(screen.getByText('Push Day Hypertrophy')).toBeInTheDocument();
    expect(screen.getByText('45m')).toBeInTheDocument(); // 45 mins
    expect(screen.getByText('15/15')).toBeInTheDocument();
    expect(screen.getByText('(100%)')).toBeInTheDocument();
    expect(screen.getByText('5200 kg')).toBeInTheDocument();
    expect(
      screen.queryByText(/Personal Records Smashed/i)
    ).not.toBeInTheDocument();
  });

  it('renders PR showcase and celebrations when PRs are achieved', () => {
    const prSummary: WorkoutFinishSummary = {
      ...baseSummary,
      prCount: 2,
      prAchievements: [
        {
          exerciseName: 'Bench Press',
          weight: 105,
          reps: 5,
          setNumber: 3,
          estimated1Rm: 122.5,
        },
        {
          exerciseName: 'Incline Dumbbell Press',
          weight: 34,
          reps: 8,
          setNumber: 2,
          estimated1Rm: 43.1,
        },
      ],
    };

    render(
      <WorkoutFinishSummaryModal summary={prSummary} onDone={mockOnDone} />
    );

    expect(screen.getByText('Personal Records Smashed!')).toBeInTheDocument();
    expect(screen.getByText('2 Personal Records!')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('105 kg × 5')).toBeInTheDocument();
    expect(screen.getByText('~122.5 kg 1RM')).toBeInTheDocument();
  });

  it('toggles exercise breakdown section', () => {
    render(
      <WorkoutFinishSummaryModal summary={baseSummary} onDone={mockOnDone} />
    );

    const toggleButton = screen.getByText(/Exercise Breakdown \(2\)/i);
    expect(toggleButton).toBeInTheDocument();

    // Initially collapsed
    expect(screen.queryByText(/Top: 100 kg × 8/i)).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Top: 100 kg × 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Top: 32 kg × 10/i)).toBeInTheDocument();
  });

  it('copies workout summary text to clipboard and shows toast', async () => {
    render(
      <WorkoutFinishSummaryModal summary={baseSummary} onDone={mockOnDone} />
    );

    const copyButton = screen.getByRole('button', { name: /Copy Summary/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Workout Complete: Push Day Hypertrophy')
    );
  });

  it('triggers onDone callback when clicking Done', () => {
    render(
      <WorkoutFinishSummaryModal summary={baseSummary} onDone={mockOnDone} />
    );

    const doneButton = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneButton);

    expect(mockOnDone).toHaveBeenCalledTimes(1);
  });

  describe('utility functions', () => {
    it('estimates 1RM correctly using Epley formula', () => {
      expect(estimateOneRepMax(100, 1)).toBe(100);
      expect(estimateOneRepMax(100, 10)).toBe(133.3);
      expect(estimateOneRepMax(0, 5)).toBe(0);
      expect(estimateOneRepMax(80, null)).toBe(80);
    });

    it('formats shareable summary text accurately', () => {
      const summaryText = formatWorkoutSummaryText(baseSummary, 'kg');
      expect(summaryText).toContain(
        '🏋️ Workout Complete: Push Day Hypertrophy'
      );
      expect(summaryText).toContain(
        '⏱️ Duration: 45m | 📊 Sets: 15/15 | ⚡ Volume: 5,200 kg'
      );
      expect(summaryText).toContain(
        '• Bench Press: 4/4 sets (Top: 100 kg × 8)'
      );
      expect(summaryText).toContain('Logged with SparkyFitness ⚡');
    });
  });
});
