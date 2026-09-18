import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSecondsToHHMM } from '@/utils/timeFormatters';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SleepDebtData } from '@workspace/shared';
import { chartTheme } from '@/lib/chartTheme';

interface SleepDebtHistoryProps {
  data: SleepDebtData;
}

const DEBT_COLORS = {
  surplus: 'hsl(var(--status-optimal))',
  minor: 'hsl(var(--status-optimal))',
  moderate: 'hsl(var(--status-moderate))',
  significant: 'hsl(var(--status-low))',
};

function getBarColor(deviation: number): string {
  if (isNaN(deviation) || deviation <= 0) {
    return DEBT_COLORS.surplus;
  }

  if (deviation < 1) {
    return DEBT_COLORS.minor;
  }

  if (deviation < 2) {
    return DEBT_COLORS.moderate;
  }

  return DEBT_COLORS.significant;
}

const TrendIcon: React.FC<{ direction: string }> = ({ direction }) => {
  const size = 14;
  switch (direction) {
    case 'improving':
      return <TrendingDown size={size} className="text-status-optimal" />;
    case 'worsening':
      return <TrendingUp size={size} className="text-status-low" />;
    default:
      return <Minus size={size} className="text-muted-foreground" />;
  }
};

const SleepDebtHistory: React.FC<SleepDebtHistoryProps> = ({ data }) => {
  const { t } = useTranslation();
  const { formatDateInUserTimezone, dateFormat } = usePreferences();

  const chartData = useMemo(() => {
    return [...data.last14Days].reverse().map((day) => ({
      date: formatDateInUserTimezone(day.date, dateFormat),
      deviation: Math.max(0, day.deviation),
      surplus: Math.min(0, day.deviation),
      tst: day.tst,
      rawDeviation: day.deviation,
    }));
  }, [data.last14Days, formatDateInUserTimezone, dateFormat]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t('sleepScience.debtHistory', '14-Day Sleep Debt')}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon direction={data.trend.direction} />
            <span className="capitalize">{data.trend.direction}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
          >
            <CartesianGrid {...chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              interval={1}
            />
            <YAxis
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              tickFormatter={(v: number) => formatSecondsToHHMM(v * 3600)}
            />
            <Tooltip
              {...chartTheme.tooltip}
              formatter={(
                value:
                  string | number | ReadonlyArray<string | number> | undefined,
                name: string | number | undefined
              ) => {
                const label =
                  String(name) === 'deviation'
                    ? t('sleepScience.debt', 'Debt')
                    : t('sleepScience.surplus', 'Surplus');
                const val = Number(Array.isArray(value) ? value[0] : value);
                return [formatSecondsToHHMM(Math.abs(val || 0) * 3600), label];
              }}
            />
            <ReferenceLine y={0} stroke={chartTheme.axis.stroke} />
            <Bar dataKey="deviation" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.rawDeviation)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SleepDebtHistory;
