import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Trash2,
  CalendarDays,
  CheckSquare,
  X,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { error } from '@/utils/logging';
import type { WorkoutPlanTemplate } from '@/types/workout';
import AddWorkoutPlanDialog from './AddWorkoutPlanDialog';
import {
  useUpdateWorkoutPlanTemplateMutation,
  useDeleteWorkoutPlanTemplateMutation,
  useWorkoutPlanTemplates,
} from '@/hooks/Exercises/useWorkoutPlans';

interface ManageSchedulesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Lists every training schedule (active or not) so one can be activated,
// edited, or retired — the Active Training Schedule card only ever shows
// the single currently-active one, so this is the only place to reach the
// others.
const ManageSchedulesDialog = ({
  isOpen,
  onOpenChange,
}: ManageSchedulesDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { loggingLevel } = usePreferences();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlanTemplate | null>(
    null
  );

  const { data: plans } = useWorkoutPlanTemplates(user?.id);
  const { mutateAsync: updateWorkoutPlanTemplate } =
    useUpdateWorkoutPlanTemplateMutation();
  const { mutateAsync: deleteWorkoutPlanTemplate } =
    useDeleteWorkoutPlanTemplateMutation();

  const handleUpdatePlan = async (
    planId: string,
    updatedPlanData: Partial<WorkoutPlanTemplate>
  ) => {
    if (!user?.id) return;
    try {
      await updateWorkoutPlanTemplate({ id: planId, data: updatedPlanData });
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
    } catch (err) {
      error(loggingLevel, 'Error updating workout plan:', err);
    }
  };

  const handleDeletePlan = React.useCallback(
    async (planId: string) => {
      if (!user?.id) return;
      try {
        await deleteWorkoutPlanTemplate(planId);
      } catch (err) {
        error(loggingLevel, 'Error deleting workout plan:', err);
      }
    },
    [user?.id, deleteWorkoutPlanTemplate, loggingLevel]
  );

  const handleTogglePlanActive = React.useCallback(
    async (planId: string, isActive: boolean) => {
      if (!user?.id) return;
      try {
        const planToUpdate = plans?.find((p) => p.id === planId);
        if (!planToUpdate) {
          toast({
            title: t('common.error'),
            description: t(
              'workoutPlansManager.updateStatusError',
              'Could not find the plan to update.'
            ),
            variant: 'destructive',
          });
          return;
        }
        await updateWorkoutPlanTemplate({
          id: planId,
          data: { ...planToUpdate, is_active: isActive },
        });
      } catch (err) {
        error(loggingLevel, 'Error toggling workout plan active status:', err);
      }
    },
    [user?.id, plans, t, updateWorkoutPlanTemplate, loggingLevel]
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t(
                'workoutPlansManager.managePlansTitle',
                'Manage Training Schedules'
              )}
            </DialogTitle>
          </DialogHeader>
          {!plans || plans.length === 0 ? (
            <p className="text-center text-gray-400 py-10 italic">
              {t(
                'workoutPlansManager.noPlansFound',
                'No workout plans found. Create one to get started!'
              )}
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {plan.plan_name}
                      </span>
                      <Badge
                        variant={plan.is_active ? 'default' : 'secondary'}
                        className="font-normal text-[10px] cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                        onClick={() =>
                          handleTogglePlanActive(plan.id, !plan.is_active)
                        }
                      >
                        {plan.is_active
                          ? t('workoutPlansManager.activeStatus')
                          : t('workoutPlansManager.inactiveStatus')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span>
                        {new Date(plan.start_date!).toLocaleDateString()}
                      </span>
                      <span>-</span>
                      <span>
                        {plan.end_date
                          ? new Date(plan.end_date).toLocaleDateString()
                          : t('workoutPlansManager.ongoingStatus', 'Ongoing')}
                      </span>
                    </div>
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
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t('common.edit', 'Edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleTogglePlanActive(plan.id, !plan.is_active)
                        }
                      >
                        {plan.is_active ? (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            {t('workoutPlansManager.deactivate', 'Deactivate')}
                          </>
                        ) : (
                          <>
                            <CheckSquare className="mr-2 h-4 w-4" />
                            {t('workoutPlansManager.activate', 'Activate')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('common.delete', 'Delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddWorkoutPlanDialog
        key={`edit-${selectedPlan?.id ?? (isEditDialogOpen ? 'open' : 'closed')}`}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedPlan(null);
        }}
        onSave={() => {}}
        initialData={selectedPlan}
        onUpdate={handleUpdatePlan}
      />
    </>
  );
};

export default ManageSchedulesDialog;
