import React from 'react';
import { useTranslation } from 'react-i18next';
import { DailyHealthMetrics } from '@workspace/shared';
import {
  BatteryCharging,
  Building2,
  Footprints,
  Heart,
  Route,
  ShieldAlert,
  Zap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';

interface DailyHealthMetricsCardProps {
  metrics?: DailyHealthMetrics;
  isLoading?: boolean;
}

/**
 * Flat vitals HUD for a single day's wearable health summary. Presentational
 * only — has no Card/CardHeader shell of its own, so a caller (e.g.
 * WearableHealthCard on Home) can wrap it in its own SectionCard. No per-tile
 * border/background: the grid gaps and typography carry the separation, per
 * the "one card boundary per region" rule.
 */
export const DailyHealthMetricsCard: React.FC<DailyHealthMetricsCardProps> = ({
  metrics,
  isLoading,
}) => {
  const { t } = useTranslation();
  const { distanceUnit, convertDistance } = usePreferences();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // `== null` rather than a falsy test: 0 is a real reading (a fully drained
  // body battery) and must not render as "no data".
  const bodyBatteryStatus = (level?: number | null) => {
    if (level == null) return 'bg-muted-foreground/40';
    if (level >= 75) return 'bg-status-optimal';
    if (level >= 40) return 'bg-status-moderate';
    return 'bg-status-low';
  };

  const distanceDisplay =
    metrics.total_distance_meters != null
      ? `${convertDistance(
          metrics.total_distance_meters / 1000,
          'km',
          distanceUnit
        ).toFixed(2)} ${distanceUnit}`
      : null;

  const tiles: {
    key: string;
    icon: typeof Footprints;
    label: string;
    value: React.ReactNode;
    caption?: React.ReactNode;
  }[] = [
    {
      key: 'steps',
      icon: Footprints,
      label: t('dailyHealthMetrics.steps', 'Steps'),
      value:
        metrics.total_steps != null
          ? metrics.total_steps.toLocaleString()
          : '--',
    },
    {
      key: 'distance',
      icon: Route,
      label: t('dailyHealthMetrics.distance', 'Distance'),
      value: distanceDisplay ?? '--',
    },
    {
      key: 'floors',
      icon: Building2,
      label: t('dailyHealthMetrics.floors', 'Floors'),
      value: metrics.floors_ascended ?? '--',
      caption:
        metrics.floors_descended != null
          ? t('dailyHealthMetrics.floorsDescended', '↓ {{val}}', {
              val: metrics.floors_descended,
            })
          : undefined,
    },
    {
      key: 'stress',
      icon: ShieldAlert,
      label: t('dailyHealthMetrics.avgStress', 'Avg Stress'),
      value: metrics.avg_stress_level ?? '--',
      caption: t('dailyHealthMetrics.max', 'Max: {{val}}', {
        val: metrics.max_stress_level ?? '--',
      }),
    },
    {
      key: 'restingHr',
      icon: Heart,
      label: t('dailyHealthMetrics.restingHr', 'Resting HR'),
      value: (
        <>
          <span>{metrics.resting_heart_rate ?? '--'}</span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            bpm
          </span>
        </>
      ),
      caption: t('dailyHealthMetrics.recovery', 'Recovery: {{val}}', {
        val: metrics.heart_rate_recovery_1min
          ? `${metrics.heart_rate_recovery_1min} bpm`
          : '--',
      }),
    },
    {
      key: 'vo2max',
      icon: TrendingUp,
      label: t('dailyHealthMetrics.vo2Max', 'VO2 Max'),
      value: metrics.vo2_max ?? '--',
      caption: t('dailyHealthMetrics.fitnessAge', 'Fit Age: {{val}}', {
        val: metrics.fitness_age ?? '--',
      }),
    },
    {
      key: 'readiness',
      icon: Zap,
      label: t('dailyHealthMetrics.readiness', 'Readiness'),
      value: metrics.training_readiness_score ?? '--',
      caption: (
        <>
          <RefreshCw className="mr-0.5 inline h-3 w-3" strokeWidth={1.5} />
          {t('dailyHealthMetrics.recHours', 'Rec: {{val}}', {
            val: metrics.recovery_time_hours
              ? `${metrics.recovery_time_hours}h`
              : '--',
          })}
        </>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Body Battery — kept as its own full-width row since the progress
         bar needs the width; everything else shares one flat grid below. */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <BatteryCharging className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{t('dailyHealthMetrics.bodyBattery', 'Body Battery')}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            +{metrics.body_battery_charged ?? 0} / -
            {metrics.body_battery_drained ?? 0}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="metric-num text-2xl text-foreground">
            {metrics.body_battery_highest ?? '--'}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {t('dailyHealthMetrics.peak', 'peak')}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('dailyHealthMetrics.low', 'low: {{val}}', {
              val: metrics.body_battery_lowest ?? '--',
            })}
          </span>
        </div>
        {metrics.body_battery_highest != null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                'h-full',
                bodyBatteryStatus(metrics.body_battery_highest)
              )}
              style={{
                width: `${Math.min(100, Math.max(0, metrics.body_battery_highest))}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-4 border-t border-border pt-4">
        {tiles.map(({ key, icon: Icon, label, value, caption }) => (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{label}</span>
            </div>
            <p className="metric-num mt-0.5 truncate text-lg text-foreground">
              {value}
            </p>
            {caption && (
              <p className="truncate text-[11px] text-muted-foreground">
                {caption}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
