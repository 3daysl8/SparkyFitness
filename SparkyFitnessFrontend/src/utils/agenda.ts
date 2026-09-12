import { instantToDay } from '@workspace/shared';
import type { CalendarEvent } from '@/types/calendar';

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
