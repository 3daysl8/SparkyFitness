import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Compass,
  Droplet,
  Dumbbell,
  Moon,
  Pill,
  Sparkles,
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
import { SectionCard } from '@/components/biometric/SectionCard';
import { DataRow } from '@/components/biometric/DataRow';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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
        onClick: () => navigate('/workouts'),
      },
      {
        id: 'water',
        label: t('diary.water', 'Hydration'),
        icon: Droplet,
        isCompleted: waterComplete,
        value: `${waterMl} / ${waterGoalMl} ml (${waterPct}%)`,
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
    <SectionCard
      title={t(
        'checkIn.dailyCheckpointTitle',
        'Daily Checkpoint & Accountability'
      )}
      icon={CheckCircle2}
      summary={`${completedCount} of ${totalCheckpoints} pillars completed (${checkpointPct}%)`}
      badge={
        completedCount === totalCheckpoints && (
          <Badge variant="default" className="gap-1 text-[11px] font-medium">
            <Sparkles className="h-3 w-3" />
            {t('checkIn.allDone', 'Completed')}
          </Badge>
        )
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        <Progress value={checkpointPct} className="h-1.5" />
        <div className="divide-y divide-border">
          {checkpoints.map((item) => (
            <DataRow
              key={item.id}
              icon={item.icon}
              label={item.label}
              sublabel={item.value}
              state={item.isCompleted ? 'complete' : 'default'}
              onSelect={item.onClick}
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
