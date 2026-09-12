import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, dayOfWeek } from '@workspace/shared';
import focusService from '../services/focusService.js';
import focusRepository from '../models/focusRepository.js';

vi.mock('../models/focusRepository.js', () => ({
  default: {
    getTodaySnapshot: vi.fn(),
    getCheckinHistoryForFocuses: vi.fn(),
  },
}));

/** Nearest Monday on or before `date` — lets tests build a known weekday
 * pattern without hardcoding a real-world date's day-of-week. */
function mondayOnOrBefore(date: string): string {
  let d = date;
  while (dayOfWeek(d) !== 1) d = addDays(d, -1);
  return d;
}

const TODAY = mondayOnOrBefore('2026-09-12'); // a Monday
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

function emptySnapshot(recurring: unknown[] = []) {
  return {
    scheduled: [],
    daily_recurring: recurring,
    weekly: [],
    long_term: [],
  };
}

function checkin(date: string, overrides: Record<string, unknown> = {}) {
  return {
    focus_id: 'habit-1',
    checkin_date: date,
    progress_value: null,
    completed: true,
    ...overrides,
  };
}

describe('focusService.getToday — streak computation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not break a streak across days excluded by recurrence_days_of_week', async () => {
    // A Mon-Fri-only habit, checked in for every weekday across the last two
    // full work weeks plus this Monday. The two intervening weekends have no
    // check-in rows (they were never scheduled) and must not reset the streak.
    const checkedInDates: string[] = [];
    for (const weekOffset of [-14, -7, 0]) {
      const weekMonday = addDays(TODAY, weekOffset);
      const days = weekOffset === 0 ? [0] : [0, 1, 2, 3, 4]; // this week: Monday only (today)
      for (const d of days) checkedInDates.push(addDays(weekMonday, d));
    }

    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot([
        {
          id: 'habit-1',
          target_type: 'boolean',
          target_value: null,
          recurrence_days_of_week: WEEKDAYS,
          today_checkin: checkin(TODAY),
        },
      ])
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue(
      checkedInDates.map((d) => checkin(d))
    );

    const result = await focusService.getToday('user-1', TODAY);

    expect(result.daily_recurring[0].current_streak).toBe(11);
    expect(result.daily_recurring[0].done).toBe(true);
  });

  it('still breaks the streak on a genuinely missed scheduled day', async () => {
    // Same Mon-Fri habit, but last week's Wednesday was skipped.
    const weekMinus1Monday = addDays(TODAY, -7);
    const checkedInDates = [
      TODAY, // this Monday
      addDays(weekMinus1Monday, 4), // last Friday
      addDays(weekMinus1Monday, 3), // last Thursday
      // last Wednesday intentionally missing
      addDays(weekMinus1Monday, 1), // last Tuesday
      addDays(weekMinus1Monday, 0), // last Monday
    ];

    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot([
        {
          id: 'habit-1',
          target_type: 'boolean',
          target_value: null,
          recurrence_days_of_week: WEEKDAYS,
          today_checkin: checkin(TODAY),
        },
      ])
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue(
      checkedInDates.map((d) => checkin(d))
    );

    const result = await focusService.getToday('user-1', TODAY);

    // Mon(today) + Fri + Thu = 3, then breaks at the missing Wednesday.
    expect(result.daily_recurring[0].current_streak).toBe(3);
  });

  it('treats an empty-array recurrence as "every day", not "never"', async () => {
    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot([
        {
          id: 'habit-1',
          target_type: 'boolean',
          target_value: null,
          recurrence_days_of_week: [],
          today_checkin: checkin(TODAY),
        },
      ])
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue([
      checkin(TODAY),
      checkin(addDays(TODAY, -1)),
      checkin(addDays(TODAY, -2)),
    ]);

    const result = await focusService.getToday('user-1', TODAY);

    expect(result.daily_recurring[0].current_streak).toBe(3);
  });

  it('applies the numeric at-least-target rule, not merely "a value was logged"', async () => {
    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot([
        {
          id: 'habit-1',
          target_type: 'numeric',
          target_value: 10000,
          recurrence_days_of_week: null,
          today_checkin: checkin(TODAY, {
            completed: null,
            progress_value: 12000,
          }),
        },
      ])
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue([
      checkin(TODAY, { completed: null, progress_value: 12000 }),
      checkin(addDays(TODAY, -1), { completed: null, progress_value: 5000 }), // logged but under target
    ]);

    const result = await focusService.getToday('user-1', TODAY);

    expect(result.daily_recurring[0].done).toBe(true);
    expect(result.daily_recurring[0].current_streak).toBe(1);
  });

  it('reports zero streak and not-done when today itself is unmet', async () => {
    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot([
        {
          id: 'habit-1',
          target_type: 'boolean',
          target_value: null,
          recurrence_days_of_week: null,
          today_checkin: null,
        },
      ])
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue([
      checkin(addDays(TODAY, -1)),
      checkin(addDays(TODAY, -2)),
    ]);

    const result = await focusService.getToday('user-1', TODAY);

    expect(result.daily_recurring[0].done).toBe(false);
    expect(result.daily_recurring[0].current_streak).toBe(0);
  });

  it('passes date, computed week start, and day-of-week through to the repository', async () => {
    vi.mocked(focusRepository.getTodaySnapshot).mockResolvedValue(
      emptySnapshot()
    );
    vi.mocked(focusRepository.getCheckinHistoryForFocuses).mockResolvedValue(
      []
    );

    const result = await focusService.getToday('user-1', TODAY);

    expect(focusRepository.getTodaySnapshot).toHaveBeenCalledWith(
      'user-1',
      TODAY,
      TODAY, // TODAY is itself a Monday, i.e. the week start
      1 // Monday
    );
    expect(result.week_start).toBe(TODAY);
  });
});
