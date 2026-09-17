import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dumbbell, History, Search } from 'lucide-react';
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
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 mb-6 pb-2 border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-full px-4 h-9 gap-2 transition-all ${
                  isActive
                    ? 'bg-slate-200/60 dark:bg-muted shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span className="text-xs font-semibold">{tab.label}</span>
              </Button>
            );
          })}
        </div>

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
