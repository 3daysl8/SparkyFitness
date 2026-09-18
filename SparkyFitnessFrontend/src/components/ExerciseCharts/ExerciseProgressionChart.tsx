import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatWeight } from '@/utils/numberFormatting';
import { Button } from '@/components/ui/button';
import type { ExerciseProgressResponse } from '@workspace/shared';
import { chartTheme } from '@/lib/chartTheme';

interface ExerciseProgressionChartProps {
  progressEntries: ExerciseProgressResponse[] | undefined;
  weightUnit: string;
}

type TimeRange = '30d' | '90d' | '6m' | '1y' | 'all';

interface ProgressionDataPoint {
  date: string;
  rawDate: number;
  estimated1RM: number;
  bestWeight: number;
  bestReps: number;
}

export const ExerciseProgressionChart = ({
  progressEntries,
  weightUnit,
}: ExerciseProgressionChartProps) => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');

  const allDataPoints = useMemo<ProgressionDataPoint[]>(() => {
    if (!progressEntries || progressEntries.length === 0) return [];

    const byDate = new Map<
      string,
      { max1RM: number; bestWeight: number; bestReps: number; rawDate: number }
    >();

    progressEntries.forEach((entry) => {
      let dailyMax1RM = 0;
      let dailyBestWeight = 0;
      let dailyBestReps = 0;

      (entry.sets ?? []).forEach((set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (weight <= 0 || reps <= 0) return;

        // Epley formula: weight * (1 + reps / 30)
        const est1RM = reps === 1 ? weight : weight * (1 + reps / 30);
        if (est1RM > dailyMax1RM) {
          dailyMax1RM = est1RM;
          dailyBestWeight = weight;
          dailyBestReps = reps;
        }
      });

      if (dailyMax1RM > 0) {
        const dateKey = entry.entry_date;
        const existing = byDate.get(dateKey);
        const entryTime = new Date(dateKey).getTime();

        if (!existing || dailyMax1RM > existing.max1RM) {
          byDate.set(dateKey, {
            max1RM: dailyMax1RM,
            bestWeight: dailyBestWeight,
            bestReps: dailyBestReps,
            rawDate: entryTime,
          });
        }
      }
    });

    return Array.from(byDate.entries())
      .map(([date, val]) => ({
        date,
        rawDate: val.rawDate,
        estimated1RM: Math.round(val.max1RM * 10) / 10,
        bestWeight: val.bestWeight,
        bestReps: val.bestReps,
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [progressEntries]);

  const filteredData = useMemo(() => {
    if (allDataPoints.length === 0) return [];
    if (timeRange === 'all') return allDataPoints;

    const latestDate = allDataPoints[allDataPoints.length - 1]!.rawDate;
    let days = 90;
    if (timeRange === '30d') days = 30;
    if (timeRange === '90d') days = 90;
    if (timeRange === '6m') days = 180;
    if (timeRange === '1y') days = 365;

    const cutoff = latestDate - days * 24 * 60 * 60 * 1000;
    const subset = allDataPoints.filter((dp) => dp.rawDate >= cutoff);
    return subset.length > 0 ? subset : allDataPoints;
  }, [allDataPoints, timeRange]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const initial = filteredData[0]!.estimated1RM;
    const current = filteredData[filteredData.length - 1]!.estimated1RM;
    const peak = Math.max(...filteredData.map((d) => d.estimated1RM));
    const delta = current - initial;
    const percentChange =
      initial > 0 ? ((delta / initial) * 100).toFixed(1) : '0';

    return { initial, current, peak, delta, percentChange };
  }, [filteredData]);

  if (allDataPoints.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        {t(
          'exercise.exerciseDetailModal.noProgressionData',
          'No progression history recorded yet.'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Time Range Selector & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-metric-workout" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(
              'exercise.exerciseDetailModal.estimated1RMProgression',
              'Est. 1RM Progression'
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md text-xs">
          {(['30d', '90d', '6m', '1y', 'all'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              type="button"
              variant={timeRange === range ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px] font-medium"
              onClick={() => setTimeRange(range)}
            >
              {range.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-card/60 p-2.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              {t('exercise.exerciseDetailModal.current1RM', 'Current 1RM')}
            </span>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {formatWeight(stats.current, weightUnit)}
            </p>
          </div>
          <div className="rounded-md border bg-card/60 p-2.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              {t('exercise.exerciseDetailModal.peak1RM', 'All-Time Peak')}
            </span>
            <p className="mt-0.5 text-sm font-bold text-metric-workout">
              {formatWeight(stats.peak, weightUnit)}
            </p>
          </div>
          <div className="rounded-md border bg-card/60 p-2.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              {t('exercise.exerciseDetailModal.progressGain', 'Progress')}
            </span>
            <p
              className={`mt-0.5 text-sm font-bold ${stats.delta >= 0 ? 'text-status-optimal' : 'text-destructive'}`}
            >
              {stats.delta >= 0
                ? `+${stats.percentChange}%`
                : `${stats.percentChange}%`}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-44 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="1rmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartTheme.colors.workout}
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor={chartTheme.colors.workout}
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis
              dataKey="date"
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              tickLine={false}
            />
            <YAxis
              domain={['dataMin - 5', 'dataMax + 5']}
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              tickLine={false}
              tickFormatter={(val) => `${Math.round(val)}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]!.payload as ProgressionDataPoint;
                  return (
                    <div className="rounded-lg border border-border bg-card p-2 text-xs">
                      <p className="font-semibold text-foreground">
                        {data.date}
                      </p>
                      <p className="text-metric-workout font-bold mt-0.5">
                        Est. 1RM: {formatWeight(data.estimated1RM, weightUnit)}
                      </p>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        Best: {formatWeight(data.bestWeight, weightUnit)} ×{' '}
                        {data.bestReps} reps
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="estimated1RM"
              stroke={chartTheme.colors.workout}
              strokeWidth={2}
              fill="url(#1rmGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ExerciseProgressionChart;
