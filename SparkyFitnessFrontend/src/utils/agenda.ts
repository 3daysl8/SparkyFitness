import { addDays, dayOfWeek, instantToDay } from '@workspace/shared';
import type { CalendarEvent } from '@/types/calendar';

/** Monday-based week start for a YYYY-MM-DD day string — same convention as
 * the server's focusService.weekStartFor. */
export function weekStartFor(date: string): string {
  const offset = (dayOfWeek(date) + 6) % 7; // Sun(0)->6, Mon(1)->0, ... Sat(6)->5
  return addDays(date, -offset);
}

/** The calendar day an event belongs to, for grouping in Week view. An
 * all-day event's `start` is a floating calendar date with no real instant
 * (node-ical parses `VALUE=DATE` as UTC midnight purely as a Date
 * container), so it must NOT be re-projected through the user's timezone —
 * doing so can shift it onto the adjacent day depending on UTC offset. A
 * timed event's `start` is a real instant and does need that projection. */
export function eventDayKey(event: CalendarEvent, tz: string): string {
  return event.allDay
    ? event.start.slice(0, 10)
    : instantToDay(event.start, tz);
}
