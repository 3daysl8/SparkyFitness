import focusRepository from '../models/focusRepository.js';
import { addDays, dayOfWeek } from '@workspace/shared';

/** Monday-based week start for a YYYY-MM-DD day string. */
function weekStartFor(date: string): string {
  const offset = (dayOfWeek(date) + 6) % 7; // Sun(0)->6, Mon(1)->0, ... Sat(6)->5
  return addDays(date, -offset);
}

interface CheckinLike {
  progress_value: number | null;
  completed: boolean | null;
}

interface CheckinHistoryRow extends CheckinLike {
  focus_id: string;
  checkin_date: string;
}

interface RecurringFocusRow {
  id: string;
  target_type: string;
  target_value: number | null;
  today_checkin: CheckinLike | null;
  recurrence_days_of_week: number[] | null;
  [key: string]: unknown;
}

// How far back to look when computing a "current streak" — long enough for
// any realistic streak on a personal habit, short enough to keep the query
// and in-memory walk cheap.
const STREAK_LOOKBACK_DAYS = 60;

/**
 * Whether a day's check-in counts as "done" for streak/checklist purposes.
 * Boolean/none-target focuses use the completed flag; numeric-target ones use
 * an at-least-target threshold (mirrors uHabits' numeric-habit completion
 * rule) rather than merely having *a* value logged for the day.
 */
function isCheckinDone(
  checkin: CheckinLike | null | undefined,
  targetType: string,
  targetValue: number | null
): boolean {
  if (!checkin) return false;
  if (targetType === 'numeric') {
    return (
      checkin.progress_value !== null &&
      targetValue !== null &&
      checkin.progress_value >= targetValue
    );
  }
  return checkin.completed === true;
}

/**
 * Consecutive-day streak ending at `date` (inclusive): walks backward day by
 * day through `history` until the first *scheduled* day that isn't done. A
 * day excluded by `recurrenceDaysOfWeek` is skipped rather than treated as a
 * miss — otherwise a habit that (say) excludes weekends would have its
 * streak reset by Monday every week, since no check-in row ever exists for
 * an excluded day. A day with no check-in row on a day the habit *was*
 * scheduled still breaks the streak. Deliberately a simple counter rather
 * than uHabits' exponential-moving-average "strength" score — plenty for a
 * personal single-user tool.
 */
function computeStreak(
  history: CheckinHistoryRow[],
  targetType: string,
  targetValue: number | null,
  date: string,
  recurrenceDaysOfWeek: number[] | null
): number {
  const byDate = new Map(history.map((h) => [h.checkin_date, h]));
  let streak = 0;
  let cursor = date;
  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const scheduled =
      !recurrenceDaysOfWeek ||
      recurrenceDaysOfWeek.length === 0 ||
      recurrenceDaysOfWeek.includes(dayOfWeek(cursor));
    if (scheduled) {
      if (!isCheckinDone(byDate.get(cursor), targetType, targetValue)) break;
      streak += 1;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Resolves everything a "for date" view needs in one call — the Hermes
 * morning briefing, the in-app checklist home page, and the AI chat's
 * get_today action all share this: one-off focuses scheduled for `date`,
 * recurring daily habits active on `date` (each with its done state and
 * current streak), the focus for that date's Monday-starting week, and every
 * active long_term focus.
 */
async function getToday(userId: string, date: string) {
  const weekStart = weekStartFor(date);
  const dow = dayOfWeek(date);
  const snapshot = await focusRepository.getTodaySnapshot(
    userId,
    date,
    weekStart,
    dow
  );

  const recurring = snapshot.daily_recurring as unknown as RecurringFocusRow[];
  const recurringIds = recurring.map((f) => f.id);
  const sinceDate = addDays(date, -STREAK_LOOKBACK_DAYS);
  const history = (await focusRepository.getCheckinHistoryForFocuses(
    userId,
    recurringIds,
    sinceDate
  )) as unknown as CheckinHistoryRow[];

  const historyByFocus = new Map<string, CheckinHistoryRow[]>();
  for (const row of history) {
    const list = historyByFocus.get(row.focus_id) ?? [];
    list.push(row);
    historyByFocus.set(row.focus_id, list);
  }

  const dailyRecurring = recurring.map((f) => {
    const hist = historyByFocus.get(f.id) ?? [];
    return {
      ...f,
      done: isCheckinDone(f.today_checkin, f.target_type, f.target_value),
      current_streak: computeStreak(
        hist,
        f.target_type,
        f.target_value,
        date,
        f.recurrence_days_of_week
      ),
    };
  });

  return {
    date,
    week_start: weekStart,
    scheduled: snapshot.scheduled,
    daily_recurring: dailyRecurring,
    weekly: snapshot.weekly,
    long_term: snapshot.long_term,
  };
}

export default {
  weekStartFor,
  getToday,
};
