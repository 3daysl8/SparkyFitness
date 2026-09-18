import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dumbbell, History, Search } from 'lucide-react';
import { SegmentedControl } from '@/components/biometric/SegmentedControl';
import WorkoutsRoutinesTab from './WorkoutsRoutinesTab';
import WorkoutsHistoryTab from './WorkoutsHistoryTab';
import WorkoutsLibraryTab from './WorkoutsLibraryTab';

type WorkoutsTabId = 'routines' | 'history' | 'library';

const DEFAULT_TAB: WorkoutsTabId = 'routines';

const WorkoutsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

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
