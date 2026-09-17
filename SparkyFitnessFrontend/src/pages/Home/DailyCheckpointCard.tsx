import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Compass,
  Droplet,
  Dumbbell,
  Moon,
  Pill,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTodayFocusSnapshot } from '@/hooks/useFocus';
import { useExerciseEntries } from '@/hooks/Exercises/useExerciseEntries';
import {
  useWaterIntakeQuery,
  useWaterGoalQuery,
} from '@/hooks/Diary/useWaterIntake';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import { useMedications, useMedicationEntries } from '@/hooks/useMedications';
import { useMoodEntryByDate } from '@/hooks/CheckIn/useMood';
import { useCheckInMeasurementsForDate } from '@/hooks/CheckIn/useCheckIn';
import { hasLoggedWorkout } from '@/utils/workoutSessionSummary';
import { getDueDosesForDate } from '@workspace/shared';
import { entryMatchesDue } from '@/utils/medicationUtils';
import type { MedicationDetail } from '@/types/medications';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function DailyCheckpointCard({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUserId } = useActiveUser();
  const { timezone } = usePreferences();
  const userId = activeUserId ?? undefined;

  const [isOpen, setIsOpen] = useState(false);

  // 1. Focus & Habits
  const { data: snapshot } = useTodayFocusSnapshot(selectedDate);
  const habits = snapshot?.daily_recurring ?? [];
  const habitsTotal = habits.length;
  const habitsDone = habits.filter((h) => h.done).length;
  const habitsComplete = habitsTotal > 0 && habitsDone === habitsTotal;

  // 2. Workout
  const { data: exerciseEntries = [] } = useExerciseEntries(
    selectedDate,
    userId
  );
  const workoutLogged = hasLoggedWorkout(exerciseEntries);

  // 3. Hydration
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  const { data: waterGoalMl = 1920 } = useWaterGoalQuery(selectedDate, userId);
  const waterPct =
    waterGoalMl > 0
      ? Math.min(100, Math.round((waterMl / waterGoalMl) * 100))
      : 0;
  const waterComplete = waterPct >= 100;

  // 4. Sleep
  const { data: sleepEntries = [] } = useSleepEntriesQuery(
    selectedDate,
    selectedDate
  );
  const sleepLogged = sleepEntries.length > 0;
  const sleepDurationHours =
    sleepEntries.reduce((sum, e) => sum + (e.duration_in_seconds || 0), 0) /
    3600;

  // 5. Supplements
  const { data: meds = [] } = useMedications({ activeOnly: true });
  const { data: medEntries = [] } = useMedicationEntries({
    fromDate: selectedDate,
    toDate: selectedDate,
  });
  const supplementMeds = useMemo(
    () => (meds as MedicationDetail[]).filter((m) => m.is_supplement),
    [meds]
  );
  const dueDoses = useMemo(() => {
    if (supplementMeds.length === 0) return [];
    return getDueDosesForDate(supplementMeds, selectedDate, timezone);
  }, [supplementMeds, selectedDate, timezone]);
  const suppsDone = useMemo(() => {
    return dueDoses.filter((due) =>
      medEntries.some(
        (e) =>
          entryMatchesDue(e, due) &&
          (e.status === 'taken' || e.status === 'skipped')
      )
    ).length;
  }, [dueDoses, medEntries]);
  const suppsComplete =
    dueDoses.length > 0
      ? suppsDone >= dueDoses.length
      : supplementMeds.length === 0;

  // 6. Body & Mood Check-In
  const { data: moodEntry } = useMoodEntryByDate(selectedDate);
  const { data: checkInMeasurements } =
    useCheckInMeasurementsForDate(selectedDate);
  const bodyCheckInDone = Boolean(
    (checkInMeasurements &&
      'id' in checkInMeasurements &&
      checkInMeasurements.id) ||
    (moodEntry && moodEntry.mood_value > 0)
  );

  // Checkpoint metrics list
  const checkpoints = useMemo(() => {
    return [
      {
        id: 'habits',
        label: t('focus.dailyHabits', 'Daily Habits'),
        icon: Compass,
        isCompleted: habitsComplete,
        value:
          habitsTotal > 0
            ? `${habitsDone}/${habitsTotal} done`
            : t('focus.noneScheduled', 'None scheduled'),
        statusColor: habitsComplete
          ? 'text-emerald-500'
          : habitsDone > 0
            ? 'text-amber-500'
            : 'text-muted-foreground',
        onClick: () => {
          const el = document.getElementById('home-habits-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        },
      },
      {
        id: 'workout',
        label: t('nav.workouts', 'Workout'),
        icon: Dumbbell,
        isCompleted: workoutLogged,
        value: workoutLogged
          ? t('common.completed', 'Logged')
          : t('common.notLogged', 'Not logged'),
        statusColor: workoutLogged
          ? 'text-metric-workout'
          : 'text-muted-foreground',
        onClick: () => navigate('/workouts'),
      },
      {
        id: 'water',
        label: t('diary.water', 'Hydration'),
        icon: Droplet,
        isCompleted: waterComplete,
        value: `${waterMl} / ${waterGoalMl} ml (${waterPct}%)`,
        statusColor: waterComplete
          ? 'text-metric-water'
          : 'text-muted-foreground',
        onClick: () => navigate('/diary'),
      },
      {
        id: 'sleep',
        label: t('checkIn.tabs.sleep', 'Sleep'),
        icon: Moon,
        isCompleted: sleepLogged,
        value: sleepLogged
          ? `${sleepDurationHours.toFixed(1)}h logged`
          : t('common.notLogged', 'Not logged'),
        statusColor: sleepLogged
          ? 'text-metric-sleep'
          : 'text-muted-foreground',
        onClick: () => navigate('/checkin?tab=sleep'),
      },
      {
        id: 'supplements',
        label: t('medications.today.supplementsTitle', 'Supplements'),
        icon: Pill,
        isCompleted: suppsComplete,
        value:
          dueDoses.length > 0
            ? `${suppsDone}/${dueDoses.length} doses`
            : `${supplementMeds.length} active in cabinet`,
        statusColor: suppsComplete
          ? 'text-emerald-500'
          : 'text-muted-foreground',
        onClick: () => navigate('/checkin?tab=protocols'),
      },
      {
        id: 'checkin',
        label: t('checkIn.title', 'Body & Mood Check-In'),
        icon: Activity,
        isCompleted: bodyCheckInDone,
        value: bodyCheckInDone
          ? t('common.completed', 'Recorded')
          : t('checkIn.tapToRecord', 'Tap to record'),
        statusColor: bodyCheckInDone
          ? 'text-indigo-500'
          : 'text-muted-foreground',
        onClick: () => navigate('/checkin'),
      },
    ];
  }, [
    habitsComplete,
    habitsDone,
    habitsTotal,
    workoutLogged,
    waterComplete,
    waterMl,
    waterGoalMl,
    waterPct,
    sleepLogged,
    sleepDurationHours,
    suppsComplete,
    suppsDone,
    dueDoses.length,
    supplementMeds.length,
    bodyCheckInDone,
    navigate,
    t,
  ]);

  const completedCount = checkpoints.filter((c) => c.isCompleted).length;
  const totalCheckpoints = checkpoints.length;
  const checkpointPct = Math.round((completedCount / totalCheckpoints) * 100);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/70 bg-card/60 shadow-sm transition-all hover:bg-card/90">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-3.5 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  {t(
                    'checkIn.dailyCheckpointTitle',
                    'Daily Checkpoint & Accountability'
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {completedCount} of {totalCheckpoints} pillars completed (
                  {checkpointPct}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {completedCount === totalCheckpoints && (
                <Badge
                  variant="default"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  {t('checkIn.allDone', 'Completed')}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 p-3.5 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-1">
              <Progress value={checkpointPct} className="h-1.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {checkpoints.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={cn(
                      'group flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/50 p-2.5 text-left transition-all hover:bg-muted/50 hover:border-border',
                      item.isCompleted &&
                        'border-emerald-500/20 bg-emerald-500/5'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                          item.isCompleted
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.value}
                        </p>
                      </div>
                    </div>

                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
