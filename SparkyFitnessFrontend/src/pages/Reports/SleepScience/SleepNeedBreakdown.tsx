import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { formatSecondsToHHMM } from '@/utils/timeFormatters';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyNeedData } from '@workspace/shared';
import { chartTheme } from '@/lib/chartTheme';

interface SleepNeedBreakdownProps {
  data: DailyNeedData;
}

const SleepNeedBreakdown: React.FC<SleepNeedBreakdownProps> = ({ data }) => {
  const { t } = useTranslation();

  const chartData = [
    {
      name: t('sleepScience.baseline', 'Baseline'),
      value: data.baseline_need,
      color: chartTheme.colors.sleep,
    },
    {
      name: t('sleepScience.strain', 'Strain'),
      value: data.strain_addition,
      color: chartTheme.colors.workout,
    },
    {
      name: t('sleepScience.debtRecovery', 'Debt Recovery'),
      value: data.debt_addition,
      color: 'hsl(var(--status-low))',
    },
    {
      name: t('sleepScience.naps', 'Naps'),
      value: -(data.nap_subtraction ?? 0),
      color: 'hsl(var(--status-optimal))',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>
            {t('sleepScience.sleepNeedTonight', 'Sleep Need Tonight')}
          </span>
          <span className="text-2xl font-bold text-primary">
            {formatSecondsToHHMM(data.total_need * 3600)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
          >
            <CartesianGrid {...chartTheme.grid} horizontal={false} />
            <XAxis
              dataKey="name"
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
            />
            <YAxis
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              domain={
                chartData.some((d) => (d.value ?? 0) < 0)
                  ? ['auto', 'auto']
                  : [0, 'auto']
              }
              tickFormatter={(v: number) => formatSecondsToHHMM(v * 3600)}
            />
            <Tooltip
              {...chartTheme.tooltip}
              formatter={(
                value:
                  string | number | ReadonlyArray<string | number> | undefined
              ) => {
                const val = Number(Array.isArray(value) ? value[0] : value);
                return [formatSecondsToHHMM((val || 0) * 3600)];
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">
            {t('sleepScience.method', 'Method')}: {data.method}
          </span>
          <span className="capitalize px-2 py-0.5 rounded bg-muted">
            {data.confidence}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SleepNeedBreakdown;
