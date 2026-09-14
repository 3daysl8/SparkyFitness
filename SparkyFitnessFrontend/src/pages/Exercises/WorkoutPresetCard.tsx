import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Edit,
  Trash2,
  CopyPlus,
  CalendarPlus,
  MoreHorizontal,
  Layers,
  Dumbbell,
  Clock,
} from 'lucide-react';
import type { WorkoutPreset } from '@/types/workout';
import { formatWeight } from '@/utils/numberFormatting';
import type { WeightUnit } from '@/contexts/PreferencesContext';

// Rough, clearly-labeled estimate (not a precision figure): a fixed per-set
// working time plus each set's actual rest_time (defaulting to the app's
// standard 90s when unset), rounded to the nearest 5 minutes for display.
const ESTIMATED_SECONDS_PER_SET_WORK = 30;
const DEFAULT_REST_SECONDS_FOR_ESTIMATE = 90;

function estimateDurationMinutes(preset: WorkoutPreset): number {
  const totalSeconds =
    preset.exercises?.reduce((sum, exercise) => {
      const exerciseSeconds =
        exercise.sets?.reduce((setSum, set) => {
          const rest = set.rest_time ?? DEFAULT_REST_SECONDS_FOR_ESTIMATE;
          return setSum + ESTIMATED_SECONDS_PER_SET_WORK + rest;
        }, 0) ?? 0;
      return sum + exerciseSeconds;
    }, 0) ?? 0;
  return Math.max(5, Math.round(totalSeconds / 60 / 5) * 5);
}

interface WorkoutPresetCardProps {
  preset: WorkoutPreset;
  isOwned: boolean;
  weightUnit: WeightUnit;
  onStart: () => void;
  onLogToDiary: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const WorkoutPresetCard = ({
  preset,
  isOwned,
  weightUnit,
  onStart,
  onLogToDiary,
  onDuplicate,
  onEdit,
  onDelete,
}: WorkoutPresetCardProps) => {
  const { t } = useTranslation();
  const exerciseCount = preset.exercises?.length ?? 0;
  const totalSets =
    preset.exercises?.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0) ?? 0;
  const totalVolume =
    preset.exercises?.reduce((sum, ex) => {
      const vol =
        ex.sets?.reduce(
          (s, set) => s + (set.weight ?? 0) * (set.reps ?? 0),
          0
        ) ?? 0;
      return sum + vol;
    }, 0) ?? 0;
  const estimatedMinutes = estimateDurationMinutes(preset);

  return (
    <Card className="relative flex flex-col transition-colors">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{preset.name}</h3>
            {preset.description && (
              <p className="text-xs text-muted-foreground truncate">
                {preset.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
                <span className="sr-only">
                  {t('common.actions', 'Actions')}
                </span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {t('common.actions', 'Actions')}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={onLogToDiary}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                {t('workoutPresetsManager.logToDiary', 'Log to Diary')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <CopyPlus className="mr-2 h-4 w-4" />
                {t('workoutPresetsManager.duplicate', 'Duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!isOwned} onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                {t('common.edit', 'Edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!isOwned}
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.delete', 'Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {t('workoutPresetsManager.exerciseCount', '{{count}} exercises', {
              count: exerciseCount,
            })}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>{totalSets} sets</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>~{estimatedMinutes} min</span>
          </div>
          {totalVolume > 0 && (
            <div className="flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5 text-indigo-500" />
              <span>{formatWeight(totalVolume, weightUnit)}</span>
            </div>
          )}
        </div>

        <Button className="mt-auto w-full gap-2" onClick={onStart} size="sm">
          <Play className="h-4 w-4" />
          {t('workoutPresetsManager.startWorkout', 'Start Workout')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WorkoutPresetCard;
