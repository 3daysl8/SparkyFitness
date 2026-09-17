import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Award, Flame } from 'lucide-react';
import { formatWeight } from '@/utils/numberFormatting';
import type { ExerciseProgressResponse } from '@workspace/shared';

interface ExerciseRmLadderProps {
  progressEntries: ExerciseProgressResponse[] | undefined;
  weightUnit: string;
}

interface RmRecord {
  targetReps: number;
  weight: number;
  date: string;
  est1RM: number;
}

const TARGET_REP_TIERS = [1, 3, 5, 8, 10, 12];

export const ExerciseRmLadder = ({
  progressEntries,
  weightUnit,
}: ExerciseRmLadderProps) => {
  const { t } = useTranslation();

  const { rmLadder, maxVolumeSet, maxWeightSet } = useMemo(() => {
    if (!progressEntries || progressEntries.length === 0) {
      return { rmLadder: [], maxVolumeSet: null, maxWeightSet: null };
    }

    const tierBests = new Map<number, RmRecord>();
    let maxVol = { volume: 0, weight: 0, reps: 0, date: '' };
    let maxWt = { weight: 0, reps: 0, date: '' };

    progressEntries.forEach((entry) => {
      (entry.sets ?? []).forEach((set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (weight <= 0 || reps <= 0) return;

        // Max single-set volume
        const vol = weight * reps;
        if (vol > maxVol.volume) {
          maxVol = { volume: vol, weight, reps, date: entry.entry_date };
        }

        // Absolute heaviest weight
        if (weight > maxWt.weight) {
          maxWt = { weight, reps, date: entry.entry_date };
        }

        // Check exact target rep matches
        TARGET_REP_TIERS.forEach((targetTier) => {
          if (reps >= targetTier) {
            const existing = tierBests.get(targetTier);
            if (!existing || weight > existing.weight) {
              const est1RM = reps === 1 ? weight : weight * (1 + reps / 30);
              tierBests.set(targetTier, {
                targetReps: targetTier,
                weight,
                date: entry.entry_date,
                est1RM: Math.round(est1RM * 10) / 10,
              });
            }
          }
        });
      });
    });

    const ladder = TARGET_REP_TIERS.map((tier) => ({
      tier,
      record: tierBests.get(tier) ?? null,
    }));

    return {
      rmLadder: ladder,
      maxVolumeSet: maxVol.volume > 0 ? maxVol : null,
      maxWeightSet: maxWt.weight > 0 ? maxWt : null,
    };
  }, [progressEntries]);

  if (!progressEntries || progressEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        {t(
          'exercise.exerciseDetailModal.noRmRecords',
          'No personal records logged yet.'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Featured Records (Max Weight & Max Volume) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-3">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Trophy className="h-4 w-4" />
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {t(
                'exercise.exerciseDetailModal.heaviestWeight',
                'Heaviest Lift'
              )}
            </span>
          </div>
          <p className="mt-1 text-base font-bold text-foreground">
            {maxWeightSet
              ? `${formatWeight(maxWeightSet.weight, weightUnit)} × ${maxWeightSet.reps}`
              : '—'}
          </p>
          {maxWeightSet && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {maxWeightSet.date}
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-indigo-500/5 border-indigo-500/30 p-3">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <Flame className="h-4 w-4" />
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {t('exercise.exerciseDetailModal.maxSetVolume', 'Max Set Volume')}
            </span>
          </div>
          <p className="mt-1 text-base font-bold text-foreground">
            {maxVolumeSet
              ? `${formatWeight(maxVolumeSet.volume, weightUnit)}`
              : '—'}
          </p>
          {maxVolumeSet && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatWeight(maxVolumeSet.weight, weightUnit)} ×{' '}
              {maxVolumeSet.reps} ({maxVolumeSet.date})
            </p>
          )}
        </div>
      </div>

      {/* Rep Max Ladder Grid */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Award className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(
              'exercise.exerciseDetailModal.repMaxLadder',
              'Rep Max (RM) Records'
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rmLadder.map(({ tier, record }) => (
            <div
              key={tier}
              className={`rounded-md border p-2.5 transition-colors ${
                record
                  ? 'bg-card border-border/80'
                  : 'bg-muted/30 border-dashed opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">{tier}RM</span>
                {record && (
                  <span className="text-[10px] text-muted-foreground">
                    {record.date}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {record ? formatWeight(record.weight, weightUnit) : '—'}
              </p>
              {record && record.targetReps > 1 && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                  Est. 1RM: {formatWeight(record.est1RM, weightUnit)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExerciseRmLadder;
