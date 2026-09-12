import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { info, error as logError } from '@/utils/logging';

/** Shared sign-out flow (toast + redirect to /login) so every entry point —
 * currently just Settings/Profile — behaves identically. */
export function useSignOut() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { loggingLevel } = usePreferences();

  return async () => {
    info(loggingLevel, 'useSignOut: Attempting to sign out.');
    try {
      await signOut();
      toast({
        title: t('common.success', 'Success'),
        description: t('auth.signedOut', 'Signed out successfully'),
      });
      navigate('/login');
    } catch (err) {
      logError(loggingLevel, 'useSignOut: Sign out error:', err);
      toast({
        title: t('common.error', 'Error'),
        description: t('auth.signOutFailed', 'Failed to sign out'),
        variant: 'destructive',
      });
    }
  };
}
