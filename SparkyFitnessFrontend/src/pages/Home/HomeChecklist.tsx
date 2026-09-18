import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { todayInZone } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useWaterContainer } from '@/contexts/WaterContainerContext';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/biometric/MetricCard';
import { DataRow } from '@/components/biometric/DataRow';
import { AlertTriangle, Droplet, Moon, Plus } from 'lucide-react';
import {
  usePlannedWorkoutDayView,
  useMovePlannedWorkoutMutation,
  useSkipPlannedWorkoutMutation,
} from '@/hooks/Exercises/usePlannedWorkouts';
import {
  useWaterIntakeQuery,
  useWaterGoalQuery,
  useUpdateWaterIntakeMutation,
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import AgendaCard from '@/pages/Home/AgendaCard';
import ToDoCard from '@/pages/Home/ToDoCard';
import WorkoutCard from '@/pages/Home/WorkoutCard';
import HabitCard from '@/pages/Home/HabitCard';
import FocusBanner from '@/pages/Home/FocusBanner';
import DailyCheckpointCard from '@/pages/Home/DailyCheckpointCard';
import SupplementsSnapshotCard from '@/pages/Home/SupplementsSnapshotCard';
import CycleSnapshotCard from '@/pages/Home/CycleSnapshotCard';
import WearableHealthCard from '@/pages/Home/WearableHealthCard';
import DailyStatusHero from '@/pages/Home/DailyStatusHero';

function WaterCard({
  selectedDate,
  userId,
}: {
  selectedDate: string;
  userId?: string;
}) {
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  const { data: waterGoalMl = 1920 } = useWaterGoalQuery(selectedDate, userId);
  const { activeContainer } = useWaterContainer();
  const { mutate: updateWater, isPending } = useUpdateWaterIntakeMutation();

  const pct =
    waterGoalMl > 0 ? Math.min(100, (waterMl / waterGoalMl) * 100) : 0;

  const mlPerDrink = (() => {
    if (!activeContainer) return 250;
    const servings = Math.max(1, activeContainer.servings_per_container || 1);
    const hasVolumeOverride =
      !activeContainer.linked_food_id || activeContainer.volume > 0;
    return hasVolumeOverride ? activeContainer.volume / servings : 250;
  })();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId || isPending) return;
    updateWater({
      user_id: userId,
      entry_date: selectedDate,
      change_drinks: 1,
      container_id: activeContainer?.id ?? null,
    });
  };

  return (
    <MetricCard
      layout="tile"
      label="Water"
      value={`${Math.round(pct)}%`}
      progress={pct}
      metric="water"
      icon={Droplet}
      emptyBorder={pct === 0}
    >
      <Button
        size="sm"
        variant="secondary"
        className="h-6 gap-1 rounded-full px-2.5 text-[11px]"
        onClick={handleQuickAdd}
        disabled={!userId || isPending}
      >
        <Plus className="h-3 w-3" /> {Math.round(mlPerDrink)}ml
      </Button>
    </MetricCard>
  );
}

function SleepCard({ selectedDate }: { selectedDate: string }) {
  const navigate = useNavigate();
  const { data: sleepEntries = [] } = useSleepEntriesQuery(
    selectedDate,
    selectedDate
  );
  const logged = sleepEntries.length > 0;
  const totalHours =
    sleepEntries.reduce((sum, e) => sum + (e.duration_in_seconds || 0), 0) /
    3600;

  return (
    <MetricCard
      layout="tile"
      label="Sleep"
      value={logged ? `${totalHours.toFixed(1)}h` : 'Tap to log'}
      progress={logged ? 100 : 0}
      metric="sleep"
      icon={Moon}
      emptyBorder={!logged}
      onSelect={() => navigate('/checkin?tab=sleep')}
    />
  );
}

function MetricCards({ selectedDate }: { selectedDate: string }) {
  const { activeUserId } = useActiveUser();
  const userId = activeUserId ?? undefined;
  return (
    <div className="grid grid-cols-3 gap-2">
      <WorkoutCard selectedDate={selectedDate} />
      <WaterCard selectedDate={selectedDate} userId={userId} />
      <SleepCard selectedDate={selectedDate} />
    </div>
  );
}

function MissedWorkoutsNudge({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();
  const { timezone, formatDate } = usePreferences();
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const isToday = selectedDate === todayIso;
  const { data: dayView } = usePlannedWorkoutDayView(
    selectedDate,
    activeUserId ?? undefined
  );
  const moveMutation = useMovePlannedWorkoutMutation();
  const skipMutation = useSkipPlannedWorkoutMutation();

  const missed = dayView?.missed ?? [];
  if (!isToday || missed.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-status-moderate">
        <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
        {t('exercise.workoutCard.missedTitle', {
          count: missed.length,
          defaultValue: '{{count}} missed workouts',
        })}
      </div>
      <div className="mt-2 divide-y divide-border">
        {missed.map((row) => (
          <DataRow
            key={row.id}
            label={row.title}
            sublabel={formatDate(row.planned_date)}
            trailing={
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    moveMutation.mutate({
                      id: row.id,
                      data: { planned_date: todayIso },
                    })
                  }
                  disabled={moveMutation.isPending || skipMutation.isPending}
                >
                  {t('exercise.workoutCard.moveToToday', 'Move to today')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => skipMutation.mutate(row.id)}
                  disabled={moveMutation.isPending || skipMutation.isPending}
                >
                  {t('exercise.workoutCard.skip', 'Skip')}
                </Button>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function HomeChecklist() {
  const { timezone, firstDayOfWeek } = usePreferences();
  const todayIso = useMemo(() => todayInZone(timezone), [timezone]);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Roll selectedDate forward at the user's local midnight, but only while
  // they're still viewing "today"
  const lastKnownTodayRef = useRef(todayIso);
  const checkMidnightRollover = useCallback(() => {
    const currentToday = todayInZone(timezone);
    if (currentToday === lastKnownTodayRef.current) {
      return;
    }
    const previousToday = lastKnownTodayRef.current;
    lastKnownTodayRef.current = currentToday;
    setSelectedDate((current) =>
      current === previousToday ? currentToday : current
    );
  }, [timezone]);

  useEffect(() => {
    checkMidnightRollover();
    const interval = window.setInterval(checkMidnightRollover, 60000);
    document.addEventListener('visibilitychange', checkMidnightRollover);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkMidnightRollover);
    };
  }, [checkMidnightRollover]);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Greeting, date nav (absorbs the old WeekStrip) and today's focus
         completion ring */}
      <DailyStatusHero
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        firstDayOfWeek={firstDayOfWeek}
      />

      {/* 2. Metric Tiles & Missed Workout Alerts */}
      <MetricCards selectedDate={selectedDate} />
      <MissedWorkoutsNudge selectedDate={selectedDate} />

      {/* 3. Vitals HUD (Garmin/other provider daily sync) */}
      <WearableHealthCard selectedDate={selectedDate} />

      {/* 4. Female Menstrual Cycle & Phase Snapshot — grouped with the other
         "body state today" signals, ahead of the protocols/actions below */}
      <CycleSnapshotCard date={selectedDate} />

      {/* 5. Today's Supplements & Protocols */}
      <SupplementsSnapshotCard selectedDate={selectedDate} />

      {/* 6. Schedule & Calendar Events */}
      <AgendaCard selectedDate={selectedDate} />

      {/* 7. Daily Accountability Checkpoint */}
      <DailyCheckpointCard selectedDate={selectedDate} />

      {/* 8. Weekly Focus context strip, directly above the day's actions */}
      <FocusBanner selectedDate={selectedDate} />

      {/* 9. Actionable Tasks (To-Do List) */}
      <ToDoCard selectedDate={selectedDate} />

      {/* 10. Daily Habits & Streaks */}
      <div id="home-habits-section">
        <HabitCard selectedDate={selectedDate} />
      </div>
    </div>
  );
}
