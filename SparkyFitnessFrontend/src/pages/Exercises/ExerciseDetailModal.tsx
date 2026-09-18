import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipValueType,
} from 'recharts';
import { TrendingUp, Trophy, History, Layers } from 'lucide-react';
import type { Exercise as ExerciseInterface } from '@/types/exercises';
import {
  EXERCISE_CATEGORY_META,
  ExerciseCategory,
} from '@/constants/exercises';
import {
  resolveExerciseImageSrc,
  filterValidExerciseImages,
} from '@/utils/exercises';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatWeight } from '@/utils/numberFormatting';
import {
  useWorkoutExerciseStats,
  useExerciseProgress,
} from '@/hooks/Exercises/useExerciseEntries';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import ExerciseProgressionChart from '@/components/ExerciseCharts/ExerciseProgressionChart';
import ExerciseRmLadder from '@/components/ExerciseCharts/ExerciseRmLadder';
import { chartTheme } from '@/lib/chartTheme';

interface ExerciseDetailModalProps {
  exercise: ExerciseInterface | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HISTORY_DAYS = 365;

const ExerciseDetailModal = ({
  exercise,
  open,
  onOpenChange,
}: ExerciseDetailModalProps) => {
  const { t } = useTranslation();
  const { weightUnit } = usePreferences();
  const [activeTab, setActiveTab] = useState<
    'progression' | 'records' | 'history'
  >('progression');

  const exerciseId = exercise?.id;
  const statsMap = useWorkoutExerciseStats(exerciseId ? [exerciseId] : []);
  const bestSet = exerciseId ? statsMap[exerciseId]?.bestSet : undefined;

  const estimated1RM =
    bestSet?.weight != null && bestSet?.reps != null
      ? bestSet.weight * (1 + bestSet.reps / 30)
      : null;

  const now = new Date();
  const endDate = formatDateToYYYYMMDD(now);
  const startDate = formatDateToYYYYMMDD(
    new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000)
  );

  const { data: progressEntries } = useExerciseProgress(
    exerciseId,
    startDate,
    endDate,
    open
  );

  const volumeHistory = useMemo(() => {
    if (!progressEntries) return [];
    const byDate = new Map<string, number>();
    for (const entry of progressEntries) {
      const volume = (entry.sets ?? []).reduce(
        (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
        0
      );
      if (volume <= 0) continue;
      byDate.set(
        entry.entry_date,
        (byDate.get(entry.entry_date) ?? 0) + volume
      );
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, volume]) => ({ date, volume }));
  }, [progressEntries]);

  const recentSessions = useMemo(() => {
    if (!progressEntries) return [];
    return [...progressEntries]
      .filter((e) => (e.sets ?? []).length > 0)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      .slice(0, 10);
  }, [progressEntries]);

  if (!exercise) return null;

  const meta =
    EXERCISE_CATEGORY_META[exercise.category as ExerciseCategory] ??
    EXERCISE_CATEGORY_META['general'];
  const image = filterValidExerciseImages(exercise.images)[0];
  const imageSrc = resolveExerciseImageSrc(image);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {imageSrc && (
            <div className="w-full h-40 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
              <img
                src={imageSrc}
                alt={exercise.name}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="secondary"
              className={`capitalize ${meta.bg} ${meta.color}`}
            >
              {exercise.category}
            </Badge>
            {exercise.equipment?.map((eq) => (
              <Badge key={eq} variant="outline" className="capitalize">
                {eq}
              </Badge>
            ))}
          </div>

          {(exercise.primary_muscles?.length ||
            exercise.secondary_muscles?.length) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {!!exercise.primary_muscles?.length && (
                <p>
                  <span className="font-semibold text-foreground">
                    {t(
                      'exercise.exerciseDetailModal.primaryMuscles',
                      'Primary: '
                    )}
                  </span>
                  <span className="capitalize">
                    {exercise.primary_muscles.join(', ')}
                  </span>
                </p>
              )}
              {!!exercise.secondary_muscles?.length && (
                <p>
                  <span className="font-semibold text-foreground">
                    {t(
                      'exercise.exerciseDetailModal.secondaryMuscles',
                      'Secondary: '
                    )}
                  </span>
                  <span className="capitalize">
                    {exercise.secondary_muscles.join(', ')}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Tabbed Progression & Intelligence Sections */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as typeof activeTab)}
            className="w-full space-y-3"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="progression" className="gap-1 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                {t('exercise.exerciseDetailModal.tabProgression', '1RM Curve')}
              </TabsTrigger>
              <TabsTrigger value="records" className="gap-1 text-xs">
                <Trophy className="h-3.5 w-3.5" />
                {t('exercise.exerciseDetailModal.tabRecords', 'PR Ladder')}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1 text-xs">
                <History className="h-3.5 w-3.5" />
                {t('exercise.exerciseDetailModal.tabHistory', 'History')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="progression" className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {t('exercise.exerciseDetailModal.estimated1RM', 'Est. 1RM')}
                  </p>
                  <p className="text-base font-bold">
                    {estimated1RM != null
                      ? formatWeight(estimated1RM, weightUnit)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {t('exercise.exerciseDetailModal.bestSet', 'Best Set')}
                  </p>
                  <p className="text-base font-bold">
                    {bestSet?.weight != null && bestSet?.reps != null
                      ? `${formatWeight(bestSet.weight, weightUnit)} × ${bestSet.reps}`
                      : '—'}
                  </p>
                </div>
              </div>

              <ExerciseProgressionChart
                progressEntries={progressEntries}
                weightUnit={weightUnit}
              />
            </TabsContent>

            <TabsContent value="records" className="space-y-3 pt-1">
              <ExerciseRmLadder
                progressEntries={progressEntries}
                weightUnit={weightUnit}
              />
            </TabsContent>

            <TabsContent value="history" className="space-y-3 pt-1">
              {volumeHistory.length > 1 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t(
                      'exercise.exerciseDetailModal.volumeHistory',
                      'Volume History (last 90 days)'
                    )}
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={volumeHistory.slice(-30)}>
                      <CartesianGrid {...chartTheme.grid} />
                      <XAxis
                        dataKey="date"
                        stroke={chartTheme.axis.stroke}
                        tick={chartTheme.axis.tick}
                      />
                      <YAxis
                        stroke={chartTheme.axis.stroke}
                        tick={chartTheme.axis.tick}
                        tickFormatter={(value) => `${Math.round(value)}`}
                      />
                      <Tooltip
                        formatter={(value: TooltipValueType | undefined) =>
                          value ? formatWeight(Number(value), weightUnit) : 0
                        }
                        {...chartTheme.tooltip}
                      />
                      <Bar
                        dataKey="volume"
                        fill={chartTheme.colors.workout}
                        isAnimationActive={false}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(
                      'exercise.exerciseDetailModal.recentWorkouts',
                      'Recent Sessions'
                    )}
                  </span>
                </div>

                {recentSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    {t(
                      'exercise.exerciseDetailModal.noRecentSessions',
                      'No past workout sessions logged.'
                    )}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {recentSessions.map((session, idx) => {
                      const sessionVolume = (session.sets ?? []).reduce(
                        (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
                        0
                      );
                      return (
                        <div
                          key={
                            session.exercise_entry_id ??
                            `${session.entry_date}-${idx}`
                          }
                          className="rounded-md border p-2 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground">
                              {session.entry_date}
                            </span>
                            <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                              {(session.sets ?? []).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="bg-muted/60 px-1.5 py-0.5 rounded"
                                >
                                  {formatWeight(s.weight ?? 0, weightUnit)} ×{' '}
                                  {s.reps ?? 0}
                                </span>
                              ))}
                            </div>
                          </div>
                          {sessionVolume > 0 && (
                            <span className="text-[11px] font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                              {formatWeight(sessionVolume, weightUnit)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseDetailModal;
