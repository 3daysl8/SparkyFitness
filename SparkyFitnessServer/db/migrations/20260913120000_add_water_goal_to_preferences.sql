-- Water goal preference (Ouroboros Life restructure, step 1).
--
-- Home's water quick-log card currently reads its daily target from
-- user_goals.water_goal_ml via GET /goals/for-date -- the same
-- nutrition-goals table/endpoint that a later migration in this restructure
-- hard-deletes along with the rest of the food/goals cluster. Decouple the
-- water goal first: it becomes a plain per-user preference on
-- user_preferences, alongside water_display_unit / add_exercise_water_to_goal
-- / add_food_water_to_intake, which already live there.
--
-- Nullable, no default: NULL means "no goal set", matching how
-- user_goals.water_goal_ml already behaved. Callers (useWaterGoalQuery on the
-- frontend) already treat NULL/0/undefined as "fall back to 1920 ml" -- that
-- fallback is unchanged by this migration.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS water_goal_ml numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_preferences_water_goal_ml_positive'
                   AND conrelid = 'public.user_preferences'::regclass) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_water_goal_ml_positive
      CHECK (water_goal_ml IS NULL OR water_goal_ml > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.user_preferences.water_goal_ml IS
  'Daily water intake target in millilitres, set from Settings > Water Tracking. NULL means unset -- readers (useWaterGoalQuery) fall back to 1920 ml. Decoupled from the legacy user_goals.water_goal_ml (GET /goals/for-date) so Home''s water card survives the nutrition-goals table being dropped in a later migration.';
