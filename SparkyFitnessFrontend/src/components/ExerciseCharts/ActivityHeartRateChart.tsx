import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ZoomableChart from '@/components/ZoomableChart';
import { ChartDataPoint } from '@/types/reports';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatTimeWithPreference } from '@/utils/timeFormatters';
import { chartTheme } from '@/lib/chartTheme';

interface ActivityHeartRateChartProps {
  data: ChartDataPoint[];
  xAxisMode: string;
  getXAxisDataKey: () => string;
  getXAxisLabel: () => string;
  distanceUnit: string;
}

export const ActivityHeartRateChart = ({
  data,
  xAxisMode,
  getXAxisDataKey,
  getXAxisLabel,
  distanceUnit,
}: ActivityHeartRateChartProps) => {
  const { t } = useTranslation();
  const { timeFormat } = usePreferences();

  return (
    <ZoomableChart title={t('reports.activityReport.heartRateBpm')}>
      {(isMaximized, zoomLevel) => (
        <Card className={`mb-8 ${isMaximized ? 'h-full flex flex-col' : ''}`}>
          <CardHeader>
            <CardTitle className="text-sm">
              {t('reports.activityReport.heartRateBpm')}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`grow ${isMaximized ? 'min-h-0 h-full' : ''}`}
          >
            <ResponsiveContainer
              width={`${100 * zoomLevel}%`}
              height={isMaximized ? '100%' : 300 * zoomLevel}
              minWidth={0}
              minHeight={0}
              debounce={100}
            >
              <LineChart data={data} syncId="activityReportSync">
                <CartesianGrid {...chartTheme.grid} />
                <XAxis
                  dataKey={getXAxisDataKey()}
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                  label={{
                    value: getXAxisLabel(),
                    position: 'insideBottom',
                    offset: -5,
                    fill: chartTheme.axis.stroke,
                  }}
                  tickFormatter={(value) => {
                    if (xAxisMode === 'activityDuration')
                      return `${Number(value).toFixed(0)} ${t('common.min', 'min')}`;
                    if (xAxisMode === 'distance')
                      return `${Number(value).toFixed(2)}`;
                    if (xAxisMode === 'timeOfDay')
                      return formatTimeWithPreference(
                        new Date(value),
                        timeFormat
                      );
                    return String(value);
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={chartTheme.axis.tick}
                />
                <Tooltip
                  {...chartTheme.tooltip}
                  labelFormatter={(value) => {
                    if (xAxisMode === 'timeOfDay')
                      return formatTimeWithPreference(
                        new Date(value),
                        timeFormat
                      );
                    if (xAxisMode === 'activityDuration')
                      return `${Number(value).toFixed(0)} ${t('common.min', 'min')}`;
                    if (xAxisMode === 'distance')
                      return `${Number(value).toFixed(2)} ${distanceUnit === 'km' ? 'km' : 'mi'}`;
                    return String(value);
                  }}
                />
                <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke={chartTheme.colors.workout}
                  name={t('reports.activityReport.heartRateBpm')}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </ZoomableChart>
  );
};
