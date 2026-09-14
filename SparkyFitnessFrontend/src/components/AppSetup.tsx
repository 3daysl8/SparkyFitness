import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { info } from '@/utils/logging';
import { useAnnouncementQuery } from '@/hooks/useGeneralQueries';
import { AnnouncementInfo } from './AnnouncementDialog';

interface AppSetupProps {
  setAnnouncement: React.Dispatch<
    React.SetStateAction<AnnouncementInfo | null>
  >;
  setShowAnnouncementDialog: (show: boolean) => void;
}

const AppSetup = ({
  setAnnouncement,
  setShowAnnouncementDialog,
}: AppSetupProps): null => {
  const { user, loading } = useAuth();
  const { loggingLevel } = usePreferences();

  const { data: announcementData, isSuccess: isAnnouncementSuccess } =
    useAnnouncementQuery({
      enabled: !loading && !!user,
    });

  useEffect(() => {
    info(loggingLevel, 'AppSetup useEffect: auth state', {
      user: !!user,
      loading,
    });

    if (!loading && user && isAnnouncementSuccess && announcementData) {
      info(loggingLevel, '[ANNOUNCEMENT CHECK]', {
        active: announcementData.active,
        id: announcementData.id,
        title: announcementData.title,
        dismissedId: localStorage.getItem('dismissedAnnouncementId'),
      });

      if (announcementData.active) {
        setAnnouncement(announcementData);
        const dismissedId = localStorage.getItem('dismissedAnnouncementId');
        if (dismissedId !== announcementData.id) {
          info(
            loggingLevel,
            '[ANNOUNCEMENT SHOWING] Opening dialog for id:',
            announcementData.id
          );
          setShowAnnouncementDialog(true);
        } else {
          info(
            loggingLevel,
            '[ANNOUNCEMENT SKIPPED] Already dismissed id:',
            dismissedId
          );
        }
      } else {
        info(loggingLevel, '[ANNOUNCEMENT SKIPPED] active is false');
      }
    }
  }, [
    user,
    loading,
    isAnnouncementSuccess,
    announcementData,
    loggingLevel,
    setAnnouncement,
    setShowAnnouncementDialog,
  ]);

  return null;
};

export default AppSetup;
