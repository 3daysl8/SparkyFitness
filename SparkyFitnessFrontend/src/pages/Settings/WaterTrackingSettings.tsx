import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, Droplet } from 'lucide-react';
import WaterContainerManager from './WaterContainerManager';
import { AccordionTrigger, AccordionContent } from '@/components/ui/accordion'; // Import Accordion components
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const WaterTrackingSettings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    water_display_unit,
    saveAllPreferences,
    setWaterDisplayUnit,
    addExerciseWaterToGoal,
    setAddExerciseWaterToGoal,
    addFoodWaterToIntake,
    setAddFoodWaterToIntake,
    waterGoalMl,
    setWaterGoalMl,
  } = usePreferences();
  const [localWaterUnit, setLocalWaterUnit] = useState(water_display_unit);
  const [localWaterGoalMl, setLocalWaterGoalMl] = useState<string>(
    waterGoalMl != null ? String(waterGoalMl) : ''
  );

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setLocalWaterUnit(water_display_unit);
  }, [water_display_unit]);

  useEffect(() => {
    setLocalWaterGoalMl(waterGoalMl != null ? String(waterGoalMl) : '');
  }, [waterGoalMl]);

  const handlePreferencesUpdate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const trimmedGoal = localWaterGoalMl.trim();
      const parsedGoal = trimmedGoal === '' ? NaN : Number(trimmedGoal);
      const nextWaterGoalMl =
        trimmedGoal !== '' && !isNaN(parsedGoal) && parsedGoal > 0
          ? parsedGoal
          : null;
      await saveAllPreferences({
        water_display_unit: localWaterUnit,
        waterGoalMl: nextWaterGoalMl,
      }); // Pass the new logging level directly
      setWaterDisplayUnit(localWaterUnit);
      setWaterGoalMl(nextWaterGoalMl);

      toast({
        title: t('settings.preferences.successTitle', 'Erfolg'),
        description: t(
          'settings.preferences.successDescription',
          'Preferences saved.'
        ),
      });
    } catch (error: unknown) {
      console.error('Error updating preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AccordionTrigger
        className="flex items-center gap-2 p-4 hover:no-underline"
        description={t(
          'settings.waterTracking.description',
          'Configure your water intake tracking settings'
        )}
      >
        <Droplet className="h-5 w-5 text-muted-foreground" />
        {t('settings.waterTracking.title', 'Water Tracking')}
      </AccordionTrigger>
      <AccordionContent className="p-4 pt-0 space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="water_display_unit">
            {t('settings.waterTracking.waterDisplayUnit', 'Water Display Unit')}
          </Label>
          <Select
            value={localWaterUnit}
            onValueChange={(unit: 'ml' | 'oz' | 'liter') =>
              setLocalWaterUnit(unit)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ml">
                {t('settings.waterTracking.milliliters', 'Milliliters (ml)')}
              </SelectItem>
              <SelectItem value="oz">
                {t('settings.waterTracking.fluidOunces', 'Fluid Ounces (oz)')}
              </SelectItem>
              <SelectItem value="liter">
                {t('settings.waterTracking.liters', 'Liters')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="water_goal_ml">
            {t(
              'settings.waterTracking.dailyWaterGoal',
              'Daily Water Goal (ml)'
            )}
          </Label>
          <Input
            id="water_goal_ml"
            type="number"
            min={0}
            step="10"
            placeholder={t(
              'settings.waterTracking.dailyWaterGoalPlaceholder',
              'Default (1920 ml)'
            )}
            value={localWaterGoalMl}
            onChange={(e) => setLocalWaterGoalMl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {t(
              'settings.waterTracking.dailyWaterGoalHint',
              "Leave blank to use the default 1920 ml goal. This drives Home's water quick-log target."
            )}
          </p>
        </div>
        <Button onClick={handlePreferencesUpdate} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading
            ? t('settings.profileInformation.saving', 'Saving...')
            : t(
                'settings.waterTracking.saveWaterSettings',
                'Save Water Settings'
              )}
        </Button>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="add-exercise-water-to-goal">
              {t(
                'settings.waterTracking.addExerciseWater',
                'Add exercise water loss to daily goal'
              )}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.waterTracking.addExerciseWaterHint',
                'Increases your daily water goal by the estimated sweat loss from activities.'
              )}
            </p>
          </div>
          <Switch
            id="add-exercise-water-to-goal"
            checked={addExerciseWaterToGoal}
            onCheckedChange={(checked) => {
              setAddExerciseWaterToGoal(checked);
              saveAllPreferences({ addExerciseWaterToGoal: checked });
            }}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="add-food-water-to-intake">
              {t(
                'settings.waterTracking.addFoodWater',
                'Count water from food toward your intake'
              )}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.waterTracking.addFoodWaterHint',
                "Folds a logged food's water content into your daily water total, unless it's already counted by a linked container."
              )}
            </p>
          </div>
          <Switch
            id="add-food-water-to-intake"
            checked={addFoodWaterToIntake}
            onCheckedChange={(checked) => {
              setAddFoodWaterToIntake(checked);
              saveAllPreferences({ addFoodWaterToIntake: checked });
            }}
          />
        </div>
        <Separator />
        <WaterContainerManager />
      </AccordionContent>
    </>
  );
};
