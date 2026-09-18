import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipValueType,
} from 'recharts';
import ZoomableChart from '@/components/ZoomableChart';
import { formatWeight } from '@/utils/numberFormatting';
import { chartTheme } from '@/lib/chartTheme';

interface MaxWeightTrendChartProps {
  data: { date: string; maxWeight: number; comparisonMaxWeight: number }[];
  weightUnit: string;
  comparisonPeriod: string | null;
}

export const MaxWeightTrendChart = ({
  data,
  weightUnit,
  comparisonPeriod,
}: MaxWeightTrendChartProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('exerciseReportsDashboard.maxWeightTrend', 'Max Weight Trend')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ZoomableChart
          title={t(
            'exerciseReportsDashboard.maxWeightTrend',
            'Max Weight Trend'
          )}
        >
          {(isMaximized, zoomLevel) => (
            <ResponsiveContainer
              width={isMaximized ? `${100 * zoomLevel}%` : '100%'}
              height={isMaximized ? '100%' : 300}
              minWidth={0}
              minHeight={0}
              debounce={100}
            >
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
              >
                <CartesianGrid {...chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                  tickFormatter={(value) => formatWeight(value, weightUnit)}
                  label={{
                    value: t(
                      'exerciseReportsDashboard.maxWeightCurrent',
                      `Max Weight (${weightUnit})`,
                      { weightUnit }
                    ),
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: {
                      textAnchor: 'middle',
                      fill: chartTheme.axis.stroke,
                    },
                  }}
                />
                <Tooltip
                  formatter={(value: TooltipValueType | undefined) =>
                    value ? formatWeight(Number(value), weightUnit) : 0
                  }
                  {...chartTheme.tooltip}
                />
                <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
                <Bar
                  dataKey="maxWeight"
                  fill={chartTheme.colors.workout}
                  name={t(
                    'exerciseReportsDashboard.maxWeightCurrent',
                    'Max Weight (Current)'
                  )}
                  isAnimationActive={false}
                />
                {comparisonPeriod && (
                  <Bar
                    dataKey="comparisonMaxWeight"
                    fill={chartTheme.colors.workout}
                    opacity={0.6}
                    name={t(
                      'exerciseReportsDashboard.maxWeightComparison',
                      'Max Weight (Comparison)'
                    )}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ZoomableChart>
      </CardContent>
    </Card>
  );
};
