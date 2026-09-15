-- Workout session integrity (Ouros Life workout-mapping fix, phase 1).
--
-- Additive only: no existing row is modified, and every statement is
-- idempotent because the runner has no rollback and CI applies migrations twice.

SET LOCAL lock_timeout = '5s';

-- A client-generated id per logical save lets a repeated Finish tap, a
-- network retry, or a coach re-log return the original session instead of
-- inserting a duplicate. The fingerprint detects a replayed id carrying a
-- different payload.
ALTER TABLE public.exercise_preset_entries
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS client_request_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_preset_entries_user_client_request
  ON public.exercise_preset_entries (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.exercise_preset_entries.client_request_id IS
  'Client-generated idempotency key for session creation, unique per user. NULL for sessions created before this column existed or by writers that do not send one.';
COMMENT ON COLUMN public.exercise_preset_entries.client_request_fingerprint IS
  'Hash of the create payload stored with client_request_id; a replay with the same key but a different fingerprint is rejected.';

-- Where calories_burned came from, so editing duration can recompute a derived
-- value without overwriting one the user or a device supplied. NULL = legacy
-- row of unknown origin.
ALTER TABLE public.exercise_entries
  ADD COLUMN IF NOT EXISTS calories_source text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'exercise_entries_calories_source_check'
                   AND conrelid = 'public.exercise_entries'::regclass) THEN
    ALTER TABLE public.exercise_entries
      ADD CONSTRAINT exercise_entries_calories_source_check
      CHECK (calories_source IS NULL OR calories_source IN ('derived', 'manual', 'device'));
  END IF;
END $$;

COMMENT ON COLUMN public.exercise_entries.calories_source IS
  'Origin of calories_burned: derived (computed from duration x rate), manual (entered by the user or coach), device (synced). NULL for rows created before this column existed.';
