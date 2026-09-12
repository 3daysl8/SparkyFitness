import NodeCache from 'node-cache';
import * as ical from 'node-ical';
import calendarFeedRepository from '../models/calendarFeedRepository.js';
import { log } from '../config/logging.js';
import {
  createGuardedFetch,
  PUBLIC_ONLY_AI_NETWORK_POLICY,
} from '../utils/outboundUrlPolicy.js';
import { dayRangeToUtcRange } from '@workspace/shared';

// 15-minute TTL so the dashboard never blocks on a live fetch to Google/
// Apple/Outlook — matches the announcementCache precedent in
// services/announcementService.ts. Keyed by feed id (not URL) so renaming a
// feed doesn't invalidate it, but changing its ics_url does (a new fetch
// naturally repopulates the key on next read since the old parsed calendar
// is never reused for a different URL).
const CACHE_TTL_SECONDS = 15 * 60;
const feedCache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: 120,
});

// A calendar feed URL is user-supplied and fetched server-side on every
// cache miss — always block private/internal addresses, with no admin
// override (unlike AI service URLs, there's no legitimate reason a personal
// calendar feed would need to reach internal infrastructure).
const guardedFetch = createGuardedFetch(PUBLIC_ONLY_AI_NETWORK_POLICY);
const MAX_REDIRECTS = 5;

// Curated, not exhaustive — the same string-match precedent already used to
// auto-complete a "Workout" habit on Finish (see the regex in
// HomeChecklist.tsx's WorkoutCard): there's no category field on a calendar
// event to key off instead.
const WORKOUT_TITLE_PATTERN =
  /\bworkout\b|\bgym\b|leg day|chest day|back day|arm day|shoulder day|push day|pull day|cardio day/i;

// A URL that's shape-valid and public but doesn't actually serve an ICS
// feed (wrong link, an HTML "share" page instead of the raw .ics one, a
// dead subscription) — client error, not a policy block or a server fault.
export class InvalidIcsFeedError extends Error {
  statusCode = 400;
  code = 'invalid_ics_feed';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidIcsFeedError';
  }
}

export interface StructuredCalendarEvent {
  id: string;
  feedId: string;
  feedName: string;
  feedColor: string | null;
  title: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  allDay: boolean;
  location: string | null;
  description: string | null;
  isWorkout: boolean;
}

interface CalendarFeedRow {
  id: string;
  name: string;
  ics_url: string;
  color: string | null;
}

/**
 * Follows redirects manually (createGuardedFetch forces `redirect: 'manual'`
 * precisely so a redirect can't bypass the private-address guard) —
 * re-validates every hop through the same guarded fetch rather than trusting
 * an intermediate 3xx to a location the caller never approved.
 */
async function fetchWithGuardedRedirects(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const response = await guardedFetch(current);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects while fetching calendar feed.');
}

async function fetchAndParseIcsUrl(
  icsUrl: string,
  label: string
): Promise<ical.CalendarResponse> {
  const response = await fetchWithGuardedRedirects(icsUrl);
  if (!response.ok) {
    throw new InvalidIcsFeedError(
      `Calendar feed "${label}" returned HTTP ${response.status}`
    );
  }
  const text = await response.text();
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
    throw new InvalidIcsFeedError(
      `Calendar feed "${label}" did not return a valid iCalendar (.ics) feed.`
    );
  }
  return (await ical.async.parseICS(text)) as ical.CalendarResponse;
}

async function getParsedFeed(
  feed: CalendarFeedRow
): Promise<ical.CalendarResponse> {
  const cacheKey = `calendar-feed:${feed.id}`;
  const cached = feedCache.get<ical.CalendarResponse>(cacheKey);
  if (cached) return cached;

  const parsed = await fetchAndParseIcsUrl(feed.ics_url, feed.name);
  feedCache.set(cacheKey, parsed);
  return parsed;
}

/** Eagerly fetches+sanity-checks an ics_url (SSRF-guarded, same path as a
 * normal agenda read) so a bad or blocked URL is rejected the moment a user
 * saves it, rather than silently returning zero events on every later
 * dashboard load. Deliberately does not cache the result: the feed doesn't
 * have its final id yet on create, and the natural first agenda read
 * populates the cache anyway. */
async function validateFeedUrl(icsUrl: string): Promise<void> {
  await fetchAndParseIcsUrl(icsUrl, icsUrl);
}

/** VEVENT text fields (summary/location/description) come back either as a
 * plain string or `{ val, params }` when the source line carried iCal
 * parameters (e.g. a language tag) — normalize to a plain string either way. */
function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'val' in (value as Record<string, unknown>)
  ) {
    return String((value as { val: unknown }).val);
  }
  return String(value);
}

function toStructuredEvent(
  feed: CalendarFeedRow,
  source: ical.VEvent,
  start: Date,
  end: Date,
  allDay: boolean
): StructuredCalendarEvent {
  const title = textValue(source.summary) ?? '(untitled event)';
  return {
    id: `${feed.id}:${source.uid}:${start.toISOString()}`,
    feedId: feed.id,
    feedName: feed.name,
    feedColor: feed.color,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    location: textValue(source.location),
    description: textValue(source.description),
    isWorkout: WORKOUT_TITLE_PATTERN.test(title),
  };
}

function eventsForFeedInRange(
  feed: CalendarFeedRow,
  calendar: ical.CalendarResponse,
  rangeStart: Date,
  rangeEnd: Date
): StructuredCalendarEvent[] {
  const events: StructuredCalendarEvent[] = [];

  for (const key of Object.keys(calendar)) {
    const component = calendar[key];
    if (!component || component.type !== 'VEVENT') continue;
    const vevent = component;

    if (vevent.rrule) {
      const instances = ical.expandRecurringEvent(vevent, {
        from: rangeStart,
        to: rangeEnd,
        includeOverrides: true,
        excludeExdates: true,
      });
      for (const instance of instances) {
        events.push(
          toStructuredEvent(
            feed,
            instance.event,
            instance.start,
            instance.end,
            instance.isFullDay
          )
        );
      }
      continue;
    }

    // A standalone RECURRENCE-ID override with no rrule of its own is
    // already surfaced by its master event's expandRecurringEvent call
    // above (includeOverrides: true) — counting it again here would
    // duplicate that occurrence.
    if ('recurrenceid' in vevent && vevent.recurrenceid) continue;

    if (!vevent.start || !vevent.end) continue;
    if (vevent.end < rangeStart || vevent.start > rangeEnd) continue;
    events.push(
      toStructuredEvent(
        feed,
        vevent,
        vevent.start,
        vevent.end,
        vevent.datetype === 'date'
      )
    );
  }

  return events;
}

/** Merged, sorted agenda across every enabled feed for `[startDay, endDay]`
 * inclusive, resolved in the caller's timezone. A single feed failing to
 * fetch/parse (dead URL, provider outage) is logged and dropped rather than
 * failing the whole agenda — one bad subscription shouldn't blank the
 * dashboard for every other calendar. */
async function getAgenda(
  userId: string,
  startDay: string,
  endDay: string,
  timezone: string
): Promise<StructuredCalendarEvent[]> {
  const feeds = (await calendarFeedRepository.listEnabledFeeds(
    userId
  )) as CalendarFeedRow[];
  if (feeds.length === 0) return [];

  const { start: rangeStart, end: rangeEnd } = dayRangeToUtcRange(
    startDay,
    endDay,
    timezone
  );

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const calendar = await getParsedFeed(feed);
      return eventsForFeedInRange(feed, calendar, rangeStart, rangeEnd);
    })
  );

  const events: StructuredCalendarEvent[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      events.push(...result.value);
    } else {
      log(
        'warn',
        `Calendar feed "${feeds[i].name}" (${feeds[i].id}) failed to load:`,
        result.reason
      );
    }
  });

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

/** Invalidates a feed's cached parse — call after its ics_url changes so an
 * edit takes effect immediately instead of waiting out the 15-minute TTL. */
function invalidateFeedCache(feedId: string): void {
  feedCache.del(`calendar-feed:${feedId}`);
}

export { WORKOUT_TITLE_PATTERN, eventsForFeedInRange };
export default {
  getAgenda,
  validateFeedUrl,
  invalidateFeedCache,
};
