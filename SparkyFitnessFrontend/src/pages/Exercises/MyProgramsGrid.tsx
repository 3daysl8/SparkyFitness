import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { WorkoutPreset } from '@/types/workout';
import WorkoutPresetForm from './WorkoutPresetForm';
import WorkoutPresetCard from './WorkoutPresetCard';
import {
  useCreateWorkoutPresetMutation,
  useDeleteWorkoutPresetMutation,
  useUpdateWorkoutPresetMutation,
  useWorkoutPresets,
} from '@/hooks/Exercises/useWorkoutPresets';
import { useLogWorkoutPresetMutation } from '@/hooks/Exercises/useExerciseEntries';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  createWorkoutPlaybackRouteState,
  createBlankWorkoutPlaybackDraft,
} from '@/utils/workoutPlayback';
import WorkoutPresetSelector from './WorkoutPresetSelector';

import { DataTablePagination } from '@/components/ui/DataTablePagination';
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

// The grid below renders WorkoutPresetCard directly rather than table rows,
// but still runs through useReactTable so pagination reuses the same proven
// bookkeeping (and DataTablePagination component) as every other paginated
// list in this app. No columns are needed since nothing renders a cell
// through columnDef here.
const NO_COLUMNS: ColumnDef<WorkoutPreset, unknown>[] = [];

// Matches workout_presets.name VARCHAR(255) in the database.
const MAX_PRESET_NAME_LENGTH = 255;

interface MyProgramsGridProps {
  isAddOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

const MyProgramsGrid = ({
  isAddOpen,
  onAddOpenChange,
}: MyProgramsGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { weightUnit } = usePreferences();

  const [isStartWorkoutDialogOpen, setIsStartWorkoutDialogOpen] =
    useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<WorkoutPreset | null>(
    null
  );

  // The dashboard's empty Workout card links here with this state flag to
  // jump straight into the routine picker instead of just landing on the
  // page — same "signal a dialog to open via router state" convention as
  // MainLayout's openFoodSearchForMeal (consumed in Diary.tsx).
  useEffect(() => {
    const state = location.state as { openStartWorkout?: boolean } | null;
    if (state?.openStartWorkout) {
      setIsStartWorkoutDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const { data, isLoading, isFetching } = useWorkoutPresets(
    user?.id,
    currentPage,
    itemsPerPage
  );

  const { mutateAsync: createPreset } = useCreateWorkoutPresetMutation();
  const { mutateAsync: updatePreset } = useUpdateWorkoutPresetMutation();
  const { mutateAsync: deletePreset } = useDeleteWorkoutPresetMutation();
  const { mutateAsync: logWorkoutPreset } = useLogWorkoutPresetMutation();

  const presets = React.useMemo(() => data?.presets ?? [], [data]);
  const totalPresets = data?.total ?? 0;
  const totalPages = Math.ceil(totalPresets / itemsPerPage);

  // Deleting every preset on the last page (or shrinking the page size) can
  // leave the request pointing past the end of the list, which would render an
  // empty table next to a stale page number. Fall back to the last real page.
  React.useEffect(() => {
    if (data && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [data, totalPages, currentPage]);

  const handleCreatePreset = async (
    newPresetData: Omit<
      WorkoutPreset,
      'id' | 'created_at' | 'updated_at' | 'user_id'
    >
  ) => {
    if (!user?.id) return;
    await createPreset({ ...newPresetData, user_id: user.id });
    onAddOpenChange(false);
  };

  const handleDuplicatePreset = React.useCallback(
    async (preset: WorkoutPreset) => {
      if (!user?.id) return;
      // The server always inserts fresh rows for exercises/sets on create and
      // ignores any incoming id (see workoutPresetRepository.createWorkoutPreset),
      // so the original's exercises/sets can be sent as-is. Defaults to
      // private regardless of the source's visibility — duplicating someone
      // else's public preset shouldn't silently re-share it under this user.
      // sort_order is the one field that can't be sent as-is: the read
      // queries never select wpe.sort_order, so preset.exercises[].sort_order
      // is always undefined here and every duplicated row would insert with
      // the same value, relying on id-ASC as a display-order tiebreak.
      // preset.exercises already arrives in display order (server sorts by
      // sort_order then id), so the array index is the real sort_order.
      // workout_presets.name is VARCHAR(255) with no client-side length cap on
      // creation, so a max-length preset name must be truncated here to leave
      // room for the localized suffix — otherwise the duplicate insert fails.
      const suffixOnly = t('workoutPresetsManager.duplicateNameSuffix', {
        name: '',
      });
      const availableNameLength = Math.max(
        0,
        MAX_PRESET_NAME_LENGTH - suffixOnly.length
      );
      const truncatedName =
        preset.name.length > availableNameLength
          ? preset.name.slice(0, availableNameLength)
          : preset.name;

      await createPreset({
        user_id: user.id,
        name: t('workoutPresetsManager.duplicateNameSuffix', {
          name: truncatedName,
        }),
        description: preset.description,
        is_public: false,
        exercises: preset.exercises.map((exercise, index) => ({
          ...exercise,
          sort_order: index,
        })),
      });
    },
    [createPreset, user?.id, t]
  );

  const handleUpdatePreset = async (
    presetId: string,
    updatedPresetData: Partial<WorkoutPreset>
  ) => {
    await updatePreset({ id: presetId, data: updatedPresetData });
    setIsEditDialogOpen(false);
    setSelectedPreset(null);
  };

  const handleDeletePreset = React.useCallback(
    async (presetId: string) => {
      await deletePreset(presetId);
    },
    [deletePreset]
  );

  const handleLogPresetToDiary = React.useCallback(
    async (preset: WorkoutPreset) => {
      try {
        const today = formatDateToYYYYMMDD(new Date());
        await logWorkoutPreset({ presetId: preset.id, date: today });
        toast({
          title: t('common.success', 'Success'),
          description: t('workoutPresetsManager.logSuccess', {
            presetName: preset.name,
          }),
        });
      } catch (err) {
        toast({
          title: t('common.error', 'Error'),
          description: t('workoutPresetsManager.logError', {
            presetName: preset.name,
          }),
          variant: 'destructive',
        });
      }
    },
    [logWorkoutPreset, t]
  );

  const handleStartWorkoutPlayback = React.useCallback(
    (preset: WorkoutPreset) => {
      const today = formatDateToYYYYMMDD(new Date());
      const routeState = createWorkoutPlaybackRouteState(
        preset,
        today,
        `${location.pathname}${location.search}`
      );

      navigate(`/workout-playback?date=${today}`, {
        state: routeState,
      });
    },
    [location.pathname, location.search, navigate]
  );

  const handleStartBlankWorkout = React.useCallback(() => {
    const today = formatDateToYYYYMMDD(new Date());
    navigate(`/workout-playback?date=${today}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
        draft: createBlankWorkoutPlaybackDraft(today),
      },
    });
  }, [location.pathname, location.search, navigate]);

  // Pagination bookkeeping only — the grid below renders WorkoutPresetCard
  // directly from table.getRowModel().rows rather than through columnDef
  // cells, reusing this proven state machine (and DataTablePagination)
  // instead of hand-rolling a parallel one.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: presets,
    columns: NO_COLUMNS,
    getRowId: (row) => row.id.toString(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: (updater) => {
      const current = { pageIndex: currentPage - 1, pageSize: itemsPerPage };
      const next = typeof updater === 'function' ? updater(current) : updater;
      setCurrentPage(next.pageIndex + 1);
    },
    manualPagination: true,
    pageCount: totalPages,
    state: {
      pagination: { pageIndex: currentPage - 1, pageSize: itemsPerPage },
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            {t(
              'exercise.databaseManager.workoutPresetsCardTitle',
              'My Programs'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {presets.length === 0 && !isLoading ? (
            <p className="text-center text-gray-400 py-10 italic">
              {t(
                'workoutPresetsManager.noPresetsFound',
                'No workout presets found.'
              )}
            </p>
          ) : (
            <div className="space-y-4">
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
                  isLoading || isFetching ? 'opacity-70 grayscale-[0.3]' : ''
                }`}
              >
                {table.getRowModel().rows.map((row) => {
                  const preset = row.original;
                  return (
                    <WorkoutPresetCard
                      key={row.id}
                      preset={preset}
                      isOwned={preset.user_id === user?.id}
                      weightUnit={weightUnit}
                      onStart={() => handleStartWorkoutPlayback(preset)}
                      onLogToDiary={() => handleLogPresetToDiary(preset)}
                      onDuplicate={() => handleDuplicatePreset(preset)}
                      onEdit={() => {
                        setSelectedPreset(preset);
                        setIsEditDialogOpen(true);
                      }}
                      onDelete={() => handleDeletePreset(preset.id.toString())}
                    />
                  );
                })}
              </div>
              <DataTablePagination table={table} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isStartWorkoutDialogOpen}
        onOpenChange={setIsStartWorkoutDialogOpen}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('workoutPresetsManager.startWorkout', 'Start Workout')}
            </DialogTitle>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={handleStartBlankWorkout}
          >
            <Plus className="h-4 w-4" />
            {t(
              'workoutPresetsManager.startBlankWorkout',
              'Start Blank Workout'
            )}
          </Button>
          <WorkoutPresetSelector
            onPresetSelected={handleStartWorkoutPlayback}
          />
        </DialogContent>
      </Dialog>

      <WorkoutPresetForm
        isOpen={isAddOpen}
        onClose={() => onAddOpenChange(false)}
        onSave={handleCreatePreset}
      />

      {selectedPreset && (
        <WorkoutPresetForm
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedPreset(null);
          }}
          onSave={(updatedData) =>
            handleUpdatePreset(selectedPreset.id.toString(), updatedData)
          }
          initialPreset={selectedPreset}
        />
      )}
    </div>
  );
};

export default MyProgramsGrid;
