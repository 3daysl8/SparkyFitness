import { useTranslation } from 'react-i18next';
import { DateRangePickerWithPresets } from '@/components/ui/DateRangeWithPresets';
import { SegmentedControl } from '@/components/biometric/SegmentedControl';
import {
  Droplet,
  TrendingUp,
  Dumbbell,
  BedDouble,
  Activity,
  Table as TableIcon,
  Pill,
} from 'lucide-react';

interface ReportsControlsProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ReportsControls = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activeTab,
  onTabChange,
}: ReportsControlsProps) => {
  const { t } = useTranslation();

  const reportTypes = [
    {
      value: 'charts',
      label: t('reports.hydrationTab', 'Hydration'),
      icon: Droplet,
    },
    {
      value: 'measurements',
      label: t('reports.measurementsTab', 'Measurements'),
      icon: Activity,
    },
    {
      value: 'fasting',
      label: t('reports.fasting.insightsTab', 'Fasting'),
      icon: TrendingUp,
    },
    {
      value: 'exercise-charts',
      label: t('reports.exerciseProgressTab', 'Exercise'),
      icon: Dumbbell,
    },
    {
      value: 'sleep-analytics',
      label: t('reports.sleepTab', 'Sleep'),
      icon: BedDouble,
    },
    {
      value: 'stress-analytics',
      label: t('reports.stressTab', 'Stress'),
      icon: Activity,
    },
    {
      value: 'medications-reports',
      label: t('reports.medicationsTab', 'Medications'),
      icon: Pill,
    },
    {
      value: 'table',
      label: t('reports.tableTab', 'Table'),
      icon: TableIcon,
    },
  ];

  return (
    <div className="w-full flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
      {/* Navigation */}
      <div className="flex-1 min-w-0 w-full lg:w-auto">
        <SegmentedControl
          options={reportTypes}
          value={activeTab}
          onChange={onTabChange}
        />
      </div>

      {/* Vertical Divider (Desktop Only) */}
      <div className="hidden lg:block w-px h-6 bg-border" />

      {/* Secondary Filter: Date Picker */}
      <div className="shrink-0">
        <DateRangePickerWithPresets
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
      </div>
    </div>
  );
};

export default ReportsControls;
