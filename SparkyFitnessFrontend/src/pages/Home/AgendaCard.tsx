import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { addDays } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useAgenda } from '@/hooks/useCalendar';
import { formatTimeInZone } from '@/utils/timeFormatters';
import { eventDayKey } from '@/utils/agenda';
import { SectionCard } from '@/components/biometric/SectionCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarDays, Dumbbell, MapPin } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import DayWeekToggle, { type DayWeekView } from './DayWeekToggle';
import EmptyState from './EmptyState';

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function EventLocation({ location }: { location: string }) {
  if (isUrl(location)) {
    return (
      <a
        href={location}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{location}</span>
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="truncate">{location}</span>
    </span>
  );
}

function EventRow({
  event,
  tz,
  timeFormat,
  compact,
}: {
  event: CalendarEvent;
  tz: string;
  timeFormat: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const timeLabel = event.allDay
    ? t('agenda.allDay', 'All day')
    : `${formatTimeInZone(event.start, { kind: 'tz', tz }, timeFormat)} – ${formatTimeInZone(
        event.end,
        { kind: 'tz', tz },
        timeFormat
      )}`;

  return (
    <div className="flex items-start gap-3 py-2">
      <span
        aria-hidden="true"
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: event.feedColor ?? 'var(--muted-foreground)',
        }}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="metric-num text-[11px] text-muted-foreground">
          {timeLabel}
        </p>
        <p
          className={cn(
            'truncate font-medium text-foreground',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {event.title}
        </p>
        {!compact && event.location && (
          <EventLocation location={event.location} />
        )}
      </div>
      {event.isWorkout && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-[11px]"
          onClick={() =>
            navigate('/workouts', { state: { openStartWorkout: true } })
          }
        >
          <Dumbbell className="h-3 w-3" />
          {t('agenda.launchWorkout', 'Launch Workout')}
        </Button>
      )}
    </div>
  );
}

function DayView({
  events,
  tz,
  timeFormat,
}: {
  events: CalendarEvent[];
  tz: string;
  timeFormat: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6 text-muted-foreground" />}
        title={t(
          'agenda.emptyToday',
          'No events scheduled today — enjoy your free time!'
        )}
        actionLabel={t('agenda.manageFeeds', 'Manage Feeds')}
        onAction={() =>
          navigate(
            '/settings?tab=developer-integrations&section=calendar-feeds'
          )
        }
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          tz={tz}
          timeFormat={timeFormat}
        />
      ))}
    </div>
  );
}

function WeekView({
  weekStart,
  events,
  tz,
  timeFormat,
}: {
  weekStart: string;
  events: CalendarEvent[];
  tz: string;
  timeFormat: string;
}) {
  const { t } = useTranslation();

  const days = useMemo(() => {
    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = eventDayKey(event, tz);
      const list = eventsByDay.get(key) ?? [];
      list.push(event);
      eventsByDay.set(key, list);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      return { day, events: eventsByDay.get(day) ?? [] };
    });
  }, [weekStart, events, tz]);

  return (
    <div className="space-y-3">
      {days.map(({ day, events: dayEvents }) => {
        const label = new Date(`${day}T00:00:00`).toLocaleDateString(
          undefined,
          {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }
        );
        return (
          <div key={day}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {dayEvents.length === 0 ? (
              <p className="pl-3 text-xs text-muted-foreground/70">
                {t('agenda.noEventsDay', 'No events')}
              </p>
            ) : (
              <div className="divide-y divide-border pl-3">
                {dayEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    tz={tz}
                    timeFormat={timeFormat}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgendaCard({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { timezone, timeFormat } = usePreferences();
  const [view, setView] = useState<DayWeekView>('day');

  // A rolling 7-day window starting today, not a Monday-anchored calendar
  // week — "the rest of the week" reads as upcoming days, and a fixed
  // calendar week would show mostly past days whenever today falls on a
  // Friday/Saturday/Sunday.
  const weekStart = selectedDate;
  const rangeStart = view === 'day' ? selectedDate : weekStart;
  const rangeEnd = view === 'day' ? selectedDate : addDays(weekStart, 6);

  const { data: events = [], isLoading } = useAgenda(rangeStart, rangeEnd);

  return (
    <SectionCard
      title={t('agenda.title', "Today's Agenda")}
      icon={CalendarDays}
      action={<DayWeekToggle view={view} onChange={setView} />}
      loading={isLoading}
    >
      {view === 'day' ? (
        <DayView events={events} tz={timezone} timeFormat={timeFormat} />
      ) : (
        <WeekView
          weekStart={weekStart}
          events={events}
          tz={timezone}
          timeFormat={timeFormat}
        />
      )}
    </SectionCard>
  );
}
