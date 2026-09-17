import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Vibrate,
  Clock,
  Sparkles,
  Dumbbell,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  getNotificationPermission,
  requestNotificationPermission,
  isSupplementReminderEnabled,
  setSupplementReminderEnabled,
  isCheckInReminderEnabled,
  setCheckInReminderEnabled,
  getCheckInReminderTime,
  setCheckInReminderTime,
  isWorkoutReminderEnabled,
  setWorkoutReminderEnabled,
  isFastingReminderEnabled,
  setFastingReminderEnabled,
  showWebNotification,
  type WebNotificationPermission,
} from '@/utils/reminderUtils';
import {
  isRestTimerAudioEnabled,
  setRestTimerAudioEnabled,
  isRestTimerVibrationEnabled,
  setRestTimerVibrationEnabled,
  playRestTimerChime,
} from '@/utils/audioFeedback';

export const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();

  const [permission, setPermission] = useState<WebNotificationPermission>(() =>
    getNotificationPermission()
  );
  const [supplementsEnabled, setSupplementsEnabled] = useState(() =>
    isSupplementReminderEnabled()
  );
  const [checkInEnabled, setCheckInEnabled] = useState(() =>
    isCheckInReminderEnabled()
  );
  const [checkInTime, setCheckInTimeState] = useState(() =>
    getCheckInReminderTime()
  );
  const [workoutEnabled, setWorkoutEnabled] = useState(() =>
    isWorkoutReminderEnabled()
  );
  const [fastingEnabled, setFastingEnabled] = useState(() =>
    isFastingReminderEnabled()
  );
  const [audioEnabled, setAudioEnabled] = useState(() =>
    isRestTimerAudioEnabled()
  );
  const [vibrationEnabled, setVibrationEnabled] = useState(() =>
    isRestTimerVibrationEnabled()
  );

  const handleRequestPermission = async () => {
    const nextPerm = await requestNotificationPermission();
    setPermission(nextPerm);
    if (nextPerm === 'granted') {
      showWebNotification(
        t('settings.notifications.welcomeTitle', 'Notifications Active'),
        {
          body: t(
            'settings.notifications.welcomeBody',
            'You will receive reminders for scheduled supplement protocols and daily checkpoints.'
          ),
        }
      );
    }
  };

  const handleSupplementsChange = (val: boolean) => {
    setSupplementsEnabled(val);
    setSupplementReminderEnabled(val);
  };

  const handleCheckInChange = (val: boolean) => {
    setCheckInEnabled(val);
    setCheckInReminderEnabled(val);
  };

  const handleCheckInTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCheckInTimeState(val);
    setCheckInReminderTime(val);
  };

  const handleWorkoutChange = (val: boolean) => {
    setWorkoutEnabled(val);
    setWorkoutReminderEnabled(val);
  };

  const handleFastingChange = (val: boolean) => {
    setFastingEnabled(val);
    setFastingReminderEnabled(val);
  };

  const handleAudioChange = (val: boolean) => {
    setAudioEnabled(val);
    setRestTimerAudioEnabled(val);
    if (val) {
      playRestTimerChime();
    }
  };

  const handleVibrationChange = (val: boolean) => {
    setVibrationEnabled(val);
    setRestTimerVibrationEnabled(val);
  };

  return (
    <div className="space-y-6">
      {/* System / Browser Permission Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                {t(
                  'settings.notifications.permissionTitle',
                  'Browser & Device Notifications'
                )}
              </CardTitle>
            </div>
            {permission === 'granted' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('settings.notifications.granted', 'Active / Granted')}
              </span>
            ) : permission === 'denied' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('settings.notifications.denied', 'Blocked by Browser')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t('settings.notifications.notSet', 'Not Configured')}
              </span>
            )}
          </div>
          <CardDescription>
            {t(
              'settings.notifications.permissionDesc',
              'Enable system notifications to receive timely alerts for multi-dose supplement protocols, daily check-ins, and fasting timers.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {permission !== 'granted' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {t(
                    'settings.notifications.enablePrompts',
                    'Enable System Notifications'
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {permission === 'denied'
                    ? t(
                        'settings.notifications.unblockHint',
                        'Notifications are blocked in your browser settings. Click the lock/site icon in the address bar to allow.'
                      )
                    : t(
                        'settings.notifications.promptHint',
                        'Grant permission so Ouros Life can alert you at your scheduled times.'
                      )}
                </p>
              </div>
              {permission !== 'denied' && (
                <Button
                  size="sm"
                  onClick={handleRequestPermission}
                  className="rounded-full shrink-0"
                >
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  {t('settings.notifications.allowBtn', 'Allow Notifications')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Routine & Protocol Reminders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t(
              'settings.notifications.protocolsTitle',
              'Protocols & Routine Reminders'
            )}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.notifications.protocolsDesc',
              'Configure alerts for daily supplements, scheduled workouts, and reflection checkpoints.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 divide-y">
          {/* Supplements */}
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                {t(
                  'settings.notifications.supplements',
                  'Scheduled Supplement & Medication Doses'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.supplementsDesc',
                  'Receive alerts at morning, afternoon, and evening dose times for your active protocols.'
                )}
              </p>
            </div>
            <Switch
              checked={supplementsEnabled}
              onCheckedChange={handleSupplementsChange}
            />
          </div>

          {/* Daily Check-In */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-primary" />
                {t(
                  'settings.notifications.checkin',
                  'Evening Daily Check-In Reminder'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.checkinDesc',
                  'Reminds you to log daily wellness, body metrics, and mood reflections.'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="time"
                  value={checkInTime}
                  onChange={handleCheckInTimeChange}
                  disabled={!checkInEnabled}
                  className="w-28 h-8 text-xs"
                />
              </div>
              <Switch
                checked={checkInEnabled}
                onCheckedChange={handleCheckInChange}
              />
            </div>
          </div>

          {/* Workouts */}
          <div className="flex items-center justify-between pt-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Dumbbell className="h-4 w-4 text-blue-500" />
                {t(
                  'settings.notifications.workouts',
                  'Scheduled Workout Reminders'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.workoutsDesc',
                  'Alerts for scheduled training sessions on planned workout days.'
                )}
              </p>
            </div>
            <Switch
              checked={workoutEnabled}
              onCheckedChange={handleWorkoutChange}
            />
          </div>

          {/* Fasting */}
          <div className="flex items-center justify-between pt-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-amber-500" />
                {t(
                  'settings.notifications.fasting',
                  'Fasting Window Completion'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.fastingDesc',
                  'Alert when your intermittent or medication fasting window finishes.'
                )}
              </p>
            </div>
            <Switch
              checked={fastingEnabled}
              onCheckedChange={handleFastingChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audio & Haptic Feedback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t(
              'settings.notifications.feedbackTitle',
              'Sound & Timer Feedback'
            )}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.notifications.feedbackDesc',
              'Audio chimes and vibration cues for active workout rest intervals and countdowns.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 divide-y">
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Volume2 className="h-4 w-4 text-primary" />
                {t(
                  'settings.notifications.restChime',
                  'Rest Timer Chimes & Fanfare'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.restChimeDesc',
                  'Synthesized harmonic chime when a rest interval completes during workouts.'
                )}
              </p>
            </div>
            <Switch
              checked={audioEnabled}
              onCheckedChange={handleAudioChange}
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Vibrate className="h-4 w-4 text-purple-500" />
                {t(
                  'settings.notifications.vibration',
                  'Haptic Vibration Feedback'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.notifications.vibrationDesc',
                  'Vibrate mobile / supported devices on timer completion.'
                )}
              </p>
            </div>
            <Switch
              checked={vibrationEnabled}
              onCheckedChange={handleVibrationChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
