import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, todayInZone } from '@workspace/shared';
import type { PlannedWorkoutResponse } from '@workspace/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  usePlannedWorkoutsRange,
  useMovePlannedWorkoutMutation,
  useSkipPlannedWorkoutMutation,
  useDeletePlannedWorkoutMutation,
} from '@/hooks/Exercises/usePlannedWorkouts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarClock, Clock, ListChecks, Trash2 } from 'lucide-react';
import { formatMinutesToHHMM } from '@/utils/timeFormatters';

// Matches the backend's EAGER_WINDOW_DAYS eager-sync window (see
// plannedWorkoutService.ts): querying further out than this would ask for
// template-generated rows the server hasn't created yet.
const RANGE_DAYS_BEFORE = 7;
const RANGE_DAYS_AFTER = 27;

const STATUS_VARIANT: Record<
  PlannedWorkoutResponse['status'],
  NonNullable<BadgeProps['variant']>
> = {
  planned: 'outline',
  started: 'default',
  completed: 'secondary',
  skipped: 'secondary',
};

const sortByDateThenTime = (
  a: PlannedWorkoutResponse,
  b: PlannedWorkoutResponse
) =>
  a.planned_date.localeCompare(b.planned_date) ||
  (a.planned_time ?? '99:99:99').localeCompare(b.planned_time ?? '99:99:99');

const PlannedWorkoutsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { timezone } = usePreferences();

  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const from = useMemo(() => addDays(todayIso, -RANGE_DAYS_BEFORE), [todayIso]);
  const to = useMemo(() => addDays(todayIso, RANGE_DAYS_AFTER), [todayIso]);

  const { data, isLoading } = usePlannedWorkoutsRange(from, to, user?.id);

  const rows = useMemo(
    () => [...(data ?? [])].sort(sortByDateThenTime),
    [data]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          {t('exercise.plannedWorkoutsList.title', 'Planned Workouts')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {t(
                'exercise.plannedWorkoutsList.emptyState',
                "Nothing planned yet — plan a workout and it'll show up here."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <PlannedWorkoutRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PlannedWorkoutRow = ({ row }: { row: PlannedWorkoutResponse }) => {
  const { t } = useTranslation();
  const { formatDateInUserTimezone } = usePreferences();

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(row.planned_date);
  const [moveTime, setMoveTime] = useState(row.planned_time?.slice(0, 5) ?? '');

  const { mutate: move, isPending: isMoving } = useMovePlannedWorkoutMutation();
  const { mutate: skip, isPending: isSkipping } =
    useSkipPlannedWorkoutMutation();
  const { mutate: remove, isPending: isDeleting } =
    useDeletePlannedWorkoutMutation();

  // Status-gated server routes (see plannedWorkoutService.ts): move/skip both
  // require status 'planned'; delete allows 'planned' or a 'skipped' row that
  // never got linked to a session. Gating here avoids a predictable 409.
  const canMove = row.status === 'planned';
  const canSkip = row.status === 'planned';
  const canDelete =
    row.status === 'planned' ||
    (row.status === 'skipped' && !row.completed_session_id);

  const handleMoveOpenChange = (open: boolean) => {
    if (open) {
      setMoveDate(row.planned_date);
      setMoveTime(row.planned_time?.slice(0, 5) ?? '');
    }
    setIsMoveOpen(open);
  };

  const handleMoveSubmit = () => {
    if (!moveDate) return;
    move(
      {
        id: row.id,
        data: { planned_date: moveDate, planned_time: moveTime || null },
      },
      { onSuccess: () => setIsMoveOpen(false) }
    );
  };

  const statusLabel = t(
    `exercise.plannedWorkoutsList.status.${row.status}`,
    row.status === 'planned'
      ? 'Planned'
      : row.status === 'started'
        ? 'In Progress'
        : row.status === 'completed'
          ? 'Completed'
          : 'Skipped'
  );

  const typeLabel = row.workout_type
    ? t(
        `exercise.addPlannedWorkoutDialog.workoutTypeOptions.${row.workout_type}`,
        row.workout_type
      )
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANT[row.status]} className="text-[10px]">
            {statusLabel}
          </Badge>
          {row.is_missed && (
            <Badge variant="destructive" className="text-[10px]">
              {t('exercise.plannedWorkoutsList.missedBadge', 'Missed')}
            </Badge>
          )}
          <span className="font-semibold text-sm truncate">{row.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>
            {formatDateInUserTimezone(row.planned_date, 'MMM dd, yyyy')}
            {row.planned_time ? ` · ${row.planned_time.slice(0, 5)}` : ''}
          </span>
          {typeLabel && (
            <Badge variant="outline" className="font-normal text-[10px]">
              {typeLabel}
            </Badge>
          )}
          {row.duration_estimate_minutes != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatMinutesToHHMM(row.duration_estimate_minutes)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Popover open={isMoveOpen} onOpenChange={handleMoveOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={!canMove}>
              <CalendarClock className="h-4 w-4 mr-1.5" />
              {t('exercise.plannedWorkoutsList.moveButton', 'Move')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`move-date-${row.id}`}>
                {t('exercise.plannedWorkoutsList.moveDateLabel', 'Date')}
              </Label>
              <Input
                id={`move-date-${row.id}`}
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`move-time-${row.id}`}>
                {t(
                  'exercise.plannedWorkoutsList.moveTimeLabel',
                  'Time (optional)'
                )}
              </Label>
              <Input
                id={`move-time-${row.id}`}
                type="time"
                value={moveTime}
                onChange={(e) => setMoveTime(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={isMoving || !moveDate}
              onClick={handleMoveSubmit}
            >
              {t('exercise.plannedWorkoutsList.moveSubmit', 'Confirm Move')}
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          disabled={!canSkip || isSkipping}
          onClick={() => skip(row.id)}
        >
          <ListChecks className="h-4 w-4 mr-1.5" />
          {t('exercise.plannedWorkoutsList.skipButton', 'Skip')}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={!canDelete || isDeleting}
          onClick={() => remove(row.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">
            {t('exercise.plannedWorkoutsList.deleteButton', 'Delete')}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default PlannedWorkoutsList;
