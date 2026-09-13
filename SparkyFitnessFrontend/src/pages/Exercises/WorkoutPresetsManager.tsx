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
import { Plus, CheckSquare, Play, X } from 'lucide-react';
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

import { useBulkSelection } from '@/hooks/useBulkSelection';
import BulkActionToolbar from '@/components/BulkActionToolbar';
import BulkDeleteDialog from '@/components/BulkDeleteDialog';
import { DataTablePagination } from '@/components/ui/DataTablePagination';
import {
  ColumnDef,
  RowSelectionState,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useIsMobile } from '@/hooks/use-mobile';

// The grid below renders WorkoutPresetCard directly rather than table rows,
// but still runs through useReactTable so pagination/selection reuse the
// same proven bookkeeping (and DataTablePagination component) as every other
// paginated list in this app. No columns are needed since nothing renders a
// cell through columnDef here.
const NO_COLUMNS: ColumnDef<WorkoutPreset, unknown>[] = [];

// Matches workout_presets.name VARCHAR(255) in the database.
const MAX_PRESET_NAME_LENGTH = 255;

const WorkoutPresetsManager = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { weightUnit } = usePreferences();

  const [isAddPresetDialogOpen, setIsAddPresetDialogOpen] = useState(false);
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
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectedIdsFromTable = React.useMemo(() => {
    return new Set<string>(Object.keys(rowSelection));
  }, [rowSelection]);

  const {
    selectedIds,
    selectAll,
    clearSelection,
    selectedCount,
    isEditMode,
    toggleEditMode,
  } = useBulkSelection(selectedIdsFromTable);

  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const editablePresetIds = presets
    .filter((p) => p.user_id === user?.id)
    .map((p) => p.id.toString());

  const allSelected =
    editablePresetIds.length > 0 && selectedCount === editablePresetIds.length;

  const handleBulkDeleteConfirm = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deletePreset(id)));
    } catch (err) {
      // Error handling is handled by mutation
    } finally {
      clearSelection();
      setRowSelection({});
      setShowBulkDeleteDialog(false);
    }
  };

  const handleCreatePreset = async (
    newPresetData: Omit<
      WorkoutPreset,
      'id' | 'created_at' | 'updated_at' | 'user_id'
    >
  ) => {
    if (!user?.id) return;
    await createPreset({ ...newPresetData, user_id: user.id });
    setIsAddPresetDialogOpen(false);
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

  // Pagination/selection bookkeeping only — the grid below renders
  // WorkoutPresetCard directly from table.getRowModel().rows rather than
  // through columnDef cells, reusing this proven state machine (and
  // DataTablePagination) instead of hand-rolling a parallel one.
  const table = useReactTable({
    data: presets,
    columns: NO_COLUMNS,
    getRowId: (row) => row.id.toString(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    onPaginationChange: (updater) => {
      const current = { pageIndex: currentPage - 1, pageSize: itemsPerPage };
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.pageSize !== itemsPerPage) {
        setItemsPerPage(next.pageSize);
        setCurrentPage(1);
      } else {
        setCurrentPage(next.pageIndex + 1);
      }
    },
    manualPagination: true,
    pageCount: totalPages,
    state: {
      rowSelection,
      pagination: { pageIndex: currentPage - 1, pageSize: itemsPerPage },
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {t(
              'exercise.databaseManager.workoutPresetsCardTitle',
              'Workout Presets'
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              onClick={toggleEditMode}
              className={`shrink-0 ${
                isEditMode
                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                  : ''
              }`}
              title={
                isEditMode
                  ? t('common.cancel', 'Cancel')
                  : t('common.select', 'Select')
              }
            >
              {isEditMode ? (
                isMobile ? (
                  <X className="w-5 h-5" />
                ) : (
                  t('common.cancel', 'Cancel')
                )
              ) : isMobile ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                t('common.select', 'Select')
              )}
            </Button>
            <Button
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              onClick={() => setIsStartWorkoutDialogOpen(true)}
              className="shrink-0"
              title={t('workoutPresetsManager.startWorkout', 'Start Workout')}
            >
              <Play className={isMobile ? 'w-5 h-5' : 'h-4 w-4 mr-2'} />
              {!isMobile && (
                <span>
                  {t('workoutPresetsManager.startWorkout', 'Start Workout')}
                </span>
              )}
            </Button>
            <Button
              onClick={() => setIsAddPresetDialogOpen(true)}
              size={isMobile ? 'icon' : 'default'}
              className="shrink-0"
              title={t('workoutPresetsManager.addPresetButton', 'Add presets')}
            >
              <Plus className={isMobile ? 'w-5 h-5' : 'h-4 w-4 mr-2'} />
              {!isMobile && (
                <span>
                  {t('workoutPresetsManager.addPresetButton', 'Add presets')}
                </span>
              )}
            </Button>
          </div>
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
                      isEditMode={isEditMode}
                      isSelected={row.getIsSelected()}
                      weightUnit={weightUnit}
                      onToggleSelect={() => row.toggleSelected()}
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

      <BulkActionToolbar
        selectedCount={selectedCount}
        totalCount={editablePresetIds.length}
        allSelected={allSelected}
        onClear={() => {
          clearSelection();
          setRowSelection({});
        }}
        onDelete={() => setShowBulkDeleteDialog(true)}
        onSelectAll={(checked) => {
          if (checked) {
            selectAll(editablePresetIds);
            // Sync with table
            const newSelection: RowSelectionState = {};
            presets.forEach((p) => {
              if (p.user_id === user?.id) newSelection[p.id.toString()] = true;
            });
            setRowSelection(newSelection);
          } else {
            clearSelection();
            setRowSelection({});
          }
        }}
      />

      <BulkDeleteDialog
        isOpen={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        selectedCount={selectedCount}
        entityName={t('workoutPresetsManager.presets', 'presets')}
        onConfirm={handleBulkDeleteConfirm}
      />

      <WorkoutPresetForm
        isOpen={isAddPresetDialogOpen}
        onClose={() => setIsAddPresetDialogOpen(false)}
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

export default WorkoutPresetsManager;
