import type React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import { debug, info } from '@/utils/logging';
import {
  Home,
  Activity, // Used for Check-In
  BarChart3,
  Dumbbell, // Used for Workouts
  Compass, // Used for Focus
  Plus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import SparkyChat from '../pages/Chat/SparkyChat';
import AddComp from '@/layouts/AddComp';
import ThemeToggle from '@/components/ThemeToggle';
import GlobalSyncButton from '@/components/GlobalSyncButton';
import UserAccountMenu from '@/components/UserAccountMenu';
import GitHubStarCounter from '@/components/GitHubStarCounter';
import GitHubSponsorButton from '@/components/GitHubSponsorButton';
import GlobalNotificationIcon from '@/components/GlobalNotificationIcon';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getGridClassNormal } from '@/utils/layout';

interface AddCompItem {
  value: string;
  label: string;
  icon: LucideIcon;
  fullWidth?: boolean;
}

const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isActingOnBehalf, hasPermission, hasWritePermission } =
    useActiveUser();
  const { getDateRelationToToday, loggingLevel } = usePreferences();
  debug(loggingLevel, 'MainLayout: Component rendered.');

  const [isAddCompOpen, setIsAddCompOpen] = useState(false);

  const addCompItems: AddCompItem[] = useMemo(() => {
    const items: AddCompItem[] = [];
    if (!isActingOnBehalf) {
      items.push(
        {
          value: '/checkin',
          label: t('nav.checkin', 'Daily Check-In'),
          icon: Activity,
        },
        {
          value: '/workouts',
          label: t('nav.workouts', 'Start Workout'),
          icon: Dumbbell,
        },
        {
          value: '/focus',
          label: t('nav.focus', 'Focus & Goals'),
          icon: Compass,
        },
        {
          value: '/reports',
          label: t('nav.progress', 'Progress & History'),
          icon: BarChart3,
        }
      );
    } else {
      if (hasWritePermission('checkin')) {
        items.push({
          value: '/checkin',
          label: t('nav.checkin', 'Daily Check-In'),
          icon: Activity,
        });
      }
      if (hasPermission('reports')) {
        items.push({
          value: '/reports',
          label: t('nav.reports', 'Reports'),
          icon: BarChart3,
        });
      }
    }
    return items;
  }, [isActingOnBehalf, hasWritePermission, hasPermission, t]);

  const availableTabs = useMemo(() => {
    debug(loggingLevel, 'MainLayout: Calculating available tabs (desktop).', {
      isActingOnBehalf,
      hasPermission,
      hasWritePermission,
    });
    const tabs = [];
    if (!isActingOnBehalf) {
      tabs.push(
        { value: '/', label: t('nav.home', 'Home'), icon: Home },
        {
          value: '/workouts',
          label: t('nav.workouts', 'Workouts'),
          icon: Dumbbell,
        },
        { value: '/focus', label: t('nav.focus', 'Focus'), icon: Compass },
        {
          value: '/reports',
          label: t('nav.progress', 'Progress'),
          icon: BarChart3,
        }
      );
    } else {
      if (hasWritePermission('checkin')) {
        tabs.push({
          value: '/checkin',
          label: t('nav.checkin', 'Check-In'),
          icon: Activity,
        });
      }
      if (hasPermission('reports')) {
        tabs.push({
          value: '/reports',
          label: t('nav.reports', 'Reports'),
          icon: BarChart3,
        });
      }
    }
    return tabs;
  }, [isActingOnBehalf, hasPermission, hasWritePermission, loggingLevel, t]);

  const availableMobileTabs = useMemo(() => {
    debug(loggingLevel, 'MainLayout: Calculating available tabs (mobile).', {
      isActingOnBehalf,
      hasPermission,
      hasWritePermission,
      isAddCompOpen,
    });
    const mobileTabs = [];
    if (!isActingOnBehalf) {
      mobileTabs.push(
        { value: '/', label: t('nav.home', 'Home'), icon: Home },
        {
          value: '/workouts',
          label: t('nav.workouts', 'Workouts'),
          icon: Dumbbell,
        },
        {
          value: 'Add',
          label: t('common.add', 'Add'),
          icon: isAddCompOpen ? X : Plus,
        },
        { value: '/focus', label: t('nav.focus', 'Focus'), icon: Compass },
        {
          value: '/reports',
          label: t('nav.progress', 'Progress'),
          icon: BarChart3,
        }
      );
    } else {
      if (hasWritePermission('checkin')) {
        mobileTabs.push({
          value: '/checkin',
          label: t('nav.checkin', 'Check-In'),
          icon: Activity,
        });
      }
      if (hasPermission('reports')) {
        mobileTabs.push({
          value: '/reports',
          label: t('nav.reports', 'Reports'),
          icon: BarChart3,
        });
      }
    }
    return mobileTabs;
  }, [
    isActingOnBehalf,
    hasPermission,
    hasWritePermission,
    loggingLevel,
    isAddCompOpen,
    t,
  ]);

  const handleNavigateFromAddComp = useCallback(
    (value: string) => {
      info(loggingLevel, `MainLayout: Navigating to ${value} from AddComp.`);
      navigate(value);
      setIsAddCompOpen(false);
    },
    [loggingLevel, navigate]
  );

  const gridClass = getGridClassNormal(availableTabs.length);
  const mobileGridClass = getGridClassNormal(availableMobileTabs.length);

  const location = useLocation();

  // Whether the current route is reachable for the active profile. When acting
  // on behalf, a delegate only has a subset of tabs; landing on a disallowed
  // route (e.g. staying on Diary after switching to a checkin-only profile)
  // would otherwise mount that page and fire requests that 403.
  const isCurrentPathAllowed = useMemo(() => {
    if (!isActingOnBehalf || availableTabs.length === 0) {
      return true;
    }
    const currentPath = location.pathname;
    return (
      availableTabs.some((tab) => {
        if (tab.value === '/') {
          return (
            currentPath === '/' ||
            currentPath === '/workout-playback' ||
            currentPath.startsWith('/workout-playback/')
          );
        }
        return (
          currentPath === tab.value || currentPath.startsWith(tab.value + '/')
        );
      }) ||
      currentPath === '/settings' ||
      currentPath.startsWith('/settings') ||
      currentPath === '/checkin' ||
      currentPath.startsWith('/checkin')
    );
  }, [isActingOnBehalf, availableTabs, location.pathname]);

  useEffect(() => {
    if (!isCurrentPathAllowed) {
      const fallbackTab = availableTabs[0]?.value;
      if (fallbackTab) {
        debug(
          loggingLevel,
          `MainLayout: Redirecting from unauthorized path ${location.pathname} to ${fallbackTab}`
        );
        navigate(fallbackTab, { replace: true });
      }
    }
  }, [
    isCurrentPathAllowed,
    availableTabs,
    location.pathname,
    navigate,
    loggingLevel,
  ]);

  const selectedDate = new URLSearchParams(location.search).get('date');
  const selectedDateRelation = selectedDate
    ? getDateRelationToToday(selectedDate)
    : 'today';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <BrandMark size={36} />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-slate-300">
              Ouros Life
            </h1>
            {!isMobile && (
              <>
                <GitHubStarCounter owner="CodeWithCJ" repo="SparkyFitness" />
                <GitHubSponsorButton owner="CodeWithCJ" />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <GlobalSyncButton />
            <ThemeToggle />
            <GlobalNotificationIcon />
            <UserAccountMenu />
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden sm:block mb-8">
          <div
            className={`grid ${gridClass} gap-2 p-1 bg-muted rounded-lg`}
            role="tablist"
          >
            {availableTabs.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={location.pathname === value ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'flex items-center justify-center gap-2 transition-all',
                  location.pathname === value &&
                    'bg-background text-foreground shadow-sm'
                )}
                onClick={() => navigate(value)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav
          aria-label={t('nav.ariaLabel', 'Main navigation')}
          className={cn(
            'apple-safe-area sm:hidden fixed bottom-0 left-0 right-0 z-50 w-full bg-background border-t transition-colors',
            selectedDateRelation === 'past' && 'border-date-past/80',
            selectedDateRelation === 'future' && 'border-date-future/50'
          )}
        >
          {selectedDateRelation !== 'today' && (
            <div
              className={cn(
                'absolute inset-0 pointer-events-none z-10 overflow-hidden',
                selectedDateRelation === 'past' && 'bg-date-past/10',
                selectedDateRelation === 'future' && 'bg-date-future/10'
              )}
            />
          )}
          <div
            className={`relative h-14 grid ${mobileGridClass} items-center justify-items-center`}
          >
            {availableMobileTabs.map(({ value, label, icon: Icon }) => {
              if (value === 'Add') {
                return (
                  <button
                    key={value}
                    aria-label={label}
                    onClick={() => setIsAddCompOpen((prev) => !prev)}
                    className={cn(
                      '-translate-y-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform active:scale-95',
                      isAddCompOpen && 'rotate-45'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </button>
                );
              }
              const isActive = location.pathname === value;
              return (
                <Button
                  key={value}
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  className={cn(
                    'h-10 w-14 rounded-full transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => {
                    setIsAddCompOpen(false);
                    navigate(value);
                  }}
                >
                  <Icon className="h-6 w-6" />
                </Button>
              );
            })}
          </div>
        </nav>

        <div className="pb-16 sm:pb-0">
          {/* Don't mount a disallowed page while the redirect effect runs, or it
              fires requests the active profile isn't permitted to make. */}
          {isCurrentPathAllowed ? <Outlet /> : null}
        </div>

        <SparkyChat />
      </div>

      <AddComp
        isVisible={isAddCompOpen}
        onClose={() => setIsAddCompOpen(false)}
        items={addCompItems}
        onNavigate={handleNavigateFromAddComp}
      />
    </div>
  );
};

export default MainLayout;
