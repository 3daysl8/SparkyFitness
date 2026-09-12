import focusRepository from '../models/focusRepository.js';
import { addDays, dayOfWeek } from '@workspace/shared';

/** Monday-based week start for a YYYY-MM-DD day string. */
function weekStartFor(date: string): string {
  const offset = (dayOfWeek(date) + 6) % 7; // Sun(0)->6, Mon(1)->0, ... Sat(6)->5
  return addDays(date, -offset);
}

/**
 * Resolves everything the Hermes morning briefing (or the in-app "Today"
 * widget) needs in one call: today's daily focus/es, the focus for the
 * current Monday-starting week, and every active long_term focus.
 */
async function getToday(userId: string, date: string) {
  const weekStart = weekStartFor(date);
  const snapshot = await focusRepository.getTodaySnapshot(
    userId,
    date,
    weekStart
  );
  return { date, week_start: weekStart, ...snapshot };
}

export default {
  weekStartFor,
  getToday,
};
