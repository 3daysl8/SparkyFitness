// Internal shapes shared between the planned-workout domain
// (models/plannedWorkoutRepository.ts, services/plannedWorkoutService.ts)
// and session-completion linking in services/exerciseService.ts, so neither
// side has to import from the other's owned files.

/** Raw exercise_preset_entries.workout_type / planned_workouts.workout_type value. */
export type PlannedWorkoutType =
  'strength' | 'cardio' | 'mobility' | 'recovery' | 'other';

export type PlannedWorkoutStatus =
  'planned' | 'started' | 'completed' | 'skipped';

export type PlannedWorkoutOrigin = 'template' | 'manual' | 'coach';

/** A planned_workouts row as the repository returns it — DB shape, not the API response shape (which derives is_missed and formats dates as strings for the client). */
export interface PlannedWorkoutRow {
  id: string;
  user_id: string;
  planned_date: string; // YYYY-MM-DD
  planned_time: string | null;
  duration_estimate_minutes: number | null;
  title: string;
  workout_preset_id: number | null;
  exercise_id: string | null;
  workout_type: PlannedWorkoutType | null;
  notes: string | null;
  status: PlannedWorkoutStatus;
  started_at: string | null;
  completed_at: string | null;
  completed_session_id: string | null;
  origin: PlannedWorkoutOrigin;
  template_id: number | null;
  assignment_id: number | null;
  generated_for_date: string | null;
  slot: number | null;
  user_modified: boolean;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Outcome of linking a newly created session to a planned workout
 * (createGroupedWorkoutSessionWithStatus, when the request carries a
 * planned_workout_id). The session always saves regardless of `linked` —
 * a failed link is reported via `warning`, never a thrown error.
 */
export interface PlannedWorkoutLinkResult {
  linked: boolean;
  warning?: string;
}
