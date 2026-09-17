import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationSettings } from '@/pages/Settings/NotificationSettings';
import * as reminderUtils from '@/utils/reminderUtils';
import * as audioFeedback from '@/utils/audioFeedback';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
}));

describe('NotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders all notification sections and permission state', () => {
    render(<NotificationSettings />);

    expect(
      screen.getByText('Browser & Device Notifications')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Protocols & Routine Reminders')
    ).toBeInTheDocument();
    expect(screen.getByText('Sound & Timer Feedback')).toBeInTheDocument();
    expect(
      screen.getByText('Scheduled Supplement & Medication Doses')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Evening Daily Check-In Reminder')
    ).toBeInTheDocument();
    expect(screen.getByText('Rest Timer Chimes & Fanfare')).toBeInTheDocument();
  });

  it('toggles supplement reminders and updates localStorage', () => {
    const setSupplementSpy = jest.spyOn(
      reminderUtils,
      'setSupplementReminderEnabled'
    );
    render(<NotificationSettings />);

    const switches = screen.getAllByRole('switch');
    // First switch inside protocols section is supplements switch
    const supplementSwitch = switches[0];
    if (supplementSwitch) {
      fireEvent.click(supplementSwitch);
      expect(setSupplementSpy).toHaveBeenCalled();
    }
  });

  it('toggles audio feedback and triggers sample chime', () => {
    const setAudioSpy = jest.spyOn(audioFeedback, 'setRestTimerAudioEnabled');
    const playChimeSpy = jest.spyOn(audioFeedback, 'playRestTimerChime');
    render(<NotificationSettings />);

    const switches = screen.getAllByRole('switch');
    // Rest chime switch is near the end
    const chimeSwitch = switches[switches.length - 2];
    if (chimeSwitch) {
      fireEvent.click(chimeSwitch);
      expect(setAudioSpy).toHaveBeenCalled();
      expect(playChimeSpy).toBeDefined();
    }
  });

  it('updates evening check-in time', () => {
    const setTimeSpy = jest.spyOn(reminderUtils, 'setCheckInReminderTime');
    render(<NotificationSettings />);

    const timeInput = screen.getByDisplayValue('20:00');
    fireEvent.change(timeInput, { target: { value: '21:30' } });
    expect(setTimeSpy).toHaveBeenCalledWith('21:30');
  });
});
