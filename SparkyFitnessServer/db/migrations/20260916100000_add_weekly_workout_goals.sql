-- Weekly workout goals (Ouros Life workout-mapping fix, phase 5).
--
-- Additive only, idempotent (ADD COLUMN IF NOT EXISTS / named-constraint
-- guards) since the migration runner has no rollback and CI applies every
-- file twice. All five columns are policy/target knobs on user_preferences,
-- not user data -- no backfill needed. Existing rows get the two defaulted
-- columns and NULL ("no goal set") on the three targets.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS weekly_workout_target_total INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_workout_target_strength INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_workout_target_cardio INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_cardio_min_minutes INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weekly_strength_counting TEXT NOT NULL DEFAULT 'any_strength';

-- Named CHECK constraints, added separately so re-running this file is a
-- no-op (ADD CONSTRAINT has no IF NOT EXISTS form).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_weekly_workout_target_total_positive'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_weekly_workout_target_total_positive
      CHECK (weekly_workout_target_total IS NULL OR weekly_workout_target_total > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_weekly_workout_target_strength_positive'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_weekly_workout_target_strength_positive
      CHECK (weekly_workout_target_strength IS NULL OR weekly_workout_target_strength > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_weekly_workout_target_cardio_positive'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_weekly_workout_target_cardio_positive
      CHECK (weekly_workout_target_cardio IS NULL OR weekly_workout_target_cardio > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_weekly_cardio_min_minutes_positive'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_weekly_cardio_min_minutes_positive
      CHECK (weekly_cardio_min_minutes > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_weekly_strength_counting_check'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_weekly_strength_counting_check
      CHECK (weekly_strength_counting IN ('any_strength', 'explicit_only'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_preferences.weekly_workout_target_total IS
  'Sessions/week target across every workout type, regardless of classification. NULL means unset -- no weekly-goal chip/progress is shown for this leg.';
COMMENT ON COLUMN public.user_preferences.weekly_workout_target_strength IS
  'Strength sessions/week target -- see weekly_strength_counting for how a session qualifies as strength (shared/src/workouts/weeklyGoal.ts classifySession). NULL means unset.';
COMMENT ON COLUMN public.user_preferences.weekly_workout_target_cardio IS
  'Cardio sessions/week target; a session only counts if its duration meets weekly_cardio_min_minutes. NULL means unset.';
COMMENT ON COLUMN public.user_preferences.weekly_cardio_min_minutes IS
  'Minimum session duration (minutes) for a cardio-classified session to count toward weekly_workout_target_cardio. Default 20.';
COMMENT ON COLUMN public.user_preferences.weekly_strength_counting IS
  'any_strength (default): a session counts as strength via the full classifySession cascade, including its last-resort exercise-modality guess. explicit_only: stop at the tag cascade (session/preset/exercise workout_type) and never count an untagged session as strength off modality alone.';
