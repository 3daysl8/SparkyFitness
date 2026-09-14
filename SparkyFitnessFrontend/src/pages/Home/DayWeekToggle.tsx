import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type DayWeekView = 'day' | 'week';

/** Segmented Day/Week control shared by the dashboard's Today's Agenda and
 * To-Do List cards, so the two stay visually identical rather than drifting
 * apart under separate implementations. */
export default function DayWeekToggle({
  view,
  onChange,
}: {
  view: DayWeekView;
  onChange: (view: DayWeekView) => void;
}) {
  const { t } = useTranslation();
  const options: { value: DayWeekView; label: string }[] = [
    { value: 'day', label: t('agenda.day', 'Day') },
    { value: 'week', label: t('agenda.week', 'Week') },
  ];

  return (
    <div
      className="flex items-center rounded-full bg-muted p-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] transition-colors',
            view === opt.value
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
