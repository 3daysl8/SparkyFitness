-- Planned workouts (Ouros Life workout-mapping fix, phase 2).
--
-- Additive only: no existing row is modified, and every statement is
-- idempotent because the runner has no rollback and CI applies migrations
-- twice. RLS is NOT defined here — applied in db/rls_policies.sql
-- (create_diary_policy, reapplied on every startup); diary delegates can
-- already write sessions, so the same tier covers planned workouts.

SET LOCAL lock_timeout = '5s';

-- A composite FK from planned_workouts (completed_session_id, user_id) needs
-- a matching unique constraint on exactly that column pair to bind to, even
-- though id alone is already the primary key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'exercise_preset_entries_id_user_id_key'
                   AND conrelid = 'public.exercise_preset_entries'::regclass) THEN
    ALTER TABLE public.exercise_preset_entries
      ADD CONSTRAINT exercise_preset_entries_id_user_id_key UNIQUE (id, user_id);
  END IF;
END $$;

-- Ensure the shared updated_at trigger exists (idempotent; originally
-- defined by 20260912120000_add_focus_schema.sql).
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- planned_workouts — a dated intention to do a workout, distinct from the
-- exercise_preset_entries row that records one actually done. A template's
-- weekday assignments generate rows here (origin='template') on a rolling
-- window; a user can also add one manually (origin='manual') or a coach can
-- schedule one (origin='coach'). completed_session_id links a completed plan
-- to the session that fulfilled it; "missed" is derived on read from
-- planned_date + status, never written.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planned_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    planned_time TIME NULL,
    duration_estimate_minutes INTEGER,
    title TEXT NOT NULL,
    workout_preset_id INTEGER REFERENCES public.workout_presets(id) ON DELETE SET NULL,
    exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
    workout_type TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_session_id UUID,
    origin TEXT NOT NULL DEFAULT 'manual',
    template_id INTEGER REFERENCES public.workout_plan_templates(id) ON DELETE SET NULL,
    assignment_id INTEGER REFERENCES public.workout_plan_template_assignments(id) ON DELETE SET NULL,
    generated_for_date DATE,
    slot SMALLINT,
    user_modified BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named CHECK constraints, added separately so re-running this file is a
-- no-op (ADD CONSTRAINT has no IF NOT EXISTS form).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'planned_workouts_workout_type_check'
                   AND conrelid = 'public.planned_workouts'::regclass) THEN
    ALTER TABLE public.planned_workouts
      ADD CONSTRAINT planned_workouts_workout_type_check
      CHECK (workout_type IS NULL OR workout_type IN ('strength', 'cardio', 'mobility', 'recovery', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'planned_workouts_status_check'
                   AND conrelid = 'public.planned_workouts'::regclass) THEN
    ALTER TABLE public.planned_workouts
      ADD CONSTRAINT planned_workouts_status_check
      CHECK (status IN ('planned', 'started', 'completed', 'skipped'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'planned_workouts_origin_check'
                   AND conrelid = 'public.planned_workouts'::regclass) THEN
    ALTER TABLE public.planned_workouts
      ADD CONSTRAINT planned_workouts_origin_check
      CHECK (origin IN ('template', 'manual', 'coach'));
  END IF;

  -- Composite FK to exercise_preset_entries, scoped to the owning user so a
  -- planned workout can never link to another user's session. ON DELETE SET
  -- NULL names only completed_session_id (PG15+ column-list form) so
  -- deleting the session doesn't cascade-delete the plan, just unlinks it —
  -- the revert_planned_workout_on_session_unlink trigger below then reverts
  -- status back to 'planned'.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'planned_workouts_completed_session_fkey'
                   AND conrelid = 'public.planned_workouts'::regclass) THEN
    ALTER TABLE public.planned_workouts
      ADD CONSTRAINT planned_workouts_completed_session_fkey
      FOREIGN KEY (completed_session_id, user_id)
      REFERENCES public.exercise_preset_entries (id, user_id)
      ON DELETE SET NULL (completed_session_id);
  END IF;

  -- A session completes at most one plan.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'planned_workouts_completed_session_id_key'
                   AND conrelid = 'public.planned_workouts'::regclass) THEN
    ALTER TABLE public.planned_workouts
      ADD CONSTRAINT planned_workouts_completed_session_id_key UNIQUE (completed_session_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_planned_workouts_user_planned_date
  ON public.planned_workouts (user_id, planned_date);

-- Regeneration key: a template's weekday assignment only ever produces one
-- row per (template, generated calendar date, assignment slot). NULLS NOT
-- DISTINCT so two non-template rows (both NULL on all three columns) never
-- collide, while template rows are always fully keyed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_planned_workouts_template_generation
  ON public.planned_workouts (template_id, generated_for_date, slot)
  NULLS NOT DISTINCT
  WHERE origin = 'template';

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.planned_workouts
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Deleting (or otherwise unlinking) the session that completed a plan must
-- not leave the plan silently claiming 'completed' with a dangling
-- reference. Not SECURITY DEFINER (runs as the caller, same as every other
-- trigger in this schema) with a pinned search_path so it can't be tricked
-- by a session-local search_path into resolving an attacker's function.
CREATE OR REPLACE FUNCTION revert_planned_workout_on_session_unlink()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.completed_session_id IS NOT NULL
     AND NEW.completed_session_id IS NULL
     AND NEW.status = 'completed' THEN
    NEW.status := 'planned';
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER revert_completed_on_session_unlink BEFORE UPDATE ON public.planned_workouts
FOR EACH ROW EXECUTE PROCEDURE revert_planned_workout_on_session_unlink();

COMMENT ON TABLE public.planned_workouts IS
  'A dated intention to do a workout, distinct from the exercise_preset_entries row that records one actually done. "Missed" is derived on read from planned_date + status, never written.';
COMMENT ON COLUMN public.planned_workouts.completed_session_id IS
  'The session that fulfilled this plan. Set NULL (not cascade-deleted) if that session is later removed; the revert_completed_on_session_unlink trigger then reverts status to planned.';
COMMENT ON COLUMN public.planned_workouts.origin IS
  'template = generated from a workout_plan_templates weekday assignment; manual = added directly by the user; coach = scheduled by an MCP client.';
COMMENT ON COLUMN public.planned_workouts.generated_for_date IS
  'The calendar date this row was generated to represent, for template-origin regeneration keying. NULL for manual/coach rows.';
COMMENT ON COLUMN public.planned_workouts.slot IS
  'Disambiguates multiple template assignments landing on the same generated_for_date. NULL for manual/coach rows.';
COMMENT ON COLUMN public.planned_workouts.user_modified IS
  'True once the user has edited a template-generated row directly; regeneration then leaves it alone instead of refreshing it.';
COMMENT ON COLUMN public.planned_workouts.dismissed_at IS
  'Set when a user dismisses a template-generated row instead of deleting it outright (deletion is reserved for planned/skipped rows with no linked session); regeneration skips dismissed rows.';

-- ---------------------------------------------------------------------------
-- Nullable workout_type on the tables planned_workouts references, so a
-- plan/session/preset can carry a consistent category. Same value set as
-- planned_workouts.workout_type.
-- ---------------------------------------------------------------------------
ALTER TABLE public.exercise_preset_entries
  ADD COLUMN IF NOT EXISTS workout_type TEXT;
ALTER TABLE public.workout_presets
  ADD COLUMN IF NOT EXISTS workout_type TEXT;
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS workout_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'exercise_preset_entries_workout_type_check'
                   AND conrelid = 'public.exercise_preset_entries'::regclass) THEN
    ALTER TABLE public.exercise_preset_entries
      ADD CONSTRAINT exercise_preset_entries_workout_type_check
      CHECK (workout_type IS NULL OR workout_type IN ('strength', 'cardio', 'mobility', 'recovery', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'workout_presets_workout_type_check'
                   AND conrelid = 'public.workout_presets'::regclass) THEN
    ALTER TABLE public.workout_presets
      ADD CONSTRAINT workout_presets_workout_type_check
      CHECK (workout_type IS NULL OR workout_type IN ('strength', 'cardio', 'mobility', 'recovery', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'exercises_workout_type_check'
                   AND conrelid = 'public.exercises'::regclass) THEN
    ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_workout_type_check
      CHECK (workout_type IS NULL OR workout_type IN ('strength', 'cardio', 'mobility', 'recovery', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.exercise_preset_entries.workout_type IS
  'Optional category (strength|cardio|mobility|recovery|other) for weekly-goal classification. NULL for rows created before this column existed.';
COMMENT ON COLUMN public.workout_presets.workout_type IS
  'Optional category (strength|cardio|mobility|recovery|other), inherited by sessions started from this preset unless overridden.';
COMMENT ON COLUMN public.exercises.workout_type IS
  'Optional category (strength|cardio|mobility|recovery|other), the lowest-priority fallback in weekly-goal classification.';
