import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Heart, Bell, CheckCircle2 } from 'lucide-react';
import { useCycleSettings, useCycleActive } from '@/hooks/useCycle';
import { useToast } from '@/hooks/use-toast';

export const CycleTrackingSettings: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isFemale } = useCycleActive();
  const { settings, updateSettings, isUpdating } = useCycleSettings();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [avgCycleLength, setAvgCycleLength] = useState(
    String(settings.avg_cycle_length || 28)
  );
  const [avgPeriodLength, setAvgPeriodLength] = useState(
    String(settings.avg_period_length || 5)
  );
  const [lastPeriodStartDate, setLastPeriodStartDate] = useState(
    settings.last_period_start_date || ''
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    settings.reminders_enabled ?? true
  );

  const handleSave = () => {
    const cycleLen = Math.max(
      21,
      Math.min(45, parseInt(avgCycleLength, 10) || 28)
    );
    const periodLen = Math.max(
      2,
      Math.min(10, parseInt(avgPeriodLength, 10) || 5)
    );

    updateSettings({
      enabled,
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      last_period_start_date:
        lastPeriodStartDate || new Date().toISOString().split('T')[0],
      reminders_enabled: remindersEnabled,
    });

    toast({
      title: t('settings.cycle.savedTitle', 'Cycle Settings Saved'),
      description: t(
        'settings.cycle.savedDesc',
        'Your cycle parameters and prediction rules have been updated.'
      ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-950/30 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <CardTitle>
              {t('settings.cycle.title', 'Menstrual Cycle & Phase Tracking')}
            </CardTitle>
            <CardDescription>
              {t(
                'settings.cycle.description',
                'Configure cycle lengths, period start date, and phase-adapted training recommendations.'
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enable / Disable Switch */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              {t(
                'settings.cycle.enableFeature',
                'Enable Menstrual Cycle Tracking'
              )}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isFemale
                ? t(
                    'settings.cycle.autoEnabledForFemale',
                    'Recommended for female profiles. Displays phase insights and period predictions on your dashboard.'
                  )
                : t(
                    'settings.cycle.manualEnable',
                    'Enables cycle phase cards and daily period tracking.'
                  )}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Average Cycle Length */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="avg_cycle_len"
                  className="text-xs font-semibold"
                >
                  {t(
                    'settings.cycle.avgCycleLength',
                    'Average Cycle Length (Days)'
                  )}
                </Label>
                <Input
                  id="avg_cycle_len"
                  type="number"
                  min="21"
                  max="45"
                  value={avgCycleLength}
                  onChange={(e) => setAvgCycleLength(e.target.value)}
                  placeholder="28"
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'settings.cycle.avgCycleHelp',
                    'Typically 28 days (normal range: 21–35 days).'
                  )}
                </p>
              </div>

              {/* Average Period Length */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="avg_period_len"
                  className="text-xs font-semibold"
                >
                  {t(
                    'settings.cycle.avgPeriodLength',
                    'Average Period Duration (Days)'
                  )}
                </Label>
                <Input
                  id="avg_period_len"
                  type="number"
                  min="2"
                  max="10"
                  value={avgPeriodLength}
                  onChange={(e) => setAvgPeriodLength(e.target.value)}
                  placeholder="5"
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'settings.cycle.avgPeriodHelp',
                    'Typically 4–6 days of bleeding/flow.'
                  )}
                </p>
              </div>
            </div>

            {/* Last Period Start Date */}
            <div className="space-y-1.5">
              <Label
                htmlFor="last_period_date"
                className="text-xs font-semibold"
              >
                {t(
                  'settings.cycle.lastPeriodDate',
                  'Most Recent Period Start Date'
                )}
              </Label>
              <Input
                id="last_period_date"
                type="date"
                value={lastPeriodStartDate}
                onChange={(e) => setLastPeriodStartDate(e.target.value)}
                className="text-xs max-w-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t(
                  'settings.cycle.lastPeriodHelp',
                  'First day of your last period. Used to determine current cycle day and predict future phases.'
                )}
              </p>
            </div>

            {/* Reminders Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    {t(
                      'settings.cycle.reminders',
                      'Upcoming Period & Ovulation Alerts'
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'settings.cycle.remindersHelp',
                    'Receive a gentle notification 2 days before your predicted period.'
                  )}
                </p>
              </div>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={setRemindersEnabled}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            size="sm"
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isUpdating
              ? t('common.saving', 'Saving...')
              : t('common.saveChanges', 'Save Changes')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CycleTrackingSettings;
