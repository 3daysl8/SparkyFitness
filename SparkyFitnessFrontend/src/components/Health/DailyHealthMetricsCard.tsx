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

interface DailyHealthMetricsCardProps {
  metrics?: DailyHealthMetrics;
  isLoading?: boolean;
}

/**
 * Tile grid of a single day's wearable health summary (body battery, steps,
 * stress, resting HR, VO2 max, training readiness). Presentational only —
 * intentionally has no Card/CardHeader shell of its own, so a caller (e.g.
 * WearableHealthCard on Home) can wrap it in whatever card/collapsible shell
 * matches its own page's conventions.
 */
export const DailyHealthMetricsCard: React.FC<DailyHealthMetricsCardProps> = ({
  metrics,
  isLoading,
}) => {
  const { t } = useTranslation();
  const { distanceUnit, convertDistance } = usePreferences();

  if (isLoading) {
    return (
      <div className="w-full animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-muted rounded-xl"></div>
          <div className="h-20 bg-muted rounded-xl"></div>
          <div className="h-20 bg-muted rounded-xl"></div>
          <div className="h-20 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // `== null` rather than a falsy test: 0 is a real reading (a fully drained
  // body battery, a stress level of zero) and must not render as "no data".
  const getBodyBatteryColor = (level?: number | null) => {
    if (level == null) return 'bg-muted-foreground/40';
    if (level >= 75) return 'bg-emerald-500';
    if (level >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getStressColor = (stress?: number | null) => {
    if (stress == null) return 'text-muted-foreground';
    if (stress <= 25) return 'text-emerald-500';
    if (stress <= 50) return 'text-blue-500';
    if (stress <= 75) return 'text-amber-500';
    return 'text-rose-500';
  };

  const distanceDisplay =
    metrics.total_distance_meters != null
      ? `${convertDistance(
          metrics.total_distance_meters / 1000,
          'km',
          distanceUnit
        ).toFixed(2)} ${distanceUnit}`
      : null;

  return (
    // Fixed 2-column layout: this card lives in a narrow Home-column slot
    // (see WearableHealthCard.tsx), so it must not rely on viewport-width
    // breakpoints (sm:/lg:) — those measure the page, not this container,
    // and cause overlap/truncation here.
    <div className="grid grid-cols-2 gap-3">
      {/* Body Battery */}
      <div className="col-span-2 p-3.5 rounded-xl bg-muted/50 border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BatteryCharging className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{t('dailyHealthMetrics.bodyBattery', 'Body Battery')}</span>
          </div>
          <span className="text-xs font-bold text-emerald-500 whitespace-nowrap">
            +{metrics.body_battery_charged ?? 0} / -
            {metrics.body_battery_drained ?? 0}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2 flex-wrap">
          <span className="text-2xl font-black">
            {metrics.body_battery_highest ?? '--'}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {t('dailyHealthMetrics.peak', 'peak')}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            (
            {t('dailyHealthMetrics.low', 'low: {{val}}', {
              val: metrics.body_battery_lowest ?? '--',
            })}
            )
          </span>
        </div>
        {metrics.body_battery_highest != null && (
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getBodyBatteryColor(metrics.body_battery_highest)}`}
              style={{
                width: `${Math.min(100, Math.max(0, metrics.body_battery_highest))}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Activity: Steps / Distance / Floors */}
      <div className="col-span-2 grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-muted/50 border flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Footprints className="h-4 w-4 text-indigo-500 shrink-0" />
            <span>{t('dailyHealthMetrics.steps', 'Steps')}</span>
          </div>
          <span className="text-xl font-black">
            {metrics.total_steps != null
              ? metrics.total_steps.toLocaleString()
              : '--'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 border flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Route className="h-4 w-4 text-sky-500 shrink-0" />
            <span>{t('dailyHealthMetrics.distance', 'Distance')}</span>
          </div>
          <span className="text-xl font-black">{distanceDisplay ?? '--'}</span>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 border flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Building2 className="h-4 w-4 text-orange-500 shrink-0" />
            <span>{t('dailyHealthMetrics.floors', 'Floors')}</span>
          </div>
          <span className="text-xl font-black">
            {metrics.floors_ascended ?? '--'}
          </span>
          {metrics.floors_descended != null && (
            <span className="text-[11px] text-muted-foreground font-mono truncate">
              {t('dailyHealthMetrics.floorsDescended', '↓ {{val}}', {
                val: metrics.floors_descended,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Stress Level */}
      <div className="p-3.5 rounded-xl bg-muted/50 border flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{t('dailyHealthMetrics.avgStress', 'Avg Stress')}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-black ${getStressColor(metrics.avg_stress_level)}`}
          >
            {metrics.avg_stress_level ?? '--'}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          {t('dailyHealthMetrics.max', 'Max: {{val}}', {
            val: metrics.max_stress_level ?? '--',
          })}
        </span>
      </div>

      {/* Resting Heart Rate */}
      <div className="p-3.5 rounded-xl bg-muted/50 border flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Heart className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{t('dailyHealthMetrics.restingHr', 'Resting HR')}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-rose-500">
            {metrics.resting_heart_rate ?? '--'}
          </span>
          <span className="text-xs text-muted-foreground">bpm</span>
        </div>
        <span className="text-[11px] text-muted-foreground truncate">
          {t('dailyHealthMetrics.recovery', 'Recovery: {{val}}', {
            val: metrics.heart_rate_recovery_1min
              ? `${metrics.heart_rate_recovery_1min} bpm`
              : '--',
          })}
        </span>
      </div>

      {/* VO2 Max */}
      <div className="p-3.5 rounded-xl bg-muted/50 border flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <TrendingUp className="h-4 w-4 text-cyan-500 shrink-0" />
          <span>{t('dailyHealthMetrics.vo2Max', 'VO2 Max')}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-cyan-500">
            {metrics.vo2_max ?? '--'}
          </span>
          <span className="text-xs text-muted-foreground">ml/kg/min</span>
        </div>
        <span className="text-[11px] text-muted-foreground truncate">
          {t('dailyHealthMetrics.fitnessAge', 'Fit Age: {{val}}', {
            val: metrics.fitness_age ?? '--',
          })}
        </span>
      </div>

      {/* Training Readiness / Recovery */}
      <div className="p-3.5 rounded-xl bg-muted/50 border flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
          <span>{t('dailyHealthMetrics.readiness', 'Readiness')}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-yellow-500">
            {metrics.training_readiness_score ?? '--'}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono truncate">
          <RefreshCw className="inline h-3 w-3 mr-0.5 text-muted-foreground" />
          {t('dailyHealthMetrics.recHours', 'Rec: {{val}}', {
            val: metrics.recovery_time_hours
              ? `${metrics.recovery_time_hours}h`
              : '--',
          })}
        </span>
      </div>
    </div>
  );
};
