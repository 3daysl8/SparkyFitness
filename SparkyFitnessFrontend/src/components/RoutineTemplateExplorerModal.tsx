import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Search,
  Sparkles,
  Zap,
  Plus,
  Edit,
  Clock,
  Dumbbell,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
} from 'lucide-react';
import {
  ROUTINE_CATEGORIES,
  ROUTINE_TEMPLATES,
  RoutineTemplate,
  RoutineTemplateCategory,
  convertTemplateToWorkoutPreset,
} from '@/constants/routineTemplates';
import type { WorkoutPreset } from '@/types/workout';
import type { Exercise } from '@/types/exercises';

interface RoutineTemplateExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToMyRoutines: (
    presetData: Omit<WorkoutPreset, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<void>;
  onStartWorkout: (
    presetData: Omit<WorkoutPreset, 'id' | 'created_at' | 'updated_at'>
  ) => void;
  onCustomize: (
    presetData: Omit<WorkoutPreset, 'id' | 'created_at' | 'updated_at'>
  ) => void;
  existingExercises?: Exercise[];
  userId?: string;
}

export const RoutineTemplateExplorerModal: React.FC<
  RoutineTemplateExplorerModalProps
> = ({
  isOpen,
  onClose,
  onAddToMyRoutines,
  onStartWorkout,
  onCustomize,
  existingExercises,
  userId = 'default-user',
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<RoutineTemplateCategory>('all');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(
    null
  );
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [addedTemplateIds, setAddedTemplateIds] = useState<Set<string>>(
    new Set()
  );

  const filteredTemplates = useMemo(() => {
    return ROUTINE_TEMPLATES.filter((tpl) => {
      const matchesCategory =
        selectedCategory === 'all' || tpl.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const title = t(tpl.titleKey, tpl.defaultTitle).toLowerCase();
      const desc = t(tpl.descriptionKey, tpl.defaultDescription).toLowerCase();
      const musclesMatch = tpl.primaryMuscles.some((m) =>
        m.toLowerCase().includes(term)
      );
      const exercisesMatch = tpl.exercises.some((e) =>
        e.name.toLowerCase().includes(term)
      );

      return (
        title.includes(term) ||
        desc.includes(term) ||
        musclesMatch ||
        exercisesMatch
      );
    });
  }, [selectedCategory, searchTerm, t]);

  const handleAdd = async (template: RoutineTemplate) => {
    try {
      setSavingTemplateId(template.id);
      const presetData = convertTemplateToWorkoutPreset(
        template,
        userId,
        existingExercises
      );
      await onAddToMyRoutines(presetData);
      setAddedTemplateIds((prev) => new Set(prev).add(template.id));
    } finally {
      setSavingTemplateId(null);
    }
  };

  const handleStartNow = (template: RoutineTemplate) => {
    const presetData = convertTemplateToWorkoutPreset(
      template,
      userId,
      existingExercises
    );
    onStartWorkout(presetData);
    onClose();
  };

  const handleCustomizeClick = (template: RoutineTemplate) => {
    const presetData = convertTemplateToWorkoutPreset(
      template,
      userId,
      existingExercises
    );
    onCustomize(presetData);
    onClose();
  };

  const getDifficultyBadgeColor = (
    difficulty: RoutineTemplate['difficulty']
  ) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'Intermediate':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'Advanced':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[950px] max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden w-full">
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/20">
          <DialogHeader className="gap-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                  {t('routineTemplates.modalTitle', 'Routine Template Library')}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t(
                    'routineTemplates.modalSubtitle',
                    'Explore proven training splits and strength routines. Add to your routines or start immediately.'
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search Bar */}
          <div className="relative mt-3 sm:mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t(
                'routineTemplates.searchPlaceholder',
                'Search routines by name, exercise, or muscle group...'
              )}
              className="pl-9 bg-background text-sm"
            />
          </div>

          {/* Category Filter Pills - Flex-wrap to ensure pills never drop off screen on mobile */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-1">
            {ROUTINE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {t(cat.labelKey, cat.defaultLabel)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Template List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground/50 animate-pulse" />
              <p className="text-base font-medium text-foreground">
                {t('routineTemplates.noResultsFound', 'No routines found')}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t(
                  'routineTemplates.noResultsFoundDesc',
                  'Try searching for another exercise name or select a different category filter.'
                )}
              </p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isExpanded = expandedTemplateId === template.id;
              const isAdded = addedTemplateIds.has(template.id);
              const isSaving = savingTemplateId === template.id;
              const totalSetsCount = template.exercises.reduce(
                (sum, ex) => sum + ex.sets.length,
                0
              );

              return (
                <Card
                  key={template.id}
                  className="border shadow-sm hover:border-primary/40 transition-colors overflow-hidden"
                >
                  <CardHeader className="p-4 sm:p-6 pb-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base sm:text-lg font-semibold break-words">
                            {t(template.titleKey, template.defaultTitle)}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[11px] ${getDifficultyBadgeColor(
                              template.difficulty
                            )}`}
                          >
                            {t(
                              `routineTemplates.difficulty.${template.difficulty.toLowerCase()}`,
                              template.difficulty
                            )}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs sm:text-sm">
                          {t(
                            template.descriptionKey,
                            template.defaultDescription
                          )}
                        </CardDescription>
                      </div>

                      {/* Action Buttons: Responsive grid on mobile, inline on desktop */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                        <Button
                          size="sm"
                          onClick={() => handleStartNow(template)}
                          className="gap-1.5 font-medium shadow-sm w-full sm:w-auto h-9 sm:h-8"
                        >
                          <Zap className="h-3.5 w-3.5 fill-current shrink-0" />
                          {t('routineTemplates.startWorkout', 'Start Now')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving || isAdded}
                          onClick={() => handleAdd(template)}
                          className="gap-1.5 w-full sm:w-auto h-9 sm:h-8"
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              {t('routineTemplates.added', 'Added')}
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 shrink-0" />
                              {t(
                                'routineTemplates.addToRoutines',
                                'Add Routine'
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Meta info chips - wrapped with gap-y to prevent edge clipping */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />~
                        {template.estimatedDurationMin} min
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                        {template.exercises.length}{' '}
                        {t('routineTemplates.exercises', 'exercises')} (
                        {totalSetsCount} {t('routineTemplates.sets', 'sets')})
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground/80 whitespace-nowrap">
                        <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        {template.targetSplit}
                      </span>
                    </div>

                    {/* Muscle pills - flex-wrap to stay completely within card on any screen */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {template.primaryMuscles.map((muscle) => (
                        <span
                          key={muscle}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-secondary text-secondary-foreground whitespace-nowrap"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 pt-0 pb-4">
                    {/* Collapsible Exercise Preview Toggle */}
                    <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedTemplateId(isExpanded ? null : template.id)
                        }
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            {t(
                              'routineTemplates.hideExercises',
                              'Hide exercise list'
                            )}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            {t(
                              'routineTemplates.viewExercises',
                              'Preview exercises & sets'
                            )}{' '}
                            ({template.exercises.length})
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCustomizeClick(template)}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                      >
                        <Edit className="h-3 w-3" />
                        {t(
                          'routineTemplates.customize',
                          'Customize in Builder'
                        )}
                      </Button>
                    </div>

                    {/* Expanded Exercise Table */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2 border rounded-lg p-3 bg-muted/20 text-xs">
                        {template.exercises.map((exercise, exIndex) => (
                          <div
                            key={`${exercise.name}-${exIndex}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b last:border-0 gap-1 sm:gap-2"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-muted-foreground w-4 sm:w-5 text-right shrink-0">
                                {exIndex + 1}.
                              </span>
                              <span className="font-medium text-foreground break-words">
                                {exercise.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 shrink-0"
                              >
                                {exercise.equipment}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 pl-5 sm:pl-0 text-muted-foreground text-[11px] sm:text-xs">
                              <span className="whitespace-nowrap">
                                {exercise.sets.length} sets ×{' '}
                                {exercise.sets[0]?.reps || 10} reps
                              </span>
                              <span>•</span>
                              <span className="whitespace-nowrap">
                                {exercise.sets[0]?.rest_time || 90}s rest
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
