-- Ouroboros Life restructure, step 2: DB migration + RLS (schema only).
--
-- Hard-deletes three domains that don't fit a single-purpose personal
-- lifestyle app: the menstrual cycle/pregnancy/TTC suite, clinical GLP-1
-- medication management (titration/injection-site/symptom tracking), and the
-- food diary/nutrition-goals cluster. This reverses this app's established
-- "hide, don't delete" precedent -- confirmed deliberately as a real cut this
-- time. No service/route/repository code is touched here (steps 3-5 do that);
-- this file is schema-only, matched by a corresponding edit to
-- db/rls_policies.sql in the same commit.
--
-- ORDER MATTERS, confirmed by prior review: cycle/pregnancy tables carry
-- `prenatal_medication_id`/`supplement_medication_id` FKs into `medications`
-- (see 20260702180000_add_cycle_tracking_schema.sql), so they must be dropped
-- BEFORE `medications` is altered, or the alter fails/orphans. Clinical
-- medication tables (medication_pens/injection_entries/etc.) also FK into
-- `medications` and are dropped before its ALTER for the same reason. The
-- food/goals cluster is dropped last -- it has no FK relationship to the
-- above, and step 1 of this restructure (20260913120000_add_water_goal_to_
-- preferences.sql) already moved Home's water goal off `user_goals` onto
-- `user_preferences.water_goal_ml`, so `user_goals` is now safe to drop too.
--
-- Deliberately NOT dropped despite being defined in the same original
-- migrations as tables above: `user_custom_moods` / `user_mood_display_
-- preferences` (co-located with the cycle schema in 20260702180000 but back
-- the unrelated, still-active general Mood feature -- models/moodRepository.ts)
-- and the `medication_types` / `medication_schedule_types` / `medication_
-- route_types` lookup tables (global reference data, not user rows).
--
-- EXTRA FK ISSUES FOUND BEYOND THE ONES CALLED OUT ABOVE (both against
-- surviving tables, both requiring CASCADE on the food-cluster drops below):
--   - public.user_water_containers.linked_food_id / linked_variant_id /
--     linked_meal_type_id FK into foods(id) / food_variants(id) / meal_types(id)
--     respectively (added by 20260905150000_add_caffeine_alcohol_water_and_
--     container_links.sql, feature #2115). user_water_containers itself is
--     NOT dropped (Home's water feature keeps it) -- CASCADE below drops only
--     these three FK constraints from it, leaving linked_food_id/linked_
--     variant_id/linked_meal_type_id/linked_quantity/hydration_factor as
--     orphaned (still-present, no-longer-enforced) columns. Cleaning those
--     columns up is application-layer work for a later step, not schema-only
--     step 2.
--   - public.water_intake_entries.food_entry_id FK into food_entries(id)
--     ON DELETE CASCADE (added by the same migration). water_intake_entries
--     is NOT dropped -- CASCADE below drops only this FK constraint from it,
--     leaving food_entry_id as an orphaned nullable column.
--   - public.openfoodfacts_sync_queue.food_id (its PRIMARY KEY) FK into
--     foods(id) ON DELETE CASCADE (added by 20260901103000_add_openfoodfacts_
--     automatic_sync.sql). openfoodfacts_sync_queue is NOT dropped (it keeps
--     its own create_owner_policy in rls_policies.sql, unrelated to this
--     restructure) -- CASCADE below drops only this FK constraint, leaving
--     food_id in place as an orphaned (still-PK, no-longer-enforced) column.
--
-- Note: `food_data_providers` (named in some planning notes) does not exist
-- under that name -- it was renamed to `external_data_providers` back in
-- 20250712163617_refactor_data_providers_and_add_exercise_source_id.sql, and
-- that table is shared reference-integration config (Garmin/Strava/Withings/
-- Oura/etc.), not food-specific, so it is correctly left untouched here.

-- =============================================================================
-- 1. Cycle / pregnancy / TTC suite.
-- =============================================================================
DROP TABLE IF EXISTS public.cycle_test_entries CASCADE;
DROP TABLE IF EXISTS public.user_cycle_display_preferences CASCADE;
DROP TABLE IF EXISTS public.cycle_daily_entries CASCADE;
DROP TABLE IF EXISTS public.cycles CASCADE;
DROP TABLE IF EXISTS public.cycle_settings CASCADE;
DROP TABLE IF EXISTS public.health_appointments CASCADE;
DROP TABLE IF EXISTS public.pregnancy_checklist_state CASCADE;
DROP TABLE IF EXISTS public.pregnancy_photos CASCADE;
DROP TABLE IF EXISTS public.pregnancy_contractions CASCADE;
DROP TABLE IF EXISTS public.pregnancy_kick_sessions CASCADE;
DROP TABLE IF EXISTS public.pregnancies CASCADE;

-- =============================================================================
-- 2. Clinical medication tables (GLP-1 titration/injection/symptom tracking).
--    Trimmed, not dropped: `medications`, `medication_schedules`,
--    `medication_entries`, `user_medication_display_preferences` -- these back
--    the surviving "Daily Protocols & Supplements" slice.
-- =============================================================================
DROP TABLE IF EXISTS public.symptom_entries CASCADE;
DROP TABLE IF EXISTS public.user_custom_symptom_locations CASCADE;
DROP TABLE IF EXISTS public.user_custom_symptoms CASCADE;
DROP TABLE IF EXISTS public.injection_entries CASCADE;
DROP TABLE IF EXISTS public.medication_titration_steps CASCADE;
DROP TABLE IF EXISTS public.medication_pens CASCADE;

-- =============================================================================
-- 3. Trim `medications` to the dosing/schedule/supplement surface.
--    Columns confirmed against their defining CREATE TABLE in
--    20260624000000_add_medication_glp1_schema.sql (lines 82-111: prescriber
--    TEXT, pharmacy TEXT, rx_number TEXT, effectiveness_rating SMALLINT,
--    photo_path TEXT, is_glp1 BOOLEAN NOT NULL DEFAULT FALSE) -- no later
--    migration renames or retypes any of them. Kept untouched: dosing/schedule
--    columns, is_supplement + nutrients (added by
--    20260710000000_add_supplement_nutrients_to_medications.sql), and every
--    other column. The partial index idx_medications_is_glp1
--    (user_id, is_glp1) WHERE is_glp1 is defined ON is_glp1 and is dropped
--    automatically by Postgres along with the column -- no separate DROP INDEX
--    needed.
-- =============================================================================
ALTER TABLE public.medications
  DROP COLUMN IF EXISTS prescriber,
  DROP COLUMN IF EXISTS pharmacy,
  DROP COLUMN IF EXISTS rx_number,
  DROP COLUMN IF EXISTS is_glp1,
  DROP COLUMN IF EXISTS effectiveness_rating,
  DROP COLUMN IF EXISTS photo_path;

-- =============================================================================
-- 4. Food / nutrition / goals cluster.
--    CASCADE here also drops the three user_water_containers FK constraints
--    and the one water_intake_entries FK constraint documented above -- both
--    surviving tables, neither of which is touched otherwise.
-- =============================================================================
DROP TABLE IF EXISTS public.meal_plan_template_assignments CASCADE;
DROP TABLE IF EXISTS public.meal_plan_templates CASCADE;
DROP TABLE IF EXISTS public.meal_plans CASCADE;
DROP TABLE IF EXISTS public.meal_foods CASCADE;
DROP TABLE IF EXISTS public.food_entry_meals CASCADE;
DROP TABLE IF EXISTS public.food_favorites CASCADE;
DROP TABLE IF EXISTS public.food_entries CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.meal_types CASCADE;
DROP TABLE IF EXISTS public.food_variants CASCADE;
DROP TABLE IF EXISTS public.foods CASCADE;
DROP TABLE IF EXISTS public.user_meal_visibilities CASCADE;
DROP TABLE IF EXISTS public.user_custom_nutrients CASCADE;
DROP TABLE IF EXISTS public.user_nutrient_display_preferences CASCADE;
DROP TABLE IF EXISTS public.user_nutrient_goal_preferences CASCADE;
DROP TABLE IF EXISTS public.user_allergen_preferences CASCADE;
DROP TABLE IF EXISTS public.weekly_goal_plans CASCADE;
DROP TABLE IF EXISTS public.goal_presets CASCADE;
DROP TABLE IF EXISTS public.user_goals CASCADE;
