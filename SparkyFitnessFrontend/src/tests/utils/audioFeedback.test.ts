import {
  isRestTimerAudioEnabled,
  setRestTimerAudioEnabled,
  isRestTimerBeepsEnabled,
  setRestTimerBeepsEnabled,
  isRestTimerVibrationEnabled,
  setRestTimerVibrationEnabled,
  playRestTimerCountdownBeep,
  playRestTimerChime,
  triggerRestTimerVibration,
} from '@/utils/audioFeedback';

describe('audioFeedback', () => {
  let originalAudioContext: typeof window.AudioContext;
  let originalNavigator: Navigator;
  let mockStart: jest.Mock;
  let mockStop: jest.Mock;
  let mockConnect: jest.Mock;
  let mockSetValueAtTime: jest.Mock;
  let mockExponentialRampToValueAtTime: jest.Mock;
  let mockAudioContext: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    originalAudioContext = window.AudioContext;
    originalNavigator = window.navigator;

    mockStart = jest.fn();
    mockStop = jest.fn();
    mockConnect = jest.fn();
    mockSetValueAtTime = jest.fn();
    mockExponentialRampToValueAtTime = jest.fn();

    const mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: mockSetValueAtTime },
      connect: mockConnect,
      start: mockStart,
      stop: mockStop,
    };

    const mockGain = {
      gain: {
        setValueAtTime: mockSetValueAtTime,
        exponentialRampToValueAtTime: mockExponentialRampToValueAtTime,
      },
      connect: mockConnect,
    };

    mockAudioContext = jest.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn().mockReturnValue(mockOscillator),
      createGain: jest.fn().mockReturnValue(mockGain),
      resume: jest.fn().mockResolvedValue(undefined),
    }));

    (window as unknown as { AudioContext: unknown }).AudioContext =
      mockAudioContext;
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
  });

  describe('settings and persistence', () => {
    it('defaults audio, beeps, and vibration to enabled', () => {
      expect(isRestTimerAudioEnabled()).toBe(true);
      expect(isRestTimerBeepsEnabled()).toBe(true);
      expect(isRestTimerVibrationEnabled()).toBe(true);
    });

    it('persists audio enable/disable changes to localStorage', () => {
      setRestTimerAudioEnabled(false);
      expect(isRestTimerAudioEnabled()).toBe(false);
      expect(localStorage.getItem('sparky.restTimerAudio.enabled')).toBe(
        'false'
      );

      setRestTimerAudioEnabled(true);
      expect(isRestTimerAudioEnabled()).toBe(true);
      expect(localStorage.getItem('sparky.restTimerAudio.enabled')).toBe(
        'true'
      );
    });

    it('persists beeps and vibration changes to localStorage', () => {
      setRestTimerBeepsEnabled(false);
      expect(isRestTimerBeepsEnabled()).toBe(false);

      setRestTimerVibrationEnabled(false);
      expect(isRestTimerVibrationEnabled()).toBe(false);
    });
  });

  describe('audio playback', () => {
    it('plays completion chime with multi-tone synthesis', () => {
      expect(() => playRestTimerChime()).not.toThrow();
      expect(mockStart).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockSetValueAtTime).toHaveBeenCalledWith(587.33, 0); // D5
    });

    it('plays countdown beep for 3, 2, and 1 seconds', () => {
      playRestTimerCountdownBeep(3);
      expect(mockSetValueAtTime).toHaveBeenCalledWith(440, 0); // A4

      playRestTimerCountdownBeep(2);
      expect(mockSetValueAtTime).toHaveBeenCalledWith(554.37, 0); // C#5

      playRestTimerCountdownBeep(1);
      expect(mockSetValueAtTime).toHaveBeenCalledWith(659.25, 0); // E5
    });

    it('does not create AudioContext when audio is muted', () => {
      setRestTimerAudioEnabled(false);
      mockAudioContext.mockClear();

      playRestTimerChime();
      playRestTimerCountdownBeep(3);

      expect(mockAudioContext).not.toHaveBeenCalled();
    });

    it('does not play countdown beep when beeps are disabled', () => {
      setRestTimerBeepsEnabled(false);
      mockAudioContext.mockClear();

      playRestTimerCountdownBeep(3);
      expect(mockAudioContext).not.toHaveBeenCalled();
    });
  });

  describe('vibration feedback', () => {
    it('triggers vibration on navigator when supported and enabled', () => {
      const vibrateMock = jest.fn();
      Object.defineProperty(window, 'navigator', {
        value: { ...originalNavigator, vibrate: vibrateMock },
        configurable: true,
        writable: true,
      });

      triggerRestTimerVibration();
      expect(vibrateMock).toHaveBeenCalledWith([120, 60, 120]);
    });

    it('does not trigger vibration when vibration is disabled in settings', () => {
      setRestTimerVibrationEnabled(false);
      const vibrateMock = jest.fn();
      Object.defineProperty(window, 'navigator', {
        value: { ...originalNavigator, vibrate: vibrateMock },
        configurable: true,
        writable: true,
      });

      triggerRestTimerVibration();
      expect(vibrateMock).not.toHaveBeenCalled();
    });
  });
});
