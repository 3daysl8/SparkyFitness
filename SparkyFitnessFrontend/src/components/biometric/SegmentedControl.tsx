import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * The one horizontally-scrolling pill-row selector, replacing near-identical
 * hand-rolled `Button` rows across CheckIn/Medications/Workouts/Reports/
 * Settings. Never wraps — a long option set scrolls instead. Nested
 * SegmentedControls are disallowed by the same "one boundary per region"
 * rule as nested cards; a page with a sub-split folds it into this same row.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1',
        className
      )}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const isActive = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-surface-3 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="size-3.5" strokeWidth={1.5} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
