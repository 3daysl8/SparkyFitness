import { eventDayKey } from '@/utils/agenda';
import type { CalendarEvent } from '@/types/calendar';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    feedId: 'feed-1',
    feedName: 'Test',
    feedColor: null,
    title: 'Test event',
    start: '2026-09-16T09:00:00.000Z',
    end: '2026-09-16T10:00:00.000Z',
    allDay: false,
    location: null,
    description: null,
    isWorkout: false,
    ...overrides,
  };
}

describe('eventDayKey', () => {
  it('projects a timed event through the user timezone', () => {
    // 2026-09-16T09:00:00Z is still 2026-09-16 in Europe/London (BST, UTC+1).
    expect(
      eventDayKey(event({ start: '2026-09-16T09:00:00.000Z' }), 'Europe/London')
    ).toBe('2026-09-16');
  });

  it('rolls a timed event back a day in a negative-offset zone near midnight UTC', () => {
    // 2026-09-16T02:00:00Z is 2026-09-15 22:00 in America/New_York (EDT, UTC-4).
    expect(
      eventDayKey(
        event({ start: '2026-09-16T02:00:00.000Z' }),
        'America/New_York'
      )
    ).toBe('2026-09-15');
  });

  it('does NOT re-project an all-day event through the timezone', () => {
    // Same instant as above, but allDay: must stay on its floating calendar
    // date (the UTC date) regardless of the negative-offset zone that would
    // otherwise roll a real instant back a day.
    expect(
      eventDayKey(
        event({ start: '2026-09-16T00:00:00.000Z', allDay: true }),
        'America/New_York'
      )
    ).toBe('2026-09-16');
  });
});
