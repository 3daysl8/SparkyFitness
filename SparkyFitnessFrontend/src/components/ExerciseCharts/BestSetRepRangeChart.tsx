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
} from 'recharts';
import ZoomableChart from '@/components/ZoomableChart';
import { chartTheme } from '@/lib/chartTheme';

interface BestSetRepRangeChartProps {
  data: { range: string; weight: number }[];
  exerciseName: string;
  weightUnit: string;
}

export const BestSetRepRangeChart = ({
  data,
  exerciseName,
  weightUnit,
}: BestSetRepRangeChartProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            'exerciseReportsDashboard.bestSetByRepRange',
            `Best Set by Rep Range - ${exerciseName}`,
            { exerciseName }
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ZoomableChart
          title={t(
            'exerciseReportsDashboard.bestSetByRepRangeTitle',
            'Best Set by Rep Range'
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
                  dataKey="range"
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                  label={{
                    value: t(
                      'exerciseReportsDashboard.maxWeight',
                      `Weight (${weightUnit})`,
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
                <Tooltip {...chartTheme.tooltip} />
                <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
                <Bar
                  dataKey="weight"
                  fill={chartTheme.colors.workout}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ZoomableChart>
      </CardContent>
    </Card>
  );
};
