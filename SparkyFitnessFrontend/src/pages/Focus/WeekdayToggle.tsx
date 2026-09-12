import { Button } from '@/components/ui/button';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A row of 7 toggle buttons for picking which days of the week a recurring
 * focus is active on. An empty or full selection both mean "every day" to
 * the backend (see focusRepository's recurrence_days_of_week IS NULL check),
 * so callers should send `undefined` rather than the raw set when all 7 (or
 * none) are selected. */
export default function WeekdayToggle({
  selected,
  onChange,
}: {
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAY_LABELS.map((label, idx) => (
        <Button
          key={idx}
          type="button"
          size="sm"
          variant={selected.has(idx) ? 'default' : 'outline'}
          onClick={() => {
            const next = new Set(selected);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            onChange(next);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
