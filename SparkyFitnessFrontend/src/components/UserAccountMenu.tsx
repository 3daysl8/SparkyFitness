import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import {
  User,
  KeyRound,
  Heart,
  Settings as SettingsIcon,
  Users,
  Shield,
  LogOut,
  Loader2,
  Check,
} from 'lucide-react';

export const UserAccountMenu: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    activeUserId,
    activeUserName,
    isActingOnBehalf,
    accessibleUsers,
    switchToUser,
  } = useActiveUser();

  const [isSwitching, setIsSwitching] = useState(false);

  if (!user) return null;

  const getInitials = (name?: string | null, email?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(/\s+/);
      const first = parts[0];
      const second = parts[1];
      if (parts.length >= 2 && first && second) {
        return `${first[0]}${second[0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleSwitchUser = async (targetUserId: string) => {
    setIsSwitching(true);
    try {
      await switchToUser(targetUserId);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Switchable users for family access
  const switchableUsers = accessibleUsers.filter((accessibleUser) => {
    const permissions = accessibleUser.permissions;
    if (!permissions || typeof permissions !== 'object') return true;
    const hasOnlyFoodList =
      permissions.food_list &&
      !permissions.calorie &&
      !permissions.checkin &&
      !permissions.reports &&
      !permissions.diary;
    return !hasOnlyFoodList;
  });

  const initials = getInitials(activeUserName || user.fullName, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 px-2 gap-2 rounded-full hover:bg-accent focus-visible:ring-1"
          aria-label={t('nav.userMenu', 'User account menu')}
        >
          <Avatar className="h-7 w-7 border border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {isSwitching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium max-w-[120px] truncate hidden md:inline">
            {activeUserName || user.fullName || user.email}
          </span>
          {isActingOnBehalf && (
            <span
              className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background"
              title="Acting on behalf of family member"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">
              {activeUserName || user.fullName || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Profile & Security */}
        <DropdownMenuItem
          onClick={() =>
            navigate(
              '/settings?tab=profile-account&section=profile-information'
            )
          }
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{t('userMenu.profileInfo', 'Profile & Info')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            navigate('/settings?tab=profile-account&section=account-security')
          }
          className="cursor-pointer"
        >
          <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{t('userMenu.loginSecurity', 'Login & Passkeys')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => navigate('/settings?tab=wellness')}
          className="cursor-pointer"
        >
          <Heart className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{t('userMenu.wellness', 'Wellness & Tracking')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => navigate('/settings?tab=developer-integrations')}
          className="cursor-pointer"
        >
          <SettingsIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>
            {t('userMenu.developerIntegrations', 'Developer & Integrations')}
          </span>
        </DropdownMenuItem>

        {user.role === 'admin' && (
          <DropdownMenuItem
            onClick={() => navigate('/admin')}
            className="cursor-pointer"
          >
            <Shield className="mr-2 h-4 w-4 text-primary" />
            <span className="font-medium text-primary">
              {t('userMenu.adminDashboard', 'Admin Dashboard')}
            </span>
          </DropdownMenuItem>
        )}

        {/* Family Member Switcher (if available) */}
        {switchableUsers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('userMenu.familyProfiles', 'Family Profiles')}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleSwitchUser(user.id)}
              className="cursor-pointer justify-between"
            >
              <span>{t('userMenu.myProfile', 'My Profile')}</span>
              {!isActingOnBehalf && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
            {switchableUsers.map((accessibleUser) => {
              const isSelected = activeUserId === accessibleUser.user_id;
              return (
                <DropdownMenuItem
                  key={accessibleUser.user_id}
                  onClick={() => handleSwitchUser(accessibleUser.user_id)}
                  className="cursor-pointer justify-between"
                >
                  <span className="truncate">
                    {accessibleUser.full_name || accessibleUser.email}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('common.signOut', 'Sign Out')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAccountMenu;
