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

interface ExerciseVarietyScoreProps {
  varietyData: {
    [muscleGroup: string]: number;
  } | null;
}

const ExerciseVarietyScore = ({ varietyData }: ExerciseVarietyScoreProps) => {
  const { t } = useTranslation();

  if (!varietyData || Object.keys(varietyData).length === 0) {
    return null;
  }

  const chartData = Object.entries(varietyData).map(([muscle, count]) => ({
    muscle,
    count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('reports.exerciseVarietyScore', 'Exercise Variety Score')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer
          width="100%"
          height={300}
          minWidth={0}
          minHeight={0}
          debounce={100}
        >
          <BarChart data={chartData}>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis
              dataKey="muscle"
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
            />
            <YAxis
              allowDecimals={false}
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              label={{
                value: t('reports.uniqueExercises', 'Unique Exercises'),
                angle: -90,
                position: 'insideLeft',
                fill: chartTheme.axis.stroke,
              }}
            />
            <Tooltip {...chartTheme.tooltip} />
            <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
            <Bar
              dataKey="count"
              fill={chartTheme.colors.workout}
              name={t('reports.uniqueExercises', 'Unique Exercises')}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ExerciseVarietyScore;
