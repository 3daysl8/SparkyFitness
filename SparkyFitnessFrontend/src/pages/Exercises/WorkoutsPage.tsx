import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subDays } from 'date-fns';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dumbbell, History, Search } from 'lucide-react';
import { SegmentedControl } from '@/components/biometric/SegmentedControl';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useExerciseDashboardData } from '@/hooks/Reports/useReports';
import { calculateTotalTonnage } from '@/utils/reportUtil';
import { formatWeight } from '@/utils/numberFormatting';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import WorkoutsRoutinesTab from './WorkoutsRoutinesTab';
import WorkoutsHistoryTab from './WorkoutsHistoryTab';
import WorkoutsLibraryTab from './WorkoutsLibraryTab';

type WorkoutsTabId = 'routines' | 'history' | 'library';

const DEFAULT_TAB: WorkoutsTabId = 'routines';

const WorkoutsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { weightUnit } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();

  // Rolling 7-day window (including today) — the same "trailing window"
  // convention SleepVitalsHud uses, not an invented range.
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    return {
      startDate: formatDateToYYYYMMDD(subDays(today, 6)),
      endDate: formatDateToYYYYMMDD(today),
    };
  }, []);
  const { data: exerciseDashboardData } = useExerciseDashboardData(
    startDate,
    endDate,
    user?.id
  );
  const weeklyTonnage = exerciseDashboardData
    ? calculateTotalTonnage(exerciseDashboardData.exerciseEntries)
    : null;

  const requestedTab = searchParams.get('tab');
  const activeTab: WorkoutsTabId =
    requestedTab === 'history' || requestedTab === 'library'
      ? requestedTab
      : DEFAULT_TAB;

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set('tab', value);
      return prev;
    });
  };

  const tabs: { id: WorkoutsTabId; label: string; icon: typeof Dumbbell }[] = [
    {
      id: 'routines',
      label: t('exercise.workoutsPage.tabs.routines', 'Programs & Routines'),
      icon: Dumbbell,
    },
    {
      id: 'history',
      label: t('exercise.workoutsPage.tabs.history', 'History'),
      icon: History,
    },
    {
      id: 'library',
      label: t('exercise.workoutsPage.tabs.library', 'Exercise Library'),
      icon: Search,
    },
  ];

  return (
    <div className="space-y-6">
      {weeklyTonnage != null && weeklyTonnage > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <Dumbbell className="size-3.5 shrink-0 text-metric-workout" />
          <span>
            {t('exercise.workoutsPage.weeklyTonnage', {
              volume: formatWeight(weeklyTonnage, weightUnit),
              defaultValue: '{{volume}} lifted this week',
            })}
          </span>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <SegmentedControl
          options={tabs.map(({ id, label, icon }) => ({
            value: id,
            label,
            icon,
          }))}
          value={activeTab}
          onChange={handleTabChange}
          className="mb-6"
        />

        <TabsContent value="routines" className="focus-visible:outline-none">
          <WorkoutsRoutinesTab />
        </TabsContent>

        <TabsContent value="history" className="focus-visible:outline-none">
          <WorkoutsHistoryTab />
        </TabsContent>

        <TabsContent value="library" className="focus-visible:outline-none">
          <WorkoutsLibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkoutsPage;
