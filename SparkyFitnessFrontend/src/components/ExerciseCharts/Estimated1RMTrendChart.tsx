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

interface Estimated1RMTrendChartProps {
  data: {
    date: string;
    estimated1RM: number;
    comparisonEstimated1RM: number;
  }[];
  weightUnit: string;
  comparisonPeriod: string | null;
}

export const Estimated1RMTrendChart = ({
  data,
  weightUnit,
  comparisonPeriod,
}: Estimated1RMTrendChartProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            'exerciseReportsDashboard.estimated1RMTrend',
            'Estimated 1RM Trend'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ZoomableChart
          title={t(
            'exerciseReportsDashboard.estimated1RMTrend',
            'Estimated 1RM Trend'
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
                      'exerciseReportsDashboard.estimated1RMCurrent',
                      `Estimated 1RM (${weightUnit})`,
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
                  dataKey="estimated1RM"
                  fill={chartTheme.colors.workout}
                  name={t(
                    'exerciseReportsDashboard.estimated1RMCurrent',
                    'Estimated 1RM (Current)'
                  )}
                  isAnimationActive={false}
                />
                {comparisonPeriod && (
                  <Bar
                    dataKey="comparisonEstimated1RM"
                    fill={chartTheme.colors.workout}
                    opacity={0.6}
                    name={t(
                      'exerciseReportsDashboard.estimated1RMComparison',
                      'Estimated 1RM (Comparison)'
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
