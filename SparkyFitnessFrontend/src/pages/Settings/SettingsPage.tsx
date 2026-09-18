import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  Users,
  Tag,
  Cloud,
  Sparkles,
  User,
  Database,
  Heart,
  Bell,
} from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SegmentedControl } from '@/components/biometric/SegmentedControl';
import FamilyAccessManager from './FamilyAccessManager';
import AIServiceSettings from './AIServiceSettings';
import CustomCategoryManager from './CustomCategoryManager';
import ExternalProviderSettings from './ExternalProviderSettings';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import TooltipWarning from '@/components/TooltipWarning';
import { DeveloperResources } from './DevloperResources';
import { AccountSecurity } from './AccountSecurity';
import { ApiSettings } from './ApiSettings';
import { WaterTrackingSettings } from './WaterTrackingSettings';
import { NotificationSettings } from './NotificationSettings';
import { CycleTrackingSettings } from './CycleTrackingSettings';
import CalendarFeedSettings from './CalendarFeedSettings';
import { PreferenceSettings } from './PreferenceSettings';
import { ProfileInformation } from './ProfileInformation';
import { DataManagementSettings } from './DataManagementSettings';
import { DataImportSettings } from './DataImportSettings';

export interface PasswordFormState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
const SECTION_TO_TAB_MAP: Record<string, string> = {
  'profile-information': 'profile-account',
  'user-preferences': 'profile-account',
  'account-security': 'profile-account',
  'family-access': 'profile-account',
  'data-management': 'profile-account',
  'notifications-reminders': 'wellness',
  'cycle-tracking': 'wellness',
  'water-tracking': 'wellness',
  'custom-categories': 'wellness',
  'food-and-exercise-data-providers': 'developer-integrations',
  'ai-service': 'developer-integrations',
  'api-settings': 'developer-integrations',
  'developer-resources': 'developer-integrations',
  integrations: 'developer-integrations',
};

const Settings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const section = queryParams.get('section');
  const tab = queryParams.get('tab');
  const defaultExpanded: string[] = [];

  if (section) {
    if (section === 'integrations') {
      defaultExpanded.push('food-and-exercise-data-providers');
    } else {
      defaultExpanded.push(section);
    }
  }

  const activeTab = (() => {
    if (section && SECTION_TO_TAB_MAP[section]) {
      return SECTION_TO_TAB_MAP[section];
    }
    if (tab) {
      return tab;
    }
    return 'profile-account';
  })();

  const handleTabChange = (value: string) => {
    navigate(`/settings?tab=${value}`);
  };

  return (
    <div className="space-y-6 w-full">
      <Tabs value={activeTab} className="w-full">
        <SegmentedControl
          className="mb-6"
          options={[
            {
              value: 'profile-account',
              label: t('settings.tabs.profileAccount', 'Profile & Account'),
              icon: User,
            },
            {
              value: 'wellness',
              label: t('settings.tabs.wellness', 'Wellness & Tracking'),
              icon: Heart,
            },
            {
              value: 'developer-integrations',
              label: t(
                'settings.tabs.developerIntegrations',
                'Developer & Integrations'
              ),
              icon: SettingsIcon,
            },
          ]}
          value={activeTab}
          onChange={handleTabChange}
        />

        <TabsContent value="profile-account" className="mt-0">
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={defaultExpanded}
          >
            <AccordionItem value="profile-information">
              <ProfileInformation />
            </AccordionItem>
            <AccordionItem value="user-preferences">
              <PreferenceSettings />
            </AccordionItem>
            <AccordionItem value="family-access">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.familyAccess.description',
                  'Manage access to your data for family members'
                )}
              >
                <Users className="h-5 w-5 text-muted-foreground" />
                {t('settings.familyAccess.title', 'Family Access')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <FamilyAccessManager />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="data-management">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.dataManagement.subtitle',
                  'Import, export, or manage your data'
                )}
              >
                <Database className="h-5 w-5 text-muted-foreground" />
                {t('settings.dataManagement.sectionTitle', 'Data Management')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0 space-y-6">
                <DataImportSettings />
                <DataManagementSettings />
              </AccordionContent>
            </AccordionItem>
            <AccountSecurity />
          </Accordion>
        </TabsContent>

        <TabsContent value="wellness" className="mt-0">
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={defaultExpanded}
          >
            <AccordionItem value="notifications-reminders">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.notifications.description',
                  'Configure protocol reminders, check-in alerts, and timer feedback'
                )}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {t('settings.notifications.title', 'Reminders & Notifications')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <NotificationSettings />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cycle-tracking">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.cycle.description',
                  'Configure cycle lengths, period start date, and phase-adapted training recommendations'
                )}
              >
                <Heart className="h-5 w-5 text-muted-foreground" />
                {t('settings.cycle.title', 'Menstrual Cycle & Phase Tracking')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <CycleTrackingSettings />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="water-tracking">
              <WaterTrackingSettings />
            </AccordionItem>
            <AccordionItem value="custom-categories">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.customCategories.description',
                  'Create and manage custom measurement categories'
                )}
              >
                <Tag className="h-5 w-5 text-muted-foreground" />
                {t('settings.customCategories.title', 'Custom Categories')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <CustomCategoryManager />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="developer-integrations" className="mt-0">
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={defaultExpanded}
          >
            <AccordionItem value="food-and-exercise-data-providers">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.foodExerciseDataProviders.description',
                  'Configure external food and exercise data sources and synchronize data with Garmin Connect'
                )}
              >
                <Cloud className="h-5 w-5 text-muted-foreground" />
                {t(
                  'settings.foodExerciseDataProviders.title',
                  'Wearable & Exercise Data Providers'
                )}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0 space-y-4">
                <TooltipWarning
                  warningMsg={t(
                    'settings.foodExerciseDataProviders.invalidKeyLengthWarning',
                    'If you encounter an "Invalid key length" error, ensure your encryption key in the server\'s env variables are 64 hex.'
                  )}
                />
                <ExternalProviderSettings />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="calendar-feeds">
              <CalendarFeedSettings />
            </AccordionItem>
            <AccordionItem value="ai-service">
              <AccordionTrigger
                className="flex items-center gap-2 p-4 hover:no-underline"
                description={t(
                  'settings.aiService.description',
                  'Manage settings for AI-powered features'
                )}
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                {t('settings.aiService.title', 'AI Service')}
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <TooltipWarning
                  warningMsg={t(
                    'settings.aiService.invalidKeyLengthWarning',
                    'If you encounter an "Invalid key length" error, ensure your encryption key in the server\'s env variables are 64 hex.'
                  )}
                />
                <AIServiceSettings />
              </AccordionContent>
            </AccordionItem>
            <ApiSettings />
            <DeveloperResources />
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
