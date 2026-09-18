import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FastingReport } from '@/pages/Reports/FastingReport';
import MedicationReports from '@/pages/Reports/MedicationReports';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import ZoomableChart from '@/components/ZoomableChart';
import ReportsControls from '@/pages/Reports/ReportsControls';
import HydrationTrendChart from '@/pages/Reports/HydrationTrendChart';
import WidgetGrid from '@/components/widgets/WidgetGrid';
import {
  generateReportsMeasurementsDefaultLayouts,
  useMeasurementChartWidgets,
} from '@/pages/Reports/MeasurementChartsGrid';
import ReportsTables, {
  type TableFilterValue,
} from '@/pages/Reports/ReportsTables';
import ExerciseReportsDashboard from '@/pages/Reports/ExerciseReportsDashboard';
import SleepReport from '@/pages/Reports/SleepReport';
import BodyBatteryCard from '@/pages/Reports/BodyBatteryCard';
import RespirationCard from '@/pages/Reports/RespirationCard';
import { WeeklyAlcoholCard } from '@/pages/Reports/WeeklyAlcoholCard';

import StressChart from '@/pages/Reports/StressChart';
import { debug, info } from '@/utils/logging';

import MoodChart from '@/pages/Reports/MoodChart';
import { useMoodEntries } from '@/hooks/CheckIn/useMood';
import {
  useExerciseDashboardData,
  useRawStressData,
  useReportsData,
} from '@/hooks/Reports/useReports';
import { useFastingDataRange } from '@/hooks/Fasting/useFasting';
import {
  exportBodyMeasurements,
  exportCustomMeasurement,
  exportExerciseEntries,
} from '@/utils/reportUtil';
import { CustomCategoryReport } from './CustomCategoryReport';
import { ChartErrorBoundary } from '../Errors/ChartErrorFallback';
import { CustomCategoriesResponse } from '@workspace/shared';
import { useSearchParams } from 'react-router-dom';

const Reports = () => {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();
  const {
    formatDateInUserTimezone,
    loggingLevel,
    energyUnit,
    convertEnergy,
    weightUnit: defaultWeightUnit,
    measurementUnit: defaultMeasurementUnit,
  } = usePreferences();

  // Suppress specific Recharts warning in hidden tabs
  useEffect(() => {
    const originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes(
          'The width(-1) and height(-1) of chart should be greater than 0'
        )
      ) {
        return;
      }
      originalConsoleWarn(...args);
    };

    return () => {
      // Restore original console.warn on component unmount
      console.warn = originalConsoleWarn;
    };
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  const [startDate, setStartDate] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('startDate')) return params.get('startDate')!;
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return formatDateInUserTimezone(date, 'yyyy-MM-dd');
  });

  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') ??
      formatDateInUserTimezone(new Date(), 'yyyy-MM-dd')
  );

  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'charts'
  );

  const [selectedTable, setSelectedTable] = useState<TableFilterValue>('all');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams((prev) => {
      prev.set('tab', value);
      return prev;
    });
  };

  const { data: moodData = [], isLoading: moodLoading } = useMoodEntries(
    startDate,
    endDate
  );
  const { data: rawStressData = [], isLoading: stressLoading } =
    useRawStressData(activeUserId);
  const { data: exerciseDashboardData, isLoading: dashboardLoading } =
    useExerciseDashboardData(startDate, endDate, activeUserId);
  const { data: fastingData = [], isLoading: fastingLoading } =
    useFastingDataRange(startDate, endDate);

  const { data: reportsData, isLoading: reportsLoading } = useReportsData(
    startDate,
    endDate,
    activeUserId
  );

  // Der globale Ladezustand
  const loading =
    !startDate ||
    !endDate ||
    moodLoading ||
    stressLoading ||
    dashboardLoading ||
    fastingLoading ||
    reportsLoading;

  const {
    tabularData = [],
    exerciseEntries = [],
    measurementData = [],
    customCategories = [],
    customMeasurementsData = [],
    medications = [],
    medicationEntries = [],
    symptomEntries = [],
  } = reportsData || {};

  const measurementChartWidgets = useMeasurementChartWidgets({
    // Pass the raw (possibly undefined) value so the hook's stable
    // EMPTY_MEASUREMENTS fallback is used while loading. The destructured
    // `measurementData` above defaults to a fresh `[]` each render, which
    // would defeat that and re-compute every widget.
    measurementData: reportsData?.measurementData,
  });

  const handleStartDateChange = (date: string) => {
    debug(loggingLevel, 'Reports: Start date change handler called:', {
      newDate: date,
      currentStartDate: startDate,
    });
    setStartDate(date);
    setSearchParams((prev) => {
      prev.set('startDate', date);
      return prev;
    });
  };

  const handleEndDateChange = (date: string) => {
    debug(loggingLevel, 'Reports: End date change handler called:', {
      newDate: date,
      currentEndDate: endDate,
    });
    setEndDate(date);
    setSearchParams((prev) => {
      prev.set('endDate', date);
      return prev;
    });
  };

  info(loggingLevel, 'Reports: Rendering reports component.');

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'charts':
        return (
          <div className="space-y-12">
            <ChartErrorBoundary>
              <HydrationTrendChart
                startDate={startDate}
                endDate={endDate}
                userId={activeUserId}
              />
            </ChartErrorBoundary>
          </div>
        );
      case 'measurements':
        return (
          <div className="space-y-6">
            <ChartErrorBoundary>
              <WidgetGrid
                pageKey="reports-measurements"
                widgets={measurementChartWidgets}
                generateDefaultLayouts={
                  generateReportsMeasurementsDefaultLayouts
                }
              />
            </ChartErrorBoundary>
            <ChartErrorBoundary>
              <BodyBatteryCard
                categories={customCategories}
                measurementsData={customMeasurementsData}
              />
            </ChartErrorBoundary>
            <ChartErrorBoundary>
              <RespirationCard
                categories={customCategories}
                measurementsData={customMeasurementsData}
              />
            </ChartErrorBoundary>
            <ChartErrorBoundary>
              <WeeklyAlcoholCard date={endDate} userId={activeUserId} />
            </ChartErrorBoundary>
            <ChartErrorBoundary>
              <CustomCategoryReport
                customCategories={customCategories}
                customMeasurementsData={customMeasurementsData}
              />
            </ChartErrorBoundary>
          </div>
        );
      case 'fasting':
        return (
          <ChartErrorBoundary>
            <FastingReport fastingData={fastingData} />
          </ChartErrorBoundary>
        );
      case 'exercise-charts':
        return (
          <ChartErrorBoundary>
            <ExerciseReportsDashboard
              exerciseDashboardData={exerciseDashboardData}
              startDate={startDate}
              endDate={endDate}
            />
          </ChartErrorBoundary>
        );
      case 'sleep-analytics':
        return (
          <ChartErrorBoundary>
            <SleepReport startDate={startDate} endDate={endDate} />
          </ChartErrorBoundary>
        );
      case 'stress-analytics':
        return (
          <div className="space-y-6">
            <ChartErrorBoundary>
              {rawStressData?.length > 0 ? (
                <StressChart
                  title={t('reports.stressChartTitle', 'Raw Stress Levels')}
                  data={rawStressData}
                />
              ) : (
                <p>
                  {t('reports.noStressData', 'No raw stress data available.')}
                </p>
              )}
            </ChartErrorBoundary>
            <ChartErrorBoundary>
              {moodData?.length > 0 ? (
                <ZoomableChart
                  title={t('reports.moodChartTitle', 'Daily Mood')}
                >
                  <MoodChart
                    title={t('reports.moodChartTitle', 'Daily Mood')}
                    data={moodData}
                  />
                </ZoomableChart>
              ) : (
                <p>
                  {t('reports.noMoodData', 'No daily mood data available.')}
                </p>
              )}
            </ChartErrorBoundary>
          </div>
        );
      case 'table':
        return (
          <ChartErrorBoundary>
            <ReportsTables
              tabularData={tabularData}
              exerciseEntries={exerciseEntries}
              measurementData={measurementData}
              customCategories={customCategories}
              customMeasurementsData={customMeasurementsData}
              prData={exerciseDashboardData?.prData}
              selectedTable={selectedTable}
              onSelectedTableChange={setSelectedTable}
              onExportFoodDiary={() => {}}
              customNutrients={[]}
              onExportBodyMeasurements={() =>
                exportBodyMeasurements({
                  loggingLevel,
                  startDate,
                  endDate,
                  measurementData,
                  defaultWeightUnit,
                  defaultMeasurementUnit,
                  formatDateInUserTimezone,
                })
              }
              onExportCustomMeasurements={(
                category: CustomCategoriesResponse
              ) =>
                exportCustomMeasurement({
                  loggingLevel,
                  startDate,
                  endDate,
                  category,
                  customMeasurementsData,
                  formatDateInUserTimezone,
                })
              }
              onExportExerciseEntries={() =>
                exportExerciseEntries({
                  loggingLevel,
                  energyUnit,
                  exerciseEntries,
                  startDate,
                  endDate,
                  formatDateInUserTimezone,
                  convertEnergy,
                })
              }
            />
          </ChartErrorBoundary>
        );
      case 'medications-reports':
        return (
          <ChartErrorBoundary>
            <MedicationReports
              startDate={startDate}
              endDate={endDate}
              tabularData={tabularData}
              exerciseEntries={exerciseEntries}
              measurementData={measurementData.map((m) => ({
                entry_date: m.entry_date,
                weight: m.weight ?? null,
              }))}
              customCategories={customCategories}
              customMeasurementsData={customMeasurementsData}
              medications={medications}
              medicationEntries={medicationEntries}
              symptomEntries={symptomEntries}
            />
          </ChartErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10">
      {startDate && endDate ? (
        <ReportsControls
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      ) : (
        <div>
          {t('reports.loadingDateControls', 'Loading date controls...')}
        </div>
      )}
      {loading ? (
        <div>{t('reports.loadingReports', 'Loading reports...')}</div>
      ) : (
        <div className="w-full animate-in fade-in duration-500">
          {renderActiveContent()}
        </div>
      )}
    </div>
  );
};

export default Reports;
