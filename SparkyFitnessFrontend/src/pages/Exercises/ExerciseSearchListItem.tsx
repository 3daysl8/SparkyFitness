import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EXERCISE_CATEGORY_META } from '@/constants/exercises';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Exercise } from '@/types/exercises';
import { getEnergyUnitString } from '@/utils/nutritionCalculations';
import {
  resolveExerciseImageSrc,
  filterValidExerciseImages,
} from '@/utils/exercises';
import {
  Share2,
  Users,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ElementType, useState } from 'react';

type ExerciseCategory = keyof typeof EXERCISE_CATEGORY_META;

interface ExerciseListItemProps {
  exercise: Exercise;
  onAction: (exercise: Exercise) => void | Promise<void>;
  actionText: string;
  actionIcon?: ElementType;
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  wger: {
    label: 'Wger',
    className: 'bg-surface-2 text-muted-foreground',
  },
  'free-exercise-db': {
    label: 'Free DB',
    className: 'bg-surface-2 text-muted-foreground',
  },
  nutritionix: {
    label: 'Nutritionix',
    className: 'bg-surface-2 text-muted-foreground',
  },
};

export const ExerciseSearchListItem = ({
  exercise,
  onAction,
  actionText,
  actionIcon: ActionIcon,
}: ExerciseListItemProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isActioning, setIsActioning] = useState(false);
  const { energyUnit, convertEnergy } = usePreferences();
  const [imageError, setImageError] = useState(false);
  const validImages = filterValidExerciseImages(exercise.images);
  const imageCount = validImages.length;
  const handleNextImage = () =>
    setCurrentImageIndex((prev) => (prev + 1) % (imageCount || 1));
  const handlePrevImage = () =>
    setCurrentImageIndex(
      (prev) => (prev - 1 + (imageCount || 1)) % (imageCount || 1)
    );

  const handleSpeak = () => {
    if (window.speechSynthesis?.speak) {
      const text = Array.isArray(exercise.instructions)
        ? exercise.instructions.join('. ')
        : (exercise.instructions ?? '');
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  const handleAction = async () => {
    setIsActioning(true);
    try {
      await onAction(exercise);
    } finally {
      setIsActioning(false);
    }
  };

  const meta =
    EXERCISE_CATEGORY_META[exercise.category as ExerciseCategory] ??
    EXERCISE_CATEGORY_META['general'];
  const CategoryIcon = meta.icon;

  const sourceBadge = exercise.source ? SOURCE_BADGES[exercise.source] : null;

  const metaPills: string[] = [];
  if (exercise.level) metaPills.push(exercise.level);
  if (exercise.force) metaPills.push(exercise.force);
  if (exercise.mechanic) metaPills.push(exercise.mechanic);

  const hasImage = imageCount > 0;
  const showFallback = !hasImage || imageError;
  const safeImageIndex = imageCount > 0 ? currentImageIndex % imageCount : 0;

  return (
    <div className="group flex gap-3 p-3 rounded-lg bg-card border border-border hover:bg-surface-2 transition-colors">
      {/* Category icon or image thumbnail */}
      {hasImage && !showFallback ? (
        <div className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden ring-1 ring-border bg-surface-2">
          <img
            src={resolveExerciseImageSrc(validImages[safeImageIndex])}
            alt={exercise.name}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
          {imageCount > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-0.5">
              <button
                onClick={handlePrevImage}
                className="text-white bg-black/40 hover:bg-black/60 rounded p-0.5 transition-colors"
              >
                <ChevronLeft className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={handleNextImage}
                className="text-white bg-black/40 hover:bg-black/60 rounded p-0.5 transition-colors"
              >
                <ChevronRight className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg}`}
        >
          <CategoryIcon className={`w-4 h-4 ${meta.color}`} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="font-semibold text-sm text-foreground leading-tight">
            {exercise.name}
          </span>
          {sourceBadge && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sourceBadge.className}`}
            >
              {sourceBadge.label}
            </span>
          )}
          {exercise.tags?.map((tag: string) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 gap-0.5"
            >
              {tag === 'public' && <Share2 className="h-2.5 w-2.5" />}
              {tag === 'family' && <Users className="h-2.5 w-2.5" />}
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </Badge>
          ))}
        </div>

        {/* Category + calories row */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
          {exercise.category && (
            <span className="capitalize">{exercise.category}</span>
          )}
          {exercise.calories_per_hour ? (
            <>
              <span>·</span>
              <span className="text-metric-workout font-medium">
                {Math.round(
                  convertEnergy(exercise.calories_per_hour, 'kcal', energyUnit)
                )}{' '}
                {getEnergyUnitString(energyUnit)}/hr
              </span>
            </>
          ) : null}
        </div>

        {/* Meta pills */}
        {metaPills.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-1">
            {metaPills.map((pill) => (
              <span
                key={pill}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground capitalize"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        {/* Muscles + equipment */}
        {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
          <div className="text-[10px] text-muted-foreground leading-snug">
            <span className="font-medium">Primary: </span>
            {exercise.primary_muscles.join(', ')}
          </div>
        )}
        {exercise.secondary_muscles &&
          exercise.secondary_muscles.length > 0 && (
            <div className="text-[10px] text-muted-foreground leading-snug">
              <span className="font-medium">Secondary: </span>
              {exercise.secondary_muscles.join(', ')}
            </div>
          )}
        {exercise.equipment && exercise.equipment.length > 0 && (
          <div className="text-[10px] text-muted-foreground leading-snug">
            <span className="font-medium">Equipment: </span>
            {exercise.equipment.join(', ')}
          </div>
        )}

        {/* Description */}
        {exercise.description && (
          <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
            {exercise.description}
          </div>
        )}

        {/* Instructions (first line + speak) */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-muted-foreground line-clamp-1 flex-1">
              {exercise.instructions[0]}
            </span>
            <button
              onClick={handleSpeak}
              className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface-2 transition-colors"
              title="Read instructions aloud"
            >
              <Volume2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="flex-shrink-0 self-center">
        <Button
          onClick={handleAction}
          disabled={isActioning}
          size="sm"
          className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
        >
          {isActioning ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            ActionIcon && <ActionIcon className="h-3.5 w-3.5" />
          )}
          {actionText}
        </Button>
      </div>
    </div>
  );
};
