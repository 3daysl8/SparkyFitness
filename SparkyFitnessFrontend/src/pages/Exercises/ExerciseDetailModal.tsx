import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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

interface ExerciseDetailModalProps {
  exercise: ExerciseInterface | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VOLUME_HISTORY_DAYS = 90;

const ExerciseDetailModal = ({
  exercise,
  open,
  onOpenChange,
}: ExerciseDetailModalProps) => {
  const { t } = useTranslation();
  const { weightUnit } = usePreferences();

  const exerciseId = exercise?.id;
  const statsMap = useWorkoutExerciseStats(exerciseId ? [exerciseId] : []);
  const bestSet = exerciseId ? statsMap[exerciseId]?.bestSet : undefined;
  // Epley formula, computed client-side from the same bestSet the ghost-value
  // endpoint already returns — no dedicated 1RM endpoint needed for this.
  const estimated1RM =
    bestSet?.weight != null && bestSet?.reps != null
      ? bestSet.weight * (1 + bestSet.reps / 30)
      : null;

  const now = new Date();
  const endDate = formatDateToYYYYMMDD(now);
  const startDate = formatDateToYYYYMMDD(
    new Date(now.getTime() - VOLUME_HISTORY_DAYS * 24 * 60 * 60 * 1000)
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

  if (!exercise) return null;

  const meta =
    EXERCISE_CATEGORY_META[exercise.category as ExerciseCategory] ??
    EXERCISE_CATEGORY_META['general'];
  const image = filterValidExerciseImages(exercise.images)[0];
  const imageSrc = resolveExerciseImageSrc(image);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {imageSrc && (
            <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
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
            <div className="space-y-1 text-sm">
              {!!exercise.primary_muscles?.length && (
                <p>
                  <span className="font-semibold">
                    {t(
                      'exercise.exerciseDetailModal.primaryMuscles',
                      'Primary: '
                    )}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {exercise.primary_muscles.join(', ')}
                  </span>
                </p>
              )}
              {!!exercise.secondary_muscles?.length && (
                <p>
                  <span className="font-semibold">
                    {t(
                      'exercise.exerciseDetailModal.secondaryMuscles',
                      'Secondary: '
                    )}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {exercise.secondary_muscles.join(', ')}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                {t('exercise.exerciseDetailModal.estimated1RM', 'Est. 1RM')}
              </p>
              <p className="text-lg font-bold">
                {estimated1RM != null
                  ? formatWeight(estimated1RM, weightUnit)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                {t('exercise.exerciseDetailModal.bestSet', 'Best Set')}
              </p>
              <p className="text-lg font-bold">
                {bestSet?.weight != null && bestSet?.reps != null
                  ? `${formatWeight(bestSet.weight, weightUnit)} × ${bestSet.reps}`
                  : '—'}
              </p>
            </div>
          </div>

          {volumeHistory.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {t(
                  'exercise.exerciseDetailModal.volumeHistory',
                  'Volume History (last 90 days)'
                )}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={volumeHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => formatWeight(value, weightUnit)}
                  />
                  <Tooltip
                    formatter={(value: TooltipValueType | undefined) =>
                      value ? formatWeight(Number(value), weightUnit) : 0
                    }
                  />
                  <Bar
                    dataKey="volume"
                    fill="#6366f1"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseDetailModal;
