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
import { chartTheme } from '@/lib/chartTheme';

interface TrainingVolumeByMuscleGroupChartProps {
  data: { muscle: string; volume: number }[];
  weightUnit: string;
}

export const TrainingVolumeByMuscleGroupChart = ({
  data,
  weightUnit,
}: TrainingVolumeByMuscleGroupChartProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            'exerciseReportsDashboard.trainingVolumeByMuscleGroup',
            'Training Volume by Muscle Group'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
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
                dataKey="muscle"
                stroke={chartTheme.axis.stroke}
                tick={chartTheme.axis.tick}
              />
              <YAxis
                stroke={chartTheme.axis.stroke}
                tick={chartTheme.axis.tick}
                label={{
                  value: t(
                    'exerciseReportsDashboard.volumeCurrent',
                    `Volume (${weightUnit})`,
                    { weightUnit }
                  ),
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { textAnchor: 'middle', fill: chartTheme.axis.stroke },
                }}
              />
              <Tooltip {...chartTheme.tooltip} />
              <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
              <Bar
                dataKey="volume"
                fill={chartTheme.colors.workout}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
