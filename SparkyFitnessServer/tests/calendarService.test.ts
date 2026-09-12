import { describe, it, expect } from 'vitest';
import * as ical from 'node-ical';
import {
  eventsForFeedInRange,
  WORKOUT_TITLE_PATTERN,
} from '../services/calendarService.js';

// A hand-built but valid RFC 5545 fixture, parsed offline via node-ical's
// parseICS (no network) so these tests exercise the real parse + expansion
// path rather than a hand-mocked CalendarResponse shape.
const FIXTURE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:single-event-1@test
DTSTAMP:20260901T000000Z
DTSTART:20260915T090000Z
DTEND:20260915T100000Z
SUMMARY:Dentist Appointment
LOCATION:123 Main St
DESCRIPTION:Annual checkup
END:VEVENT
BEGIN:VEVENT
UID:allday-event-1@test
DTSTAMP:20260901T000000Z
DTSTART;VALUE=DATE:20260916
DTEND;VALUE=DATE:20260917
SUMMARY:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:recurring-gym-1@test
DTSTAMP:20260901T000000Z
DTSTART:20260907T060000Z
DTEND:20260907T070000Z
SUMMARY:Gym - Leg Day
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10
EXDATE:20260921T060000Z
END:VEVENT
END:VCALENDAR
`;

const FEED = {
  id: 'feed-1',
  name: 'Test Calendar',
  ics_url: 'https://example.invalid/cal.ics',
  color: '#ff0000',
};

async function parseFixture() {
  return (await ical.async.parseICS(FIXTURE_ICS)) as ical.CalendarResponse;
}

describe('calendarService.eventsForFeedInRange', () => {
  it('returns a single-instant event, an all-day event, and a recurring occurrence within range', async () => {
    const calendar = await parseFixture();
    const rangeStart = new Date('2026-09-14T00:00:00Z');
    const rangeEnd = new Date('2026-09-21T00:00:00Z');

    const events = eventsForFeedInRange(FEED, calendar, rangeStart, rangeEnd);
    const byTitle = new Map(events.map((e) => [e.title, e]));
    expect(events).toHaveLength(3);

    const dentist = byTitle.get('Dentist Appointment');
    expect(dentist).toMatchObject({
      allDay: false,
      location: '123 Main St',
      description: 'Annual checkup',
      isWorkout: false,
      feedId: 'feed-1',
      feedColor: '#ff0000',
    });

    const holiday = byTitle.get('Public Holiday');
    expect(holiday).toMatchObject({ allDay: true });

    const gym = byTitle.get('Gym - Leg Day');
    expect(gym).toMatchObject({ isWorkout: true });
    expect(gym!.start).toBe('2026-09-14T06:00:00.000Z');
  });

  it('excludes an EXDATE occurrence from a recurring series', async () => {
    const calendar = await parseFixture();
    const events = eventsForFeedInRange(
      FEED,
      calendar,
      new Date('2026-09-21T00:00:00Z'),
      new Date('2026-09-22T00:00:00Z')
    );
    expect(events.filter((e) => e.title === 'Gym - Leg Day')).toHaveLength(0);
  });

  it('still includes the following, non-excluded occurrence', async () => {
    const calendar = await parseFixture();
    const events = eventsForFeedInRange(
      FEED,
      calendar,
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-09-29T00:00:00Z')
    );
    expect(events.filter((e) => e.title === 'Gym - Leg Day')).toHaveLength(1);
  });

  it('returns nothing for a range with no events', async () => {
    const calendar = await parseFixture();
    const events = eventsForFeedInRange(
      FEED,
      calendar,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-02T00:00:00Z')
    );
    expect(events).toHaveLength(0);
  });
});

describe('WORKOUT_TITLE_PATTERN', () => {
  it.each([
    ['Gym', true],
    ['Morning Workout', true],
    ['Leg Day', true],
    ['Chest Day', true],
    ['Team Standup', false],
    ['Dentist Appointment', false],
  ])('%s -> %s', (title, expected) => {
    expect(WORKOUT_TITLE_PATTERN.test(title)).toBe(expected);
  });
});
