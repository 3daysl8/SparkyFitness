import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import {
  useExerciseEntryHistoryPage,
  useDeleteExerciseEntryMutation,
  useDeleteExercisePresetEntryMutation,
} from '@/hooks/Exercises/useExerciseEntries';
import { createWorkoutPlaybackRouteStateFromSession } from '@/utils/workoutPlayback';
import type { ExerciseSessionResponse } from '@workspace/shared';
import WorkoutHistorySessionCard from './WorkoutHistorySessionCard';

const PAGE_SIZE = 10;

const WorkoutsHistoryTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [sessionToDelete, setSessionToDelete] =
    useState<ExerciseSessionResponse | null>(null);

  const { data, isLoading, isFetching } = useExerciseEntryHistoryPage(
    page,
    PAGE_SIZE,
    user?.id
  );
  const { mutate: deleteExerciseEntry } = useDeleteExerciseEntryMutation();
  const { mutate: deleteExercisePresetEntry } =
    useDeleteExercisePresetEntryMutation();

  const sessions = data?.sessions ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((data?.pagination.totalCount ?? 0) / PAGE_SIZE)
  );

  const handleRepeat = (session: ExerciseSessionResponse) => {
    const today = formatDateToYYYYMMDD(new Date());
    const routeState = createWorkoutPlaybackRouteStateFromSession(
      session,
      today,
      `${location.pathname}${location.search}`
    );
    navigate(`/workout-playback?date=${today}`, { state: routeState });
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    // A "preset" session is a grouped workout (its id is the preset entry
    // id); an "individual" session is a single standalone exercise entry —
    // each has its own delete route, per exerciseEntryService.ts.
    if (sessionToDelete.type === 'preset') {
      deleteExercisePresetEntry(sessionToDelete.id);
    } else {
      deleteExerciseEntry(sessionToDelete.id);
    }
    setSessionToDelete(null);
  };

  if (!isLoading && sessions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <History className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            {t(
              'exercise.workoutsHistory.emptyState',
              "No workouts logged yet — finish a session and it'll show up here."
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={`space-y-3 ${isFetching ? 'opacity-70 grayscale-[0.3]' : ''}`}
    >
      {sessions.map((session) => (
        <WorkoutHistorySessionCard
          key={session.id}
          session={session}
          onRepeat={() => handleRepeat(session)}
          onDelete={() => setSessionToDelete(session)}
        />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <span className="sr-only">
              {t('dataTable.previousPage', 'Go to previous page')}
            </span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {t('dataTable.pageOf', {
              page,
              total: totalPages,
              defaultValue: `Page ${page} of ${totalPages}`,
            })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <span className="sr-only">
              {t('dataTable.nextPage', 'Go to next page')}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ConfirmationDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t(
          'exercise.workoutsHistory.deleteConfirmTitle',
          'Delete this workout?'
        )}
        description={t(
          'exercise.workoutsHistory.deleteConfirmDescription',
          "This permanently removes the logged session. This can't be undone."
        )}
        variant="destructive"
        confirmLabel={t('exercise.workoutsHistory.deleteWorkout', 'Delete')}
      />
    </div>
  );
};

export default WorkoutsHistoryTab;
