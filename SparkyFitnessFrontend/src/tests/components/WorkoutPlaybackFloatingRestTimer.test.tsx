import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutPlaybackFloatingRestTimer from '@/pages/Exercises/WorkoutPlaybackFloatingRestTimer';
import { setRestTimerAudioEnabled } from '@/utils/audioFeedback';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

describe('WorkoutPlaybackFloatingRestTimer', () => {
  const mockPauseResume = jest.fn();
  const mockSkip = jest.fn();
  const mockExtend = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    mockPauseResume.mockReset();
    mockSkip.mockReset();
    mockExtend.mockReset();
  });

  it('renders nothing when restState is idle', () => {
    const { container } = render(
      <WorkoutPlaybackFloatingRestTimer
        restState="idle"
        restRemaining="01:30"
        onPauseResume={mockPauseResume}
        onSkip={mockSkip}
        onExtend={mockExtend}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders countdown time and action buttons when running', () => {
    render(
      <WorkoutPlaybackFloatingRestTimer
        restState="running"
        restRemaining="00:45"
        restRemainingSeconds={45}
        onPauseResume={mockPauseResume}
        onSkip={mockSkip}
        onExtend={mockExtend}
      />
    );

    expect(screen.getByText('00:45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+30s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mute rest timer' })
    ).toBeInTheDocument();
  });

  it('triggers onPauseResume, onSkip, and onExtend callbacks', () => {
    render(
      <WorkoutPlaybackFloatingRestTimer
        restState="running"
        restRemaining="00:45"
        onPauseResume={mockPauseResume}
        onSkip={mockSkip}
        onExtend={mockExtend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '+30s' }));
    expect(mockExtend).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(mockPauseResume).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockSkip).toHaveBeenCalledTimes(1);
  });

  it('toggles mute audio state on click', () => {
    setRestTimerAudioEnabled(true);
    render(
      <WorkoutPlaybackFloatingRestTimer
        restState="running"
        restRemaining="00:45"
        onPauseResume={mockPauseResume}
        onSkip={mockSkip}
        onExtend={mockExtend}
      />
    );

    const muteButton = screen.getByRole('button', { name: 'Mute rest timer' });
    fireEvent.click(muteButton);

    expect(
      screen.getByRole('button', { name: 'Unmute rest timer' })
    ).toBeInTheDocument();
    expect(localStorage.getItem('sparky.restTimerAudio.enabled')).toBe('false');
  });

  it('applies urgent pulse styling when remaining seconds is 5 or less', () => {
    const { container } = render(
      <WorkoutPlaybackFloatingRestTimer
        restState="running"
        restRemaining="00:03"
        restRemainingSeconds={3}
        onPauseResume={mockPauseResume}
        onSkip={mockSkip}
        onExtend={mockExtend}
      />
    );

    const timerPill = container.querySelector('.animate-pulse');
    expect(timerPill).toBeInTheDocument();
    expect(timerPill).toHaveClass('border-amber-500/60');
  });
});
