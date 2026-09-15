import { useMemo } from 'react';
import { orderedDaysOfWeek } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Button } from '@/components/ui/button';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A row of 7 toggle buttons for picking which days of the week a recurring
 * focus is active on. An empty or full selection both mean "every day" to
 * the backend (see focusRepository's recurrence_days_of_week IS NULL check),
 * so callers should send `undefined` rather than the raw set when all 7 (or
 * none) are selected.
 *
 * Buttons render in the user's preferred week-start order (via
 * orderedDaysOfWeek), but `selected`/`onChange` stay keyed by day id
 * (0 = Sunday .. 6 = Saturday) regardless of display order — only which
 * button renders in which visual position changes, never what id a given
 * button represents when clicked. */
export default function WeekdayToggle({
  selected,
  onChange,
}: {
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const { firstDayOfWeek } = usePreferences();
  const orderedDayIds = useMemo(
    () => orderedDaysOfWeek(firstDayOfWeek),
    [firstDayOfWeek]
  );

  return (
    <div className="flex flex-wrap gap-1">
      {orderedDayIds.map((dayId) => (
        <Button
          key={dayId}
          type="button"
          size="sm"
          variant={selected.has(dayId) ? 'default' : 'outline'}
          onClick={() => {
            const next = new Set(selected);
            if (next.has(dayId)) next.delete(dayId);
            else next.add(dayId);
            onChange(next);
          }}
        >
          {WEEKDAY_LABELS[dayId]}
        </Button>
      ))}
    </div>
  );
}
