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

interface RepsVsWeightChartProps {
  data: { reps: number; averageWeight: number }[];
  exerciseName: string;
  weightUnit: string;
}

export const RepsVsWeightChart = ({
  data,
  exerciseName,
  weightUnit,
}: RepsVsWeightChartProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            'exerciseReportsDashboard.repsVsWeight',
            `Reps vs Weight - ${exerciseName}`,
            { exerciseName }
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ZoomableChart
          title={t('exerciseReportsDashboard.repsVsWeight', 'Reps vs Weight', {
            exerciseName: '',
          })}
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
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                data={data}
              >
                <CartesianGrid {...chartTheme.grid} />
                <XAxis
                  dataKey="reps"
                  name={t('exerciseReportsDashboard.reps', 'Reps')}
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                  label={{
                    value: t(
                      'exerciseReportsDashboard.averageWeight',
                      `Average Weight (${weightUnit})`,
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
                  dataKey="averageWeight"
                  name={exerciseName}
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
