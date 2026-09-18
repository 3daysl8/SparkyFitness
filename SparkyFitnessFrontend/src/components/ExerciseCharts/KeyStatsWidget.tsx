import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatWeight } from '@/utils/numberFormatting';
import { ExerciseDashboardData } from '@/types/reports';
import { MetricCard } from '@/components/biometric/MetricCard';

interface KeyStatsWidgetProps {
  data: ExerciseDashboardData;
  totalTonnage: number;
  weightUnit: string;
}

export const KeyStatsWidget = ({
  data,
  totalTonnage,
  weightUnit,
}: KeyStatsWidgetProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            'exerciseReportsDashboard.overallPerformanceSnapshot',
            'Overall Performance Snapshot'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          metric="workout"
          label={t('exerciseReportsDashboard.totalWorkouts', 'Total Workouts')}
          value={formatNumber(data.keyStats.totalWorkouts)}
        />
        <MetricCard
          metric="workout"
          label={t('exerciseReportsDashboard.totalTonnage', 'Total Tonnage')}
          value={formatWeight(totalTonnage, weightUnit)}
        />
        <MetricCard
          metric="workout"
          label={t('exerciseReportsDashboard.totalVolume', 'Total Volume')}
          value={formatWeight(data.keyStats.totalVolume, weightUnit)}
        />
        <MetricCard
          metric="workout"
          label={t('exerciseReportsDashboard.totalReps', 'Total Reps')}
          value={formatNumber(data.keyStats.totalReps)}
        />
        {data.consistencyData && (
          <>
            <MetricCard
              metric="workout"
              label={t(
                'exerciseReportsDashboard.currentStreakDays',
                'Current Streak (days)'
              )}
              value={data.consistencyData.currentStreak}
            />
            <MetricCard
              metric="workout"
              label={t(
                'exerciseReportsDashboard.longestStreakDays',
                'Longest Streak (days)'
              )}
              value={data.consistencyData.longestStreak}
            />
            <MetricCard
              metric="workout"
              label={t(
                'exerciseReportsDashboard.weeklyFrequency',
                'Weekly Frequency'
              )}
              value={data.consistencyData.weeklyFrequency.toFixed(1)}
            />
            <MetricCard
              metric="workout"
              label={t(
                'exerciseReportsDashboard.monthlyFrequency',
                'Monthly Frequency'
              )}
              value={data.consistencyData.monthlyFrequency.toFixed(1)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};
